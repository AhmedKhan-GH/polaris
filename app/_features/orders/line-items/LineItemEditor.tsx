'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { OrderLineItem } from '@/lib/domain/orderLineItem'
import type { UserRole } from '@/lib/profile'
import { useOrderLineItems } from '../data/useOrderLineItems'
import { ShortcutTooltip } from '../shared/ShortcutTooltip'
import { findSkuFromInput, parseEntryMacro } from './entryMacro'
import {
  formatItemCount,
  formatMoney,
  formatQuantity,
  getLineItemSummary,
  getLineItemTotal,
} from './summary'

const FIELD =
  'h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none transition-colors focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60'
const ACTION =
  'h-9 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50'
const LINE_ITEM_GRID =
  'grid-cols-[minmax(12rem,1.5fr)_minmax(6rem,0.55fr)_minmax(5rem,0.45fr)_minmax(6rem,0.55fr)_minmax(7rem,0.65fr)_auto]'

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
  const canCreateSku = role === 'admin' || role === 'owner' || role === 'system'
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
  const [skuQuery, setSkuQuery] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [skuNumber, setSkuNumber] = useState('')
  const [skuName, setSkuName] = useState('')
  const [skuUnit, setSkuUnit] = useState('')
  const summary = getLineItemSummary(lineItems)
  const summaryTotal =
    summary.pricedCount === 0 && summary.count > 0
      ? null
      : summary.totalCost

  async function handleCreateLineItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await createLineItem({
      skuId,
      quantity,
      unit,
      unitPrice,
    })
    setQuantity('1')
    setUnit('')
    setUnitPrice('')
    setSkuQuery('')
    setSkuId('')
  }

  async function handleCreateSku(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const created = await createSku({
      skuNumber,
      name: skuName,
      defaultUnit: skuUnit,
    })
    setSkuId(created.id)
    setSkuQuery(`${created.skuNumber} - ${created.name}`)
    setUnit(created.defaultUnit ?? '')
    setSkuNumber('')
    setSkuName('')
    setSkuUnit('')
  }

  function selectSkuByLabel(nextLabel: string) {
    const macro = parseEntryMacro(nextLabel, skuOptions)
    const nextSku = macro?.sku ?? findSkuFromInput(nextLabel, skuOptions)
    setSkuQuery(
      nextSku && macro?.hasMacro
        ? `${nextSku.skuNumber} - ${nextSku.name}`
        : nextLabel,
    )
    setSkuId(nextSku?.id ?? '')
    if (macro?.quantity) setQuantity(macro.quantity)
    if (macro?.unit) setUnit(macro.unit)
    if (macro?.unitPrice) setUnitPrice(macro.unitPrice)
    if (!macro?.unit && nextSku?.defaultUnit) setUnit(nextSku.defaultUnit)
  }

  function handleEntryKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    const target = e.target as HTMLElement
    if (target instanceof HTMLButtonElement) return
    e.preventDefault()
    e.currentTarget.requestSubmit()
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Line items</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono tabular-nums text-zinc-500">
            {formatItemCount(summary.count)}
          </span>
          <span className="font-mono tabular-nums text-zinc-300">
            {formatMoney(summaryTotal)}
          </span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error.message}
        </p>
      )}

      {editable && !isLoading && (
        <form
          onSubmit={handleCreateLineItem}
          onKeyDown={handleEntryKeyDown}
          className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 md:grid-cols-[minmax(14rem,1fr)_5rem_5rem_6rem_auto]"
        >
          <ShortcutTooltip
            label="SKU macro"
            shortcut="SKU x2 @10"
            className="block"
          >
            <input
              value={skuQuery}
              onChange={(e) => selectSkuByLabel(e.target.value)}
              list={`sku-options-${orderId}`}
              required
              placeholder="Search SKU"
              aria-label="SKU"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <datalist id={`sku-options-${orderId}`}>
            {skuOptions.map((sku) => (
              <option key={sku.id} value={`${sku.skuNumber} - ${sku.name}`}>
                {sku.skuNumber} - {sku.name}
              </option>
            ))}
          </datalist>
          <ShortcutTooltip label="Next field" shortcut="Tab" className="block">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              type="number"
              min="0.001"
              step="0.001"
              required
              placeholder="Qty"
              aria-label="Quantity"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <ShortcutTooltip label="Next field" shortcut="Tab" className="block">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              placeholder="Unit"
              aria-label="Unit"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <ShortcutTooltip label="Optional price" shortcut="@ in macro" className="block">
            <input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Price"
              aria-label="Unit price"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <ShortcutTooltip label="Add line item" shortcut="Enter" className="block">
            <button
              type="submit"
              disabled={isLineItemPending || !skuId}
              className={`${ACTION} w-full bg-zinc-100 text-zinc-950 hover:bg-white`}
            >
              Add
            </button>
          </ShortcutTooltip>
        </form>
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
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="min-w-[46rem]">
            <div className={`grid ${LINE_ITEM_GRID} items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500`}>
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span>Unit</span>
              <span className="text-right">Price</span>
              <span className="text-right">Line total</span>
              <span />
            </div>
            <div className="divide-y divide-zinc-800">
              {lineItems.map((lineItem) => (
                <LineItemRow
                  key={`${lineItem.id}:${lineItem.updatedAt}`}
                  lineItem={lineItem}
                  editable={editable}
                  isPending={isLineItemPending}
                  onUpdate={updateLineItem}
                  onRemove={removeLineItem}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {editable && !isLoading && canCreateSku && (
        <form
          onSubmit={handleCreateSku}
          className="grid gap-2 rounded-lg border border-zinc-800 p-3 md:grid-cols-[8rem_minmax(10rem,1fr)_6rem_auto]"
        >
          <ShortcutTooltip label="SKU number" shortcut="Tab" className="block">
            <input
              value={skuNumber}
              onChange={(e) => setSkuNumber(e.target.value)}
              required
              placeholder="SKU"
              aria-label="New SKU number"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <ShortcutTooltip label="Product name" shortcut="Tab" className="block">
            <input
              value={skuName}
              onChange={(e) => setSkuName(e.target.value)}
              required
              placeholder="Product name"
              aria-label="New SKU name"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <ShortcutTooltip label="Default unit" shortcut="Tab" className="block">
            <input
              value={skuUnit}
              onChange={(e) => setSkuUnit(e.target.value)}
              placeholder="Unit"
              aria-label="New SKU unit"
              className={`${FIELD} w-full`}
            />
          </ShortcutTooltip>
          <ShortcutTooltip label="Create SKU" shortcut="Enter" className="block">
            <button
              type="submit"
              disabled={isSkuPending}
              className={`${ACTION} w-full`}
            >
              New SKU
            </button>
          </ShortcutTooltip>
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
  const initialUnitPrice = lineItem.unitPrice === null ? '' : String(lineItem.unitPrice)
  const parsedQuantity = Number(quantity)
  const parsedUnitPrice = unitPrice.trim() === '' ? null : Number(unitPrice)
  const lineTotal =
    parsedUnitPrice === null ||
    !Number.isFinite(parsedQuantity) ||
    !Number.isFinite(parsedUnitPrice)
      ? null
      : parsedQuantity * parsedUnitPrice
  const isDirty =
    quantity !== String(lineItem.quantity) ||
    unit !== lineItem.unit ||
    unitPrice !== initialUnitPrice

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
      className={`grid ${LINE_ITEM_GRID} items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-zinc-900/60`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs font-medium text-zinc-100">
            {lineItem.skuNumber}
          </span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            #{lineItem.lineNumber}
          </span>
        </div>
        <div className="mt-1 truncate text-sm text-zinc-300">
          {lineItem.skuName}
        </div>
      </div>
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
            className={`${FIELD} text-right tabular-nums`}
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
            className={`${FIELD} text-right tabular-nums`}
          />
          <span className="text-right font-mono text-sm tabular-nums text-zinc-200">
            {formatMoney(lineTotal)}
          </span>
          <span className="flex justify-end gap-1">
            <ShortcutTooltip label="Save changes" shortcut="Enter">
              <button
                type="submit"
                disabled={isPending || !isDirty}
                className={ACTION}
              >
                Save
              </button>
            </ShortcutTooltip>
            <ShortcutTooltip label="Remove line item">
              <button
                type="button"
                disabled={isPending}
                onClick={() => void onRemove(lineItem.id)}
                className={`${ACTION} text-red-200`}
              >
                Remove
              </button>
            </ShortcutTooltip>
          </span>
        </>
      ) : (
        <>
          <span className="text-right font-mono text-zinc-300 tabular-nums">
            {formatQuantity(lineItem.quantity)}
          </span>
          <span className="truncate text-zinc-300">{lineItem.unit}</span>
          <span className="text-right font-mono text-zinc-300 tabular-nums">
            {formatMoney(lineItem.unitPrice)}
          </span>
          <span className="text-right font-mono text-zinc-200 tabular-nums">
            {formatMoney(getLineItemTotal(lineItem))}
          </span>
          <span />
        </>
      )}
    </form>
  )
}
