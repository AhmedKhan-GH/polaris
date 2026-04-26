import { Fragment, type ReactNode } from 'react'

// Transition labels sit at the top of each column, naming the action
// that moves cards out of that column into the next one. Index N = label
// above column N. The Archiving column's outbound move closes the order
// into the terminal 'archived' state, which is hidden from the kanban
// (visible in the spreadsheet only), so its label is an invisible spacer.
const TRANSITION_LABELS = [
  'Submit →',
  'Invoice →',
  'Archive →',
  undefined,
] as const

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
