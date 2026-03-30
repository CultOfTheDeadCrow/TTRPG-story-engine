import { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { WarningBanner } from './WarningBanner'
import { DiffReview } from './DiffReview'
import { useSessionImport } from '../hooks/useSessionImport'

interface SessionImportScreenProps {
  apiKeyConfigured: boolean
  onEntityListRefresh: () => void
}

export function SessionImportScreen({ apiKeyConfigured, onEntityListRefresh }: SessionImportScreenProps): JSX.Element {
  const [notes, setNotes] = useState('')
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { analysisText, entityUpdates, newEntities, entityCount, isAnalyzing, error, startImport, cancel, reset } = useSessionImport()

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  async function handleApply(): Promise<void> {
    // Collect accepted entity updates (default true means accepted)
    const checkedUpdates = entityUpdates.filter(u => accepted[`${u.entity_id}:${u.field}`] !== false)

    // Collect accepted new entities — an entity is accepted if ANY of its fields are checked
    const checkedNewEntities = newEntities.filter(ne => {
      const fields = ['name', 'type']
      if (ne.status) fields.push('status')
      if (ne.description) fields.push('description')
      if (ne.tags && ne.tags.length > 0) fields.push('tags')
      return fields.some(f => accepted[`${ne.tempKey}:${f}`] !== false)
    })

    const result = await window.electronAPI.sessions.applySession({
      notes,
      entityUpdates: checkedUpdates,
      newEntities: checkedNewEntities,
    })

    // Success: show message, reset screen, refresh sidebar
    setSuccessMessage(`${result.appliedCount} updates applied, ${result.createdCount} entities created`)
    setNotes('')
    setAccepted({})
    reset()
    onEntityListRefresh()
  }

  // Calculate accepted count for both entity updates and new entity fields
  const allKeys = [
    ...entityUpdates.map(u => `${u.entity_id}:${u.field}`),
    ...newEntities.flatMap(ne => {
      const fields = ['name', 'type']
      if (ne.status) fields.push('status')
      if (ne.description) fields.push('description')
      if (ne.tags && ne.tags.length > 0) fields.push('tags')
      return fields.map(f => `${ne.tempKey}:${f}`)
    })
  ]
  const acceptedCount = allKeys.filter(k => accepted[k] ?? true).length

  const hasProposals = entityUpdates.length > 0 || newEntities.length > 0
  const hasOutput = analysisText.length > 0 || hasProposals

  return (
    <div className="h-full w-full overflow-y-auto p-4 space-y-4 min-w-0">
      {!apiKeyConfigured && <WarningBanner />}

      {/* Session notes textarea */}
      <Textarea
        placeholder="Paste session notes here \u2014 German and English accepted, no formatting required"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="min-h-[200px] resize-y"
        disabled={isAnalyzing}
      />

      {/* Action buttons */}
      <div className="space-x-2">
        <Button
          onClick={() => void startImport(notes)}
          disabled={!apiKeyConfigured || notes.trim().length === 0 || isAnalyzing}
        >
          Analyze
        </Button>
        {isAnalyzing && (
          <Button variant="destructive" onClick={cancel}>
            Stop Analysis
          </Button>
        )}
      </div>

      {/* Status line */}
      {isAnalyzing && entityCount > 0 && (
        <p className="text-sm text-muted-foreground">Analyzing against {entityCount} entities</p>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Analysis failed: {error}. Check your API key in Settings and try again.
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 p-3 text-sm text-green-800 dark:text-green-200">
          {successMessage}
        </div>
      )}

      {/* Analysis text */}
      {(analysisText || isAnalyzing) && (
        <div>
          {isAnalyzing && !analysisText && (
            <p className="text-sm text-muted-foreground animate-pulse">Analyzing...</p>
          )}
          {analysisText && (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{analysisText}</div>
          )}
        </div>
      )}

      {/* DiffReview */}
      {!isAnalyzing && hasProposals && (
        <DiffReview
          updates={entityUpdates}
          newEntities={newEntities}
          accepted={accepted}
          onAcceptedChange={setAccepted}
        />
      )}

      {/* Apply button */}
      {!isAnalyzing && hasProposals && (
        <Button onClick={() => void handleApply()} disabled={acceptedCount === 0}>
          Apply Selected ({acceptedCount})
        </Button>
      )}

      {/* Empty state */}
      {!hasOutput && !isAnalyzing && !error && !successMessage && (
        <div>
          <p className="text-sm font-semibold">No session imported yet</p>
          <p className="text-sm text-muted-foreground">
            Paste your session notes above and click Analyze to sync your knowledge base.
          </p>
        </div>
      )}

      {/* No proposals state */}
      {!isAnalyzing && analysisText && entityUpdates.length === 0 && newEntities.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No changes proposed. Your knowledge base is already up to date with these notes.
        </p>
      )}
    </div>
  )
}
