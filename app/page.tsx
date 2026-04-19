import { findAllOrders } from "@/lib/db/orderRepository";
import { createOrderAction } from "./actions";

const COLUMNS = ["Drafting", "Reviewing", "Invoicing", "Archiving"];

export default async function Home() {
  const orders = await findAllOrders();
  const drafting = [...orders].reverse();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 overflow-hidden">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-50">Orders</h1>
        <form action={createOrderAction}>
          <button
            type="submit"
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            New Order
          </button>
        </form>
      </header>

      <div className="grid flex-1 min-h-0 gap-4 overflow-x-auto" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))" }}>
        {COLUMNS.map((column) => {
          const tiles = column === "Drafting" ? drafting : [];
          return (
            <section
              key={column}
              className="flex min-h-0 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {column}
                </h2>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                  {tiles.length}
                </span>
              </div>
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {tiles.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm font-medium text-zinc-50"
                  >
                    {order.orderNumber}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
