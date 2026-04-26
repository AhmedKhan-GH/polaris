'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatCreatedAt,
  type Order,
  type OrderStatus,
} from '@/lib/domain/order'
import { StatusBadge } from './StatusBadge'
import { useOrderActions } from './useOrderActions'

interface ActionConfig {
  label: string
  toStatus: OrderStatus
  tone: 'primary' | 'danger'
}

// Mirrors VALID_TRANSITIONS in lib/db/orderRepository.ts. Forward
// transitions render as "primary" (continue the pipeline); terminal
// exits render as "danger" so the discard/reject/void sinks stand
// apart from the happy-path moves. archiving is the post-fulfillment
// holding step before the terminal archived state. 'Discard' is the
// author-driven soft delete on a draft; an admin 'Delete' (hard) is
// out of scope here.
const ACTIONS_BY_STATUS: Record<OrderStatus, ActionConfig[]> = {
  draft: [
    { label: 'Submit',   toStatus: 'submitted', tone: 'primary' },
    { label: 'Discard',  toStatus: 'discarded', tone: 'danger'  },
  ],
  submitted: [
    { label: 'Invoice',  toStatus: 'invoiced',  tone: 'primary' },
    { label: 'Reject',   toStatus: 'rejected',  tone: 'danger'  },
  ],
  invoiced: [
    { label: 'Complete', toStatus: 'archiving', tone: 'primary' },
    { label: 'Void',     toStatus: 'voided',    tone: 'danger'  },
  ],
  archiving: [
    { label: 'Archive',  toStatus: 'archived',  tone: 'primary' },
  ],
  archived:  [],
  discarded: [],
  rejected:  [],
  voided:    [],
}

type DropdownGroup = 'primary' | 'danger' | null

