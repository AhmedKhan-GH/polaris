'use client'

import { useEffect } from 'react'
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
// exits render as "danger" so the discard/cancel/void sinks stand
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
    { label: 'Cancel',   toStatus: 'cancelled', tone: 'danger'  },
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
  cancelled: [],
  voided:    [],
}

export function OrderDetailSidebar({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
  const { transition, discardDraft, duplicate, isPending, error } =
    useOrderActions()

  // Esc closes the panel — gives keyboard parity with the X button.
  useEffect(() => {
    if (!order) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [order, onClose])

  const open = order !== null
  const actions = order ? ACTIONS_BY_STATUS[order.status] : []

  async function handleTransition(action: ActionConfig) {
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

  async function handleDuplicate() {
    if (!order) return
    await duplicate({ sourceOrderId: order.id }).catch(() => {})
  }

  return (
    <aside
      aria-hidden={!open}
      className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
        open ? 'translate-x-0' : 'translate-x-full'
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

          <div className="flex flex-col gap-2 px-5 py-4">
            {actions.length > 0 ? (
              actions.map((action) => (
                <button
                  key={action.toStatus}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleTransition(action)}
                  className={
                    action.tone === 'primary'
                      ? 'rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60'
                      : 'rounded border border-red-500/40 bg-transparent px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60'
                  }
                >
                  {action.label}
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">
                Terminal state — no further transitions.
              </p>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={handleDuplicate}
              className="rounded border border-zinc-700 bg-transparent px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            >
              Duplicate to new draft
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="mx-5 mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {error.message}
            </p>
          )}
        </>
      )}
    </aside>
  )
}
