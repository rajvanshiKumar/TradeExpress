import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  Printer,
  RotateCcw,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import Image from '../components/common/Image';
import { TableSkeleton } from '../components/common/Skeleton';
import { StatusBadge } from '../components/common/Badge';
import { apiGet, apiPost, isApiConfigured } from '../services/apiClient';
import orderService from '../services/orderService';
import useCurrency from '../hooks/useCurrency';
import useNotifications from '../hooks/useNotifications';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatDateTime } from '../utils/formatDate';
import { quantityLabel } from '../utils/units';

const STEP_ICONS = {
  ORDER_PLACED: Package,
  ORDER_CONFIRMED: CheckCircle2,
  PROCESSING: Clock,
  PACKED: Package,
  SHIPPED: Truck,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle2,
};

export default function OrderTracking() {
  const { orderNumber: paramOrderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const queryOrderNumber = searchParams.get('order');
  const initialQuery = paramOrderNumber || queryOrderNumber || '';

  const [inputNumber, setInputNumber] = useState(initialQuery);
  const [activeNumber, setActiveNumber] = useState(initialQuery);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { money } = useCurrency();
  const { showToast } = useNotifications();

  useDocumentTitle(activeNumber ? `Track Order ${activeNumber}` : 'Track My Order');

  const canCancel =
    tracking &&
    !tracking.isCancelled &&
    (tracking.orderStatus === 'ORDER_PLACED' ||
      tracking.orderStatus === 'ORDER_CONFIRMED' ||
      tracking.orderStatus === 'Pending' ||
      tracking.orderStatus === 'Confirmed');

  const handleCancelOrder = async () => {
    if (!tracking) return;
    setCancelling(true);
    try {
      await apiPost(`orders/${tracking.orderNumber}/cancel`, {});
      setTracking((prev) => ({
        ...prev,
        orderStatus: 'CANCELLED',
        isCancelled: true,
      }));
      setCancelDialogOpen(false);
      showToast('Order cancelled successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to cancel order.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!tracking) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const buyer = tracking.deliveryAddress || {};
    const invoiceNum = tracking.invoiceNumber || `TS-INV-${tracking.orderNumber}`;
    const invoiceDate = new Date(tracking.orderDate || Date.now()).toLocaleDateString('en-IN');
    const items = tracking.items || [];
    const isInter = tracking.isInterState;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GST Tax Invoice & Purchase Order - ${tracking.orderNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
            .logo { font-size: 24px; font-weight: 800; color: #047857; letter-spacing: -0.5px; }
            .subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .box h4 { margin: 0 0 10px 0; font-size: 12px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; border: 1px solid #cbd5e1; }
            td { padding: 10px; border: 1px solid #e2e8f0; }
            .totals { margin-left: auto; width: 350px; }
            .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .totals-row.grand { font-size: 16px; font-weight: bold; border-top: 2px solid #0f172a; margin-top: 5px; padding-top: 10px; color: #047857; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; text-align: center; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">TradeSphere</div>
              <div class="subtitle">B2B Wholesale Marketplace & Fulfillment</div>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #475569;">TradeSphere B2B Private Limited · GSTIN: 27AABCT9999F1Z0</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; color: #0f172a; font-size: 18px;">GST TAX INVOICE & PO</h2>
              <p style="margin: 3px 0; font-weight: 600;">Invoice No: ${invoiceNum}</p>
              <p style="margin: 3px 0; font-size: 12px; color: #64748b;">Order Ref: ${tracking.orderNumber}</p>
              <p style="margin: 3px 0; font-size: 12px; color: #64748b;">Date: ${invoiceDate}</p>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <h4>Supplier / Consignor</h4>
              <p style="margin: 0; font-weight: 700;">${tracking.supplierName || 'TradeSphere Verified Supplier'}</p>
              <p style="margin: 2px 0;">GSTIN: ${tracking.supplierGstin || '27AABCT1234F1Z1'}</p>
              <p style="margin: 2px 0;">State of Origin: ${tracking.supplierState || 'Maharashtra (State Code: 27)'}</p>
            </div>
            <div class="box">
              <h4>Buyer / Bill To & Ship To</h4>
              <p style="margin: 0; font-weight: 700;">${buyer.name || 'Purchasing Manager'}</p>
              <p style="margin: 2px 0;">${buyer.company || ''}</p>
              <p style="margin: 2px 0;">GSTIN: ${tracking.buyerGstin || 'URP (Unregistered Person)'}</p>
              <p style="margin: 2px 0;">${buyer.street || ''}, ${buyer.city || ''}, ${buyer.state || ''} - ${buyer.postalCode || ''}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description of Goods</th>
                <th>HSN / SAC</th>
                <th>Qty</th>
                <th>Rate (₹)</th>
                <th>Taxable Val (₹)</th>
                <th>GST Rate</th>
                <th>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.name || item.productName}</strong><br/><span style="font-size: 11px; color: #64748b;">SKU: ${item.sku || item.productSku || 'TS-SKU'}</span></td>
                  <td>${item.hsnCode || '84713010'}</td>
                  <td>${item.quantity} ${item.unit || 'pcs'}</td>
                  <td>₹${Number(item.unitPrice).toLocaleString('en-IN')}</td>
                  <td>₹${(item.unitPrice * item.quantity).toLocaleString('en-IN')}</td>
                  <td>18%</td>
                  <td>₹${(item.unitPrice * item.quantity * 1.18).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Taxable Subtotal:</span><span>₹${Number(tracking.totals?.subtotal || 0).toLocaleString('en-IN')}</span></div>
            <div class="totals-row"><span>Logistics & Freight:</span><span>₹${Number(tracking.totals?.shippingFee || 0).toLocaleString('en-IN')}</span></div>
            ${isInter ? `
              <div class="totals-row"><span>IGST (18%):</span><span>₹${Number(tracking.totals?.tax || 0).toLocaleString('en-IN')}</span></div>
            ` : `
              <div class="totals-row"><span>CGST (9%):</span><span>₹${((tracking.totals?.tax || 0) / 2).toLocaleString('en-IN')}</span></div>
              <div class="totals-row"><span>SGST (9%):</span><span>₹${((tracking.totals?.tax || 0) / 2).toLocaleString('en-IN')}</span></div>
            `}
            <div class="totals-row grand"><span>Total Invoice Value:</span><span>₹${Number(tracking.totals?.total || 0).toLocaleString('en-IN')}</span></div>
            ${tracking.isPartialPayment ? `
              <div class="totals-row" style="color: #b45309; font-weight: bold; margin-top: 5px;"><span>Advance Paid (20%):</span><span>₹${Number(tracking.advanceAmount || 0).toLocaleString('en-IN')}</span></div>
              <div class="totals-row" style="color: #64748b;"><span>Balance Payable on Delivery:</span><span>₹${Number(tracking.balanceDue || 0).toLocaleString('en-IN')}</span></div>
            ` : ''}
          </div>

          <div class="footer">
            <p>This is a computer generated invoice and does not require physical signature. E.&O.E.</p>
            <p>Subject to jurisdiction of courts in Mumbai, Maharashtra.</p>
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


  useEffect(() => {
    if (paramOrderNumber || queryOrderNumber) {
      const num = paramOrderNumber || queryOrderNumber;
      setInputNumber(num);
      setActiveNumber(num);
    }
  }, [paramOrderNumber, queryOrderNumber]);

  useEffect(() => {
    if (!activeNumber) {
      setLoading(false);
      setTracking(null);
      setError('');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    async function fetchTracking() {
      try {
        if (isApiConfigured) {
          try {
            const res = await apiGet(`tracking/${encodeURIComponent(activeNumber)}`);
            if (isMounted && res.success && res.data) {
              setTracking(res.data);
              setLoading(false);
              return;
            }
          } catch (apiErr) {
            console.warn('[TradeSphere Tracking] API tracking fetch failed, checking local:', apiErr.message);
          }
        }

        // Fallback to local order lookup
        const localOrder = await orderService.getOrder(activeNumber);
        if (isMounted) {
          if (localOrder) {
            // Build fallback tracking shape
            const TRACKING_STEPS = [
              { key: 'ORDER_PLACED', label: 'Order Placed', description: 'Order received and logged in system.' },
              { key: 'ORDER_CONFIRMED', label: 'Order Confirmed', description: 'Payment or COD verified and order confirmed.' },
              { key: 'PROCESSING', label: 'Processing', description: 'Items picked and prepared for dispatch at supplier warehouse.' },
              { key: 'SHIPPED', label: 'Shipped', description: 'Package dispatched with freight carrier.' },
              { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', description: 'Shipment with local courier for final delivery.' },
              { key: 'DELIVERED', label: 'Delivered', description: 'Goods delivered and accepted at destination.' },
            ];

            const isConfirmed = localOrder.status === 'Confirmed' || localOrder.paymentStatus === 'paid' || localOrder.paymentStatus === 'cod';
            const timeline = TRACKING_STEPS.map((s, idx) => ({
              step: idx + 1,
              statusKey: s.key,
              label: s.label,
              description: s.description,
              isCompleted: idx === 0 || (idx === 1 && isConfirmed),
              isCurrent: isConfirmed ? idx === 1 : idx === 0,
              timestamp: idx === 0 ? localOrder.createdAt : null,
              notes: idx === 0 ? 'Order submitted by buyer.' : (isConfirmed ? 'Order verified.' : null),
            }));

            setTracking({
              orderNumber: localOrder.orderNumber || localOrder.id,
              orderId: localOrder.backendId || localOrder.id,
              orderDate: localOrder.createdAt,
              orderStatus: isConfirmed ? 'ORDER_CONFIRMED' : 'ORDER_PLACED',
              paymentStatus: localOrder.paymentStatus?.toUpperCase() || 'PENDING',
              paymentMethod: localOrder.paymentMethod,
              shippingMethod: localOrder.shippingMethod,
              shippingEta: localOrder.shippingEta || '5–7 business days',
              deliveryAddress: localOrder.address,
              isCancelled: localOrder.status === 'Cancelled',
              isRefunded: localOrder.status === 'Refunded',
              timeline,
              items: localOrder.items || [],
              totals: {
                subtotal: localOrder.totals.subtotal,
                shippingFee: localOrder.totals.shipping,
                tax: localOrder.totals.tax,
                total: localOrder.totals.total,
              },
            });
          } else {
            setError(`No order could be found matching reference "${activeNumber}". Please verify your order number and try again.`);
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load tracking details at this time.');
          setLoading(false);
        }
      }
    }

    fetchTracking();

    return () => {
      isMounted = false;
    };
  }, [activeNumber]);

  const handleSearch = (e) => {
    e.preventDefault();
    const clean = inputNumber.trim();
    if (clean) {
      setActiveNumber(clean);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Buyer Dashboard', to: '/buyer' },
          { label: 'Order Tracking' },
        ]}
        title="Track Your Shipment"
        description="Check real-time fulfillment progress, payment verification, and delivery stages for your wholesale orders."
      />

      <div className="ts-container py-8 sm:py-10">
        {/* Search bar */}
        <section aria-label="Search order" className="mx-auto mb-10 max-w-2xl">
          <form onSubmit={handleSearch} className="flex gap-2 rounded-2xl border bg-white p-2 shadow-sm">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="text"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                placeholder="Enter Order # (e.g. TS-20261015-XYZ)"
                className="w-full rounded-xl border-none bg-transparent py-2.5 pl-11 pr-4 text-sm font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Order reference number"
              />
            </div>
            <Button type="submit" variant="navy" size="md">
              Track Order
            </Button>
          </form>
        </section>

        {loading ? (
          <div className="mx-auto max-w-3xl ts-card p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center">
            <AlertCircle className="mx-auto size-10 text-red-600" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-red-950">Tracking Information Not Available</h2>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Button to="/buyer/orders" variant="outline">
                View My Orders
              </Button>
              <Button to="/products" variant="navy">
                Browse Products
              </Button>
            </div>
          </div>
        ) : tracking ? (
          <div className="mx-auto max-w-4xl space-y-8">
            {/* Order Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 sm:p-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Order Tracking</p>
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="text-xl font-extrabold text-navy-950 sm:text-2xl">{tracking.orderNumber}</h1>
                  <StatusBadge status={tracking.orderStatus} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Placed on {formatDateTime(tracking.orderDate)} · Payment:{' '}
                  <span className="font-semibold text-ink">{tracking.paymentStatus}</span> ({tracking.paymentMethod?.toUpperCase()})
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handlePrintInvoice}
                  variant="outline"
                  size="sm"
                  icon={Printer}
                >
                  Print GST Tax Invoice & PO
                </Button>

                {canCancel ? (
                  <Button
                    onClick={() => setCancelDialogOpen(true)}
                    variant="danger"
                    size="sm"
                    icon={XCircle}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Order'}
                  </Button>
                ) : !tracking.isCancelled ? (
                  <span
                    title="Orders cannot be cancelled once packed or in transit"
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 cursor-not-allowed"
                  >
                    Cancellation Closed ({tracking.orderStatus})
                  </span>
                ) : null}

                <Button to="/buyer/orders" variant="outline" size="sm" icon={ArrowLeft}>
                  All Orders
                </Button>
              </div>
            </div>

            {/* Cancel Confirmation Dialog */}
            {cancelDialogOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
                <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-navy-900/[0.08]">
                  <div className="flex items-center gap-2 border-b border-navy-900/[0.06] pb-3 text-danger">
                    <XCircle className="size-5" />
                    <h3 className="text-lg font-bold text-ink">Cancel Order #{tracking.orderNumber}?</h3>
                  </div>
                  <p className="mt-3 text-xs text-muted leading-relaxed">
                    Cancellation is strictly allowed only before the PACKED stage. If cancelled now, your payment will be refunded to your original source and the supplier will be notified immediately.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
                      Keep Order
                    </Button>
                    <Button variant="danger" onClick={handleCancelOrder} disabled={cancelling}>
                      {cancelling ? 'Processing...' : 'Confirm Cancellation'}
                    </Button>
                  </div>
                </div>
              </div>
            )}


            {/* Special alerts for Cancelled / Refunded */}
            {tracking.isCancelled && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 flex items-start gap-3">
                <XCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">Order Cancelled</h3>
                  <p className="text-xs mt-0.5 text-red-700">This order has been cancelled and fulfillment is stopped.</p>
                </div>
              </div>
            )}

            {tracking.isRefunded && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3">
                <RotateCcw className="size-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">Order Refunded</h3>
                  <p className="text-xs mt-0.5 text-amber-700">The payment for this order has been refunded to the original payment source.</p>
                </div>
              </div>
            )}

            {/* Progress Timeline */}
            <section aria-labelledby="timeline-heading" className="ts-card p-6 sm:p-8">
              <h2 id="timeline-heading" className="text-lg font-bold text-navy-950 mb-6">
                Fulfillment Progress
              </h2>

              <div className="relative">
                <ol className="space-y-8">
                  {tracking.timeline.map((step, index) => {
                    const Icon = STEP_ICONS[step.statusKey] || CheckCircle2;
                    const isLast = index === tracking.timeline.length - 1;

                    return (
                      <li key={step.statusKey} className="relative flex items-start gap-4 sm:gap-6">
                        {/* Connecting Line */}
                        {!isLast && (
                          <div
                            className={`absolute left-[1.1875rem] top-9 -bottom-8 w-0.5 transition-colors ${
                              step.isCompleted ? 'bg-brand-600' : 'bg-slate-200'
                            }`}
                            aria-hidden="true"
                          />
                        )}

                        {/* Step Marker */}
                        <div
                          className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-all shadow-sm ${
                            step.isCompleted
                              ? 'bg-brand-600 text-white'
                              : step.isCurrent
                              ? 'bg-navy-900 text-white ring-4 ring-navy-100'
                              : 'bg-slate-100 text-slate-400 border border-slate-300'
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </div>

                        {/* Step Content */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3
                              className={`text-sm font-bold ${
                                step.isCompleted || step.isCurrent ? 'text-navy-950' : 'text-slate-400'
                              }`}
                            >
                              {step.label}
                            </h3>
                            {step.timestamp && (
                              <time className="text-xs font-medium text-muted">
                                {formatDateTime(step.timestamp)}
                              </time>
                            )}
                          </div>
                          <p
                            className={`mt-1 text-xs ${
                              step.isCompleted || step.isCurrent ? 'text-ink' : 'text-slate-400'
                            }`}
                          >
                            {step.notes || step.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>

            {/* Shipment and Order Details Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Delivery Details */}
              <div className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Delivery Address</h3>
                <div className="mt-3 text-sm text-ink leading-relaxed">
                  <p className="font-bold text-navy-950">
                    {tracking.deliveryAddress?.name}
                    {tracking.deliveryAddress?.company ? ` · ${tracking.deliveryAddress.company}` : ''}
                  </p>
                  <p className="mt-1">{tracking.deliveryAddress?.street}</p>
                  {tracking.deliveryAddress?.line2 && <p>{tracking.deliveryAddress.line2}</p>}
                  <p>
                    {tracking.deliveryAddress?.city}, {tracking.deliveryAddress?.state}{' '}
                    {tracking.deliveryAddress?.postalCode}
                  </p>
                  <p>{tracking.deliveryAddress?.country || 'India'}</p>
                  {tracking.deliveryAddress?.phone && (
                    <p className="mt-2 text-xs font-medium text-muted">Contact: {tracking.deliveryAddress.phone}</p>
                  )}
                </div>

                <div className="mt-5 border-t pt-4">
                  <h4 className="text-xs font-bold uppercase text-muted">Shipping Service</h4>
                  <p className="mt-1 text-sm font-semibold text-navy-950 capitalize">
                    {tracking.shippingMethod} Shipping
                  </p>
                  <p className="text-xs text-muted">Estimated Delivery: {tracking.shippingEta}</p>
                </div>
              </div>

              {/* Order Financials */}
              <div className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Order Financials</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="font-semibold">{money(tracking.totals.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Shipping Fee</dt>
                    <dd className="font-semibold">
                      {tracking.totals.shippingFee === 0 ? 'Free' : money(tracking.totals.shippingFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Applicable Taxes (GST 18%)</dt>
                    <dd className="font-semibold">{money(tracking.totals.tax)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-base">
                    <dt className="font-extrabold text-navy-950">Total</dt>
                    <dd className="font-display font-extrabold text-brand-700">{money(tracking.totals.total)}</dd>
                  </div>
                </dl>

                <div className="mt-5 border-t pt-4">
                  <h4 className="text-xs font-bold uppercase text-muted">Payment Verification</h4>
                  <p className="mt-1 text-sm font-semibold text-navy-950">
                    Status: <span className="text-brand-600">{tracking.paymentStatus}</span>
                  </p>
                  <p className="text-xs text-muted">Method: {tracking.paymentMethod?.toUpperCase()}</p>
                </div>
              </div>
            </div>

            {/* Ordered Items */}
            <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
              <div className="border-b bg-surface/50 px-5 py-3.5">
                <h3 className="text-sm font-bold text-navy-950">
                  Ordered Items ({tracking.items.length})
                </h3>
              </div>
              <ul className="divide-y">
                {tracking.items.map((item) => (
                  <li key={item.id || item.productId} className="flex items-center gap-4 p-4 sm:p-5">
                    <Image
                      photo={item.photo || item.productPhoto}
                      illustration={item.illustration}
                      width={120}
                      height={120}
                      alt={item.name || item.productName}
                      className="size-16 shrink-0 rounded-xl bg-surface object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-950">
                        {item.name || item.productName}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {quantityLabel(item.quantity, item.unit || 'piece')} × {money(item.unitPrice)}
                        {item.variant ? ` · ${Object.values(item.variant).join(', ')}` : ''}
                      </p>
                      <p className="text-[0.75rem] text-muted mt-0.5">SKU: {item.sku || item.productSku || 'TS-SKU'}</p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold text-navy-950">
                      {money(item.lineTotal || item.unitPrice * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
            <Package className="mx-auto size-12 text-brand-600" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-navy-950">Track Any Order</h2>
            <p className="mt-1 text-sm text-muted">
              Enter your TradeSphere order number above to view real-time fulfillment progress and shipment milestones.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button to="/buyer/orders" variant="outline">
                View My Orders
              </Button>
              <Button to="/products" variant="navy">
                Browse Catalogue
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
