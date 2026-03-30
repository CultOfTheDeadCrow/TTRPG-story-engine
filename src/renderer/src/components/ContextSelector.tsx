import { useEffect, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import type { Entity, EntityType } from '../../../../shared/types'

interface ContextSelectorProps {
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}

const GROUPS: { type: EntityType; label: string }[] = [
  { type: 'character', label: 'Characters' },
  { type: 'location', label: 'Locations' },
  { type: 'event', label: 'Events' },
]

export function ContextSelector({ selectedIds, onSelectionChange }: ContextSelectorProps): JSX.Element {
  const [entitiesByType, setEntitiesByType] = useState<Record<EntityType, Entity[]>>({
    character: [], location: [], event: [],
  })

  useEffect(() => {
    Promise.all(
      GROUPS.map(g => window.electronAPI.entities.getAll(g.type).then(entities => ({ type: g.type, entities })))
    ).then(results => {
      const byType: Record<EntityType, Entity[]> = { character: [], location: [], event: [] }
      for (const r of results) byType[r.type] = r.entities
      setEntitiesByType(byType)
      // Default: all selected (D-03)
      if (selectedIds.size === 0) {
        const allIds = new Set(results.flatMap(r => r.entities.map(e => e.id)))
        if (allIds.size > 0) onSelectionChange(allIds)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEntity(id: string): void {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectionChange(next)
  }

  function toggleAll(type: EntityType): void {
    const entities = entitiesByType[type]
    const allSelected = entities.every(e => selectedIds.has(e.id))
    const next = new Set(selectedIds)
    if (allSelected) {
      for (const e of entities) next.delete(e.id)
    } else {
      for (const e of entities) next.add(e.id)
    }
    onSelectionChange(next)
  }

  function isAllSelected(type: EntityType): boolean {
    const entities = entitiesByType[type]
    return entities.length > 0 && entities.every(e => selectedIds.has(e.id))
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Context</h3>
        {GROUPS.map(group => {
          const entities = entitiesByType[group.type]
          if (entities.length === 0) return null
          return (
            <Collapsible key={group.type} defaultOpen>
              <div className="flex items-center gap-2 py-1">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 text-sm font-medium">
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                    {group.label}
                  </button>
                </CollapsibleTrigger>
                <Checkbox
                  checked={isAllSelected(group.type)}
                  onCheckedChange={() => toggleAll(group.type)}
                  aria-label={`Select all ${group.label}`}
                />
                <span className="text-xs text-muted-foreground">
                  ({entities.filter(e => selectedIds.has(e.id)).length}/{entities.length})
                </span>
              </div>
              <CollapsibleContent>
                <div className="ml-4 space-y-1">
                  {entities.map(entity => (
                    <label key={entity.id} className="flex items-center gap-2 py-0.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedIds.has(entity.id)}
                        onCheckedChange={() => toggleEntity(entity.id)}
                      />
                      <span className="truncate">{entity.name || 'Unnamed'}</span>
                    </label>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
        {Object.values(entitiesByType).every(arr => arr.length === 0) && (
          <p className="text-xs text-muted-foreground">No entities in knowledge base. Create entities first.</p>
        )}
      </div>
    </ScrollArea>
  )
}
