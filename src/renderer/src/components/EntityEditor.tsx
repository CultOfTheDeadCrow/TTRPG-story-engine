import { useEffect, useState, useCallback } from 'react'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'
import { TagInput } from './TagInput'
import { ChangeHistory } from './ChangeHistory'
import type { Entity } from '../../../shared/types'
import { STATUS_OPTIONS } from '../../../shared/types'

interface EntityEditorProps {
  entityId: string
  onDirtyChange: (dirty: boolean) => void
  onEntityDeleted: () => void
  onEntitySaved: () => void
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>
}

interface FormState {
  name: string
  status: string
  tags: string[]
  description: string
  notes: string
}

function formFromEntity(entity: Entity): FormState {
  return {
    name: entity.name,
    status: entity.status,
    tags: entity.tags,
    description: entity.description,
    notes: entity.notes,
  }
}

function formsEqual(a: FormState, b: FormState): boolean {
  return (
    a.name === b.name &&
    a.status === b.status &&
    a.description === b.description &&
    a.notes === b.notes &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i])
  )
}

export function EntityEditor({
  entityId,
  onDirtyChange,
  onEntityDeleted,
  onEntitySaved,
  saveRef,
}: EntityEditorProps): JSX.Element {
  const [entity, setEntity] = useState<Entity | null>(null)
  const [formState, setFormState] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    setSaveError(null)
    setDeleteError(null)
    setNameError(false)
    window.electronAPI.entities
      .getById(entityId)
      .then((fetched) => {
        if (fetched) {
          setEntity(fetched)
          setFormState(formFromEntity(fetched))
        } else {
          setLoadError('Entity not found.')
        }
      })
      .catch(() => setLoadError('Failed to load entity. Click to retry.'))
      .finally(() => setLoading(false))
  }, [entityId])

  useEffect(() => {
    if (!entity || !formState) {
      onDirtyChange(false)
      return
    }
    const dirty = !formsEqual(formState, formFromEntity(entity))
    onDirtyChange(dirty)
  }, [formState, entity, onDirtyChange])

  const handleSave = useCallback(async (): Promise<void> => {
    if (!formState) return
    if (!formState.name.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    setSaveError(null)
    try {
      await window.electronAPI.entities.update(entityId, {
        name: formState.name,
        status: formState.status as Entity['status'],
        tags: formState.tags,
        description: formState.description,
        notes: formState.notes,
      })
      // Re-fetch the saved entity to update baseline
      const updated = await window.electronAPI.entities.getById(entityId)
      if (updated) {
        setEntity(updated)
        setFormState(formFromEntity(updated))
      }
      // Increment refresh key so ChangeHistory reloads
      setHistoryRefreshKey((k) => k + 1)
      onEntitySaved()
    } catch {
      setSaveError('Failed to save. Try again or restart the app.')
    }
  }, [entityId, formState, onEntitySaved])

  // Expose save handler to parent via ref
  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave
    }
  }, [saveRef, handleSave])

  async function handleConfirmedDelete(): Promise<void> {
    setDeleteError(null)
    try {
      await window.electronAPI.entities.delete(entityId)
      onEntityDeleted()
    } catch {
      setDeleteError('Failed to delete. Try again.')
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (loadError || !entity || !formState) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {loadError ?? 'Failed to load entity. Click to retry.'}
      </div>
    )
  }

  const statusOptions = STATUS_OPTIONS[entity.type]

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex-1 space-y-4 p-6">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="entity-name" className="text-sm font-medium">
            Name
          </Label>
          <Input
            id="entity-name"
            value={formState.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Entity name"
            aria-invalid={nameError}
          />
          {nameError && (
            <p className="text-xs text-destructive">Name is required</p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Status</Label>
          <Select
            value={formState.status}
            onValueChange={(val) => updateField('status', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tags</Label>
          <TagInput value={formState.tags} onChange={(tags) => updateField('tags', tags)} />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="entity-description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="entity-description"
            value={formState.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Describe this entity..."
            className="min-h-[120px]"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="entity-notes" className="text-sm font-medium">
            Notes
          </Label>
          <Textarea
            id="entity-notes"
            value={formState.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="GM notes (not shared with players)..."
            className="min-h-[80px]"
          />
        </div>

        {saveError && (
          <p className="text-xs text-destructive">{saveError}</p>
        )}
        {deleteError && (
          <p className="text-xs text-destructive">{deleteError}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-6 py-4">
        <Button type="button" onClick={handleSave}>
          Save Changes
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {formState.name || 'this entity'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. The entity and all its change history will be
                permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmedDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Change history */}
      <div className="mt-6 px-6 pb-6">
        <ChangeHistory entityId={entityId} refreshKey={historyRefreshKey} />
      </div>
    </div>
  )
}
