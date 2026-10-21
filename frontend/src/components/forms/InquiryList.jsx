import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  History,
  MessageSquare,
  Scale,
  Send,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import { StatusBadge } from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input, { Textarea } from '../common/Input';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useInquiries from '../../hooks/useInquiries';
import useCart from '../../hooks/useCart';
import useNotifications from '../../hooks/useNotifications';
import { formatDate } from '../../utils/formatDate';
import { quantityLabel } from '../../utils/units';

export default function InquiryList({ inquiries }) {
  const { getProduct, getCompany } = useProducts();
  const { money } = useCurrency();
  const { counterInquiry, acceptInquiryQuote, rejectInquiryQuote } = useInquiries();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  // State for counter offer dialog
  const [counterTarget, setCounterTarget] = useState(null);
  const [counterValues, setCounterValues] = useState({
    unitPrice: '',
    leadTimeDays: '',
    note: '',
  });
  const [showHistoryFor, setShowHistoryFor] = useState(null);

  const openCounterModal = (inquiry) => {
    setCounterTarget(inquiry);
    setCounterValues({
      unitPrice: String(inquiry.quote?.unitPrice || inquiry.targetPrice || ''),
      leadTimeDays: String(inquiry.quote?.leadTimeDays || '14'),
      note: '',
    });
  };

  const handleSendCounter = (e) => {
    e.preventDefault();
    if (!counterValues.unitPrice || Number(counterValues.unitPrice) <= 0) {
      showToast('Please enter a valid counter unit price.', 'warning');
      return;
    }

    try {
      counterInquiry(counterTarget.id, {
        unitPrice: Number(counterValues.unitPrice),
        leadTimeDays: Number(counterValues.leadTimeDays || 14),
        note: counterValues.note.trim(),
        proposedBy: 'BUYER',
      });
      showToast('Counter-offer sent successfully to supplier!', 'success');
      setCounterTarget(null);
    } catch (err) {
      showToast(err.message || 'Failed to submit counter-offer.', 'error');
    }
  };

  const handleAcceptQuote = (inquiry) => {
    acceptInquiryQuote(inquiry.id);
    const product = inquiry.productId ? getProduct(inquiry.productId) : null;

    addToCart(
      {
        ...(product || {
          id: inquiry.productId || inquiry.id,
          name: inquiry.productName,
          photo: null,
          companyId: inquiry.companyId,
          unit: inquiry.unit || 'piece',
        }),
        price: inquiry.quote.unitPrice,
        negotiatedRfqId: inquiry.id,
      },
      inquiry.quantity
    );

    showToast(`Quote accepted! Added ${inquiry.quantity} × ${inquiry.productName} to cart at negotiated price ${money(inquiry.quote.unitPrice)}/unit.`, 'success');
    navigate('/cart');
  };

  const handleDeclineQuote = (inquiry) => {
    rejectInquiryQuote(inquiry.id, 'Declined by buyer.');
    showToast('Quote declined.', 'info');
  };

  return (
    <>
      <ul className="space-y-5">
        {inquiries.map((inquiry) => {
          const product = inquiry.productId ? getProduct(inquiry.productId) : null;
          const company = inquiry.companyId ? getCompany(inquiry.companyId) : null;
          const quote = inquiry.quote;
          const versions = quote?.versions || [];
          const currentRound = versions.length > 0 ? versions.length : quote ? 1 : 0;
          const maxRoundsReached = currentRound >= 3;
          const isAccepted = inquiry.status === 'Accepted';
          const isDeclined = inquiry.status === 'Declined';

          return (
            <li key={inquiry.id} className="ts-card overflow-hidden p-5 transition-shadow hover:shadow-md sm:p-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted">{inquiry.id}</span>
                    <span className="text-xs text-muted">· {formatDate(inquiry.createdAt)}</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-navy-900">
                    {product ? (
                      <Link to={`/products/${product.slug}`} className="hover:text-brand-600">
                        {inquiry.productName}
                      </Link>
                    ) : (
                      inquiry.productName
                    )}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {company ? (
                      <>
                        Supplier: <Link to={`/suppliers/${company.slug}`} className="font-semibold text-navy-800 hover:text-brand-600">{company.name}</Link>
                      </>
                    ) : (
                      'Open marketplace request (Multiple suppliers may quote)'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {quote && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      maxRoundsReached ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      <Clock className="size-3" />
                      Round {currentRound} of 3 {maxRoundsReached ? '(Final)' : ''}
                    </span>
                  )}
                  <StatusBadge status={inquiry.status} />
                </div>
              </div>

              {/* Inquiry details */}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50/70 p-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Quantity</dt>
                  <dd className="mt-0.5 font-bold text-navy-900">{quantityLabel(inquiry.quantity, inquiry.unit)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Target Price</dt>
                  <dd className="mt-0.5 font-bold text-navy-900">
                    {inquiry.targetPrice !== null && inquiry.targetPrice !== undefined ? money(inquiry.targetPrice) : 'Not specified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Destination</dt>
                  <dd className="mt-0.5 font-medium text-navy-900">{inquiry.destinationCountry || 'India'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Required By</dt>
                  <dd className="mt-0.5 font-medium text-navy-900">{inquiry.deliveryTime || 'Standard'}</dd>
                </div>
              </dl>

              {inquiry.specifications && (
                <p className="mt-3 text-xs leading-relaxed text-ink sm:text-sm">
                  <span className="font-semibold text-navy-900">Specifications: </span>
                  {inquiry.specifications}
                </p>
              )}

              {/* Quotation & Negotiation Card */}
              {quote ? (
                <div className={`mt-5 rounded-xl border p-4 sm:p-5 ${
                  isAccepted
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : isDeclined
                    ? 'border-slate-200 bg-slate-50 opacity-80'
                    : 'border-orange-200 bg-gradient-to-r from-orange-50/50 via-white to-amber-50/40'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy-900">
                        {isAccepted ? 'Agreed Quotation' : `Active Quote · Round ${currentRound} of 3`}
                      </span>
                      <span className="text-xs text-muted">Last proposed by <span className="font-semibold uppercase">{quote.lastProposedBy || 'Supplier'}</span></span>
                    </div>

                    {versions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowHistoryFor(showHistoryFor === inquiry.id ? null : inquiry.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                      >
                        <History className="size-3.5" />
                        {showHistoryFor === inquiry.id ? 'Hide negotiation history' : `View negotiation history (${versions.length} rounds)`}
                      </button>
                    )}
                  </div>

                  {/* Negotiation History Dropdown */}
                  {showHistoryFor === inquiry.id && versions.length > 0 && (
                    <div className="my-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                      <p className="font-semibold uppercase tracking-wider text-muted">Negotiation Rounds</p>
                      {versions.map((ver, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0">
                          <div>
                            <span className="font-bold text-navy-900">Round {ver.version}: </span>
                            <span className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase ${
                              ver.proposedBy === 'BUYER' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {ver.proposedBy}
                            </span>
                            {ver.note && <span className="ml-2 italic text-muted">"{ver.note}"</span>}
                          </div>
                          <div className="font-mono font-bold text-navy-900">
                            {money(ver.unitPrice)} / {inquiry.unit} · {ver.leadTimeDays}d lead
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Current Active Quote Terms */}
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted">Offered Unit Price</p>
                      <p className="text-lg font-black text-navy-900">{money(quote.unitPrice)} <span className="text-xs font-normal text-muted">/{inquiry.unit}</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Estimated Total</p>
                      <p className="text-lg font-black text-brand-600">{money(quote.unitPrice * inquiry.quantity)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Lead Time</p>
                      <p className="text-base font-bold text-navy-900">{quote.leadTimeDays} business days</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Payment Terms</p>
                      <p className="text-base font-bold text-navy-900">{quote.paymentTerms || '100% Escrow'}</p>
                    </div>
                  </div>

                  {quote.note && (
                    <div className="mt-3 rounded bg-white/80 p-2 text-xs text-slate-700">
                      <span className="font-semibold text-navy-900">Note: </span>{quote.note}
                    </div>
                  )}

                  {/* Final Round Advisory */}
                  {maxRoundsReached && !isAccepted && !isDeclined && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                      <strong>Round 3 reached:</strong> This is the final offer. The 3-round negotiation limit has been reached. Please accept the quote to place the order or decline it.
                    </div>
                  )}

                  {/* Actions for Buyer */}
                  {!isAccepted && !isDeclined && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 pt-2">
                      <Button
                        variant="primary"
                        icon={ShoppingCart}
                        onClick={() => handleAcceptQuote(inquiry)}
                      >
                        Accept & Place Order
                      </Button>

                      {!maxRoundsReached && (
                        <Button
                          variant="outline"
                          icon={MessageSquare}
                          onClick={() => openCounterModal(inquiry)}
                        >
                          Counter-Offer (Round {currentRound + 1} of 3)
                        </Button>
                      )}

                      <Button
                        to={`/buyer/quotes/compare/${inquiry.id}`}
                        variant="outline"
                        icon={Scale}
                      >
                        Smart Comparison
                      </Button>

                      <Button
                        variant="ghost"
                        icon={XCircle}
                        onClick={() => handleDeclineQuote(inquiry)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Decline Quote
                      </Button>
                    </div>
                  )}

                  {isAccepted && (
                    <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <CheckCircle className="size-4 text-emerald-600" />
                      Agreed! Added to cart at {money(quote.unitPrice)} per unit.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
                  <p className="text-xs text-muted">
                    Waiting for supplier response. When a quotation is submitted, you will be able to review, accept, or counter-offer up to 3 rounds.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Counter-Offer Modal */}
      <Modal
        open={Boolean(counterTarget)}
        onClose={() => setCounterTarget(null)}
        title={`Counter-Offer · Round ${(counterTarget?.quote?.versions?.length || 1) + 1} of 3`}
        description={`Negotiate terms for ${counterTarget?.quantity} × ${counterTarget?.productName}`}
        size="md"
      >
        {counterTarget && (
          <form onSubmit={handleSendCounter} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-navy-800">
              <span className="font-semibold">Supplier's Current Offer: </span>
              {money(counterTarget.quote?.unitPrice)} per {counterTarget.unit} · {counterTarget.quote?.leadTimeDays} days lead time.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="counter-price"
                label={`Your Counter Unit Price (₹ / ${counterTarget.unit})`}
                type="number"
                step="0.01"
                min="0.01"
                required
                value={counterValues.unitPrice}
                onChange={(e) => setCounterValues({ ...counterValues, unitPrice: e.target.value })}
              />

              <Input
                id="counter-lead"
                label="Desired Lead Time (days)"
                type="number"
                min="1"
                max="365"
                required
                value={counterValues.leadTimeDays}
                onChange={(e) => setCounterValues({ ...counterValues, leadTimeDays: e.target.value })}
              />
            </div>

            <Textarea
              id="counter-note"
              label="Counter-Offer Message to Supplier"
              rows={3}
              placeholder="e.g. Can you meet our budget of ₹185 for 1,000 units if we commit to repeat orders?"
              value={counterValues.note}
              onChange={(e) => setCounterValues({ ...counterValues, note: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="outline" type="button" onClick={() => setCounterTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" icon={Send}>
                Send Counter-Offer
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
