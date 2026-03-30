import { Checkbox } from '@renderer/components/ui/checkbox'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import type { ProposedUpdate, NewEntityProposal } from '../../../../shared/types'

interface DiffReviewProps {
  updates: ProposedUpdate[]
  newEntities?: NewEntityProposal[]
  accepted: Record<string, boolean>  // key: `${entityId}:${field}`, value: checked
  onAcceptedChange: (accepted: Record<string, boolean>) => void
}

function updateKey(u: ProposedUpdate): string {
  return `${u.entity_id}:${u.field}`
}

function getNewEntityFields(ne: NewEntityProposal): string[] {
  const fields = ['name', 'type']
  if (ne.status) fields.push('status')
  if (ne.description) fields.push('description')
  if (ne.tags && ne.tags.length > 0) fields.push('tags')
  return fields
}

export function DiffReview({ updates, newEntities, accepted, onAcceptedChange }: DiffReviewProps): JSX.Element | null {
  if (updates.length === 0 && (!newEntities || newEntities.length === 0)) return null

  function toggleUpdate(key: string): void {
    onAcceptedChange({ ...accepted, [key]: !(accepted[key] ?? true) })
  }

  function acceptAllForEntity(entityId: string): void {
    const next = { ...accepted }
    for (const u of updates) {
      if (u.entity_id === entityId) {
        next[updateKey(u)] = true
      }
    }
    onAcceptedChange(next)
  }

  function rejectAllForEntity(entityId: string): void {
    const next = { ...accepted }
    for (const u of updates) {
      if (u.entity_id === entityId) {
        next[updateKey(u)] = false
      }
    }
    onAcceptedChange(next)
  }

  function acceptAllForNewEntity(tempKey: string, ne: NewEntityProposal): void {
    const next = { ...accepted }
    const fields = getNewEntityFields(ne)
    for (const f of fields) { next[`${tempKey}:${f}`] = true }
    onAcceptedChange(next)
  }

  function rejectAllForNewEntity(tempKey: string, ne: NewEntityProposal): void {
    const next = { ...accepted }
    const fields = getNewEntityFields(ne)
    for (const f of fields) { next[`${tempKey}:${f}`] = false }
    onAcceptedChange(next)
  }

  // Group updates by entity
  const grouped = new Map<string, ProposedUpdate[]>()
  for (const u of updates) {
    const key = u.entity_id
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(u)
  }

  const allUpdateKeys = updates.map(updateKey)
  const allNewEntityKeys = (newEntities ?? []).flatMap(ne => {
    const fields = getNewEntityFields(ne)
    return fields.map(f => `${ne.tempKey}:${f}`)
  })
  const acceptedCount = [...allUpdateKeys, ...allNewEntityKeys].filter(k => accepted[k] ?? true).length
  const totalCount = allUpdateKeys.length + allNewEntityKeys.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Proposed Updates</h3>
        <span className="text-xs text-muted-foreground">{acceptedCount}/{totalCount} accepted</span>
      </div>
      {[...grouped.entries()].map(([entityId, entityUpdates]) => {
        const first = entityUpdates[0]
        return (
          <div key={entityId} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{first.entity_name}</span>
                <Badge variant="secondary" className="text-xs">{first.entity_type}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => acceptAllForEntity(entityId)}>Accept all</Button>
                <Button variant="ghost" size="sm" onClick={() => rejectAllForEntity(entityId)}>Reject all</Button>
              </div>
            </div>
            {entityUpdates.map(u => {
              const key = updateKey(u)
              return (
                <label key={key} className="flex items-start gap-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={accepted[key] ?? true}
                    onCheckedChange={() => toggleUpdate(key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{u.field}:</span>{' '}
                    <span>{u.new_value}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">"{u.reason}"</p>
                    {u.contradictionNote && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Contradiction: {u.contradictionNote}
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )
      })}
      {(newEntities ?? []).map(ne => {
        const fields = getNewEntityFields(ne)
        return (
          <div key={ne.tempKey} className="rounded-lg border p-3 space-y-2 bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{ne.entity_name}</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">New Entity</Badge>
                <Badge variant="secondary" className="text-xs">{ne.entity_type}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => acceptAllForNewEntity(ne.tempKey, ne)}>Accept all</Button>
                <Button variant="ghost" size="sm" onClick={() => rejectAllForNewEntity(ne.tempKey, ne)}>Reject all</Button>
              </div>
            </div>
            {fields.map(f => {
              const fieldKey = `${ne.tempKey}:${f}`
              let displayValue: string
              if (f === 'name') displayValue = ne.entity_name
              else if (f === 'type') displayValue = ne.entity_type
              else if (f === 'status') displayValue = ne.status ?? ''
              else if (f === 'description') displayValue = ne.description ?? ''
              else if (f === 'tags') displayValue = (ne.tags ?? []).join(', ')
              else displayValue = ''
              return (
                <label key={fieldKey} className="flex items-start gap-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={accepted[fieldKey] ?? true}
                    onCheckedChange={() => toggleUpdate(fieldKey)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{f}:</span>{' '}
                    <span>{displayValue}</span>
                  </div>
                </label>
              )
            })}
            <p className="text-xs text-muted-foreground mt-0.5">"{ne.reason}"</p>
          </div>
        )
      })}
    </div>
  )
}
