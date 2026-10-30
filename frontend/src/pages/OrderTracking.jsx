import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Package,
  Printer,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Truck,
  Upload,
  XCircle,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import Image from '../components/common/Image';
import Modal from '../components/common/Modal';
import Input, { Textarea } from '../components/common/Input';
import { TableSkeleton } from '../components/common/Skeleton';
import { StatusBadge } from '../components/common/Badge';
import CustomSelect from '../components/common/CustomSelect';
import { printTaxInvoice } from '../utils/taxInvoiceGenerator.js';
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

  // Dispute & Inspection State
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [disputeValues, setDisputeValues] = useState({
    reason: 'QUALITY_MISMATCH',
    description: '',
    requestedResolution: 'FULL_REFUND',
    photoProof: '',
  });
  const [disputeMessageText, setDisputeMessageText] = useState('');
  const [sendingDisputeMsg, setSendingDisputeMsg] = useState(false);

  // Review & Rating State
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewValues, setReviewValues] = useState({
    rating: 5,
    qualityRating: 5,
    packagingRating: 5,
    timelinessRating: 5,
    comment: '',
  });

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

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiPost('upload', formData);
      if (res && res.url) {
        setDisputeValues((prev) => ({ ...prev, photoProof: res.url }));
        showToast('Proof photo uploaded successfully.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to upload photo.', 'error');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!disputeValues.description || disputeValues.description.trim().length < 10) {
      showToast('Please provide a detailed description (at least 10 characters).', 'warning');
      return;
    }
    setSubmittingDispute(true);
    try {
      const res = await apiPost(`disputes/${tracking.orderNumber}`, disputeValues);
      setTracking((prev) => ({
        ...prev,
        dispute: res.data,
        escrowLedger: prev.escrowLedger ? { ...prev.escrowLedger, status: 'FROZEN_DISPUTED' } : null,
      }));
      showToast('Inspection dispute submitted! Escrow payout has been frozen.', 'success');
      setDisputeDialogOpen(false);
    } catch (err) {
      showToast(err.message || 'Failed to submit dispute.', 'error');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleSendDisputeMessage = async (e) => {
    e.preventDefault();
    if (!disputeMessageText.trim() || !tracking?.dispute?.id) return;
    setSendingDisputeMsg(true);
    try {
      const res = await apiPost(`disputes/${tracking.dispute.id}/messages`, {
        message: disputeMessageText,
        senderRole: 'BUYER',
      });
      setTracking((prev) => ({
        ...prev,
        dispute: {
          ...prev.dispute,
          messages: [...(prev.dispute?.messages || []), res.data],
        },
      }));
      setDisputeMessageText('');
      showToast('Message sent to mediation thread.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setSendingDisputeMsg(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await apiPost(`reviews/${tracking.orderNumber}`, reviewValues);
      setTracking((prev) => ({
        ...prev,
        review: res.data,
      }));
      showToast('Review submitted successfully! Thank you for rating this order.', 'success');
      setReviewDialogOpen(false);
    } catch (err) {
      showToast(err.message || 'Failed to submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!tracking) return;
    printTaxInvoice(tracking, { role: 'buyer' });
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
            console.warn('[TradeExpress Tracking] API tracking fetch failed, checking local:', apiErr.message);
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

                {tracking.orderStatus === 'DELIVERED' && !tracking.dispute && (
                  <Button
                    onClick={() => setDisputeDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    icon={ShieldAlert}
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    Report Issue / Dispute
                  </Button>
                )}

                {tracking.orderStatus === 'DELIVERED' && !tracking.review && (
                  <Button
                    onClick={() => setReviewDialogOpen(true)}
                    variant="secondary"
                    size="sm"
                    icon={Star}
                  >
                    Rate & Review
                  </Button>
                )}

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

            {/* Escrow Protection & 5-Day Inspection Banner */}
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-navy-950">TradeExpress Escrow Secured</h3>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        tracking.escrowLedger?.status === 'RELEASED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tracking.escrowLedger?.status === 'FROZEN_DISPUTED'
                          ? 'bg-red-100 text-red-800'
                          : tracking.escrowLedger?.status === 'REFUNDED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tracking.escrowLedger?.status || 'HELD IN ESCROW'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted leading-relaxed">
                      {tracking.escrowLedger?.status === 'RELEASED'
                        ? 'Inspection period complete. Escrow payout has been safely settled to the supplier.'
                        : tracking.escrowLedger?.status === 'FROZEN_DISPUTED'
                        ? 'Escrow funds are temporarily frozen while our admin team mediates your open dispute.'
                        : tracking.escrowLedger?.status === 'REFUNDED'
                        ? 'Escrow funds have been refunded back to your account.'
                        : `Funds (${money(tracking.totals.total)}) are secured in escrow. Supplier payout will only be released 5 days after delivery once inspection confirms satisfaction.`}
                    </p>
                  </div>
                </div>

                {tracking.orderStatus === 'DELIVERED' && !tracking.dispute && (
                  <Button
                    onClick={() => setDisputeDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    icon={ShieldAlert}
                    className="border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100"
                  >
                    Open Inspection Dispute
                  </Button>
                )}
              </div>
            </div>

            {/* Active Dispute Section */}
            {tracking.dispute && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-5 text-amber-600" />
                      <h3 className="text-base font-bold text-amber-950">
                        Inspection Dispute Active · Reason: {tracking.dispute.reason.replace(/_/g, ' ')}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-amber-800">
                      Filed on {formatDateTime(tracking.dispute.createdAt)} · Status:{' '}
                      <span className="font-bold uppercase tracking-wider">{tracking.dispute.status}</span>
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-900">
                    {tracking.dispute.status}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-700 sm:text-sm">
                    <strong className="text-navy-950">Claim Description: </strong>
                    {tracking.dispute.description}
                  </p>

                  {tracking.dispute.photoProof && (
                    <div className="flex items-center gap-2 text-xs">
                      <strong className="text-navy-950">Inspection Proof: </strong>
                      <a
                        href={tracking.dispute.photoProof}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand-700 underline hover:text-brand-800"
                      >
                        View Photo Evidence <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}

                  {tracking.dispute.resolution && (
                    <div className="rounded-xl border border-amber-200 bg-white p-3 text-xs text-amber-950">
                      <strong>Admin Mediation Note: </strong>
                      {tracking.dispute.resolution}
                      {tracking.dispute.refundAmount > 0 && (
                        <p className="mt-1 font-bold text-emerald-700">Refund Approved: {money(tracking.dispute.refundAmount)}</p>
                      )}
                    </div>
                  )}

                  {/* Dispute Message Thread */}
                  {tracking.dispute.messages && tracking.dispute.messages.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-200/80 bg-white p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Mediation Discussion Thread</h4>
                      <div className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {tracking.dispute.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-2.5 text-xs ${
                              msg.senderRole === 'ADMIN'
                                ? 'bg-purple-50 text-purple-950 border border-purple-200'
                                : msg.senderRole === 'BUYER'
                                ? 'bg-blue-50 text-blue-950 border border-blue-100 ml-4'
                                : 'bg-slate-50 text-slate-900 mr-4'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-[0.6875rem] uppercase tracking-wider mb-1">
                              <span>{msg.senderRole}</span>
                              <span className="font-normal text-muted lowercase">{formatDateTime(msg.createdAt)}</span>
                            </div>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>

                      {/* Add reply */}
                      {tracking.dispute.status === 'OPEN' && (
                        <form onSubmit={handleSendDisputeMessage} className="mt-3 flex gap-2">
                          <input
                            type="text"
                            placeholder="Type a message to the mediation officer..."
                            value={disputeMessageText}
                            onChange={(e) => setDisputeMessageText(e.target.value)}
                            className="ts-input flex-1 text-xs"
                          />
                          <Button type="submit" variant="primary" size="sm" icon={Send} disabled={sendingDisputeMsg}>
                            Send
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verified Review Section */}
            {tracking.review && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <h3 className="font-bold text-navy-950">Your Verified Buyer Review</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-4 ${
                          star <= tracking.review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs font-bold text-navy-900">{tracking.review.rating}.0 / 5</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded bg-white/80 p-2 text-center">
                    <span className="text-muted block text-[0.6875rem]">Quality</span>
                    <strong className="text-navy-900 font-bold">{tracking.review.qualityRating || 5}/5 ★</strong>
                  </div>
                  <div className="rounded bg-white/80 p-2 text-center">
                    <span className="text-muted block text-[0.6875rem]">Packaging</span>
                    <strong className="text-navy-900 font-bold">{tracking.review.packagingRating || 5}/5 ★</strong>
                  </div>
                  <div className="rounded bg-white/80 p-2 text-center">
                    <span className="text-muted block text-[0.6875rem]">Timeliness</span>
                    <strong className="text-navy-900 font-bold">{tracking.review.timelinessRating || 5}/5 ★</strong>
                  </div>
                </div>

                {tracking.review.comment && (
                  <p className="mt-3 text-xs italic text-slate-700 bg-white/60 p-2.5 rounded-lg border border-emerald-100">
                    "{tracking.review.comment}"
                  </p>
                )}
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
              Enter your TradeExpress order number above to view real-time fulfillment progress and shipment milestones.
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

      {/* Dispute Dialog Modal */}
      <Modal
        open={disputeDialogOpen}
        onClose={() => setDisputeDialogOpen(false)}
        title="Report Goods Issue / Open Inspection Dispute"
        description={`Order #${tracking?.orderNumber} · 5-Day Inspection Period`}
        size="md"
      >
        <form onSubmit={handleSubmitDispute} className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
            <strong>Escrow Protection Notice:</strong> Opening an inspection claim immediately freezes supplier payout. Our mediation team reviews evidence within 24-48 business hours.
          </div>

          <div>
            <label htmlFor="dispute-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Primary Claim Reason
            </label>
            <CustomSelect
              id="dispute-reason"
              value={disputeValues.reason}
              onChange={(e) => setDisputeValues({ ...disputeValues, reason: e.target.value })}
              options={[
                { value: 'QUALITY_MISMATCH', label: 'Quality Mismatch (Does not match sample/specifications)' },
                { value: 'DAMAGED_GOODS', label: 'Damaged Goods in Transit' },
                { value: 'SHORTAGE', label: 'Shortage / Quantity Less than Ordered' },
                { value: 'INCORRECT_ITEMS', label: 'Incorrect Items Delivered' }
              ]}
            />
          </div>

          <div>
            <label htmlFor="dispute-res" className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Requested Resolution
            </label>
            <CustomSelect
              id="dispute-res"
              value={disputeValues.requestedResolution}
              onChange={(e) => setDisputeValues({ ...disputeValues, requestedResolution: e.target.value })}
              options={[
                { value: 'FULL_REFUND', label: 'Full Refund to Original Payment Source' },
                { value: 'PARTIAL_REFUND', label: 'Partial Refund / Price Adjustment' },
                { value: 'REPLACEMENT', label: 'Replacement of Defective Goods' }
              ]}
            />
          </div>

          <Textarea
            id="dispute-desc"
            label="Detailed Description of Issue"
            rows={4}
            required
            placeholder="Describe the defects, shortages, or discrepancies found during unboxing..."
            value={disputeValues.description}
            onChange={(e) => setDisputeValues({ ...disputeValues, description: e.target.value })}
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Photo Evidence Attachment
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-800"
              />
              {uploadingProof && <span className="text-xs text-muted">Uploading...</span>}
            </div>
            {disputeValues.photoProof && (
              <p className="mt-1.5 text-xs text-emerald-700 font-medium">✓ Photo evidence attached</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={submittingDispute}>
              Submit Dispute Claim
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review Dialog Modal */}
      <Modal
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        title="Rate & Review Wholesale Order"
        description={`Order #${tracking?.orderNumber}`}
        size="md"
      >
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Overall Supplier & Product Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewValues({ ...reviewValues, rating: star })}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`size-7 ${
                      star <= reviewValues.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 font-bold text-navy-900">{reviewValues.rating} of 5 Stars</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700">Material Quality</label>
              <CustomSelect
                value={reviewValues.qualityRating}
                onChange={(e) => setReviewValues({ ...reviewValues, qualityRating: Number(e.target.value) })}
                options={[5, 4, 3, 2, 1].map((r) => ({ value: r, label: `${r} Stars${r === 5 ? ' (Excellent)' : ''}` }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Packaging Protection</label>
              <CustomSelect
                value={reviewValues.packagingRating}
                onChange={(e) => setReviewValues({ ...reviewValues, packagingRating: Number(e.target.value) })}
                options={[5, 4, 3, 2, 1].map((r) => ({ value: r, label: `${r} Stars${r === 5 ? ' (Secure)' : ''}` }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Delivery Timeliness</label>
              <CustomSelect
                value={reviewValues.timelinessRating}
                onChange={(e) => setReviewValues({ ...reviewValues, timelinessRating: Number(e.target.value) })}
                options={[5, 4, 3, 2, 1].map((r) => ({ value: r, label: `${r} Stars${r === 5 ? ' (On-Time)' : ''}` }))}
              />
            </div>
          </div>

          <Textarea
            id="review-comment"
            label="Review Feedback (Public)"
            rows={3}
            placeholder="Share feedback on bulk quality, packaging integrity, and accuracy of dimensions..."
            value={reviewValues.comment}
            onChange={(e) => setReviewValues({ ...reviewValues, comment: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submittingReview}>
              Submit Review
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
