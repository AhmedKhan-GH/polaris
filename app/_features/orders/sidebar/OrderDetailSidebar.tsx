'use client'

import { useEffect, useState } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import {
  formatCreatedAt,
  type Order,
  type OrderStatus,
} from '@/lib/domain/order'
import type { UserRole } from '@/lib/profile'
import { getAllowedTransitions, canDuplicate } from '@/lib/permissions/abilities'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { StatusPill } from '../shared/StatusPill'
import {
  STATUS_BUTTON_TONES,
  STATUS_PANEL_BORDER_TONES,
} from '../shared/statusTones'
import { useOrderActions } from '../data/useOrderActions'

interface ActionConfig {
  label: string
  toStatus: OrderStatus
  tone: 'primary' | 'terminal'
}

const ACTION_DESCRIPTIONS: Record<OrderStatus, string> = {
  draft:      '',
  confirmed:  'This confirms the order and locks it for processing.',
  processing: 'This moves the order into active processing and fulfillment.',
  fulfilled:  'This marks all items as delivered.',
  closed:     'This closes the order. Payment is settled and all items are delivered.',
  cancelled:  'This cancels the order. A reason will be recorded in the audit history.',
}

const ACTION_BUTTON_BASE =
  'w-full rounded border px-3 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-60'

const CONFIRM_BUTTON_BASE =
  'rounded border px-3 py-1.5 text-xs font-medium disabled:cursor-wait disabled:opacity-60'

// Mirrors VALID_TRANSITIONS in lib/db/orderRepository.ts. Button colors
// come from the destination status so the action, confirmation, and
// resulting badge stay visually aligned.
const ACTIONS_BY_STATUS: Record<OrderStatus, ActionConfig[]> = {
  draft: [
    { label: 'Confirm',  toStatus: 'confirmed', tone: 'primary' },
    { label: 'Cancel',   toStatus: 'cancelled', tone: 'terminal' },
  ],
  confirmed: [
    { label: 'Revert to Draft', toStatus: 'draft', tone: 'terminal' },
    { label: 'Process', toStatus: 'processing', tone: 'primary' },
    { label: 'Cancel',  toStatus: 'cancelled',  tone: 'terminal' },
  ],
  processing: [
    { label: 'Fulfill', toStatus: 'fulfilled', tone: 'primary' },
    { label: 'Cancel',  toStatus: 'cancelled', tone: 'terminal' },
  ],
  fulfilled: [
    { label: 'Close', toStatus: 'closed', tone: 'primary' },
    { label: 'Cancel', toStatus: 'cancelled', tone: 'terminal' },
  ],
  closed:    [],
  cancelled: [],
}

export function OrderDetailSidebar({
  order,
  onClose,
  role = 'owner',
}: {
  order: Order | null
  onClose: () => void
  role?: UserRole
}) {
  const isOpen = order !== null

  return (
    <aside
      aria-hidden={!isOpen}
      className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {order && (
        <SidebarBody
          key={order.id}
          order={order}
          onClose={onClose}
          role={role}
        />
      )}
    </aside>
  )
}

