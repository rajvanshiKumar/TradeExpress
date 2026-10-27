import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, Package, Search, Truck, RotateCcw, FileText } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import OrderDetails from '../../components/forms/OrderDetails';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useCart from '../../hooks/useCart';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { ORDER_STATUSES } from '../../utils/constants';
import { formatDate } from '../../utils/formatDate';
import { getPaymentMethod, getPaymentStatus } from '../../utils/payments';

export default function BuyerOrders() {
  const { user } = useAuth();
  const { orders, loading, error, reload, updateOrderStatus } = useOrders();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { getProduct } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [cancelId, setCancelId] = useState(null);
  useDocumentTitle('My orders');

  const mine = useMemo(() => orders.filter((order) => order.buyerId === user.id), [orders, user.id]);
  const visible = mine.filter((order) => {
    if (status && order.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || `${order.id} ${order.items.map((item) => item.name).join(' ')}`.toLowerCase().includes(q);
  });

  const openId = searchParams.get('order');
  const selected = mine.find((order) => order.id === openId) ?? null;
  const open = (id) => setSearchParams(id ? { order: id } : {});

  const cancel = () => {
    updateOrderStatus(cancelId, 'Cancelled');
    showToast(`Order ${cancelId} cancelled.`, 'info');
    setCancelId(null);
  };

  const handleReorder = (order) => {
    let count = 0;
    for (const item of order.items) {
      const prod = getProduct(item.productId || item.id) || {
        id: item.productId || item.id,
        name: item.name,
        moq: item.quantity,
        stock: 99999,
        unit: item.unit || 'piece',
        priceTiers: [{ min: 1, price: item.unitPrice }],
      };
      addToCart(prod, item.quantity, item.variant || null);
      count++;
    }
    showToast(`Added ${count} product(s) from order ${order.id} to your cart.`, 'success');
    navigate('/cart');
  };

  const handlePrintOrderInvoice = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const buyer = order.address || {};
    const invoiceNum = order.invoiceNumber || `TS-INV-${order.orderNumber || order.id}`;
    const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN');
    const items = order.items || [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GST Tax Invoice & Purchase Order - ${order.orderNumber || order.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
            .logo { font-size: 24px; font-weight: 800; color: #047857; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; border: 1px solid #cbd5e1; }
            td { padding: 10px; border: 1px solid #e2e8f0; }
            .totals { margin-left: auto; width: 320px; }
            .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .totals-row.grand { font-size: 16px; font-weight: bold; border-top: 2px solid #0f172a; color: #047857; margin-top: 5px; padding-top: 8px; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <img src="/logos/tradeexpress-logo.png" alt="TradeExpress" style="height: 36px; width: auto; max-width: 220px; object-fit: contain; margin-bottom: 4px; display: block;" onerror="this.style.display='none'" />
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #475569;">B2B Wholesale Fulfillment · GSTIN: 27AABCT9999F1Z0</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 18px;">GST TAX INVOICE & PO</h2>
              <p style="margin: 3px 0; font-weight: bold;">${invoiceNum}</p>
              <p style="margin: 3px 0; color: #64748b;">Date: ${invoiceDate}</p>
            </div>
          </div>
          <div class="grid">
            <div class="box">
              <h4 style="margin: 0 0 8px 0; text-transform: uppercase;">Consignor / Supplier</h4>
              <p style="margin: 0; font-weight: bold;">TradeExpress Verified Wholesale Merchant</p>
              <p style="margin: 2px 0;">GSTIN: 27AABCT1234F1Z1</p>
            </div>
            <div class="box">
              <h4 style="margin: 0 0 8px 0; text-transform: uppercase;">Consignee / Buyer</h4>
              <p style="margin: 0; font-weight: bold;">${order.contact?.name || buyer.name || user.name}</p>
              <p style="margin: 2px 0;">${order.contact?.company || user.company || ''}</p>
              <p style="margin: 2px 0;">${buyer.street || ''}, ${buyer.city || ''}, ${buyer.state || ''} - ${buyer.postalCode || ''}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.hsnCode || '8471'}</td>
                  <td>${item.quantity} ${item.unit || 'pcs'}</td>
                  <td>₹${Number(item.unitPrice).toLocaleString('en-IN')}</td>
                  <td>₹${Number(item.unitPrice * item.quantity).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-row"><span>Subtotal:</span><span>₹${Number(order.totals?.subtotal || 0).toLocaleString('en-IN')}</span></div>
            <div class="totals-row"><span>Logistics & Freight:</span><span>₹${Number(order.totals?.shipping || 0).toLocaleString('en-IN')}</span></div>
            <div class="totals-row"><span>GST (18%):</span><span>₹${Number(order.totals?.tax || 0).toLocaleString('en-IN')}</span></div>
            <div class="totals-row grand"><span>Total Value:</span><span>₹${Number(order.totals?.total || 0).toLocaleString('en-IN')}</span></div>
          </div>
          <div class="footer">
            <p>Computer generated GST invoice and purchase order. E.&O.E.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div>
      <SectionHeading title="My orders" description="Your orders and their payment status." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="order-search" className="sr-only">Search orders</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="order-search" type="search" className="ts-input pl-9" placeholder="Search by order ID or product" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <label htmlFor="order-status" className="sr-only">Filter by status</label>
        <select id="order-status" className="ts-input sm:w-52" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton /> : mine.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" text="Use Buy Now or add products to your cart to place an order." action={<Button to="/products" variant="navy">Browse products</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="No matching orders" text="Try a different search or status." action={<Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">Your orders</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-900">{order.id}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                    <td className="min-w-48 max-w-72"><span className="line-clamp-2">{order.items.map((item) => `${item.name} × ${item.quantity.toLocaleString('en-IN')}`).join(', ')}</span></td>
                    <td className="whitespace-nowrap font-semibold">{money(order.totals.total)}</td>
                    <td><span className="block min-w-32 text-[0.8125rem] font-medium text-ink">{getPaymentMethod(order.paymentMethod)?.label ?? 'Other'}</span><span className="text-xs text-muted">{getPaymentStatus(order)}</span></td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <Button variant="outline" size="sm" icon={Eye} onClick={() => open(order.id)} aria-label={`View order ${order.id}`}>View</Button>
                        <Button variant="outline" size="sm" icon={FileText} onClick={() => handlePrintOrderInvoice(order)} aria-label={`Print invoice for order ${order.id}`}>Invoice</Button>
                        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => handleReorder(order)} aria-label={`Reorder items from order ${order.id}`}>Reorder</Button>
                        <Button variant="outline" size="sm" icon={Truck} to={`/track/${order.orderNumber || order.id}`} aria-label={`Track order ${order.id}`}>Track</Button>
                        {order.status === 'Pending' ? <Button variant="dangerOutline" size="sm" onClick={() => setCancelId(order.id)} aria-label={`Cancel order ${order.id}`}>Cancel</Button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={Boolean(selected)} onClose={() => open('')} title="Order details" size="lg">
        {selected ? <OrderDetails order={selected} /> : null}
      </Modal>
      <ConfirmDialog open={Boolean(cancelId)} onCancel={() => setCancelId(null)} onConfirm={cancel} title="Cancel this order?" text={`Order ${cancelId} will be marked as cancelled.`} confirmLabel="Cancel order" cancelLabel="Keep order" />
    </div>
  );
}
