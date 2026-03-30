import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { Entity, EntityType, EntityHistoryEntry } from '../../shared/types'

interface RawEntityRow {
  id: string
  type: string
  name: string
  status: string
  tags: string
  description: string
  notes: string
  created_at: number
  updated_at: number
}

function parseEntityRow(row: RawEntityRow): Entity {
  return {
    id: row.id,
    type: row.type as EntityType,
    name: row.name,
    status: row.status as Entity['status'],
    tags: JSON.parse(row.tags || '[]'),
    description: row.description,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function getAllEntities(db: Database.Database, type: EntityType): Entity[] {
  const rows = db
    .prepare('SELECT * FROM entities WHERE type = ? ORDER BY name ASC')
    .all(type) as RawEntityRow[]
  return rows.map(parseEntityRow)
}

export function getEntityById(db: Database.Database, id: string): Entity | null {
  const row = db
    .prepare('SELECT * FROM entities WHERE id = ?')
    .get(id) as RawEntityRow | undefined
  if (!row) return null
  return parseEntityRow(row)
}

export function createEntity(db: Database.Database, type: EntityType): Entity {
  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO entities (id, type, name, status, tags, description, notes, created_at, updated_at)
    VALUES (?, ?, '', 'unknown', '[]', '', ?, ?, ?)
  `).run(id, type, '', now, now)
  return getEntityById(db, id)!
}

export function updateEntity(
  db: Database.Database,
  id: string,
  changes: Record<string, unknown>
): Entity {
  const existing = getEntityById(db, id)
  if (!existing) {
    throw new Error(`Entity not found: ${id}`)
  }

  const update = db.transaction(() => {
    const now = Math.floor(Date.now() / 1000)

    // Normalize changes for comparison
    const normalizedChanges: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(changes)) {
      if (field === 'tags' && Array.isArray(value)) {
        normalizedChanges[field] = value
      } else {
        normalizedChanges[field] = value
      }
    }

    // Record history entries for changed fields
    const insertHistory = db.prepare(`
      INSERT INTO entity_history (entity_id, field, old_value, new_value, reason, source, created_at)
      VALUES (?, ?, ?, ?, NULL, 'manual_edit', ?)
    `)

    for (const [field, newValue] of Object.entries(normalizedChanges)) {
      const oldValue = (existing as Record<string, unknown>)[field]

      // Serialize for comparison and storage
      const oldStr = Array.isArray(oldValue) ? JSON.stringify(oldValue) : String(oldValue ?? '')
      const newStr = Array.isArray(newValue) ? JSON.stringify(newValue) : String(newValue ?? '')

      if (oldStr !== newStr) {
        insertHistory.run(id, field, oldStr, newStr, now)
      }
    }

    // Build the UPDATE statement
    const setClauses: string[] = ['updated_at = ?']
    const values: unknown[] = [now]

    for (const [field, value] of Object.entries(normalizedChanges)) {
      setClauses.push(`${field} = ?`)
      if (field === 'tags' && Array.isArray(value)) {
        values.push(JSON.stringify(value))
      } else {
        values.push(value)
      }
    }
    values.push(id)

    db.prepare(`UPDATE entities SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)
  })

  update()
  return getEntityById(db, id)!
}

export function deleteEntity(db: Database.Database, id: string): { ok: boolean } {
  const result = db.prepare('DELETE FROM entities WHERE id = ?').run(id)
  return { ok: result.changes > 0 }
}

export function getEntityHistory(
  db: Database.Database,
  entityId: string
): EntityHistoryEntry[] {
  return db
    .prepare(
      'SELECT * FROM entity_history WHERE entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 50'
    )
    .all(entityId) as EntityHistoryEntry[]
}
