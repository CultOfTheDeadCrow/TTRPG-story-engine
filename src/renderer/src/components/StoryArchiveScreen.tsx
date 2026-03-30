import { useState, useEffect } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@renderer/components/ui/resizable'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Alert, AlertDescription } from '@renderer/components/ui/alert'
import { useAsyncData } from '../hooks/useAsyncData'
import { cn } from '@renderer/lib/utils'
import type { Entity, EntityType, NavigationState, StoryRecord, ViewType } from '../../../../shared/types'

interface StoryArchiveScreenProps {
  onNavigate: (target: NavigationState) => void
}

function entityTypeToView(type: EntityType): ViewType {
  if (type === 'character') return 'characters'
  if (type === 'location') return 'locations'
  return 'events'
}

export function StoryArchiveScreen({ onNavigate }: StoryArchiveScreenProps): JSX.Element {
  const { data: stories, loading, error, refresh } = useAsyncData(
    () => window.electronAPI.stories.getAll(),
    []
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entityMap, setEntityMap] = useState<Record<string, Entity | null>>({})

  const selectedStory: StoryRecord | null = stories?.find(s => s.id === selectedId) ?? null

  // Resolve context entity ids whenever selected story changes
  useEffect(() => {
    if (!selectedStory) return
    const ids = selectedStory.context_entity_ids
    if (ids.length === 0) return

    const missing = ids.filter(id => !(id in entityMap))
    if (missing.length === 0) return

    Promise.all(missing.map(id => window.electronAPI.entities.getById(id)))
      .then(results => {
        const newEntries: Record<string, Entity | null> = {}
        for (let i = 0; i < missing.length; i++) {
          newEntries[missing[i]] = results[i]
        }
        setEntityMap(prev => ({ ...prev, ...newEntries }))
      })
      .catch(console.error)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  function renderList(): JSX.Element {
    if (loading) {
      return (
        <div className="p-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="p-4 space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      )
    }

    if (!stories || stories.length === 0) {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No stories generated yet.
        </div>
      )
    }

    return (
      <div className="p-4 space-y-2">
        {stories.map(story => (
          <div
            key={story.id}
            className={cn(
              'flex-1 text-left rounded-lg border p-3 cursor-pointer transition-colors',
              selectedId === story.id ? 'bg-accent' : 'hover:bg-accent/50'
            )}
            onClick={() => setSelectedId(story.id)}
          >
            <p className="text-sm font-medium truncate">
              {story.prompt.slice(0, 80)}{story.prompt.length > 80 ? '...' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(story.created_at * 1000).toLocaleString()} — {story.context_entity_ids.length} entities
            </p>
          </div>
        ))}
      </div>
    )
  }

  function renderDetail(): JSX.Element {
    if (!selectedStory) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select a story to view details
        </div>
      )
    }

    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        {/* Prompt section */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompt</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedStory.prompt}</p>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {new Date(selectedStory.created_at * 1000).toLocaleString()}
          {selectedStory.applied_at ? ` — applied ${new Date(selectedStory.applied_at * 1000).toLocaleString()}` : ''}
        </p>

        {/* Entity badges */}
        {selectedStory.context_entity_ids.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context Entities</p>
            <div className="flex flex-wrap gap-2">
              {selectedStory.context_entity_ids.map(id => {
                const entity = entityMap[id]
                if (entity === undefined) {
                  // Still resolving
                  return <Skeleton key={id} className="h-5 w-20" />
                }
                if (entity === null) {
                  // Deleted entity
                  return (
                    <Badge key={id} variant="secondary" className="opacity-50 cursor-default">
                      {id.slice(0, 8)}... (deleted)
                    </Badge>
                  )
                }
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => onNavigate({ view: entityTypeToView(entity.type), selectedEntityId: entity.id })}
                  >
                    {entity.name} ({entity.type})
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Story text */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Story</p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {selectedStory.story_text}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize="25%" minSize="15%" maxSize="45%">
        <ScrollArea className="h-full">
          {renderList()}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize="75%" minSize="55%">
        {renderDetail()}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
