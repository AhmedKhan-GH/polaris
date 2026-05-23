'use client'

import { useState, type FormEvent } from 'react'
import type { OrderLineItem } from '@/lib/domain/orderLineItem'
import type { UserRole } from '@/lib/profile'
import { useOrderLineItems } from '../data/useOrderLineItems'

const FIELD =
  'h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-blue-400'
const ACTION =
  'h-9 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50'

export function LineItemEditor({
  orderId,
  orderStatus,
  role,
}: {
  orderId: string
  orderStatus: string
  role: UserRole
}) {
  const editable = orderStatus === 'drafted'
  const canCreateSku = role === 'admin' || role === 'owner'
  const {
    lineItems,
    skuOptions,
    isLoading,
    createLineItem,
    updateLineItem,
    removeLineItem,
    createSku,
    isLineItemPending,
    isSkuPending,
    error,
  } = useOrderLineItems(orderId)

  const [skuId, setSkuId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [skuNumber, setSkuNumber] = useState('')
  const [skuName, setSkuName] = useState('')
  const [skuUnit, setSkuUnit] = useState('')

  async function handleCreateLineItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await createLineItem({
      skuId,
      quantity,
      unit,
      unitPrice,
    })
    setQuantity('1')
    setUnitPrice('')
  }

  async function handleCreateSku(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const created = await createSku({
      skuNumber,
      name: skuName,
      defaultUnit: skuUnit,
    })
    setSkuId(created.id)
    setUnit(created.defaultUnit ?? '')
    setSkuNumber('')
    setSkuName('')
    setSkuUnit('')
  }

  function selectSku(nextSkuId: string) {
    setSkuId(nextSkuId)
    const nextSku = skuOptions.find((sku) => sku.id === nextSkuId)
    if (nextSku?.defaultUnit) setUnit(nextSku.defaultUnit)
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Line items</h2>
        <span className="font-mono text-xs text-zinc-500">
          {lineItems.length}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error.message}
        </p>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-600">
          Loading line items
        </div>
      ) : lineItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-600">
          No line items
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(8rem,1.4fr)_5rem_5rem_6rem_auto] gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>SKU</span>
            <span>Product</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Price</span>
            <span />
          </div>
          <div className="divide-y divide-zinc-800">
            {lineItems.map((lineItem) => (
              <LineItemRow
                key={lineItem.id}
                lineItem={lineItem}
                editable={editable}
                isPending={isLineItemPending}
                onUpdate={updateLineItem}
                onRemove={removeLineItem}
              />
            ))}
          </div>
        </div>
      )}

      {editable && (
        <form
          onSubmit={handleCreateLineItem}
          className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 md:grid-cols-[minmax(12rem,1fr)_5rem_5rem_6rem_auto]"
        >
          <select
            value={skuId}
            onChange={(e) => selectSku(e.target.value)}
            required
            aria-label="SKU"
            className={FIELD}
          >
            <option value="">SKU</option>
            {skuOptions.map((sku) => (
              <option key={sku.id} value={sku.id}>
                {sku.skuNumber} - {sku.name}
              </option>
            ))}
          </select>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            min="0.001"
            step="0.001"
            required
            aria-label="Quantity"
            className={FIELD}
          />
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
            placeholder="Unit"
            aria-label="Unit"
            className={FIELD}
          />
          <input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            aria-label="Unit price"
            className={FIELD}
          />
          <button
            type="submit"
            disabled={isLineItemPending || !skuId}
            className={`${ACTION} bg-zinc-100 text-zinc-950 hover:bg-white`}
          >
            Add
          </button>
        </form>
      )}

      {editable && canCreateSku && (
        <form
          onSubmit={handleCreateSku}
          className="grid gap-2 rounded-lg border border-zinc-800 p-3 md:grid-cols-[8rem_minmax(10rem,1fr)_6rem_auto]"
        >
          <input
            value={skuNumber}
            onChange={(e) => setSkuNumber(e.target.value)}
            required
            placeholder="SKU"
            aria-label="New SKU number"
            className={FIELD}
          />
          <input
            value={skuName}
            onChange={(e) => setSkuName(e.target.value)}
            required
            placeholder="Product name"
            aria-label="New SKU name"
            className={FIELD}
          />
          <input
            value={skuUnit}
            onChange={(e) => setSkuUnit(e.target.value)}
            placeholder="Unit"
            aria-label="New SKU unit"
            className={FIELD}
          />
          <button
            type="submit"
            disabled={isSkuPending}
            className={ACTION}
          >
            New SKU
          </button>
        </form>
      )}
    </section>
  )
}

function LineItemRow({
  lineItem,
  editable,
  isPending,
  onUpdate,
  onRemove,
}: {
  lineItem: OrderLineItem
  editable: boolean
  isPending: boolean
  onUpdate: (args: {
    lineItemId: string
    quantity: string
    unit: string
    unitPrice: string
  }) => Promise<unknown>
  onRemove: (lineItemId: string) => Promise<unknown>
}) {
  const [quantity, setQuantity] = useState(String(lineItem.quantity))
  const [unit, setUnit] = useState(lineItem.unit)
  const [unitPrice, setUnitPrice] = useState(
    lineItem.unitPrice === null ? '' : String(lineItem.unitPrice),
  )

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await onUpdate({
      lineItemId: lineItem.id,
      quantity,
      unit,
      unitPrice,
    })
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="grid grid-cols-[minmax(7rem,1fr)_minmax(8rem,1.4fr)_5rem_5rem_6rem_auto] items-center gap-2 px-3 py-2 text-sm"
    >
      <span className="truncate font-mono text-zinc-200">
        {lineItem.skuNumber}
      </span>
      <span className="truncate text-zinc-300">{lineItem.skuName}</span>
      {editable ? (
        <>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            min="0.001"
            step="0.001"
            required
            aria-label={`${lineItem.skuNumber} quantity`}
            className={FIELD}
          />
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
            aria-label={`${lineItem.skuNumber} unit`}
            className={FIELD}
          />
          <input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            aria-label={`${lineItem.skuNumber} unit price`}
            className={FIELD}
          />
          <span className="flex gap-1">
            <button
              type="submit"
              disabled={isPending}
              className={ACTION}
            >
              Save
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void onRemove(lineItem.id)}
              className={`${ACTION} text-red-200`}
            >
              Remove
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="text-zinc-300">{lineItem.quantity}</span>
          <span className="truncate text-zinc-300">{lineItem.unit}</span>
          <span className="text-zinc-300">
            {lineItem.unitPrice === null ? '-' : lineItem.unitPrice}
          </span>
          <span />
        </>
      )}
    </form>
  )
}
