import { cn } from '@renderer/lib/utils'
import { STATUS_COLORS } from '../../../shared/types'

interface StatusDotProps {
  status: string
}

export function StatusDot({ status }: StatusDotProps): JSX.Element {
  const colorClass = STATUS_COLORS[status] ?? 'bg-zinc-400'

  return (
    <span
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colorClass)}
      aria-hidden="true"
    />
  )
}
