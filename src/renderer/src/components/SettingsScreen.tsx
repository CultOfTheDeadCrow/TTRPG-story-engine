import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'

export function SettingsScreen(): JSX.Element {
  const [keyInput, setKeyInput] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  async function fetchKeyStatus(): Promise<void> {
    const status = await window.electronAPI.settings.getApiKeyStatus()
    setIsConfigured(status.configured)
  }

  useEffect(() => {
    void fetchKeyStatus()
  }, [])

  async function handleSave(): Promise<void> {
    setIsSaving(true)
    await window.electronAPI.settings.setApiKey(keyInput.trim())
    await fetchKeyStatus()
    setKeyInput('')
    setIsSaving(false)
    setTestResult(null)
  }

  async function handleClear(): Promise<void> {
    await window.electronAPI.settings.setApiKey('')
    await fetchKeyStatus()
    setTestResult(null)
  }

  async function handleTest(): Promise<void> {
    setIsTesting(true)
    const result = await window.electronAPI.settings.testApiKey()
    setTestResult(result)
    setIsTesting(false)
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-lg font-semibold mb-6">Settings</h1>

      <div className="space-y-4">
        {/* API Key field */}
        <div className="space-y-2">
          <Label htmlFor="api-key">Anthropic API Key</Label>
          <Input
            id="api-key"
            type="password"
            placeholder="sk-ant-..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-zinc-400'}`}
          />
          <span className={isConfigured ? 'text-green-400' : 'text-zinc-400'}>
            {isConfigured ? 'Key configured' : 'No key set'}
          </span>
        </div>

        {/* Save Key button */}
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving || keyInput.trim() === ''}
          className="w-full"
        >
          {isSaving ? 'Saving...' : 'Save Key'}
        </Button>

        {/* Clear Key button */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void handleClear()}
          disabled={!isConfigured}
          className="w-full"
        >
          Clear Key
        </Button>

        {/* Separator */}
        <Separator />

        {/* Test Connection button */}
        <Button
          variant="outline"
          onClick={() => void handleTest()}
          disabled={isTesting || !isConfigured}
          className="w-full"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Button>

        {/* Inline test result */}
        {testResult !== null && (
          <p className={`text-sm ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
            {testResult.ok
              ? 'Connection successful'
              : `Connection failed: ${testResult.error ?? 'Unknown error'}`}
          </p>
        )}
      </div>
    </div>
  )
}
