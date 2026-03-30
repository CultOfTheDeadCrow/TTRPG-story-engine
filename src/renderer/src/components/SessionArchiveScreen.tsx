import { useState, useEffect } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@renderer/components/ui/resizable'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Alert, AlertDescription } from '@renderer/components/ui/alert'
import { useAsyncData } from '../hooks/useAsyncData'
import { cn } from '@renderer/lib/utils'
import type { Entity, EntityType, NavigationState, SessionRecord, ViewType } from '../../../../shared/types'

interface SessionArchiveScreenProps {
  onNavigate: (target: NavigationState) => void
}

function entityTypeToView(type: EntityType): ViewType {
  if (type === 'character') return 'characters'
  if (type === 'location') return 'locations'
  return 'events'
}

export function SessionArchiveScreen({ onNavigate }: SessionArchiveScreenProps): JSX.Element {
  const { data: sessions, loading, error, refresh } = useAsyncData(
    () => window.electronAPI.sessions.getAll(),
    []
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entityMap, setEntityMap] = useState<Record<string, Entity | null>>({})

  const selectedSession: SessionRecord | null = sessions?.find(s => s.id === selectedId) ?? null

  // Resolve applied entity ids whenever selected session changes
  useEffect(() => {
    if (!selectedSession) return
    const ids = selectedSession.applied_entity_ids
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

    if (!sessions || sessions.length === 0) {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No sessions imported yet.
        </div>
      )
    }

    return (
      <div className="p-4 space-y-2">
        {sessions.map(session => (
          <div
            key={session.id}
            className={cn(
              'flex-1 text-left rounded-lg border p-3 cursor-pointer transition-colors',
              selectedId === session.id ? 'bg-accent' : 'hover:bg-accent/50'
            )}
            onClick={() => setSelectedId(session.id)}
          >
            <p className="text-sm font-medium truncate">{session.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(session.date * 1000).toLocaleString()} — {session.applied_entity_ids.length} entities affected
            </p>
          </div>
        ))}
      </div>
    )
  }

  function renderDetail(): JSX.Element {
    if (!selectedSession) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select a session to view details
        </div>
      )
    }

    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        {/* Title and timestamp */}
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{selectedSession.title}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(selectedSession.date * 1000).toLocaleString()}
          </p>
        </div>

        {/* Applied entity summary */}
        {selectedSession.applied_entity_ids.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affected Entities</p>
            <div className="flex flex-wrap gap-2">
              {selectedSession.applied_entity_ids.map(id => {
                const entity = entityMap[id]
                if (entity === undefined) {
                  return <Skeleton key={id} className="h-5 w-20" />
                }
                if (entity === null) {
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

        {/* Raw notes */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw Notes</p>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg overflow-auto max-h-[60vh]">
            {selectedSession.raw_notes}
          </pre>
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
