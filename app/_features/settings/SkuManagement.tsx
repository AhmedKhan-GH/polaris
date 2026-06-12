'use client'

import { useState, useTransition, type FormEvent } from 'react'
import type { Sku } from '@/lib/domain/orderLineItem'
import { createSkuAction, updateSkuAction } from '../orders/data/actions'

const FIELD =
  'h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-blue-400'
const BUTTON =
  'h-9 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50'
const EDIT_GRID =
  'grid-cols-[8rem_minmax(9rem,1fr)_7rem_6rem_4rem_4.5rem]'
const READ_GRID =
  'grid-cols-[8rem_minmax(12rem,1fr)_8rem_6rem_5rem]'

export function SkuManagement({
  initialSkus,
  canManage = true,
  className = 'mt-12',
}: {
  initialSkus: Sku[]
  canManage?: boolean
  className?: string
}) {
  const [skus, setSkus] = useState(initialSkus)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function sortRows(rows: Sku[]) {
    return [...rows].sort((a, b) => a.skuNumber.localeCompare(b.skuNumber))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canManage) return
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    setError(null)
    startTransition(async () => {
      try {
        const created = await createSkuAction({
          skuNumber: String(form.get('skuNumber') ?? ''),
          name: String(form.get('name') ?? ''),
          defaultUnit: String(form.get('defaultUnit') ?? ''),
        })
        setSkus((rows) =>
          sortRows([
            ...rows,
            {
              ...created,
              quickbooksLegacySku: null,
              description: null,
              category: null,
              storageType: null,
              packSize: null,
              isActive: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]),
        )
        formEl.reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create SKU')
      }
    })
  }

  function handleUpdate(row: Sku, form: FormData) {
    if (!canManage) return
    setError(null)
    startTransition(async () => {
      try {
        const updated = await updateSkuAction({
          id: row.id,
          skuNumber: String(form.get('skuNumber') ?? ''),
          name: String(form.get('name') ?? ''),
          defaultUnit: String(form.get('defaultUnit') ?? ''),
          category: String(form.get('category') ?? ''),
          isActive: form.get('isActive') === 'on',
        })
        setSkus((rows) =>
          sortRows(rows.map((sku) => (sku.id === updated.id ? updated : sku))),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update SKU')
      }
    })
  }

  return (
    <section className={className}>
      <h2 className="mb-1 text-lg font-semibold text-zinc-50">SKUs</h2>
      <p className="mb-6 text-sm text-zinc-400">
        {skus.length} {skus.length === 1 ? 'item' : 'items'}
      </p>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </p>
      )}

      {canManage && (
        <form
          onSubmit={handleCreate}
          className="mb-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 md:grid-cols-[8rem_minmax(10rem,1fr)_6rem_auto]"
        >
          <input name="skuNumber" required placeholder="SKU" className={FIELD} />
          <input name="name" required placeholder="Product name" className={FIELD} />
          <input name="defaultUnit" placeholder="Unit" className={FIELD} />
          <button
            type="submit"
            disabled={isPending}
            className={`${BUTTON} bg-zinc-100 text-zinc-950 hover:bg-white`}
          >
            Add
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <div className={canManage ? 'min-w-[38rem]' : 'min-w-[40rem]'}>
        <div className={`grid ${canManage ? EDIT_GRID : READ_GRID} gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-400`}>
          <span>SKU</span>
          <span>Name</span>
          <span>Category</span>
          <span>Unit</span>
          <span>Active</span>
          {canManage && <span />}
        </div>
        <div className="divide-y divide-zinc-800/50">
          {skus.map((sku) => (
            canManage ? (
              <form
                key={sku.id}
                action={(form) => handleUpdate(sku, form)}
                className={`grid ${EDIT_GRID} items-center gap-2 px-3 py-2`}
              >
                <input name="skuNumber" defaultValue={sku.skuNumber} className={FIELD} />
                <input name="name" defaultValue={sku.name} className={FIELD} />
                <input name="category" defaultValue={sku.category ?? ''} className={FIELD} />
                <input name="defaultUnit" defaultValue={sku.defaultUnit ?? ''} className={FIELD} />
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={sku.isActive}
                  className="h-4 w-4 justify-self-center accent-zinc-100"
                  aria-label={`${sku.skuNumber} active`}
                />
                <button type="submit" disabled={isPending} className={BUTTON}>
                  Save
                </button>
              </form>
            ) : (
              <div
                key={sku.id}
                className={`grid ${READ_GRID} items-center gap-2 px-3 py-3 text-sm`}
              >
                <span className="truncate font-mono text-zinc-200">{sku.skuNumber}</span>
                <span className="truncate text-zinc-200">{sku.name}</span>
                <span className="truncate text-zinc-400">{sku.category ?? '-'}</span>
                <span className="truncate text-zinc-400">{sku.defaultUnit ?? '-'}</span>
                <span className={sku.isActive ? 'text-emerald-300' : 'text-zinc-500'}>
                  {sku.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            )
          ))}
        </div>
        </div>
      </div>
    </section>
  )
}
