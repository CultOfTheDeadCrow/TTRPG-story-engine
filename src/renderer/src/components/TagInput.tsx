import { useState, KeyboardEvent } from 'react'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { XIcon } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ value, onChange }: TagInputProps): JSX.Element {
  const [inputValue, setInputValue] = useState('')

  function commitTag(raw: string): void {
    const trimmed = raw.trim().replace(/,+$/, '').trim()
    if (!trimmed || value.includes(trimmed)) {
      setInputValue('')
      return
    }
    onChange([...value, trimmed])
    setInputValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitTag(inputValue)
    }
  }

  function handleChange(raw: string): void {
    if (raw.endsWith(',')) {
      commitTag(raw)
    } else {
      setInputValue(raw)
    }
  }

  function removeTag(tag: string): void {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="h-5 gap-0.5 px-1.5 text-xs">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full opacity-60 hover:opacity-100"
            aria-label={`Remove tag ${tag}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commitTag(inputValue)}
        placeholder="Add tag..."
        className="h-6 w-32 min-w-0 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  )
}
