import type { OrderStatus } from '@/lib/domain/order'

export const ROW_HEIGHT = 44
export const GRID_COLUMNS = 'grid-cols-[120px_140px_1fr]'
export const ORDER_COUNT_FORMATTER = new Intl.NumberFormat('en-US')

export const STATUS_FILTER_GROUPS: readonly (readonly OrderStatus[])[] = [
  ['drafted', 'submitted', 'invoiced', 'closed'],
  ['discarded', 'rejected', 'voided', 'archived'],
]

export const STATUS_FILTER_ORDER: readonly OrderStatus[] =
  STATUS_FILTER_GROUPS.flat()
