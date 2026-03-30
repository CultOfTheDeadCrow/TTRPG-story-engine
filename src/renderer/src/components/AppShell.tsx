import { SidebarProvider, SidebarInset } from '@renderer/components/ui/sidebar'
import { EntitySidebar } from './EntitySidebar'
import type { NavigationState } from '../../../shared/types'

interface AppShellProps {
  nav: NavigationState
  onNavigate: (target: NavigationState) => void
  refreshKey: number
  children: React.ReactNode
}

export function AppShell({ nav, onNavigate, refreshKey, children }: AppShellProps): JSX.Element {
  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <EntitySidebar nav={nav} onNavigate={onNavigate} refreshKey={refreshKey} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