export function OrderDetailSidebar({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
  const { transition, discardDraft, duplicate, isPending, error } =
    useOrderActions()

  // Two-step dropdown gate per group: the user opens a menu, then
  // explicitly picks the item. Primary and danger live in separate
  // dropdowns so a hover or fat-finger on one path can't possibly land
  // on the other --- the structural separation is the point.
  const [openGroup, setOpenGroup] = useState<DropdownGroup>(null)
  // Picking a danger action defers to a confirmation modal instead of
  // firing the transition straight away. The picked action is parked
  // here while the modal is up; null means no termination is pending.
  const [pendingTerminate, setPendingTerminate] = useState<ActionConfig | null>(
    null,
  )
  const dropdownsRef = useRef<HTMLDivElement>(null)

  const actions = order ? ACTIONS_BY_STATUS[order.status] : []
  const primaryActions = useMemo(
    () => actions.filter((a) => a.tone === 'primary'),
    [actions],
  )
  const dangerActions = useMemo(
    () => actions.filter((a) => a.tone === 'danger'),
    [actions],
  )

  // Reset the open menu whenever the panel switches to a different order.
  useEffect(() => {
    setOpenGroup(null)
    setPendingTerminate(null)
  }, [order?.id])

  // Esc layers: confirm modal first, then any open dropdown, then the
  // panel itself --- innermost wins so a single Esc never crosses two
  // boundaries at once.
  useEffect(() => {
    if (!order) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (pendingTerminate) {
        setPendingTerminate(null)
      } else if (openGroup) {
        setOpenGroup(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [order, onClose, openGroup, pendingTerminate])

  // Click anywhere outside both menus closes whichever is open.
  useEffect(() => {
    if (!openGroup) return
    function onClickOutside(e: MouseEvent) {
      if (!dropdownsRef.current?.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [openGroup])

  const isOpen = order !== null

  async function runTransition(action: ActionConfig) {
    if (!order) return
    if (action.toStatus === 'discarded') {
      await discardDraft({ orderId: order.id }).catch(() => {})
    } else {
      await transition({
        orderId: order.id,
        toStatus: action.toStatus,
      }).catch(() => {})
    }
  }

  async function handleTransition(action: ActionConfig) {
    if (!order) return
    setOpenGroup(null)
    // Danger actions defer to the confirmation modal --- a forward
    // primary move is still cheap to undo (transition again), but the
    // discard/reject/void exits drop the order into a terminal state
    // with no path back, so we gate them behind an explicit Yes/No.
    if (action.tone === 'danger') {
      setPendingTerminate(action)
      return
    }
    await runTransition(action)
  }

  async function handleConfirmTerminate() {
    const action = pendingTerminate
    if (!action) return
    setPendingTerminate(null)
    await runTransition(action)
  }

  async function handleDuplicate() {
    if (!order) return
    await duplicate({ sourceOrderId: order.id }).catch(() => {})
  }

  return (
    <aside
      aria-hidden={!isOpen}
      className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {order && (
        <>
          <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-medium text-zinc-50">
                #{order.orderNumber}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail panel"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              ✕
            </button>
          </header>

          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 border-b border-zinc-800 px-5 py-4 text-sm">
            <dt className="text-zinc-500">Created</dt>
            <dd className="text-zinc-200">{formatCreatedAt(order.createdAt)}</dd>

            <dt className="text-zinc-500">Status changed</dt>
            <dd className="text-zinc-200">
              {formatCreatedAt(order.statusUpdatedAt)}
            </dd>

            {order.duplicatedFromOrderId && (
              <>
                <dt className="text-zinc-500">Duplicated from</dt>
                <dd className="font-mono text-xs text-zinc-300">
                  {order.duplicatedFromOrderId}
                </dd>
              </>
            )}
          </dl>

          {/* Wrap both action groups in dropdownsRef so the click-
              outside handler treats clicks on either group as "inside"
              and doesn't close the dropdown mid-pick. The flex-1
              spacer between them is what pins the bottom group to the
              sidebar's bottom edge --- more robust than mt-auto, which
              quietly stops working if a sibling somewhere up the tree
              doesn't yield the height. */}
          <div ref={dropdownsRef} className="flex flex-1 min-h-0 flex-col">
            <div className="flex flex-col gap-2 px-5 py-4">
              {primaryActions.length > 0 ? (
                <ActionDropdown
                  group="primary"
                  label="Transition"
                  actions={primaryActions}
                  isOpen={openGroup === 'primary'}
                  isPending={isPending}
                  onToggle={() =>
                    setOpenGroup((g) => (g === 'primary' ? null : 'primary'))
                  }
                  onPick={handleTransition}
                />
              ) : (
                actions.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    Terminal state — no further transitions.
                  </p>
                )
              )}
            </div>

            <div aria-hidden className="flex-1" />

            {error && (
              <p
                role="alert"
                className="mx-5 mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                {error.message}
              </p>
            )}

            {/* Bottom group: pt-4 anchors the buttons to the sidebar
                rim with consistent breathing room, pb-14 reserves room
                BELOW Terminate so its menu can drop downward (one item
                plus the 4px mt-1 offset and 2px border ≈ 40px) without
                clipping past the panel edge. */}
            <div className="flex flex-col gap-2 px-5 pt-4 pb-14">
              <button
                type="button"
                disabled={isPending}
                onClick={handleDuplicate}
                className="rounded border border-zinc-700 bg-transparent px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
              >
                Duplicate to new draft
              </button>
              {dangerActions.length > 0 && (
                <ActionDropdown
                  group="danger"
                  label="Terminate"
                  actions={dangerActions}
                  isOpen={openGroup === 'danger'}
                  isPending={isPending}
                  onToggle={() =>
                    setOpenGroup((g) => (g === 'danger' ? null : 'danger'))
                  }
                  onPick={handleTransition}
                />
              )}
            </div>
          </div>
        </>
      )}
      {pendingTerminate && order && (
        <ConfirmTerminateModal
          action={pendingTerminate}
          orderNumber={order.orderNumber}
          isPending={isPending}
          onConfirm={handleConfirmTerminate}
          onCancel={() => setPendingTerminate(null)}
        />
      )}
    </aside>
  )
}

function ConfirmTerminateModal({
  action,
  orderNumber,
  isPending,
  onConfirm,
  onCancel,
}: {
  action: ActionConfig
  orderNumber: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Scoped to the parent <aside>: absolute inset-0 covers the sidebar
  // pane only, not the entire viewport. The aside's `position: fixed`
  // already establishes the containing block for absolute descendants,
  // so this dialog dims and gates the sidebar without blacking out the
  // rest of the app.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-terminate-title"
      onClick={onCancel}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
      >
        <h3
          id="confirm-terminate-title"
          className="text-sm font-semibold text-zinc-50"
        >
          {action.label} order #{orderNumber}?
        </h3>
        <p className="mt-2 text-xs text-zinc-400">
          The order will be marked as{' '}
          <span className="font-medium text-zinc-200">{action.toStatus}</span>.
          Terminal states cannot be reversed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="rounded border border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            autoFocus
            className="rounded border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/25 disabled:cursor-wait disabled:opacity-60"
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionDropdown({
  group,
  label,
  actions,
  isOpen,
  isPending,
  direction = 'down',
  onToggle,
  onPick,
}: {
  group: 'primary' | 'danger'
  label: string
  actions: ActionConfig[]
  isOpen: boolean
  isPending: boolean
  direction?: 'up' | 'down'
  onToggle: () => void
  onPick: (action: ActionConfig) => void
}) {
  const triggerClass =
    group === 'primary'
      ? 'flex w-full items-center justify-between rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60'
      : 'flex w-full items-center justify-between rounded border border-red-500/40 bg-transparent px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60'

  const menuClass =
    direction === 'up'
      ? 'absolute left-0 right-0 bottom-full z-10 mb-1 overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-lg'
      : 'absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-lg'

  const caret = isOpen
    ? direction === 'up'
      ? '▾'
      : '▴'
    : direction === 'up'
      ? '▴'
      : '▾'

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={triggerClass}
      >
        <span>{label}</span>
        <span aria-hidden className="text-xs opacity-70">
          {caret}
        </span>
      </button>
      {isOpen && (
        <div role="menu" className={menuClass}>
          {actions.map((action) => (
            <button
              key={action.toStatus}
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={() => onPick(action)}
              className={
                group === 'danger'
                  ? 'block w-full px-3 py-2 text-left text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60'
                  : 'block w-full px-3 py-2 text-left text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60'
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
