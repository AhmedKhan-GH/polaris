import { OrderDetail } from '../OrderDetail';

/**
 * Order detail route — a thin shell over the reusable `OrderDetail` composition
 * component (the orders console reuses the same component in its status work
 * panel). All fetching, permission gating, and rendering live in `OrderDetail`.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetail orderId={id} />;
}
