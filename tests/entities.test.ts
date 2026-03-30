import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/db'
import {
  getAllEntities,
  getEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntityHistory,
} from '../src/main/services/entities'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

describe('createEntity', () => {
  it('creates a character entity with correct defaults', () => {
    const entity = createEntity(db, 'character')
    expect(entity.id).toBeTruthy()
    expect(entity.type).toBe('character')
    expect(entity.name).toBe('')
    expect(entity.status).toBe('unknown')
    expect(entity.tags).toEqual([])
    expect(entity.description).toBe('')
    expect(entity.notes).toBe('')
    expect(typeof entity.created_at).toBe('number')
    expect(typeof entity.updated_at).toBe('number')
  })

  it('creates a location entity with correct type', () => {
    const entity = createEntity(db, 'location')
    expect(entity.type).toBe('location')
  })

  it('creates an event entity with correct type', () => {
    const entity = createEntity(db, 'event')
    expect(entity.type).toBe('event')
  })
})

describe('getAllEntities', () => {
  it('returns only entities of the requested type, sorted by name ASC', () => {
    const char1 = createEntity(db, 'character')
    const char2 = createEntity(db, 'character')
    const loc = createEntity(db, 'location')

    updateEntity(db, char1.id, { name: 'Zebra' })
    updateEntity(db, char2.id, { name: 'Alpha' })

    const characters = getAllEntities(db, 'character')
    expect(characters.length).toBe(2)
    expect(characters[0].name).toBe('Alpha')
    expect(characters[1].name).toBe('Zebra')

    const locations = getAllEntities(db, 'location')
    expect(locations.length).toBe(1)
    expect(locations[0].id).toBe(loc.id)
  })
})

describe('getEntityById', () => {
  it('returns the entity with parsed tags array', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { tags: ['tag1', 'tag2'] })
    const fetched = getEntityById(db, entity.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.tags).toEqual(['tag1', 'tag2'])
  })

  it('returns null for non-existent entity', () => {
    const result = getEntityById(db, 'nonexistent-id')
    expect(result).toBeNull()
  })
})

describe('updateEntity', () => {
  it('returns updated entity and creates history entries for changed fields', () => {
    const entity = createEntity(db, 'character')
    const updated = updateEntity(db, entity.id, { name: 'Test', status: 'active' })

    expect(updated.name).toBe('Test')
    expect(updated.status).toBe('active')

    const history = getEntityHistory(db, entity.id)
    // 2 history entries — one for name, one for status
    expect(history.length).toBe(2)
    const fields = history.map(h => h.field)
    expect(fields).toContain('name')
    expect(fields).toContain('status')
  })

  it('does NOT create history entries for unchanged fields', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Test' })
    // Only name changed, not status or others
    const history = getEntityHistory(db, entity.id)
    expect(history.length).toBe(1)
    expect(history[0].field).toBe('name')
  })
})

describe('deleteEntity', () => {
  it('returns { ok: true } and entity is gone', () => {
    const entity = createEntity(db, 'character')
    const result = deleteEntity(db, entity.id)
    expect(result.ok).toBe(true)
    expect(getEntityById(db, entity.id)).toBeNull()
  })

  it('cascades deletion to history entries', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Test' })
    const historyBefore = getEntityHistory(db, entity.id)
    expect(historyBefore.length).toBe(1)

    deleteEntity(db, entity.id)
    // After delete, history should be gone (CASCADE)
    const historyAfter = getEntityHistory(db, entity.id)
    expect(historyAfter.length).toBe(0)
  })
})

describe('getEntityHistory', () => {
  it('returns entries in DESC created_at order', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'First' })
    updateEntity(db, entity.id, { name: 'Second' })

    const history = getEntityHistory(db, entity.id)
    // Most recent first
    expect(history.length).toBe(2)
    expect(history[0].new_value).toBe('Second')
    expect(history[1].new_value).toBe('First')
  })

  it('returns empty array for entity with no history', () => {
    const entity = createEntity(db, 'character')
    const history = getEntityHistory(db, entity.id)
    expect(history).toEqual([])
  })
})
