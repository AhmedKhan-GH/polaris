'use client'

import { useEffect, useState } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { formatCreatedAt, type Order, type OrderStatus } from '@/lib/domain/order'
import { usePreferences } from '../../../preferences/PreferencesProvider'
import { useOrderActions } from '../../data/useOrderActions'
import { StatusBadge } from '../../shared/StatusBadge'
import {
  STATUS_BUTTON_TONES,
  STATUS_PANEL_BORDER_TONES,
} from '../../shared/statusTones'

const ACTION_BUTTON =
  'rounded border px-3 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-60'

const CONFIRM_BUTTON_BASE =
  'rounded border px-3 py-1.5 text-xs font-medium disabled:cursor-wait disabled:opacity-60'

const ACTION_DESCRIPTIONS: Record<string, string> = {
  submit: 'This submits the order to administrators for final review and approval before invoicing.',
  discard: 'Discarding is for users to abandon the drafting of an order.',
  duplicate: 'This creates a new order in drafted status, linked back to this one. The original order is unchanged.',
}

export function DraftDetailPanel({ order }: { order: Order }) {
  const { timezone, hour12 } = usePreferences()
  const { transition, discardDraft, duplicate, isPending, error } =
    useOrderActions()
  const [confirmAction, setConfirmAction] = useState<'submit' | 'discard' | 'duplicate' | null>(null)

  useEffect(() => {
    if (!confirmAction) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmAction(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmAction])

  async function handleSubmit() {
    setConfirmAction(null)
    await transition({ orderId: order.id, toStatus: 'submitted' }).catch(() => {})
  }

  async function handleDiscard() {
    setConfirmAction(null)
    await discardDraft({ orderId: order.id }).catch(() => {})
  }

  async function handleDuplicate() {
    setConfirmAction(null)
    await duplicate({ sourceOrderId: order.id }).catch(() => {})
  }

  const destinationStatus: Record<string, OrderStatus> = {
    submit: 'submitted',
    discard: 'discarded',
    duplicate: 'drafted',
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

      {/* Items placeholder */}
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
      <div className="border-t border-zinc-800 px-6 py-4">
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction('discard')}
            className={`${ACTION_BUTTON} ${STATUS_BUTTON_TONES.discarded}`}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction('duplicate')}
            className={`${ACTION_BUTTON} ${STATUS_BUTTON_TONES.drafted}`}
          >
            Duplicate
          </button>
          <div className="flex-1" />
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction('submit')}
            className={`${ACTION_BUTTON} ${STATUS_BUTTON_TONES.submitted}`}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-draft-action-title"
          onClick={() => setConfirmAction(null)}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-lg border ${STATUS_PANEL_BORDER_TONES[destinationStatus[confirmAction]]} bg-zinc-900 p-4 shadow-2xl`}
          >
            <h3
              id="confirm-draft-action-title"
              className="text-sm font-semibold text-zinc-50"
            >
              {confirmAction === 'submit' && `Submit order #${order.orderNumber}?`}
              {confirmAction === 'discard' && `Discard order #${order.orderNumber}?`}
              {confirmAction === 'duplicate' && `Duplicate order #${order.orderNumber}?`}
            </h3>
            {confirmAction !== 'duplicate' && (
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={order.status} />
                <ArrowRightIcon aria-hidden className="h-3.5 w-3.5 text-zinc-500" />
                <StatusBadge status={destinationStatus[confirmAction]} />
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-400">
              {ACTION_DESCRIPTIONS[confirmAction]}{' '}
              {confirmAction !== 'duplicate' && (
                <span className="font-medium text-zinc-200">
                  This action is final and cannot be reversed.
                </span>
              )}
            </p>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmAction(null)}
                className="rounded border border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={
                  confirmAction === 'submit' ? handleSubmit :
                  confirmAction === 'discard' ? handleDiscard :
                  handleDuplicate
                }
                autoFocus
                className={`${CONFIRM_BUTTON_BASE} ${STATUS_BUTTON_TONES[destinationStatus[confirmAction]]}`}
              >
                {confirmAction === 'submit' ? 'Submit' :
                 confirmAction === 'discard' ? 'Discard' :
                 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
