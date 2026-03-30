import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream'

const CLAUDE_MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 4096

const STORY_TOOL = {
  name: 'generate_story_updates',
  description:
    'After writing the story narrative, call this tool with any proposed entity updates that result from the story events.',
  input_schema: {
    type: 'object' as const,
    properties: {
      proposed_updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'The UUID of the entity to update' },
            entity_name: { type: 'string', description: 'The name of the entity' },
            entity_type: { type: 'string', description: 'character, location, or event' },
            field: {
              type: 'string',
              description: 'The field to update: status, tags, description, or notes',
            },
            new_value: { type: 'string', description: 'The new value for the field' },
            reason: {
              type: 'string',
              description: 'Why this change is proposed, citing story events',
            },
          },
          required: ['entity_id', 'entity_name', 'entity_type', 'field', 'new_value', 'reason'],
        },
      },
    },
    required: ['proposed_updates'],
  },
}

function buildSystemPrompt(entityContext: string): string {
  return `You are a Shadowrun tabletop RPG Game Master assistant. You help the GM capture what happened in a session and what it means for the campaign going forward.

## Current Knowledge Base
${entityContext}

## Instructions
1. Write structured GM session notes in response to the GM's prompt. Do NOT write narrative fiction or prose. Write practical notes a GM would use: what happened, who was involved, key outcomes, consequences, open threads, and anything worth tracking. Use short paragraphs or bullet points. Keep it factual and useful.
2. After the notes, call the generate_story_updates tool with any entity updates that result from the events. Only propose updates for entities whose state genuinely changed (e.g., a character died, a location was destroyed, an event resolved).
3. For each proposed update, cite the specific event that justifies the change in the "reason" field.
4. The GM writes in both German and English. Respond in the same language as the prompt.
5. Do NOT include the proposed updates in the notes text itself.`
}

const activeStreams = new Map<string, { stream: MessageStream; aborted: boolean }>()

export function registerAiHandlers(getApiKeyFn: () => string | null): void {
  ipcMain.handle(
    'ai:startGeneration',
    async (event, payload: { entityContext: string; userPrompt: string }) => {
      const apiKey = getApiKeyFn()
      if (!apiKey) return { error: 'No API key configured' }

      const requestId = randomUUID()
      const client = new Anthropic({ apiKey })

      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(payload.entityContext),
        tools: [STORY_TOOL],
        messages: [{ role: 'user', content: payload.userPrompt }],
      })

      activeStreams.set(requestId, { stream, aborted: false })

      stream.on('text', (delta) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', { requestId, text: delta })
        }
      })

      stream.on('finalMessage', (message) => {
        activeStreams.delete(requestId)
        if (event.sender.isDestroyed()) return
        const toolBlock = message.content.find((b) => b.type === 'tool_use')
        const proposedUpdates =
          (toolBlock?.type === 'tool_use'
            ? (toolBlock.input as { proposed_updates: unknown[] }).proposed_updates
            : []) ?? []
        event.sender.send('ai:done', {
          requestId,
          storyText: message.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join(''),
          proposedUpdates,
        })
      })

      stream.on('error', (err) => {
        activeStreams.delete(requestId)
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:error', { requestId, message: String(err) })
        }
      })

      stream.on('abort', () => {
        activeStreams.delete(requestId)
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:cancelled', { requestId })
        }
      })

      return { requestId }
    }
  )

  ipcMain.handle('ai:cancelGeneration', (_event, requestId: string) => {
    const entry = activeStreams.get(requestId)
    if (entry) {
      entry.stream.abort()
      entry.aborted = true
      activeStreams.delete(requestId)
    }
    return { ok: true }
  })
}
