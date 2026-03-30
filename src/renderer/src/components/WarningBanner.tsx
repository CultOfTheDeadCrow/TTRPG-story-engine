import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { AlertTriangle } from 'lucide-react'

export function WarningBanner(): JSX.Element {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>No API key configured</AlertTitle>
      <AlertDescription>
        No API key configured. Go to Settings to add your Anthropic API key before using AI
        features.
      </AlertDescription>
    </Alert>
  )
}
