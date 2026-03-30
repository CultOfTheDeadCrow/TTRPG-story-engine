import { useState, useRef, useEffect } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@renderer/components/ui/resizable'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { WarningBanner } from './WarningBanner'
import { ContextSelector } from './ContextSelector'
import { DiffReview } from './DiffReview'
import { useGeneration } from '../hooks/useGeneration'
import type { Entity } from '../../../../shared/types'

interface StoryGeneratorProps {
  apiKeyConfigured: boolean
  onEntityListRefresh: () => void
  draftId?: string | null
}

export function StoryGenerator({ apiKeyConfigured, onEntityListRefresh, draftId }: StoryGeneratorProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState('')
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null)
  const [draftMode, setDraftMode] = useState(false)
  const { storyText, proposedUpdates, isGenerating, error, generate, cancel, reset, loadDraft } = useGeneration()
  const outputRef = useRef<HTMLDivElement>(null)

  // Auto-scroll during streaming (D-05)
  useEffect(() => {
    if (isGenerating && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [storyText, isGenerating])

  // Load draft when draftId changes (D-15)
  useEffect(() => {
    if (draftId) {
      window.electronAPI.stories.getById(draftId).then(draft => {
        if (draft && draft.status === 'draft') {
          setDraftMode(true)
          setPrompt(draft.prompt)
          setSavedStoryId(draft.id)
          loadDraft(draft.story_text, draft.proposed_updates)
          // Pre-check all updates from the saved draft
          const initial: Record<string, boolean> = {}
          for (const u of draft.proposed_updates) {
            initial[`${u.entity_id}:${u.field}`] = true
          }
          setAccepted(initial)
        }
      }).catch(console.error)
    } else {
      setDraftMode(false)
    }
  }, [draftId, loadDraft])

  // Initialize accepted state when proposed updates arrive (from streaming)
  useEffect(() => {
    if (!draftMode && proposedUpdates.length > 0) {
      const initial: Record<string, boolean> = {}
      for (const u of proposedUpdates) {
        initial[`${u.entity_id}:${u.field}`] = true
      }
      setAccepted(initial)
    }
  }, [proposedUpdates, draftMode])

  async function handleGenerate(): Promise<void> {
    // Build entity context: fetch full data for selected entities
    const entityTypes = ['character', 'location', 'event'] as const
    const allEntities: Entity[] = []
    for (const type of entityTypes) {
      const entities = await window.electronAPI.entities.getAll(type)
      allEntities.push(...entities)
    }
    const selected = selectedIds.size > 0
      ? allEntities.filter(e => selectedIds.has(e.id))
      : allEntities  // D-03: defaults to all if none explicitly deselected
    const entityContext = JSON.stringify(selected.map(e => ({
      id: e.id, type: e.type, name: e.name, status: e.status,
      tags: e.tags, description: e.description,
    })), null, 2)
    setSavedStoryId(null)
    await generate(entityContext, prompt)
  }

  async function handleSaveDraft(): Promise<void> {
    const story = await window.electronAPI.stories.saveDraft({
      prompt,
      storyText,
      contextEntityIds: [...selectedIds],
      proposedUpdates,
    })
    setSavedStoryId(story.id)
  }

  async function handleApply(): Promise<void> {
    // Save as draft first if not already saved, then apply
    let storyId = savedStoryId
    if (!storyId) {
      const story = await window.electronAPI.stories.saveDraft({
        prompt,
        storyText,
        contextEntityIds: [...selectedIds],
        proposedUpdates,
      })
      storyId = story.id
    }
    const checkedUpdates = proposedUpdates.filter(u => accepted[`${u.entity_id}:${u.field}`] !== false)
    await window.electronAPI.stories.applyStory(storyId, checkedUpdates)
    onEntityListRefresh()
    // Reset for new generation
    reset()
    setPrompt('')
    setAccepted({})
    setSavedStoryId(null)
    setDraftMode(false)
  }

  async function handleDiscardDraft(): Promise<void> {
    if (savedStoryId) {
      await window.electronAPI.stories.discardDraft(savedStoryId)
    }
    reset()
    setPrompt('')
    setAccepted({})
    setSavedStoryId(null)
    setDraftMode(false)
  }

  const hasOutput = storyText.length > 0 || proposedUpdates.length > 0
  const acceptedCount = Object.values(accepted).filter(Boolean).length
  const canGenerate = apiKeyConfigured && prompt.trim().length > 0 && !isGenerating

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left column: Context Selector */}
      <ResizablePanel defaultSize="25%" minSize="15%" maxSize="45%">
        <ContextSelector selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right column: scrollable */}
      <ResizablePanel defaultSize="75%" minSize="55%">
        <div ref={outputRef} className="h-full w-full overflow-y-auto p-4 space-y-4 min-w-0">
          {!apiKeyConfigured && <WarningBanner />}

          {/* Prompt input (STORY-02) */}
          <div className="space-y-2">
            <Textarea
              placeholder="What happened in this session? (German and English accepted)"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="min-h-[120px] resize-y"
              disabled={isGenerating || draftMode}
            />
            {!draftMode && (
              <div className="flex gap-2">
                <Button onClick={() => void handleGenerate()} disabled={!canGenerate}>
                  Generate
                </Button>
                {isGenerating && (
                  <Button variant="destructive" onClick={cancel}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Story output (D-05: streaming text; D-15: read-only in draft mode) */}
          {(storyText || isGenerating) && (
            <div className="space-y-2">
              {draftMode && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Draft</Badge>
                  <span className="text-xs text-muted-foreground">Story text from saved draft (read-only)</span>
                </div>
              )}
              {isGenerating && !storyText && (
                <p className="text-sm text-muted-foreground animate-pulse">Generating...</p>
              )}
              {storyText && (
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {storyText}
                </div>
              )}
            </div>
          )}

          {/* Proposed updates (D-08, D-15) */}
          {!isGenerating && proposedUpdates.length > 0 && (
            <DiffReview
              updates={proposedUpdates}
              accepted={accepted}
              onAcceptedChange={setAccepted}
            />
          )}

          {/* Action buttons — shown whenever there is output */}
          {!isGenerating && hasOutput && (
            <div className="flex gap-2 pt-2">
              {proposedUpdates.length > 0 && (
                <Button onClick={() => void handleApply()} disabled={acceptedCount === 0}>
                  Apply Selected ({acceptedCount})
                </Button>
              )}
              {draftMode ? (
                <Button variant="destructive" onClick={() => void handleDiscardDraft()}>
                  Discard Draft
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void handleSaveDraft()}>
                  Save Draft
                </Button>
              )}
            </div>
          )}

          {/* No output empty state */}
          {!hasOutput && !isGenerating && !error && (
            <p className="text-sm text-muted-foreground">
              Write a prompt and click Generate to create a story.
            </p>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
