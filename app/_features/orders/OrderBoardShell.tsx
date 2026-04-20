import { Fragment, type ReactNode } from 'react'

// Transition labels sit between columns as board-level demarcators (the
// arrow points into the next column). Index N = label above column N.
// The last column (Archiving) has no outbound transition, so it gets an
// invisible spacer to keep all four sections top-aligned.
const TRANSITION_LABELS = [
  'Submit →',
  'Invoice →',
  'Close →',
  undefined,
] as const

interface OrderBoardShellProps {
  loading?: boolean
  headerAction: ReactNode
  columns: ReactNode[]
}

export function OrderBoardShell({
  loading,
  headerAction,
  columns,
}: OrderBoardShellProps) {
  return (
    <main
      aria-busy={loading ? 'true' : undefined}
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6"
    >
      {loading && <span className="sr-only">Loading orders</span>}
      <header className="shrink-0 flex items-center gap-4">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        {headerAction}
      </header>

      <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin pb-2">
        <div className="flex flex-1 min-h-0 pr-4 items-stretch">
          {columns.map((col, i) => {
            const label = TRANSITION_LABELS[i]
            return (
              <Fragment key={i}>
                <div className="flex min-h-0 flex-col gap-2">
                  {label ? (
                    <span className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                      {label}
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="px-1 text-right text-sm font-semibold uppercase tracking-wider text-transparent whitespace-nowrap select-none"
                    >
                      &nbsp;
                    </span>
                  )}
                  {col}
                </div>
                {i < columns.length - 1 && (
                  <div
                    aria-hidden
                    className="mx-4 w-0.5 shrink-0 self-stretch rounded-full bg-zinc-700"
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </main>
  )
}
