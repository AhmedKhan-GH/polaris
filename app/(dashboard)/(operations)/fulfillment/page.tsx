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
} from 'lucide-react'

type FulfillmentStatus = 'delayed' | 'delivered' | 'in transit' | 'failed'

interface Shipment {
  id: string
  status: FulfillmentStatus
  origin: string
  destination: string
  eta: string
  carrier: string
  driver: string
  progress: number
  stops: number
  value: string
}

const SHIPMENTS: Shipment[] = [
  {
    id: '2HSJ957208S',
    status: 'delayed',
    origin: 'San Francisco, CA',
    destination: 'Albany, CA',
    eta: 'Expected May 28, 4:30 PM',
    carrier: 'North Bay Cold Chain',
    driver: 'M. Salazar',
    progress: 68,
    stops: 3,
    value: '$10,120',
  },
  {
    id: '2FSHJK87482',
    status: 'delivered',
    origin: 'San Francisco, CA',
    destination: 'Albany, CA',
    eta: 'Arrived today at 2:00 PM',
    carrier: 'Bayline Express',
    driver: 'A. Chen',
    progress: 100,
    stops: 0,
    value: '$5,180',
  },
  {
    id: '6BDK58291N',
    status: 'in transit',
    origin: 'San Francisco, CA',
    destination: 'Albany, CA',
    eta: 'Today, 2:30-5:30 PM',
    carrier: 'Golden Gate Freight',
    driver: 'J. Okafor',
    progress: 63,
    stops: 2,
    value: '$13,145',
  },
  {
    id: '5APRNZ4501',
    status: 'failed',
    origin: 'San Francisco, CA',
    destination: 'Albany, CA',
    eta: 'Payment failure',
    carrier: 'Hold for dispatch',
    driver: 'Unassigned',
    progress: 18,
    stops: 1,
    value: '$8,910',
  },
]

const STATUS_STYLE: Record<
  FulfillmentStatus,
  {
    label: string
    badge: string
    bar: string
    icon: typeof Clock3
  }
> = {
  delayed: {
    label: 'Delayed',
    badge: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
    bar: 'bg-amber-300',
    icon: Clock3,
  },
  delivered: {
    label: 'Delivered',
    badge: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
    bar: 'bg-emerald-300',
    icon: CheckCircle2,
  },
  'in transit': {
    label: 'In transit',
    badge: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
    bar: 'bg-sky-300',
    icon: Truck,
  },
  failed: {
    label: 'Failed',
    badge: 'border-rose-400/40 bg-rose-400/15 text-rose-200',
    bar: 'bg-rose-300',
    icon: AlertTriangle,
  },
}

const METRICS = [
  {
    label: 'Active routes',
    value: '18',
    detail: '6 need dispatch review',
    icon: Route,
  },
  {
    label: 'On-time rate',
    value: '92%',
    detail: '+4.2% this week',
    icon: CheckCircle2,
  },
  {
    label: 'Open exceptions',
    value: '4',
    detail: '2 payment holds',
    icon: AlertTriangle,
  },
]

export default function FulfillmentPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950 p-6 text-zinc-100">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Fulfillment</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {METRICS.map((metric) => {
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
          <aside className="flex max-h-[34rem] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 lg:min-h-0 lg:max-h-none lg:w-96 lg:shrink-0">
            <div className="border-b border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-zinc-50">
                  Tracking
                </h2>
                <span className="font-mono text-xs tabular-nums text-zinc-500">
                  {SHIPMENTS.length} loads
                </span>
              </div>
              <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-400">
                <Search aria-hidden className="h-4 w-4 shrink-0" />
                <span className="sr-only">Search shipments</span>
                <input
                  placeholder="Order ID"
                  className="min-w-0 flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-500"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              {SHIPMENTS.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          </aside>

          <div className="relative min-h-[34rem] flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <MapSurface />
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
      className="block w-full border-b border-zinc-800 px-4 py-4 text-left transition-colors hover:bg-zinc-800/70 focus:bg-zinc-800 focus:outline-none"
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
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] text-zinc-500">
            <span className="truncate">{shipment.origin}</span>
            <span className="h-px w-6 bg-zinc-700" />
            <span className="truncate text-right">{shipment.destination}</span>
          </div>
        </div>
        <span className="font-mono text-xs tabular-nums text-zinc-400">
          {shipment.value}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${status.bar}`}
          style={{ width: `${shipment.progress}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <p className="truncate text-zinc-300">{shipment.eta}</p>
          <p className="mt-1 truncate text-zinc-500">{shipment.carrier}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-zinc-300">{shipment.driver}</p>
          <p className="mt-1 font-mono tabular-nums text-zinc-500">
            {shipment.stops} stops
          </p>
        </div>
      </div>
    </button>
  )
}

function MapSurface() {
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
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M -40 476 C 140 486 250 470 355 442 C 496 404 584 322 697 239 C 770 185 829 148 942 133"
          fill="none"
          stroke="#f09f2f"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="14 10"
        />
        <path
          d="M 140 46 C 292 106 350 166 432 245 C 518 328 596 359 724 392"
          fill="none"
          stroke="#b9c2cc"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>

      <MapLabel className="left-[12%] top-[18%]" label="Cold depot" />
      <MapLabel className="left-[42%] top-[25%]" label="Midtown hub" />
      <MapLabel className="right-[12%] top-[42%]" label="North route" />
      <MapLabel className="left-[52%] bottom-[21%]" label="West docks" />

      <div className="absolute left-[59%] top-[32%] flex h-11 w-11 items-center justify-center rounded-full border-4 border-amber-300 bg-zinc-950 text-amber-200 shadow-xl">
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
          value="#6BDK58291N"
        />
        <RouteMetric icon={Clock3} label="Window" value="2:30-5:30 PM" />
        <RouteMetric icon={PackageCheck} label="Load" value="18 cases" />
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
  icon: typeof Truck
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
