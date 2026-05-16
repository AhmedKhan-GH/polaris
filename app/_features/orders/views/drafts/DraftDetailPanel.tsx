'use client'

import { useState } from 'react'
import { formatCreatedAt, type Order } from '@/lib/domain/order'
import { usePreferences } from '../../../preferences/PreferencesProvider'
import { useOrderActions } from '../../data/useOrderActions'
import { StatusBadge } from '../../shared/StatusBadge'
import { STATUS_BUTTON_TONES } from '../../shared/statusTones'

const ACTION_BUTTON =
  'rounded border px-3 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-60'

export function DraftDetailPanel({ order }: { order: Order }) {
  const { timezone, hour12 } = usePreferences()
  const { transition, discardDraft, duplicate, isPending, error } =
    useOrderActions()
  const [confirmAction, setConfirmAction] = useState<'submit' | 'discard' | 'duplicate' | null>(null)

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

  return (
    <div className="flex flex-1 flex-col">
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
        {confirmAction === null ? (
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
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-300">
              {confirmAction === 'submit' && 'Submit this order?'}
              {confirmAction === 'discard' && 'Discard this draft?'}
              {confirmAction === 'duplicate' && 'Duplicate this order?'}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmAction(null)}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
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
              className={`rounded border px-3 py-1.5 text-xs font-medium ${
                confirmAction === 'submit' ? STATUS_BUTTON_TONES.submitted :
                confirmAction === 'discard' ? STATUS_BUTTON_TONES.discarded :
                STATUS_BUTTON_TONES.drafted
              }`}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
