'use client'

import { useEffect, useState } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { formatCreatedAt, type Order, type OrderStatus } from '@/lib/domain/order'
import type { UserRole } from '@/lib/profile'
import { getAllowedTransitions, canDuplicate } from '@/lib/abilities'
import { usePreferences } from '../../preferences/PreferencesProvider'
import { useOrderActions } from '../data/useOrderActions'
import { StatusBadge } from '../shared/StatusBadge'
import {
  STATUS_BUTTON_TONES,
  STATUS_PANEL_BORDER_TONES,
} from '../shared/statusTones'

const ACTION_BUTTON =
  'rounded border px-3 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-60'

const CONFIRM_BUTTON_BASE =
  'rounded border px-3 py-1.5 text-xs font-medium disabled:cursor-wait disabled:opacity-60'

const ACTION_LABELS: Record<OrderStatus, string> = {
  drafted: 'Draft',
  submitted: 'Submit',
  invoiced: 'Invoice',
  closed: 'Close',
  archived: 'Archive',
  discarded: 'Discard',
  rejected: 'Reject',
  voided: 'Void',
}

const ACTION_DESCRIPTIONS: Record<OrderStatus, string> = {
  drafted: '',
  submitted: 'This submits the order to administrators for final review and approval before invoicing.',
  invoiced: 'This invoices the order to accounting and operational staff for billing and fulfillment.',
  closed: 'This marks the order as closed, files it with administrators for records processing, and queues it for archiving.',
  archived: 'This archives the closed order and removes it from the active pipeline.',
  discarded: 'Discarding is for users to abandon the drafting of an order.',
  rejected: 'Rejection is for admins to disregard the submission of an order.',
  voided: 'Voiding is for the accountable cancellation of an active invoice.',
}

export function OrderDetailPanel({ order, role = 'owner' }: { order: Order; role?: UserRole }) {
  const { timezone, hour12 } = usePreferences()
  const { transition, discardDraft, duplicate, isPending, error } =
    useOrderActions()
  const [pendingAction, setPendingAction] = useState<OrderStatus | 'duplicate' | null>(null)

  useEffect(() => {
    if (!pendingAction) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingAction(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pendingAction])

  const transitions = getAllowedTransitions(role, order.status)
  const primaryAction = transitions.find((s) => s !== 'discarded' && s !== 'rejected' && s !== 'voided' && s !== 'archived') ?? null
  const terminalAction = transitions.find((s) => s === 'discarded' || s === 'rejected' || s === 'voided' || s === 'archived') ?? null
  const showDuplicate = canDuplicate(role)

  async function handleConfirm() {
    if (!pendingAction) return
    setPendingAction(null)
    if (pendingAction === 'duplicate') {
      await duplicate({ sourceOrderId: order.id }).catch(() => {})
    } else if (pendingAction === 'discarded') {
      await discardDraft({ orderId: order.id }).catch(() => {})
    } else {
      await transition({ orderId: order.id, toStatus: pendingAction }).catch(() => {})
    }
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <span className="font-mono text-base font-medium text-zinc-50">
          #{order.orderNumber}
        </span>
        <StatusBadge status={order.status} />
      </div>

      {/* Metadata */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
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
          <dt className="text-zinc-500">Last updated</dt>
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
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-800 py-12 text-sm text-zinc-600">
          Line items will appear here
        </div>
      </div>

      {/* Actions */}
      {(transitions.length > 0 || showDuplicate) && (
        <div className="flex gap-2 border-t border-zinc-800 bg-zinc-950 px-5 py-4">
          <div className="flex-1">
            {terminalAction && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPendingAction(terminalAction)}
                className={`${ACTION_BUTTON} w-full ${STATUS_BUTTON_TONES[terminalAction]}`}
              >
                {ACTION_LABELS[terminalAction]}
              </button>
            )}
          </div>
          {showDuplicate && (
            <div className="flex-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPendingAction('duplicate')}
                className={`${ACTION_BUTTON} w-full ${STATUS_BUTTON_TONES.drafted}`}
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
                className={`${ACTION_BUTTON} w-full ${STATUS_BUTTON_TONES[primaryAction]}`}
              >
                {ACTION_LABELS[primaryAction]}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-action-title"
          onClick={() => setPendingAction(null)}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-lg border ${
              STATUS_PANEL_BORDER_TONES[pendingAction === 'duplicate' ? 'drafted' : pendingAction]
            } bg-zinc-900 p-4 shadow-2xl`}
          >
            <h3
              id="confirm-action-title"
              className="text-sm font-semibold text-zinc-50"
            >
              {pendingAction === 'duplicate'
                ? `Duplicate order #${order.orderNumber}?`
                : `${ACTION_LABELS[pendingAction]} order #${order.orderNumber}?`}
            </h3>
            {pendingAction !== 'duplicate' && (
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={order.status} />
                <ArrowRightIcon aria-hidden className="h-3.5 w-3.5 text-zinc-500" />
                <StatusBadge status={pendingAction} />
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-400">
              {pendingAction === 'duplicate'
                ? 'This creates a new order in drafted status, linked back to this one. The original order is unchanged.'
                : ACTION_DESCRIPTIONS[pendingAction]}{' '}
              {pendingAction !== 'duplicate' && (
                <span className="font-medium text-zinc-200">
                  This action is final and cannot be reversed.
                </span>
              )}
            </p>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPendingAction(null)}
                className="rounded border border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                autoFocus
                className={`${CONFIRM_BUTTON_BASE} ${
                  STATUS_BUTTON_TONES[pendingAction === 'duplicate' ? 'drafted' : pendingAction]
                }`}
              >
                {pendingAction === 'duplicate' ? 'Duplicate' : ACTION_LABELS[pendingAction]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
