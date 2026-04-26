import { Fragment, type ReactNode } from 'react'

// Transition labels sit at the top of each column, naming the action
// that moves cards out of that column into the next one. Index N = label
// above column N. The Archiving column's outbound move closes the order
// into the terminal 'archived' state, which is hidden from the kanban
// (visible in the spreadsheet only); the trailing cabinet icon stands in
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

const TRANSITION_LABELS: ReadonlyArray<ReactNode> = [
  'Submit →',
  'Invoice →',
  'Complete →',
  <span key="archive" className="inline-flex items-center gap-1">Archive → <ArchiveCabinetIcon /></span>,
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
          return (
            <Fragment key={i}>
              <div className="flex min-h-0 flex-1 flex-col gap-2">
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
  )
}
