import type { ReactNode } from 'react'
import type { OrderStatus } from '@/lib/domain/order'
import { STATUS_BUTTON_TONES } from './statusTones'

interface StatusPillProps {
  status: OrderStatus
  count?: ReactNode
  active?: boolean
  onClick?: () => void
}

export function StatusPill({ status, count, active = true, onClick }: StatusPillProps) {
  const className = `rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-opacity ${STATUS_BUTTON_TONES[status]} ${
    active ? 'opacity-100' : 'opacity-40'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {status}
        {count !== undefined && (
          <span className="ml-1.5 font-mono tabular-nums">{count}</span>
        )}
      </button>
    )
  }

  return (
    <span className={className}>
      {status}
      {count !== undefined && (
        <span className="ml-1.5 font-mono tabular-nums">{count}</span>
      )}
    </span>
  )
}
