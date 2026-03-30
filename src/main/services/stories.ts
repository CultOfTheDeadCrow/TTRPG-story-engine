import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { StoryRecord, ProposedUpdate } from '../../shared/types'
import { getEntityById } from './entities'

interface RawStoryRow {
  id: string
  prompt: string
  story_text: string
  context_entity_ids: string
  proposed_updates: string
  status: string
  created_at: number
  applied_at: number | null
}

function parseStoryRow(row: RawStoryRow): StoryRecord {
  return {
    id: row.id,
    prompt: row.prompt,
    story_text: row.story_text,
    context_entity_ids: JSON.parse(row.context_entity_ids),
    proposed_updates: JSON.parse(row.proposed_updates),
    status: row.status as StoryRecord['status'],
    created_at: row.created_at,
    applied_at: row.applied_at,
  }
}

export function saveDraft(
  db: Database.Database,
  params: {
    prompt: string
    storyText: string
    contextEntityIds: string[]
    proposedUpdates: ProposedUpdate[]
  }
): StoryRecord {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO stories (id, prompt, story_text, context_entity_ids, proposed_updates, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?)
  `).run(
    id,
    params.prompt,
    params.storyText,
    JSON.stringify(params.contextEntityIds),
    JSON.stringify(params.proposedUpdates),
    now
  )
  return getStoryById(db, id)!
}

export function getDrafts(db: Database.Database): StoryRecord[] {
  const rows = db
    .prepare("SELECT * FROM stories WHERE status = 'draft' ORDER BY created_at DESC")
    .all() as RawStoryRow[]
  return rows.map(parseStoryRow)
}

export function getAllAppliedStories(db: Database.Database): StoryRecord[] {
  const rows = db
    .prepare("SELECT * FROM stories WHERE status = 'applied' ORDER BY created_at DESC")
    .all() as RawStoryRow[]
  return rows.map(parseStoryRow)
}

export function getStoryById(db: Database.Database, id: string): StoryRecord | null {
  const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as RawStoryRow | undefined
  if (!row) return null
  return parseStoryRow(row)
}

export function discardDraft(db: Database.Database, id: string): { ok: boolean } {
  const result = db.prepare("DELETE FROM stories WHERE id = ? AND status = 'draft'").run(id)
  return { ok: result.changes > 0 }
}

export function applyStory(
  db: Database.Database,
  storyId: string,
  checkedUpdates: ProposedUpdate[]
): void {
  const story = getStoryById(db, storyId)
  if (!story) throw new Error(`Story not found: ${storyId}`)

  const insertHistory = db.prepare(`
    INSERT INTO entity_history (entity_id, field, old_value, new_value, reason, source, created_at)
    VALUES (?, ?, ?, ?, ?, 'story_generation', ?)
  `)

  db.transaction(() => {
    const now = Math.floor(Date.now() / 1000)

    for (const update of checkedUpdates) {
      const entity = getEntityById(db, update.entity_id)
      if (!entity) throw new Error(`Entity not found: ${update.entity_id}`)

      // Capture old value before writing
      const oldValue = (entity as Record<string, unknown>)[update.field]
      const oldStr = Array.isArray(oldValue) ? JSON.stringify(oldValue) : String(oldValue ?? '')

      // Determine DB value for tags field (ensure valid JSON array)
      let dbValue: string = update.new_value
      if (update.field === 'tags') {
        try {
          JSON.parse(update.new_value)
        } catch {
          dbValue = JSON.stringify([update.new_value])
        }
      }

      // Update entity field — column name is from structured AI output, same pattern as updateEntity()
      db.prepare(`UPDATE entities SET ${update.field} = ?, updated_at = ? WHERE id = ?`)
        .run(dbValue, now, update.entity_id)

      // Insert history entry with source='story_generation' and reason
      insertHistory.run(
        update.entity_id,
        update.field,
        oldStr,
        update.new_value,
        update.reason,
        now
      )
    }

    // Update story status to applied
    db.prepare("UPDATE stories SET status = 'applied', applied_at = ? WHERE id = ?")
      .run(now, storyId)
  })()
}
