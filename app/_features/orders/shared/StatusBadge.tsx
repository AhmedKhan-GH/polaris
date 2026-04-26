import type { OrderStatus } from '@/lib/domain/order'

const TONES: Record<OrderStatus, string> = {
  draft:     'bg-zinc-700/50 text-zinc-200',
  submitted: 'bg-blue-500/15 text-blue-300',
  invoiced:  'bg-violet-500/15 text-violet-300',
  archiving: 'bg-emerald-500/15 text-emerald-300',
  archived:  'bg-zinc-800 text-zinc-400',
  discarded: 'bg-red-500/15 text-red-300',
  rejected:  'bg-amber-500/15 text-amber-300',
  voided:    'bg-rose-500/15 text-rose-300',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONES[status]}`}
    >
      {status}
    </span>
  )
}
