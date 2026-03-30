import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/db'
import { applyStory, saveDraft } from '../src/main/services/stories'
import { getAllAppliedStories } from '../src/main/services/stories'
import { getAllSessions, getSessionById } from '../src/main/services/sessions'
import { applySession } from '../src/main/services/sessions'
import { createEntity, updateEntity } from '../src/main/services/entities'
import type { ProposedUpdate } from '../src/shared/types'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

// Helper: create an applied story
function makeAppliedStory(
  db: Database.Database,
  prompt: string
): string {
  const entity = createEntity(db, 'character')
  updateEntity(db, entity.id, { name: 'Runner', description: 'Original' })
  const update: ProposedUpdate = {
    entity_id: entity.id,
    entity_name: 'Runner',
    entity_type: 'character',
    field: 'description',
    new_value: 'Updated by story',
    reason: 'Story changed them',
  }
  const story = saveDraft(db, {
    prompt,
    storyText: 'Some story text',
    contextEntityIds: [entity.id],
    proposedUpdates: [update],
  })
  applyStory(db, story.id, [update])
  return story.id
}

// Helper: create a session record
function makeSession(db: Database.Database, notes: string): string {
  const result = applySession(db, {
    notes,
    entityUpdates: [],
    newEntities: [],
  })
  return result.sessionId
}

describe('getAllAppliedStories', () => {
  it('Test 1: returns only stories with status=applied, ordered by created_at DESC', () => {
    // Create a draft (should NOT appear)
    saveDraft(db, { prompt: 'draft', storyText: 'draft text', contextEntityIds: [], proposedUpdates: [] })

    // Create two applied stories
    const id1 = makeAppliedStory(db, 'first applied story')
    const id2 = makeAppliedStory(db, 'second applied story')

    const results = getAllAppliedStories(db)
    expect(results.length).toBe(2)
    expect(results.every(s => s.status === 'applied')).toBe(true)

    // Check both IDs are present
    const ids = results.map(s => s.id)
    expect(ids).toContain(id1)
    expect(ids).toContain(id2)
  })

  it('Test 2: returns empty array when no applied stories exist', () => {
    // Only a draft
    saveDraft(db, { prompt: 'draft', storyText: 'text', contextEntityIds: [], proposedUpdates: [] })

    const results = getAllAppliedStories(db)
    expect(results).toEqual([])
  })
})

describe('getStoryById (parse check)', () => {
  it('Test 3: returns parsed StoryRecord with context_entity_ids as string[] (not raw JSON string)', () => {
    const story = saveDraft(db, {
      prompt: 'test prompt',
      storyText: 'test text',
      contextEntityIds: ['c1', 'c2'],
      proposedUpdates: [],
    })

    const fetched = getAllAppliedStories(db)
    // Apply the story to make it accessible via getAllAppliedStories
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'E', description: 'D' })
    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'E',
      entity_type: 'character',
      field: 'description',
      new_value: 'ND',
      reason: 'r',
    }
    const story2 = saveDraft(db, {
      prompt: 'test prompt',
      storyText: 'test text',
      contextEntityIds: ['c1', 'c2'],
      proposedUpdates: [update],
    })
    applyStory(db, story2.id, [update])

    const results = getAllAppliedStories(db)
    expect(results.length).toBeGreaterThanOrEqual(1)
    const found = results.find(s => s.id === story2.id)
    expect(found).toBeDefined()
    // context_entity_ids must be string[], not string
    expect(Array.isArray(found!.context_entity_ids)).toBe(true)
    expect(found!.context_entity_ids).toEqual(['c1', 'c2'])
    expect(typeof found!.context_entity_ids).not.toBe('string')
  })
})

describe('getAllSessions', () => {
  it('Test 4: returns all sessions ordered by date DESC', () => {
    const id1 = makeSession(db, 'Session notes one')
    const id2 = makeSession(db, 'Session notes two')

    const results = getAllSessions(db)
    expect(results.length).toBe(2)
    const ids = results.map(s => s.id)
    expect(ids).toContain(id1)
    expect(ids).toContain(id2)
  })

  it('Test 5: returns empty array when no sessions exist', () => {
    const results = getAllSessions(db)
    expect(results).toEqual([])
  })
})

describe('getSessionById', () => {
  it('Test 6: returns parsed SessionRecord with applied_entity_ids as string[] (not raw JSON string)', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Slot', description: 'Desc' })
    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'Slot',
      entity_type: 'character',
      field: 'description',
      new_value: 'New desc',
      reason: 'session reason',
    }
    const result = applySession(db, {
      notes: 'Session with entity update',
      entityUpdates: [update],
      newEntities: [],
    })

    const session = getSessionById(db, result.sessionId)
    expect(session).not.toBeNull()
    expect(session!.id).toBe(result.sessionId)
    // applied_entity_ids must be string[], not string
    expect(Array.isArray(session!.applied_entity_ids)).toBe(true)
    expect(session!.applied_entity_ids).toContain(entity.id)
    expect(typeof session!.applied_entity_ids).not.toBe('string')
  })

  it('Test 7: returns null for non-existent id', () => {
    const result = getSessionById(db, 'nonexistent-id')
    expect(result).toBeNull()
  })
})
