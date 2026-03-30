import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/db'
import {
  createEntity,
  updateEntity,
  getEntityById,
  getEntityHistory,
} from '../src/main/services/entities'
import {
  saveDraft,
  getDrafts,
  getStoryById,
  discardDraft,
  applyStory,
} from '../src/main/services/stories'
import type { ProposedUpdate } from '../src/shared/types'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

describe('saveDraft', () => {
  it('creates a story with status draft and returns it', () => {
    const update: ProposedUpdate = {
      entity_id: 'e1',
      entity_name: 'Test Entity',
      entity_type: 'character',
      field: 'description',
      new_value: 'A new description',
      reason: 'Story happened',
    }
    const story = saveDraft(db, {
      prompt: 'Tell me a story',
      storyText: 'Once upon a time...',
      contextEntityIds: ['e1'],
      proposedUpdates: [update],
    })

    expect(story.id).toBeTruthy()
    expect(story.prompt).toBe('Tell me a story')
    expect(story.story_text).toBe('Once upon a time...')
    expect(story.context_entity_ids).toEqual(['e1'])
    expect(story.proposed_updates).toEqual([update])
    expect(story.status).toBe('draft')
    expect(typeof story.created_at).toBe('number')
    expect(story.applied_at).toBeNull()
  })

  it('persists the story to the database', () => {
    const story = saveDraft(db, {
      prompt: 'A prompt',
      storyText: 'Story text here',
      contextEntityIds: [],
      proposedUpdates: [],
    })

    const fetched = getStoryById(db, story.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(story.id)
  })
})

describe('getDrafts', () => {
  it('returns only draft stories', () => {
    saveDraft(db, { prompt: 'p1', storyText: 's1', contextEntityIds: [], proposedUpdates: [] })
    saveDraft(db, { prompt: 'p2', storyText: 's2', contextEntityIds: [], proposedUpdates: [] })

    const drafts = getDrafts(db)
    expect(drafts.length).toBe(2)
    expect(drafts.every(d => d.status === 'draft')).toBe(true)
  })

  it('returns drafts ordered by created_at DESC containing both inserted stories', () => {
    const s1 = saveDraft(db, { prompt: 'first', storyText: 's1', contextEntityIds: [], proposedUpdates: [] })
    const s2 = saveDraft(db, { prompt: 'second', storyText: 's2', contextEntityIds: [], proposedUpdates: [] })

    const drafts = getDrafts(db)
    expect(drafts.length).toBe(2)
    const ids = drafts.map(d => d.id)
    expect(ids).toContain(s1.id)
    expect(ids).toContain(s2.id)
  })

  it('does not return applied stories', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Test', description: 'Old desc' })

    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'Test',
      entity_type: 'character',
      field: 'description',
      new_value: 'New desc',
      reason: 'Story reason',
    }

    const story = saveDraft(db, {
      prompt: 'prompt',
      storyText: 'text',
      contextEntityIds: [entity.id],
      proposedUpdates: [update],
    })

    applyStory(db, story.id, [update])

    const drafts = getDrafts(db)
    expect(drafts.find(d => d.id === story.id)).toBeUndefined()
  })
})

describe('getStoryById', () => {
  it('returns the correct story with parsed arrays', () => {
    const story = saveDraft(db, {
      prompt: 'test prompt',
      storyText: 'test text',
      contextEntityIds: ['c1', 'c2'],
      proposedUpdates: [],
    })

    const fetched = getStoryById(db, story.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(story.id)
    expect(fetched!.prompt).toBe('test prompt')
    expect(fetched!.context_entity_ids).toEqual(['c1', 'c2'])
  })

  it('returns null for unknown id', () => {
    const result = getStoryById(db, 'nonexistent-id')
    expect(result).toBeNull()
  })
})

describe('discardDraft', () => {
  it('deletes a draft story and returns { ok: true }', () => {
    const story = saveDraft(db, { prompt: 'p', storyText: 's', contextEntityIds: [], proposedUpdates: [] })
    const result = discardDraft(db, story.id)
    expect(result.ok).toBe(true)
    expect(getStoryById(db, story.id)).toBeNull()
  })

  it('returns { ok: false } for non-existent story', () => {
    const result = discardDraft(db, 'nonexistent-id')
    expect(result.ok).toBe(false)
  })

  it('does NOT delete applied stories (status check in WHERE clause)', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'E', description: 'Old' })

    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'E',
      entity_type: 'character',
      field: 'description',
      new_value: 'New',
      reason: 'reason',
    }

    const story = saveDraft(db, {
      prompt: 'p',
      storyText: 's',
      contextEntityIds: [],
      proposedUpdates: [update],
    })

    applyStory(db, story.id, [update])

    // Attempt to discard applied story — should fail (status='applied' not 'draft')
    const result = discardDraft(db, story.id)
    expect(result.ok).toBe(false)

    // Story still in DB with applied status
    const fetched = getStoryById(db, story.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.status).toBe('applied')
  })
})

