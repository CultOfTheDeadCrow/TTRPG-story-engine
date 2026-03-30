import React from 'react'
import { Button } from '@renderer/components/ui/button'

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center flex-col gap-4">
          <p className="text-sm text-muted-foreground">Something went wrong.</p>
          <Button onClick={() => window.location.reload()}>Reload App</Button>
        </div>
      )
    }
    return this.props.children
  }
}
