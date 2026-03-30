import { useEffect, useState } from 'react'
import { FileTextIcon, TrashIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import type { StoryRecord } from '../../../../shared/types'

interface DraftsListProps {
  onOpenDraft: (draft: StoryRecord) => void
}

export function DraftsList({ onOpenDraft }: DraftsListProps): JSX.Element {
  const [drafts, setDrafts] = useState<StoryRecord[] | null>(null)

  useEffect(() => {
    window.electronAPI.stories.getDrafts().then(setDrafts).catch(console.error)
  }, [])

  async function handleDiscard(id: string): Promise<void> {
    await window.electronAPI.stories.discardDraft(id)
    setDrafts(prev => prev?.filter(d => d.id !== id) ?? [])
  }

  if (drafts === null) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center text-sm text-muted-foreground">
          <FileTextIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No drafts saved yet.</p>
          <p className="mt-1">Generate a story and click &quot;Save Draft&quot; to save it here.</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Session Notes — Drafts</h2>
        {drafts.map(draft => (
          <div key={draft.id} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
            <button
              className="flex-1 text-left"
              onClick={() => onOpenDraft(draft)}
            >
              <p className="text-sm font-medium truncate">
                {draft.prompt.slice(0, 80) || 'Untitled draft'}
                {draft.prompt.length > 80 ? '...' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(draft.created_at * 1000).toLocaleString()} &mdash; {draft.proposed_updates.length} proposed update{draft.proposed_updates.length !== 1 ? 's' : ''}
              </p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleDiscard(draft.id)}
              title="Discard draft"
            >
              <TrashIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