function SidebarBody({
  order,
  onClose,
  role,
}: {
  order: Order
  onClose: () => void
  role: UserRole
}) {
  const { transition, cancel, duplicate, isPending, error } =
    useOrderActions()
  const { timezone, hour12 } = usePreferences()

  const [pendingAction, setPendingAction] = useState<ActionConfig | null>(null)
  const [duplicatePending, setDuplicatePending] = useState(false)

  const allowedTransitions = getAllowedTransitions(role, order.status)
  const actions = ACTIONS_BY_STATUS[order.status].filter((a) =>
    allowedTransitions.includes(a.toStatus),
  )
  const primaryAction = actions.find((a) => a.tone === 'primary') ?? null
  const terminalAction = actions.find((a) => a.tone === 'terminal') ?? null
  const showDuplicate = canDuplicate(role)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (pendingAction) {
        setPendingAction(null)
      } else if (duplicatePending) {
        setDuplicatePending(false)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pendingAction, duplicatePending])

  async function runTransition(action: ActionConfig): Promise<boolean> {
    try {
      if (action.toStatus === 'cancelled') {
        await cancel({ orderId: order.id })
      } else {
        await transition({
          orderId: order.id,
          toStatus: action.toStatus,
        })
      }
      return true
    } catch {
      return false
    }
  }

  async function handleConfirmAction() {
    const action = pendingAction
    if (!action) return
    setPendingAction(null)
    const ok = await runTransition(action)
    // Terminal destinations have no further transitions in ACTIONS_BY_STATUS.
    // Closing on success keeps the sidebar open if the request fails so the
    // error state stays visible.
    if (ok && ACTIONS_BY_STATUS[action.toStatus].length === 0) {
      onClose()
    }
  }

  async function handleConfirmDuplicate() {
    setDuplicatePending(false)
    await duplicate({ sourceOrderId: order.id }).catch(() => {})
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-base font-medium text-zinc-50">
            #{order.orderNumber}
          </span>
          <StatusPill status={order.status} />
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
        <dd className="text-zinc-200">
          {formatCreatedAt(order.createdAt, timezone, hour12)}
        </dd>

        {order.createdByEmail && (
          <>
            <dt className="text-zinc-500">Created by</dt>
            <dd className="text-zinc-200">{order.createdByEmail}</dd>
          </>
        )}

        <dt className="text-zinc-500">Status changed</dt>
        <dd className="text-zinc-200">
          {formatCreatedAt(order.statusUpdatedAt, timezone, hour12)}
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {error && (
            <p
              role="alert"
              className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {error.message}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-800 bg-zinc-950 px-5 py-4">
          <div className="flex-1">
            {terminalAction && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPendingAction(terminalAction)}
                className={`${ACTION_BUTTON_BASE} ${STATUS_BUTTON_TONES[terminalAction.toStatus]}`}
              >
                {terminalAction.label}
              </button>
            )}
          </div>
          {showDuplicate && (
            <div className="flex-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDuplicatePending(true)}
                className={`${ACTION_BUTTON_BASE} ${STATUS_BUTTON_TONES.draft}`}
              >
                Duplicate
              </button>
            </div>
          )}
          <div className="flex-1">
            {primaryAction && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPendingAction(primaryAction)}
                className={`${ACTION_BUTTON_BASE} ${STATUS_BUTTON_TONES[primaryAction.toStatus]}`}
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        </div>
      </div>

      {pendingAction && (
        <ConfirmActionModal
          action={pendingAction}
          currentStatus={order.status}
          orderNumber={order.orderNumber}
          isPending={isPending}
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {duplicatePending && (
        <ConfirmDuplicateModal
          orderNumber={order.orderNumber}
          isPending={isPending}
          onConfirm={handleConfirmDuplicate}
          onCancel={() => setDuplicatePending(false)}
        />
      )}
    </>
  )
}

function ConfirmDuplicateModal({
  orderNumber,
  isPending,
  onConfirm,
  onCancel,
}: {
  orderNumber: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-duplicate-title"
      onClick={onCancel}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-lg border ${STATUS_PANEL_BORDER_TONES.draft} bg-zinc-900 p-4 shadow-2xl`}
      >
        <h3
          id="confirm-duplicate-title"
          className="text-sm font-semibold text-zinc-50"
        >
          Duplicate order #{orderNumber}?
        </h3>
        <p className="mt-2 text-xs text-zinc-400">
          This creates a new order in <span className="font-medium text-zinc-200">draft</span> status, linked back to this one. The original order is unchanged.
        </p>
        <div className="mt-4 flex justify-between gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="rounded border border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            Go Back
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            autoFocus
            className={`${CONFIRM_BUTTON_BASE} ${STATUS_BUTTON_TONES.draft}`}
          >
            Duplicate
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmActionModal({
  action,
  currentStatus,
  orderNumber,
  isPending,
  onConfirm,
  onCancel,
}: {
  action: ActionConfig
  currentStatus: OrderStatus
  orderNumber: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const isTerminal = action.tone === 'terminal'
  const titleId = isTerminal
    ? 'confirm-terminal-title'
    : 'confirm-transition-title'
  const bodyCopy = ACTION_DESCRIPTIONS[action.toStatus]
  const confirmButtonClass = `${CONFIRM_BUTTON_BASE} ${STATUS_BUTTON_TONES[action.toStatus]}`
  const cardBorderClass = STATUS_PANEL_BORDER_TONES[action.toStatus]

  // Scoped to the parent <aside>: absolute inset-0 covers the sidebar
  // pane only, not the entire viewport.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-lg border ${cardBorderClass} bg-zinc-900 p-4 shadow-2xl`}
      >
        <h3
          id={titleId}
          className="text-sm font-semibold text-zinc-50"
        >
          {action.label} order #{orderNumber}?
        </h3>
        <div className="mt-2 flex items-center gap-2">
          <StatusPill status={currentStatus} />
          <ArrowRightIcon
            aria-hidden
            className="h-3.5 w-3.5 text-zinc-500"
          />
          <StatusPill status={action.toStatus} />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {bodyCopy}{' '}
          {action.toStatus !== 'confirmed' && action.toStatus !== 'draft' && (
            <span className="font-medium text-zinc-200">
              This action is final and cannot be reversed.
            </span>
          )}
        </p>
        <div className="mt-4 flex justify-between gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="rounded border border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            Go Back
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            autoFocus
            className={confirmButtonClass}
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  )
}
