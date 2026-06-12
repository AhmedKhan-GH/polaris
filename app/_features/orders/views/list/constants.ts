import type { OrderStatus } from '@/lib/domain/order'

export const ROW_HEIGHT = 44
export const GRID_COLUMNS = 'grid-cols-[minmax(6rem,0.8fr)_minmax(7rem,0.8fr)_minmax(12rem,1.4fr)_minmax(10rem,1.2fr)]'
export const ORDER_COUNT_FORMATTER = new Intl.NumberFormat('en-US')

export const STATUS_FILTER_GROUPS: readonly (readonly OrderStatus[])[] = [
  ['drafted', 'submitted', 'invoiced', 'closed'],
  ['discarded', 'rejected', 'voided', 'archived'],
]

export const STATUS_FILTER_ORDER: readonly OrderStatus[] =
  STATUS_FILTER_GROUPS.flat()
