import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream'
import { getDatabase } from '../database'
import { getAllEntities } from './entities'
import type { EntityType } from '../../shared/types'

const CLAUDE_MODEL = 'claude-sonnet-4-5'
const SESSION_MAX_TOKENS = 8192

const SESSION_TOOL = {
  name: 'analyze_session_updates',
  description: 'After writing the session analysis, call this tool with proposed entity updates, new entity creations, and any contradictions found.',
  input_schema: {
    type: 'object' as const,
    properties: {
      entity_updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entity_id:          { type: 'string', description: 'UUID of the existing entity to update' },
            entity_name:        { type: 'string' },
            entity_type:        { type: 'string', description: 'character, location, or event' },
            field:              { type: 'string', description: 'The field to update: status, tags, description, or notes' },
            new_value:          { type: 'string' },
            reason:             { type: 'string', description: 'Why this change is proposed, citing the session notes' },
            contradiction_note: { type: 'string', description: 'Present only if this update contradicts the current entity state. Explain what the current state says vs what the notes say.' },
          },
          required: ['entity_id', 'entity_name', 'entity_type', 'field', 'new_value', 'reason'],
        },
      },
      new_entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entity_name: { type: 'string' },
            entity_type: { type: 'string', description: 'character, location, or event' },
            status:      { type: 'string' },
            tags:        { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
            reason:      { type: 'string', description: 'Why this entity should be created, citing the session notes' },
          },
          required: ['entity_name', 'entity_type', 'reason'],
        },
      },
    },
    required: ['entity_updates', 'new_entities'],
  },
}

const activeNoteStreams = new Map<string, { stream: MessageStream; aborted: boolean }>()

function buildSessionSystemPrompt(entityContext: string): string {
  return `You are a Shadowrun tabletop RPG Game Master assistant. The GM has just completed a session and is importing their session notes to update the campaign knowledge base.

## Current Knowledge Base
${entityContext}

## Instructions
1. Write an analysis of the session notes. Summarize what happened, who was involved, and what consequences arise for the campaign. Use short paragraphs or bullet points. Keep it practical and useful for the GM.
2. After the analysis, call the analyze_session_updates tool with:
   - entity_updates: For each known entity whose state changed based on the notes, propose a targeted field update. Cite the specific passage from the notes in the "reason" field. If the proposed change contradicts the entity's current state, include a "contradiction_note" explaining the discrepancy.
   - new_entities: For each named character, location, or event mentioned in the notes that does NOT exist in the knowledge base, propose creating a new entity with appropriate fields.
3. The GM writes in both German and English. Respond in the same language as the notes.
4. Do NOT include the proposed updates in the analysis text itself — they go in the tool call only.`
}

export function registerNotesHandlers(getApiKeyFn: () => string | null): void {
  ipcMain.handle(
    'notes:startImport',
    async (event, payload: { notes: string }) => {
      const apiKey = getApiKeyFn()
      if (!apiKey) return { error: 'No API key configured' }

      const requestId = randomUUID()
      const client = new Anthropic({ apiKey })

      // Fetch ALL entities (full KB — no selection step per D-04)
      const db = getDatabase()
      const entityTypes: EntityType[] = ['character', 'location', 'event']
      const allEntities = entityTypes.flatMap(type => getAllEntities(db, type))
      const entityContext = JSON.stringify(allEntities.map(e => ({
        id: e.id, type: e.type, name: e.name, status: e.status,
        tags: e.tags, description: e.description,
      })), null, 2)

      console.log(`[notes] Starting import analysis against ${allEntities.length} entities`)

      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: SESSION_MAX_TOKENS,
        system: buildSessionSystemPrompt(entityContext),
        tools: [SESSION_TOOL],
        messages: [{ role: 'user', content: payload.notes }],
      })

      activeNoteStreams.set(requestId, { stream, aborted: false })

      stream.on('text', (delta) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('notes:chunk', { requestId, text: delta })
        }
      })

      stream.on('finalMessage', (message) => {
        activeNoteStreams.delete(requestId)
        if (event.sender.isDestroyed()) return

        const toolBlock = message.content.find((b) => b.type === 'tool_use')
        const toolInput = toolBlock?.type === 'tool_use'
          ? (toolBlock.input as { entity_updates?: unknown[]; new_entities?: unknown[] })
          : { entity_updates: [], new_entities: [] }

        const entityUpdates = (toolInput.entity_updates ?? []).map((u: Record<string, unknown>) => ({
          entity_id: String(u.entity_id ?? ''),
          entity_name: String(u.entity_name ?? ''),
          entity_type: String(u.entity_type ?? ''),
          field: String(u.field ?? ''),
          new_value: String(u.new_value ?? ''),
          reason: String(u.reason ?? ''),
          ...(u.contradiction_note ? { contradictionNote: String(u.contradiction_note) } : {}),
        }))

        const newEntities = (toolInput.new_entities ?? []).map((ne: Record<string, unknown>, index: number) => ({
          tempKey: `new:${index}`,
          entity_name: String(ne.entity_name ?? ''),
          entity_type: String(ne.entity_type ?? ''),
          status: ne.status ? String(ne.status) : undefined,
          tags: Array.isArray(ne.tags) ? ne.tags.map(String) : undefined,
          description: ne.description ? String(ne.description) : undefined,
          reason: String(ne.reason ?? ''),
        }))

        const analysisText = message.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('')

        event.sender.send('notes:done', {
          requestId,
          analysisText,
          entityUpdates,
          newEntities,
          entityCount: allEntities.length,
        })
      })

      stream.on('error', (err) => {
        activeNoteStreams.delete(requestId)
        if (!event.sender.isDestroyed()) {
          event.sender.send('notes:error', { requestId, message: String(err) })
        }
      })

      stream.on('abort', () => {
        activeNoteStreams.delete(requestId)
        if (!event.sender.isDestroyed()) {
          event.sender.send('notes:cancelled', { requestId })
        }
      })

      return { requestId, entityCount: allEntities.length }
    }
  )

  ipcMain.handle('notes:cancelImport', (_event, requestId: string) => {
    const entry = activeNoteStreams.get(requestId)
    if (entry) {
      entry.stream.abort()
      entry.aborted = true
      activeNoteStreams.delete(requestId)
    }
    return { ok: true }
  })
}
