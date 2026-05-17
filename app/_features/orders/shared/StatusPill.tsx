import type { OrderStatus } from '@/lib/domain/order'
import { STATUS_BADGE_TONES, STATUS_BUTTON_TONES } from './statusTones'

interface StatusPillProps {
  status: OrderStatus
  active?: boolean
  onClick?: () => void
}

export function StatusPill({ status, active = true, onClick }: StatusPillProps) {
  const tone = onClick ? STATUS_BUTTON_TONES[status] : STATUS_BADGE_TONES[status]
  const className = `shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.6875rem] leading-tight font-medium uppercase tracking-wide transition-opacity ${tone} ${
    active ? 'opacity-100' : 'opacity-40'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {status}
      </button>
    )
  }

  return (
    <span className={className}>
      {status}
    </span>
  )
}
