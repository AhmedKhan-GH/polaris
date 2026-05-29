import type { OrderStatus } from '@/lib/domain/order'

export const STATUS_BADGE_TONES: Record<OrderStatus, string> = {
  draft:      'border-zinc-500/30 bg-zinc-700/50 text-zinc-200',
  confirmed:  'border-blue-400/30 bg-blue-500/15 text-blue-300',
  processing: 'border-violet-400/30 bg-violet-500/15 text-violet-300',
  fulfilled:  'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  closed:     'border-zinc-400/30 bg-zinc-500/15 text-zinc-300',
  cancelled:  'border-red-500/30 bg-red-500/10 text-red-300',
}

export const STATUS_BUTTON_TONES: Record<OrderStatus, string> = {
  draft:      'border-zinc-500/40 bg-zinc-700/30 text-zinc-200 hover:bg-zinc-700/45',
  confirmed:  'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25',
  processing: 'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25',
  fulfilled:  'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
  closed:     'border-zinc-500/40 bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/25',
  cancelled:  'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20',
}

export const STATUS_PANEL_BORDER_TONES: Record<OrderStatus, string> = {
  draft:      'border-zinc-600/70',
  confirmed:  'border-blue-500/50',
  processing: 'border-violet-500/50',
  fulfilled:  'border-emerald-500/50',
  closed:     'border-zinc-500/50',
  cancelled:  'border-red-500/50',
}
