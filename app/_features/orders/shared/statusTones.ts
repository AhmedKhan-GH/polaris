import type { OrderStatus } from '@/lib/domain/order'

export const STATUS_BADGE_TONES: Record<OrderStatus, string> = {
  drafted:   'border-zinc-500/30 bg-zinc-700/50 text-zinc-200',
  discarded: 'border-zinc-500/35 bg-zinc-950/80 text-red-300',
  submitted: 'border-blue-400/30 bg-blue-500/15 text-blue-300',
  rejected:  'border-blue-500/35 bg-blue-950/65 text-red-300',
  invoiced:  'border-violet-400/30 bg-violet-500/15 text-violet-300',
  voided:    'border-violet-500/35 bg-violet-950/65 text-red-300',
  closed:    'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  archived:  'border-emerald-500/35 bg-emerald-950/65 text-red-300',
}

export const STATUS_BUTTON_TONES: Record<OrderStatus, string> = {
  drafted:   'border-zinc-500/40 bg-zinc-700/30 text-zinc-200 hover:bg-zinc-700/45',
  discarded: 'border-zinc-500/40 bg-zinc-950/80 text-red-300 hover:bg-zinc-800/70',
  submitted: 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25',
  rejected:  'border-blue-500/40 bg-blue-950/65 text-red-300 hover:bg-blue-500/20',
  invoiced:  'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25',
  voided:    'border-violet-500/40 bg-violet-950/65 text-red-300 hover:bg-violet-500/20',
  closed:    'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
  archived:  'border-emerald-500/40 bg-emerald-950/65 text-red-300 hover:bg-emerald-500/20',
}

export const STATUS_PANEL_BORDER_TONES: Record<OrderStatus, string> = {
  drafted:   'border-zinc-600/70',
  discarded: 'border-zinc-500/60',
  submitted: 'border-blue-500/50',
  rejected:  'border-blue-500/50',
  invoiced:  'border-violet-500/50',
  voided:    'border-violet-500/50',
  closed:    'border-emerald-500/50',
  archived:  'border-emerald-500/50',
}
