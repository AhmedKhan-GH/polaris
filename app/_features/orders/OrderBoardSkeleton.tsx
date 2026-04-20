import { OrderBoardShell } from './OrderBoardShell'
import { OrderColumnSkeleton } from './OrderColumnSkeleton'

export function OrderBoardSkeleton() {
  return (
    <OrderBoardShell
      loading
      headerAction={
        <div
          aria-hidden
          className="h-8 w-[86px] rounded-md bg-zinc-700 animate-loading-card"
        />
      }
      columns={[
        <OrderColumnSkeleton key="drafting" name="Drafting" />,
        <OrderColumnSkeleton key="reviewing" name="Reviewing" />,
        <OrderColumnSkeleton key="fulfilling" name="Fulfilling" />,
        <OrderColumnSkeleton key="archiving" name="Archiving" />,
      ]}
    />
  )
}
