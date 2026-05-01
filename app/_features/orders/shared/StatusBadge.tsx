import type { OrderStatus } from '@/lib/domain/order'

const TONES: Record<OrderStatus, string> = {
  drafted:   'border-zinc-500/30 bg-zinc-700/50 text-zinc-200',
  discarded: 'border-zinc-500/35 bg-zinc-950/80 text-red-300',
  submitted: 'border-blue-400/30 bg-blue-500/15 text-blue-300',
  rejected:  'border-blue-500/35 bg-blue-950/65 text-red-300',
  invoiced:  'border-violet-400/30 bg-violet-500/15 text-violet-300',
  voided:    'border-violet-500/35 bg-violet-950/65 text-red-300',
  closed:    'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  archived:  'border-emerald-500/35 bg-emerald-950/65 text-emerald-400',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONES[status]}`}
    >
      {status}
    </span>
  )
}
