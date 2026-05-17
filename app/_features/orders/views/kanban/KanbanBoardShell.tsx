import { Fragment, type ReactNode } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

// Transition labels sit at the top of each column, naming the action
// that moves cards out of that column into the next one. Index N = label
// above column N. The Closed column's outbound move archives the order
// into the terminal 'archived' state, which is hidden from the kanban
// (visible in the list only); the trailing cabinet icon stands in
// for that destination column since it isn't drawn here.
const ArchiveCabinetIcon = () => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
)

function TransitionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <span>{children}</span>
      <ArrowRightIcon
        aria-hidden
        className="h-3.5 w-3.5 shrink-0"
      />
    </span>
  )
}

const TRANSITION_LABELS: ReadonlyArray<ReactNode> = [
  <TransitionLabel key="submit">Submit</TransitionLabel>,
  <TransitionLabel key="invoice">Invoice</TransitionLabel>,
  <TransitionLabel key="close">Close</TransitionLabel>,
  <span key="archive" className="inline-flex items-center justify-end gap-1">
    <TransitionLabel>Archive</TransitionLabel>
    <ArchiveCabinetIcon />
  </span>,
]

interface KanbanBoardShellProps {
  columns: ReactNode[]
}

export function KanbanBoardShell({ columns }: KanbanBoardShellProps) {
  return (
    <div className="flex-1 min-h-0 flex overflow-x-auto scrollbar-thin">
      <div className="flex flex-1 min-h-0 items-stretch">
        {columns.map((col, i) => {
          const label = TRANSITION_LABELS[i]
          // Inner columns get a divider on their right; the last
          // column has no such buffer, so its label hugs the board's
          // outer edge. Pad it out so the trailing arrow + cabinet
          // glyph have room to breathe instead of jamming the rim.
          const isLast = i === columns.length - 1
          const labelPadding = isLast ? 'pl-1 pr-3' : 'px-1'
          return (
            <Fragment key={i}>
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {label ? (
                  <span className={`${labelPadding} text-right text-sm font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap`}>
                    {label}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className={`${labelPadding} text-right text-sm font-semibold uppercase tracking-wider text-transparent whitespace-nowrap select-none`}
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
  )
}
