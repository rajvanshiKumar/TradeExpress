import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CircleCheck, PackageX, Truck } from 'lucide-react';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/Skeleton';
import CheckoutSteps from '../components/forms/CheckoutSteps';
import OrderDetails from '../components/forms/OrderDetails';
import useOrders from '../hooks/useOrders';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import orderService from '../services/orderService';
import { getPaymentMethod, getPaymentStatus } from '../utils/payments';

export default function OrderConfirmation() {
  const { id } = useParams();
  const { getOrder, loading: ordersLoading } = useOrders();
  const { user } = useAuth();
  const [fetchedOrder, setFetchedOrder] = useState(() => getOrder(id));
  const [fetchLoading, setFetchLoading] = useState(!fetchedOrder);

  useDocumentTitle('Order confirmation');

  useEffect(() => {
    let active = true;
    const existing = getOrder(id);
    if (existing) {
      setFetchedOrder(existing);
      setFetchLoading(false);
      return;
    }

    setFetchLoading(true);
    orderService
      .getOrder(id)
      .then((ord) => {
        if (active) {
          setFetchedOrder(ord);
          setFetchLoading(false);
        }
      })
      .catch(() => {
        if (active) setFetchLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, getOrder]);

  const order = fetchedOrder || getOrder(id);
  const loading = (ordersLoading && !order) || fetchLoading;

  if (loading) {
    return (
      <div className="ts-container py-10">
        <div className="ts-card">
          <TableSkeleton rows={6} />
        </div>
      </div>
    );
  }

  if (!order || (user && user.role === 'buyer' && order.buyerId && order.buyerId !== user.id && !order.id.startsWith('TS-'))) {
    return (
      <div className="ts-container py-12">
        <div className="ts-card">
          <EmptyState
            icon={PackageX}
            headingLevel={1}
            title="Order not found"
            text="We could not find this order."
            action={<Button to="/buyer/orders" variant="navy">View my orders</Button>}
          />
        </div>
      </div>
    );
  }

  const paymentLabel = getPaymentMethod(order.paymentMethod)?.label;
  const paymentStatusText = getPaymentStatus(order);
  const orderRef = order.orderNumber || order.id;

  return (
    <div className="ts-container py-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <CheckoutSteps current={6} />
      </div>

      <section
        className="mx-auto mt-8 max-w-3xl rounded-2xl border border-green-200 bg-success-50 p-6 text-center sm:p-8"
        role="status"
      >
        <CircleCheck className="mx-auto size-12 text-success" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl text-navy-950">Order confirmed</h1>
        <p className="mt-2 text-ink">
          Thank you, <span className="font-semibold">{order.contact?.name || 'Customer'}</span>. Your order reference is{' '}
          <span className="font-bold text-navy-950">{orderRef}</span>.
        </p>
        <p className="mt-2 text-sm font-semibold text-ink">
          {paymentLabel && !paymentStatusText.startsWith(paymentLabel)
            ? `${paymentLabel}: ${paymentStatusText}`
            : paymentStatusText}
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          {order.paymentStatus === 'paid'
            ? `Your payment has been verified and confirmed. A confirmation receipt with invoice details has been sent to ${order.contact?.email || 'your email'}.`
            : order.paymentMethod === 'cod'
            ? `Your order has been recorded for Cash on Delivery. An itemized order confirmation has been sent to ${order.contact?.email || 'your email'}.`
            : `Your order has been recorded with payment pending. A confirmation email has been sent to ${order.contact?.email || 'your email'}.`}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button to={`/track/${orderRef}`} variant="primary" icon={Truck}>
            Track My Order
          </Button>
          <Button to="/buyer/orders" variant="navy">
            View my orders
          </Button>
          <Button to="/products" variant="outline">
            Continue browsing
          </Button>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-3xl">
        <OrderDetails order={order} />
      </div>
    </div>
  );
}