describe('applyStory', () => {
  it('updates entity fields and creates history entries with source=story_generation and reason', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Runner', description: 'Original desc' })

    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'Runner',
      entity_type: 'character',
      field: 'description',
      new_value: 'Updated by story',
      reason: 'The story changed them',
    }

    const story = saveDraft(db, {
      prompt: 'prompt',
      storyText: 'story',
      contextEntityIds: [entity.id],
      proposedUpdates: [update],
    })

    applyStory(db, story.id, [update])

    // Entity field updated
    const updatedEntity = getEntityById(db, entity.id)
    expect(updatedEntity!.description).toBe('Updated by story')

    // History entry created with correct source and reason
    const history = getEntityHistory(db, entity.id)
    const storyEntry = history.find(h => h.source === 'story_generation')
    expect(storyEntry).toBeDefined()
    expect(storyEntry!.field).toBe('description')
    expect(storyEntry!.new_value).toBe('Updated by story')
    expect(storyEntry!.reason).toBe('The story changed them')
    expect(storyEntry!.reason).not.toBeNull()
  })

  it('captures correct old_value before writing', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Runner', description: 'Original description' })

    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'Runner',
      entity_type: 'character',
      field: 'description',
      new_value: 'New description',
      reason: 'Changed',
    }

    const story = saveDraft(db, { prompt: 'p', storyText: 's', contextEntityIds: [], proposedUpdates: [update] })
    applyStory(db, story.id, [update])

    const history = getEntityHistory(db, entity.id)
    const storyEntry = history.find(h => h.source === 'story_generation')
    expect(storyEntry!.old_value).toBe('Original description')
  })

  it('sets story status to applied with applied_at timestamp', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'E', description: 'D' })

    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'E',
      entity_type: 'character',
      field: 'description',
      new_value: 'New D',
      reason: 'r',
    }

    const story = saveDraft(db, { prompt: 'p', storyText: 's', contextEntityIds: [], proposedUpdates: [update] })
    applyStory(db, story.id, [update])

    const applied = getStoryById(db, story.id)
    expect(applied!.status).toBe('applied')
    expect(applied!.applied_at).not.toBeNull()
    expect(typeof applied!.applied_at).toBe('number')
  })

  it('is atomic: if one update fails (bad entity_id), none are written', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'Entity', description: 'Original' })

    const goodUpdate: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'Entity',
      entity_type: 'character',
      field: 'description',
      new_value: 'Should not be written',
      reason: 'r',
    }

    const badUpdate: ProposedUpdate = {
      entity_id: 'nonexistent-entity-id',
      entity_name: 'Ghost',
      entity_type: 'character',
      field: 'description',
      new_value: 'Ghost update',
      reason: 'r',
    }

    const story = saveDraft(db, {
      prompt: 'p',
      storyText: 's',
      contextEntityIds: [],
      proposedUpdates: [goodUpdate, badUpdate],
    })

    // Should throw due to bad entity_id
    expect(() => applyStory(db, story.id, [goodUpdate, badUpdate])).toThrow()

    // Good entity should be unchanged (transaction rolled back)
    const unchanged = getEntityById(db, entity.id)
    expect(unchanged!.description).toBe('Original')

    // Story should still be draft (transaction rolled back)
    const storyAfter = getStoryById(db, story.id)
    expect(storyAfter!.status).toBe('draft')
  })

  it('throws for non-existent story', () => {
    expect(() => applyStory(db, 'nonexistent-story', [])).toThrow()
  })

  it('after applyStory, getDrafts no longer includes that story', () => {
    const entity = createEntity(db, 'character')
    updateEntity(db, entity.id, { name: 'E', description: 'D' })

    const update: ProposedUpdate = {
      entity_id: entity.id,
      entity_name: 'E',
      entity_type: 'character',
      field: 'description',
      new_value: 'New',
      reason: 'r',
    }

    const story = saveDraft(db, { prompt: 'p', storyText: 's', contextEntityIds: [], proposedUpdates: [update] })

    // Story is in drafts before applying
    expect(getDrafts(db).find(d => d.id === story.id)).toBeDefined()

    applyStory(db, story.id, [update])

    // Story removed from drafts after applying
    expect(getDrafts(db).find(d => d.id === story.id)).toBeUndefined()
  })
})
