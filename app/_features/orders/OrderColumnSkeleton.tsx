import { OrderColumnShell } from './OrderColumnShell'

export function OrderColumnSkeleton({ name }: { name: string }) {
  return <OrderColumnShell loading name={name} count="—" />
}
