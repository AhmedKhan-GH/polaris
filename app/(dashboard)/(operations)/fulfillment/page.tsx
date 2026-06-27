import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  Search,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { defineAbilityFor } from '@/lib/abilities'
import {
  countFilteredOrdersByStatus,
  findFilteredOrdersPage,
  type OrderFilters,
  type OrderStatusCounts,
} from '@/lib/db/orderRepository'
import { findOrderLineItems } from '@/lib/db/orderLineItemRepository'
import {
  ACTIVE_ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '@/lib/domain/order'
import type { OrderLineItem } from '@/lib/domain/orderLineItem'
import { getProfile } from '@/lib/profile'

type FulfillmentStatus =
  | 'staging'
  | 'delayed'
  | 'delivered'
  | 'in transit'
  | 'failed'

interface Shipment {
  id: string
  orderStatus: OrderStatus
  status: FulfillmentStatus
  origin: string
  destination: string
  eta: string
  carrier: string
  progress: number
  stops: number
  value: string
  load: string
  skuSummary: string
}

const FULFILLMENT_ORDER_STATUSES: readonly OrderStatus[] = [
  ...ACTIVE_ORDER_STATUSES,
  'rejected',
  'voided',
]

const ORDER_LIMIT = 14
const ORIGIN = 'San Francisco, CA'

const DESTINATIONS = [
  'Albany, CA',
  'Oakland, CA',
  'Berkeley, CA',
  'San Jose, CA',
  'Palo Alto, CA',
  'Walnut Creek, CA',
]

const CARRIERS = [
  'North Bay Cold Chain',
  'Bayline Express',
  'Golden Gate Freight',
  'Pacific Produce Logistics',
  'Mission Route Services',
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const STATUS_STYLE: Record<
  FulfillmentStatus,
  {
    label: string
    badge: string
    bar: string
    icon: LucideIcon
  }
> = {
  staging: {
    label: 'Staging',
    badge: 'border-violet-400/40 bg-violet-400/15 text-violet-100',
    bar: 'bg-violet-300',
    icon: PackageCheck,
  },
  delayed: {
    label: 'Delayed',
    badge: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
    bar: 'bg-amber-300',
    icon: Clock3,
  },
  delivered: {
    label: 'Delivered',
    badge: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100',
    bar: 'bg-emerald-300',
    icon: CheckCircle2,
  },
  'in transit': {
    label: 'In transit',
    badge: 'border-sky-400/40 bg-sky-400/15 text-sky-100',
    bar: 'bg-sky-300',
    icon: Truck,
  },
  failed: {
    label: 'Failed',
    badge: 'border-rose-400/40 bg-rose-400/15 text-rose-100',
    bar: 'bg-rose-300',
    icon: AlertTriangle,
  },
}

export default async function FulfillmentPage() {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('read', 'Order')) notFound()

  const filters: OrderFilters = {
    statuses: FULFILLMENT_ORDER_STATUSES,
    ...(profile.role === 'guest' ? { createdBy: profile.id } : {}),
  }

  const [orders, statusCounts] = await Promise.all([
    findFilteredOrdersPage(filters, null, ORDER_LIMIT),
    countFilteredOrdersByStatus(filters),
  ])

  const shipments = await Promise.all(
    orders.map(async (order, index) =>
      toShipment(order, await findOrderLineItems(order.id), index),
    ),
  )
  const selectedShipment =
    shipments.find((shipment) =>
      ['in transit', 'delayed'].includes(shipment.status),
    ) ??
    shipments[0] ??
    null
  const metrics = buildMetrics(statusCounts)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950 p-4 text-zinc-100 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Fulfillment</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {metrics.map((metric) => {
                const Icon = metric.icon
                return (
                  <div
                    key={metric.label}
                    className="flex min-w-44 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
                      <Icon aria-hidden className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-base tabular-nums text-zinc-50">
                          {metric.value}
                        </span>
                        <span className="truncate text-xs text-zinc-400">
                          {metric.label}
                        </span>
                      </div>
                      <p className="truncate text-xs text-zinc-500">
                        {metric.detail}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
            >
              <Navigation aria-hidden className="h-4 w-4" />
              Optimize
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-100 px-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              <Truck aria-hidden className="h-4 w-4" />
              Dispatch
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
          <aside className="flex max-h-[34rem] flex-col overflow-hidden rounded-lg border border-sky-900/60 bg-[#102a3c] lg:min-h-0 lg:max-h-none lg:w-96 lg:shrink-0">
            <div className="border-b border-sky-900/70 bg-sky-950/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-zinc-50">
                  Tracking
                </h2>
                <span className="font-mono text-xs tabular-nums text-sky-200/70">
                  {shipments.length} synced
                </span>
              </div>
              <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-sky-800/80 bg-zinc-950/70 px-3 text-sm text-zinc-400">
                <Search aria-hidden className="h-4 w-4 shrink-0" />
                <span className="sr-only">Search orders</span>
                <input
                  placeholder="Order ID"
                  className="min-w-0 flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-500"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              {shipments.length > 0 ? (
                shipments.map((shipment) => (
                  <ShipmentCard key={shipment.id} shipment={shipment} />
                ))
              ) : (
                <div className="px-4 py-10 text-center">
                  <PackageCheck
                    aria-hidden
                    className="mx-auto h-8 w-8 text-sky-200/70"
                  />
                  <p className="mt-3 text-sm font-medium text-zinc-100">
                    No orders ready for fulfillment
                  </p>
                  <p className="mt-1 text-xs text-sky-100/60">
                    Submitted and invoiced orders will appear here.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <div className="relative min-h-[34rem] flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <MapSurface selectedShipment={selectedShipment} />
          </div>
        </section>
      </div>
    </div>
  )
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const status = STATUS_STYLE[shipment.status]
  const Icon = status.icon

  return (
    <button
      type="button"
      className="block w-full border-b border-sky-900/60 px-4 py-4 text-left transition-colors hover:bg-sky-900/45 focus:bg-sky-900/60 focus:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-base font-semibold text-zinc-50">
              #{shipment.id}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.badge}`}
            >
              <Icon aria-hidden className="h-3 w-3" />
              {status.label}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] text-sky-100/55">
            <span className="truncate">{shipment.origin}</span>
            <span className="h-px w-6 bg-sky-700/80" />
            <span className="truncate text-right">{shipment.destination}</span>
          </div>
        </div>
        <span className="font-mono text-xs tabular-nums text-sky-100/80">
          {shipment.value}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-950/70">
        <div
          className={`h-full rounded-full ${status.bar}`}
          style={{ width: `${shipment.progress}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <p className="truncate text-zinc-100">{shipment.eta}</p>
          <p className="mt-1 truncate text-sky-100/55">
            {shipment.skuSummary}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-zinc-100">{shipment.carrier}</p>
          <p className="mt-1 truncate text-sky-100/55">
            {shipment.load} / {formatStops(shipment.stops)}
          </p>
        </div>
      </div>
    </button>
  )
}

function MapSurface({
  selectedShipment,
}: {
  selectedShipment: Shipment | null
}) {
  const selectedStatus = selectedShipment
    ? STATUS_STYLE[selectedShipment.status]
    : STATUS_STYLE.staging

  return (
    <div className="absolute inset-0 bg-[#d9ded2]">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute left-[7%] top-0 h-full w-3 rotate-12 bg-white/80" />
        <div className="absolute left-[20%] top-0 h-full w-2 -rotate-6 bg-white/80" />
        <div className="absolute left-[37%] top-0 h-full w-3 rotate-3 bg-white/80" />
        <div className="absolute left-[56%] top-0 h-full w-2 -rotate-12 bg-white/80" />
        <div className="absolute left-[74%] top-0 h-full w-3 rotate-8 bg-white/80" />
        <div className="absolute left-0 top-[14%] h-2 w-full rotate-1 bg-white/80" />
        <div className="absolute left-0 top-[31%] h-3 w-full -rotate-2 bg-white/80" />
        <div className="absolute left-0 top-[49%] h-2 w-full rotate-2 bg-white/80" />
        <div className="absolute left-0 top-[67%] h-3 w-full -rotate-1 bg-white/80" />
        <div className="absolute left-0 top-[83%] h-2 w-full rotate-1 bg-white/80" />
      </div>

      <div className="absolute -left-20 top-16 h-40 w-72 rotate-12 rounded-full bg-emerald-200/60" />
      <div className="absolute right-16 top-10 h-32 w-52 -rotate-12 rounded-full bg-lime-200/60" />
      <div className="absolute bottom-12 left-1/3 h-28 w-56 rotate-6 rounded-full bg-emerald-100/70" />

      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 900 560"
        preserveAspectRatio="none"
      >
        <path
          d="M -40 476 C 140 486 250 470 355 442 C 496 404 584 322 697 239 C 770 185 829 148 942 133"
          fill="none"
          stroke="#f7c873"
          strokeLinecap="round"
          strokeWidth="18"
        />
        <path
          d="M -40 476 C 140 486 250 470 355 442 C 496 404 584 322 697 239 C 770 185 829 148 942 133"
          fill="none"
          stroke="#f09f2f"
          strokeDasharray="14 10"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M 140 46 C 292 106 350 166 432 245 C 518 328 596 359 724 392"
          fill="none"
          stroke="#b9c2cc"
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>

      <MapLabel className="left-[12%] top-[18%]" label="Cold depot" />
      <MapLabel className="left-[42%] top-[25%]" label="Midtown hub" />
      <MapLabel className="right-[12%] top-[42%]" label="North route" />
      <MapLabel className="left-[52%] bottom-[21%]" label="West docks" />

      <div
        className={`absolute left-[59%] top-[32%] flex h-11 w-11 items-center justify-center rounded-full border-4 bg-zinc-950 shadow-xl ${
          selectedShipment?.status === 'delayed'
            ? 'border-amber-300 text-amber-200'
            : selectedShipment?.status === 'failed'
              ? 'border-rose-300 text-rose-200'
              : 'border-sky-300 text-sky-200'
        }`}
      >
        <Truck aria-hidden className="h-5 w-5" />
      </div>
      <div className="absolute left-[18%] bottom-[18%] flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-300 bg-zinc-950 text-emerald-200 shadow-lg">
        <Warehouse aria-hidden className="h-4 w-4" />
      </div>
      <div className="absolute right-[17%] top-[18%] flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 bg-zinc-950 text-sky-200 shadow-lg">
        <MapPin aria-hidden className="h-4 w-4" />
      </div>

      <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur md:grid-cols-3">
        <RouteMetric
          icon={Truck}
          label="Selected route"
          value={
            selectedShipment
              ? `#${selectedShipment.id} - ${selectedStatus.label}`
              : 'No active route'
          }
        />
        <RouteMetric
          icon={Clock3}
          label="Window"
          value={selectedShipment?.eta ?? 'No scheduled movement'}
        />
        <RouteMetric
          icon={PackageCheck}
          label="Load"
          value={selectedShipment?.load ?? '0 units'}
        />
      </div>
    </div>
  )
}

function MapLabel({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <span
      className={`absolute rounded bg-white/70 px-2 py-1 text-xs font-medium text-zinc-600 shadow-sm ${className}`}
    >
      {label}
    </span>
  )
}

function RouteMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
        <Icon aria-hidden className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-zinc-500">{label}</p>
        <p className="truncate text-sm font-medium text-zinc-100">{value}</p>
      </div>
    </div>
  )
}

function toShipment(
  order: Order,
  lineItems: readonly OrderLineItem[],
  index: number,
): Shipment {
  const status = fulfillmentStatusFor(order)
  const itemQuantity = lineItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )
  const pricedItems = lineItems.filter((item) => item.unitPrice !== null)
  const totalValue = pricedItems.reduce(
    (total, item) => total + item.quantity * (item.unitPrice ?? 0),
    0,
  )
  const skuSummary =
    order.skuSummary ?? lineItems.map((item) => item.skuNumber).join(', ')

  return {
    id: String(order.orderNumber),
    orderStatus: order.status,
    status,
    origin: ORIGIN,
    destination: DESTINATIONS[order.orderNumber % DESTINATIONS.length],
    eta: fulfillmentWindowFor(status, order, index),
    carrier:
      status === 'staging' || status === 'failed'
        ? 'Hold for dispatch'
        : CARRIERS[order.orderNumber % CARRIERS.length],
    progress: fulfillmentProgressFor(status, order.orderNumber),
    stops: Math.min(5, lineItems.length),
    value:
      pricedItems.length > 0 ? currencyFormatter.format(totalValue) : 'Unpriced',
    load: `${numberFormatter.format(itemQuantity)} units`,
    skuSummary: skuSummary || 'No SKUs',
  }
}

function fulfillmentStatusFor(order: Order): FulfillmentStatus {
  if (order.status === 'closed') return 'delivered'
  if (order.status === 'rejected' || order.status === 'voided') return 'failed'
  if (order.status === 'drafted') return 'staging'
  if (order.status === 'submitted' && order.orderNumber % 5 === 0) {
    return 'delayed'
  }
  if (order.status === 'invoiced' && order.orderNumber % 7 === 0) {
    return 'delayed'
  }
  return 'in transit'
}

function fulfillmentProgressFor(
  status: FulfillmentStatus,
  orderNumber: number,
): number {
  if (status === 'delivered') return 100
  if (status === 'failed') return 18
  if (status === 'delayed') return 62 + (orderNumber % 14)
  if (status === 'staging') return 24 + (orderNumber % 18)
  return 48 + (orderNumber % 32)
}

function fulfillmentWindowFor(
  status: FulfillmentStatus,
  order: Order,
  index: number,
): string {
  if (status === 'delivered') return 'Arrived today'
  if (status === 'failed') return `${capitalize(order.status)} order`
  if (status === 'staging') return 'Ready for dispatch'

  const start = 9 + (index % 7)
  const end = Math.min(start + 3, 18)
  const day = status === 'delayed' ? 'Expected today' : 'Today'
  return `${day}, ${formatHour(start)}-${formatHour(end)}`
}

function buildMetrics(counts: OrderStatusCounts) {
  const staging = counts.drafted
  const inFlight = counts.submitted + counts.invoiced
  const delivered = counts.closed
  const exceptions = counts.rejected + counts.voided
  const total = inFlight + delivered + exceptions
  const onTimeRate =
    total > 0 ? Math.round(((inFlight + delivered) / total) * 100) : 0

  return [
    {
      label: 'Active routes',
      value: numberFormatter.format(staging + inFlight),
      detail: `${numberFormatter.format(inFlight)} moving, ${numberFormatter.format(staging)} staging`,
      icon: Route,
    },
    {
      label: 'On-time rate',
      value: `${onTimeRate}%`,
      detail: `${numberFormatter.format(delivered)} delivered orders`,
      icon: CheckCircle2,
    },
    {
      label: 'Open exceptions',
      value: numberFormatter.format(exceptions),
      detail: `${numberFormatter.format(counts.rejected)} rejected, ${numberFormatter.format(counts.voided)} voided`,
      icon: AlertTriangle,
    },
  ]
}

function formatHour(hour: number): string {
  const normalizedHour = ((hour - 1) % 12) + 1
  const period = hour >= 12 ? 'PM' : 'AM'
  return `${normalizedHour}:00 ${period}`
}

function formatStops(stops: number): string {
  return `${numberFormatter.format(stops)} ${stops === 1 ? 'stop' : 'stops'}`
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
