import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import { Badge } from '@renderer/components/ui/badge'
import type { EntityHistoryEntry } from '../../../shared/types'

interface ChangeHistoryProps {
  entityId: string
  refreshKey: number
}

function SourceBadge({ source }: { source: EntityHistoryEntry['source'] }): JSX.Element {
  if (source === 'manual_edit') {
    return <Badge variant="secondary">Manual</Badge>
  }
  if (source === 'story_generation') {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Story Gen</Badge>
    )
  }
  // session_import
  return (
    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Import</Badge>
  )
}

export function ChangeHistory({ entityId, refreshKey }: ChangeHistoryProps): JSX.Element {
  const [entries, setEntries] = useState<EntityHistoryEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    window.electronAPI.entities.getHistory(entityId).then(setEntries).catch(() => {
      setEntries([])
    })
  }, [entityId, refreshKey])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-base font-semibold">
        <ChevronRight
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        Change history ({entries.length} entries)
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-400">
                  {new Date(entry.created_at * 1000).toLocaleString()}
                </span>
                <SourceBadge source={entry.source} />
                <span className="text-sm font-semibold">{entry.field}:</span>
                <span className="text-sm line-through text-red-400">
                  {entry.old_value ?? '(empty)'}
                </span>
                <span className="text-sm text-muted-foreground">→</span>
                <span className="text-sm text-green-400">
                  {entry.new_value ?? '(empty)'}
                </span>
              </div>
              {entry.reason !== null && (
                <p className="text-xs italic text-zinc-400">{entry.reason}</p>
              )}
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
