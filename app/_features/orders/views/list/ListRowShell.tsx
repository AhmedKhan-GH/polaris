import { GRID_COLUMNS } from './constants'

export function ListRowShell({
  rowIndex,
  start,
  size,
}: {
  rowIndex: number
  start: number
  size: number
}) {
  // Cells stretch to the full row height so each placeholder can be
  // vertically centered against real row content.
  return (
    <div
      role="row"
      aria-hidden="true"
      aria-rowindex={rowIndex + 1}
      className={`absolute left-0 right-0 grid ${GRID_COLUMNS} border-b border-zinc-800 animate-loading-card`}
      style={{
        transform: `translateY(${start}px)`,
        height: size,
      }}
    >
      <div role="cell" className="flex items-center px-4">
        <span className="block h-4 w-16 rounded bg-zinc-700" />
      </div>
      <div role="cell" className="flex items-center px-4">
        <span className="inline-flex h-5 w-20 items-center rounded-full border border-zinc-700 bg-zinc-800 px-2">
          <span className="block h-2 w-11 rounded-full bg-zinc-700/80" />
        </span>
      </div>
      <div role="cell" className="flex items-center px-4">
        <span className="block h-4 w-36 rounded bg-zinc-700/70" />
      </div>
    </div>
  )
}
