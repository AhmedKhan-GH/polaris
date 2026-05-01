import type { OrderStatus } from '@/lib/domain/order'
import { STATUS_BADGE_TONES } from './statusTones'

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_BADGE_TONES[status]}`}
    >
      {status}
    </span>
  )
}
