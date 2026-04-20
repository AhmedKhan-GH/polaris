import { OrderCardShell } from './OrderCardShell'

export function OrderCardSkeleton() {
  return (
    <OrderCardShell loading>
      Loading
      <span className="animate-loading-dot">.</span>
      <span className="animate-loading-dot" style={{ animationDelay: '0.2s' }}>
        .
      </span>
      <span className="animate-loading-dot" style={{ animationDelay: '0.4s' }}>
        .
      </span>
    </OrderCardShell>
  )
}
