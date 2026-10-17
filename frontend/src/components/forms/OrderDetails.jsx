import { Link } from 'react-router-dom';
import Image from '../common/Image';
import { StatusBadge } from '../common/Badge';
import { AddressBlock } from './AddressForm';
import useCurrency from '../../hooks/useCurrency';
import useProducts from '../../hooks/useProducts';
import { getPaymentMethod, getPaymentStatus } from '../../utils/payments';
import { getShippingMethod } from '../../utils/calculateTotals';
import { formatDateTime } from '../../utils/formatDate';
import { quantityLabel } from '../../utils/units';

/**
 * Full details of one order. `companyId` limits the item list to one supplier's
 * products (used in the supplier dashboard).
 */
export default function OrderDetails({ order, companyId = null }) {
  const { money } = useCurrency();
  const { getCompany } = useProducts();
  const items = companyId ? order.items.filter((item) => item.companyId === companyId) : order.items;
  const shipping = getShippingMethod(order.shippingMethod);
  const payment = getPaymentMethod(order.paymentMethod);
  const itemsTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-navy-900">{order.id}</p>
          <p className="text-xs text-muted">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <ul className="divide-y">
          {items.map((item) => {
            const company = getCompany(item.companyId);
            return (
              <li key={item.productId} className="flex items-center gap-3 px-4 py-3">
                <Image photo={item.photo} illustration={item.illustration} width={120} height={120} alt="" className="size-14 shrink-0 rounded-lg bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink"><Link to={`/products/${item.slug}`} className="hover:text-brand-600">{item.name}</Link></p>
                  <p className="text-xs text-muted">{quantityLabel(item.quantity, item.unit)} × {money(item.unitPrice)}{item.variant ? ` · ${Object.values(item.variant).join(', ')}` : ''}</p>
                  {company && !companyId ? <p className="truncate text-xs text-muted">{company.name}</p> : null}
                </div>
                <p className="shrink-0 text-sm font-bold text-navy-900">{money(item.unitPrice * item.quantity)}</p>
              </li>
            );
          })}
        </ul>
        {companyId ? (
          <p className="flex justify-between border-t bg-surface/70 px-4 py-3 text-sm"><span className="text-muted">Your items in this order</span><span className="font-bold text-navy-900">{money(itemsTotal)}</span></p>
        ) : (
          <dl className="space-y-1.5 border-t bg-surface/70 px-4 py-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-semibold">{money(order.totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Shipping estimate</dt><dd className="font-semibold">{money(order.totals.shipping)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Duties & taxes estimate</dt><dd className="font-semibold">{money(order.totals.tax)}</dd></div>
            <div className="flex justify-between border-t pt-2 text-base"><dt className="font-bold text-navy-900">Total</dt><dd className="font-display font-extrabold text-navy-900">{money(order.totals.total)}</dd></div>
          </dl>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-bold">Delivery address</h3>
          <AddressBlock address={order.address} className="mt-2" />
        </div>
        <div className="rounded-xl border bg-white p-4 text-sm">
          <h3 className="text-sm font-bold">Contact, shipping and payment</h3>
          <p className="mt-2 text-ink">{order.contact.name}{order.contact.company ? `, ${order.contact.company}` : ''}</p>
          <p className="text-muted">{order.contact.email}</p>
          <p className="mt-2 text-ink">{shipping.label} <span className="text-muted">· {shipping.eta}</span></p>
          <p className="text-ink">{payment?.label ?? 'Other'} <span className="text-muted">· {getPaymentStatus(order)}</span></p>
          {order.source === 'buy-now' ? <p className="text-xs text-muted">Placed with Buy Now.</p> : null}
        </div>
      </div>
    </div>
  );
}
