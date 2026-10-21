import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  HelpCircle,
  History,
  Layers,
  MapPin,
  MessageSquare,
  Package,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  Truck,
  XCircle,
  Zap,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge, { StatusBadge } from '../../components/common/Badge';
import Rating from '../../components/common/Rating';
import Modal from '../../components/common/Modal';
import Input, { Textarea } from '../../components/common/Input';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import useCart from '../../hooks/useCart';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useInquiries from '../../hooks/useInquiries';
import useProducts from '../../hooks/useProducts';
import { apiGet, apiPost, apiPut, isApiConfigured } from '../../services/apiClient';
import { formatDate } from '../../utils/formatDate';
import { formatNumber } from '../../utils/formatCurrency';
import { quantityLabel } from '../../utils/units';

export default function QuoteComparison() {
  const { rfqId } = useParams();
  const { user } = useAuth();
  const { money } = useCurrency();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();
  const { inquiries, counterInquiry, acceptInquiryQuote, rejectInquiryQuote } = useInquiries();
  const { getProduct, getCompany } = useProducts();
  const navigate = useNavigate();
  useDocumentTitle('Smart Quote Comparison');

  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters and sorting
  const [filterMeetsMoq, setFilterMeetsMoq] = useState(false);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterSampleAvailable, setFilterSampleAvailable] = useState(false);
  const [sortBy, setSortBy] = useState('totalCost'); // totalCost, unitPrice, leadTime, rating

  // Shortlisted quotes state
  const [shortlistedQuoteIds, setShortlistedQuoteIds] = useState(new Set());
  const [buyerNotes, setBuyerNotes] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Counter offer modal
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterTargetQuote, setCounterTargetQuote] = useState(null);
  const [counterUnitPrice, setCounterUnitPrice] = useState('');
  const [counterLeadTime, setCounterLeadTime] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // Negotiation history modal
  const [historyModalQuote, setHistoryModalQuote] = useState(null);

  // Fetch comparison data from backend or fallback to local
  const loadComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isApiConfigured) {
        const res = await apiGet(`rfq/${encodeURIComponent(rfqId)}/comparison`);
        if (res && res.success && res.data) {
          setComparisonData(res.data);
          if (res.data.rfq?.savedComparison?.shortlistedQuoteIds) {
            setShortlistedQuoteIds(new Set(res.data.rfq.savedComparison.shortlistedQuoteIds));
          }
          if (res.data.rfq?.savedComparison?.buyerNotes) {
            setBuyerNotes(res.data.rfq.savedComparison.buyerNotes);
          }
          if (res.data.rfq?.savedComparison?.preferredSort) {
            setSortBy(res.data.rfq.savedComparison.preferredSort);
          }
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[TradeSphere] API comparison error, falling back to local inquiry:', err.message);
    }

    // Fallback: build comparison from local InquiryContext
    const localInquiry = inquiries.find((i) => i.id === rfqId);
    if (localInquiry) {
      const q = localInquiry.quote;
      const company = localInquiry.companyId ? getCompany(localInquiry.companyId) : null;
      const requestedQuantity = localInquiry.quantity || 1;

      const quotes = [];
      if (q) {
        const unitPrice = Number(q.unitPrice || localInquiry.targetPrice || 500);
        const subtotal = unitPrice * requestedQuantity;
        const gstAmount = Math.round(subtotal * 0.18 * 100) / 100;
        const freight = Number(q.freightCharge || 2500);
        const otherCharges = Number(q.otherCharges || 0);
        const totalLandedCost = Math.round((subtotal + gstAmount + freight + otherCharges) * 100) / 100;
        const effectiveUnitPrice = Math.round((totalLandedCost / requestedQuantity) * 100) / 100;

        quotes.push({
          id: q.id || `local-quote-${localInquiry.id}`,
          quoteNumber: q.quoteNumber || `TS-QTE-${localInquiry.id}`,
          supplierId: localInquiry.companyId,
          supplier: {
            id: localInquiry.companyId,
            name: company?.contact?.person || 'Wholesale Rep',
            company: company?.name || 'Assigned Supplier',
            city: company?.city || 'Mumbai',
            country: company?.country || 'India',
            location: `${company?.city ? `${company.city}, ` : ''}${company?.country || 'India'}`,
            isVerified: company?.verification?.status === 'reviewed',
            kycStatus: company?.verification?.status === 'reviewed' ? 'VERIFIED' : 'NOT_SUBMITTED',
          },
          status: localInquiry.status || 'SENT',
          currentVersion: q.versions?.length || 1,
          currency: 'INR',
          unitPrice,
          moq: Math.max(1, Math.round(requestedQuantity * 0.5)),
          availableQuantity: requestedQuantity * 4,
          leadTimeDays: Number(q.leadTimeDays || 14),
          shippingMethod: 'Road Express',
          gstPercentage: 18,
          freightCharge: freight,
          otherCharges,
          paymentTerms: '100% Advance via Escrow',
          sampleAvailable: true,
          sampleCost: 1000,
          notes: q.note || 'Verified factory wholesale terms.',
          calculation: {
            requestedQuantity,
            unit: localInquiry.unit || 'piece',
            unitPrice,
            subtotal,
            gstPercentage: 18,
            gstAmount,
            freightAmount: freight,
            otherCharges,
            totalLandedCost,
            effectiveUnitPrice,
            meetsMoq: true,
            meetsStock: true,
          },
          highlights: {
            isLowestUnitPrice: true,
            isLowestTotalCost: true,
            isShortestLeadTime: true,
            meetsRequestedQuantity: true,
          },
          versions: q.versions || [],
        });
      }

      setComparisonData({
        rfq: {
          id: localInquiry.id,
          rfqNumber: localInquiry.id,
          title: localInquiry.productName,
          categorySlug: localInquiry.categorySlug,
          quantity: requestedQuantity,
          unit: localInquiry.unit || 'piece',
          targetPrice: localInquiry.targetPrice,
          destinationCountry: localInquiry.destinationCountry || 'India',
          specifications: localInquiry.specifications || 'Standard wholesale inquiry.',
          status: localInquiry.status || 'OPEN',
          createdAt: localInquiry.createdAt,
        },
        summary: {
          totalQuotes: quotes.length,
          priceSpread: {
            minUnitPrice: quotes[0]?.unitPrice || 0,
            maxUnitPrice: quotes[0]?.unitPrice || 0,
            savingsPotential: 0,
          },
          leadTimeSpread: {
            minDays: quotes[0]?.leadTimeDays || 0,
            maxDays: quotes[0]?.leadTimeDays || 0,
          },
          verifiedSuppliersCount: quotes.filter((q) => q.supplier.isVerified).length,
        },
        quotations: quotes,
      });
      setLoading(false);
      return;
    }

    setError(`Quotation comparison for RFQ '${rfqId}' could not be loaded.`);
    setLoading(false);
  };

  useEffect(() => {
    loadComparison();
  }, [rfqId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter & Sort quotations
  const displayedQuotations = useMemo(() => {
    if (!comparisonData?.quotations) return [];
    let list = [...comparisonData.quotations];

    if (filterMeetsMoq) {
      list = list.filter((q) => q.calculation.meetsMoq);
    }
    if (filterVerifiedOnly) {
      list = list.filter((q) => q.supplier.isVerified);
    }
    if (filterSampleAvailable) {
      list = list.filter((q) => q.sampleAvailable);
    }

    if (sortBy === 'totalCost') {
      list.sort((a, b) => a.calculation.totalLandedCost - b.calculation.totalLandedCost);
    } else if (sortBy === 'unitPrice') {
      list.sort((a, b) => a.unitPrice - b.unitPrice);
    } else if (sortBy === 'leadTime') {
      list.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.supplier.rating || 0) - (a.supplier.rating || 0));
    }

    return list;
  }, [comparisonData?.quotations, filterMeetsMoq, filterVerifiedOnly, filterSampleAvailable, sortBy]);

  const toggleShortlist = (quoteId) => {
    setShortlistedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      if (isApiConfigured) {
        await apiPut(`rfq/${encodeURIComponent(rfqId)}/comparison`, {
          shortlistedQuoteIds: Array.from(shortlistedQuoteIds),
          preferredSort: sortBy,
          buyerNotes,
        });
        showToast('Comparison preferences and shortlisted quotes saved successfully!', 'success');
      } else {
        showToast('Comparison preferences saved locally.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save comparison preferences.', 'error');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Accept quote
  const handleAcceptQuote = async (quote) => {
    try {
      if (isApiConfigured) {
        await apiPost(`rfq/quotes/${encodeURIComponent(quote.id)}/accept`);
      }
      acceptInquiryQuote(rfqId);

      // Add to cart at negotiated price
      const rfq = comparisonData?.rfq;
      addToCart(
        {
          id: rfq?.items?.[0]?.productId || rfq?.id,
          name: rfq?.items?.[0]?.productName || rfq?.title,
          photo: rfq?.items?.[0]?.product?.photo || null,
          price: quote.unitPrice,
          unit: rfq?.unit || 'piece',
          companyId: quote.supplierId,
          negotiatedRfqId: rfq?.id,
          negotiatedQuoteId: quote.id,
        },
        rfq?.quantity || 1
      );

      showToast(`Accepted Quote #${quote.quoteNumber} from ${quote.supplier.company}! Added to cart at negotiated terms.`, 'success');
      navigate('/cart');
    } catch (err) {
      showToast(err.message || 'Failed to accept quotation.', 'error');
    }
  };

  // Open Counter Offer Modal
  const openCounterModal = (quote) => {
    setCounterTargetQuote(quote);
    setCounterUnitPrice(String(quote.unitPrice));
    setCounterLeadTime(String(quote.leadTimeDays));
    setCounterNotes('');
    setCounterModalOpen(true);
  };

  const handleSubmitCounter = async (e) => {
    e.preventDefault();
    if (!counterUnitPrice || Number(counterUnitPrice) <= 0) {
      showToast('Please enter a valid counter unit price.', 'warning');
      return;
    }

    setSubmittingCounter(true);
    try {
      if (isApiConfigured) {
        await apiPost(`rfq/quotes/${encodeURIComponent(counterTargetQuote.id)}/counter`, {
          unitPrice: Number(counterUnitPrice),
          leadTimeDays: Number(counterLeadTime || 14),
          notes: counterNotes.trim(),
          role: 'BUYER',
        });
      } else {
        counterInquiry(rfqId, {
          unitPrice: Number(counterUnitPrice),
          leadTimeDays: Number(counterLeadTime || 14),
          note: counterNotes.trim(),
          proposedBy: 'BUYER',
        });
      }

      showToast(`Counter-offer sent to ${counterTargetQuote.supplier.company}!`, 'success');
      setCounterModalOpen(false);
      loadComparison();
    } catch (err) {
      showToast(err.message || 'Failed to send counter-offer.', 'error');
    } finally {
      setSubmittingCounter(false);
    }
  };

  if (loading) {
    return (
      <div className="ts-container py-8">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error || !comparisonData) {
    return (
      <div className="ts-container py-8">
        <div className="ts-card">
          <ErrorState text={error || 'Quotation comparison not available.'} onRetry={loadComparison} />
        </div>
      </div>
    );
  }

  const { rfq, summary, quotations } = comparisonData;
  const hasMultipleQuotes = quotations.length > 1;

  return (
    <div className="ts-container py-6 sm:py-8">
      {/* Top Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/buyer/quotes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-700 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to My Quotes
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={RotateCcw}
            onClick={loadComparison}
            className="!text-xs"
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="navy"
            icon={BookmarkCheck}
            onClick={handleSavePreferences}
            loading={savingPreferences}
            className="!text-xs"
          >
            Save Comparison
          </Button>
        </div>
      </div>

      {/* RFQ Context Header */}
      <div className="ts-card p-6 shadow-sm mb-6 bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 text-white rounded-3xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-mono font-medium text-navy-200">
                <Scale className="size-3" /> RFQ #{rfq.rfqNumber}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                {rfq.status}
              </span>
              <span className="text-xs text-navy-300">
                Created {formatDate(rfq.createdAt)}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {rfq.title}
            </h1>

            <p className="mt-1 max-w-3xl text-xs sm:text-sm text-navy-200 leading-relaxed">
              <span className="font-semibold text-white">Specifications: </span>
              {rfq.specifications}
            </p>
          </div>

          {/* Quick Specs badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 shrink-0">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-300">Requested Qty</p>
              <p className="mt-0.5 text-base font-bold text-white">{quantityLabel(rfq.quantity, rfq.unit)}</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-300">Target Price</p>
              <p className="mt-0.5 text-base font-bold text-white">
                {rfq.targetPrice ? money(rfq.targetPrice) : 'Open Bidding'}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-300">Destination</p>
              <p className="mt-0.5 text-base font-bold text-white">{rfq.destinationCountry || 'India'}</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-300">Offers Received</p>
              <p className="mt-0.5 text-base font-bold text-emerald-400">{summary.totalQuotes} Quotations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Spread Highlights */}
      {hasMultipleQuotes && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ts-card p-4 border-l-4 border-l-brand-600 bg-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Price Spread</p>
              <Sparkles className="size-4 text-brand-600" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-navy-900">
              {money(summary.priceSpread.minUnitPrice)} – {money(summary.priceSpread.maxUnitPrice)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Per unit before freight & taxes</p>
          </div>

          <div className="ts-card p-4 border-l-4 border-l-emerald-600 bg-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Savings Potential</p>
              <TrendingDown className="size-4 text-emerald-600" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-emerald-600">
              {money(summary.priceSpread.savingsPotential)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Total landed cost differential</p>
          </div>

          <div className="ts-card p-4 border-l-4 border-l-blue-600 bg-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Dispatch Lead Time</p>
              <Clock className="size-4 text-blue-600" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-navy-900">
              {summary.leadTimeSpread.minDays} – {summary.leadTimeSpread.maxDays} Days
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Fastest delivery vs standard</p>
          </div>

          <div className="ts-card p-4 border-l-4 border-l-amber-500 bg-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Verified Factories</p>
              <ShieldCheck className="size-4 text-amber-500" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-navy-900">
              {summary.verifiedSuppliersCount} of {summary.totalQuotes}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">KYC and business-registered</p>
          </div>
        </div>
      )}

      {/* Comparison Controls Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-navy-900">Filter Quotes:</span>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:border-brand-500">
            <input
              type="checkbox"
              checked={filterMeetsMoq}
              onChange={(e) => setFilterMeetsMoq(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Meets MOQ
          </label>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:border-brand-500">
            <input
              type="checkbox"
              checked={filterVerifiedOnly}
              onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Verified Only
          </label>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:border-brand-500">
            <input
              type="checkbox"
              checked={filterSampleAvailable}
              onChange={(e) => setFilterSampleAvailable(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Samples Available
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-navy-900">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="ts-input !py-1.5 !text-xs font-semibold"
          >
            <option value="totalCost">Lowest Landed Cost</option>
            <option value="unitPrice">Lowest Unit Price</option>
            <option value="leadTime">Fastest Delivery Lead Time</option>
            <option value="rating">Highest Supplier Rating</option>
          </select>
        </div>
      </div>

      {/* No quotes view */}
      {displayedQuotations.length === 0 ? (
        <div className="ts-card p-12 text-center">
          <Building2 className="mx-auto size-12 text-muted" />
          <h2 className="mt-3 text-lg font-bold text-navy-900">No matching quotations</h2>
          <p className="mt-1 text-xs text-muted">
            {quotations.length === 0
              ? 'No suppliers have submitted quotations for this RFQ yet. Suppliers will review your request and submit binding offers soon.'
              : 'Try clearing your active filters to view all submitted quotes.'}
          </p>
          {quotations.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setFilterMeetsMoq(false);
                setFilterVerifiedOnly(false);
                setFilterSampleAvailable(false);
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        /* Side-by-Side Comparison Matrix */
        <div className="overflow-x-auto rounded-3xl border border-navy-100 bg-white shadow-card">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            {/* Table Header: Supplier Info */}
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="sticky left-0 z-20 w-56 bg-navy-50 p-4 font-bold text-navy-900">
                  <div className="flex items-center gap-2">
                    <Scale className="size-4 text-brand-600" />
                    <span>Comparison Metric</span>
                  </div>
                </th>

                {displayedQuotations.map((quote) => {
                  const isShortlisted = shortlistedQuoteIds.has(quote.id);
                  const isAccepted = quote.status === 'ACCEPTED';
                  const isRejected = quote.status === 'REJECTED';

                  return (
                    <th key={quote.id} className="min-w-[280px] p-4 align-top">
                      <div className="relative rounded-2xl border bg-white p-4 shadow-sm transition-all hover:border-brand-500">
                        {/* Bookmark / Shortlist button */}
                        <button
                          type="button"
                          onClick={() => toggleShortlist(quote.id)}
                          title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                          className={`absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full transition-colors ${
                            isShortlisted
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-muted hover:bg-slate-200'
                          }`}
                        >
                          <BookmarkCheck className="size-4" />
                        </button>

                        <div className="pr-6">
                          <h3 className="font-display text-base font-bold text-navy-900">
                            {quote.supplier.company}
                          </h3>

                          <p className="mt-0.5 text-xs text-muted flex items-center gap-1">
                            <MapPin className="size-3 text-navy-500" />
                            {quote.supplier.location}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {quote.supplier.isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-500/20">
                                <CheckCircle2 className="size-3 text-emerald-600" /> Verified Factory
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                Unverified
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                              <Clock className="size-3" /> Round {quote.currentVersion} of 3
                            </span>
                          </div>
                        </div>

                        {/* Comparative Highlight Badge */}
                        <div className="mt-3 space-y-1">
                          {quote.highlights.isLowestTotalCost && (
                            <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1 text-[11px] font-bold text-white shadow-sm">
                              <Sparkles className="size-3" /> Lowest Landed Cost
                            </span>
                          )}

                          {quote.highlights.isLowestUnitPrice && !quote.highlights.isLowestTotalCost && (
                            <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 py-1 text-[11px] font-bold text-white shadow-sm">
                              <Sparkles className="size-3" /> Lowest Unit Price
                            </span>
                          )}

                          {quote.highlights.isShortestLeadTime && (
                            <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 py-1 text-[11px] font-bold text-white shadow-sm">
                              <Zap className="size-3" /> Fastest Delivery ({quote.leadTimeDays}d)
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Matrix Body */}
            <tbody className="divide-y divide-navy-100">
              {/* Row 1: Unit Price */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Unit Price (excl. Tax)
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 font-display text-lg font-bold text-navy-900">
                    {money(q.unitPrice)}
                    <span className="text-xs font-normal text-muted"> / {rfq.unit}</span>
                  </td>
                ))}
              </tr>

              {/* Row 2: MOQ Compliance */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Supplier MOQ
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-navy-900">{formatNumber(q.moq)} {rfq.unit}s</span>
                      {q.calculation.meetsMoq ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                          <CheckCircle className="size-3.5" /> (Meets Qty)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                          <AlertCircle className="size-3.5" /> (Higher than requested)
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Row 3: Available Stock */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Available Stock
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-xs font-medium text-navy-800">
                    {q.availableQuantity ? `${formatNumber(q.availableQuantity)} ${rfq.unit}s` : 'Made to order'}
                  </td>
                ))}
              </tr>

              {/* Row 4: Item Subtotal */}
              <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                <td className="sticky left-0 bg-slate-50/80 p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Subtotal ({formatNumber(rfq.quantity)} {rfq.unit}s)
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 font-semibold text-navy-900">
                    {money(q.calculation.subtotal)}
                  </td>
                ))}
              </tr>

              {/* Row 5: GST / Taxes */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  <div className="flex items-center gap-1">
                    GST / Taxes
                    <span className="text-xs font-normal text-muted">(B2B ITC eligible)</span>
                  </div>
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-navy-800">
                    <span className="font-semibold">{money(q.calculation.gstAmount)}</span>
                    <span className="text-xs text-muted"> ({q.gstPercentage}%)</span>
                  </td>
                ))}
              </tr>

              {/* Row 6: Freight & Shipping */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Freight & Logistics
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-navy-800">
                    <span className="font-semibold">{money(q.calculation.freightAmount)}</span>
                    <span className="block text-xs text-muted">via {q.shippingMethod || 'Express Ground'}</span>
                  </td>
                ))}
              </tr>

              {/* Row 7: Other Charges */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Packaging & Other Charges
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-navy-800">
                    {q.calculation.otherCharges > 0 ? (
                      <>
                        <span className="font-semibold">{money(q.calculation.otherCharges)}</span>
                        {q.calculation.otherChargesDesc && (
                          <span className="block text-xs text-muted">({q.calculation.otherChargesDesc})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold">₹0 (Included)</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 8: TOTAL LANDED COST (Prominent) */}
              <tr className="bg-emerald-50/40 border-y-2 border-emerald-300">
                <td className="sticky left-0 bg-emerald-50 p-4 font-extrabold text-navy-900 border-r border-emerald-200">
                  <div className="flex items-center gap-1.5 text-base text-emerald-950">
                    <CheckCircle2 className="size-5 text-emerald-700" />
                    TOTAL LANDED COST
                  </div>
                  <span className="text-[11px] font-normal text-emerald-800">Subtotal + GST + Freight + Charges</span>
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 bg-emerald-50/40">
                    <p className="font-display text-2xl font-black text-emerald-950">
                      {money(q.calculation.totalLandedCost)}
                    </p>
                    <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                      ≈ {money(q.calculation.effectiveUnitPrice)} / unit effective
                    </p>
                  </td>
                ))}
              </tr>

              {/* Row 9: Lead Time */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Dispatch Lead Time
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4">
                    <span className="font-display text-base font-bold text-navy-900">{q.leadTimeDays} Days</span>
                    <span className="block text-xs text-muted">Dispatch from warehouse</span>
                  </td>
                ))}
              </tr>

              {/* Row 10: Payment Terms */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Payment Terms
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-xs font-medium text-navy-800">
                    {q.paymentTerms || '100% Advance via Escrow'}
                  </td>
                ))}
              </tr>

              {/* Row 11: Sample Policy */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Pre-production Sample
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-xs text-navy-800">
                    {q.sampleAvailable ? (
                      <span className="font-semibold text-emerald-700">
                        Available {q.sampleCost > 0 ? `(${money(q.sampleCost)})` : '(Free on MOQ)'}
                      </span>
                    ) : (
                      <span className="text-muted">Not offered</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 12: Supplier Notes / Remarks */}
              <tr className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white p-4 font-semibold text-navy-900 border-r border-navy-100">
                  Supplier Remarks
                </td>
                {displayedQuotations.map((q) => (
                  <td key={q.id} className="p-4 text-xs text-ink leading-relaxed max-w-xs">
                    {q.notes || 'Standard manufacturing standards apply.'}
                  </td>
                ))}
              </tr>

              {/* Row 13: Actions */}
              <tr className="bg-slate-50/80">
                <td className="sticky left-0 bg-slate-50 p-4 font-bold text-navy-900 border-r border-navy-100">
                  Buyer Actions
                </td>
                {displayedQuotations.map((quote) => {
                  const isAccepted = quote.status === 'ACCEPTED';
                  const isClosed = rfq.status === 'CLOSED';
                  const isFinalRound = quote.currentVersion >= 3;

                  return (
                    <td key={quote.id} className="p-4">
                      <div className="space-y-2">
                        {isAccepted ? (
                          <div className="rounded-xl border border-emerald-300 bg-emerald-100/70 p-2.5 text-center text-xs font-bold text-emerald-800">
                            ✓ Accepted & Order Created
                          </div>
                        ) : isClosed ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-center text-xs text-muted font-medium">
                            RFQ Closed
                          </div>
                        ) : (
                          <>
                            <Button
                              full
                              size="sm"
                              variant="navy"
                              icon={ShoppingCart}
                              onClick={() => handleAcceptQuote(quote)}
                            >
                              Accept & Order
                            </Button>

                            <Button
                              full
                              size="sm"
                              variant="outline"
                              icon={History}
                              disabled={isFinalRound}
                              onClick={() => openCounterModal(quote)}
                            >
                              {isFinalRound ? 'Round 3 of 3 (Final)' : `Counter Offer (R${quote.currentVersion + 1})`}
                            </Button>
                          </>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Link
                            to={`/suppliers/${quote.supplier.company?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || quote.supplierId}`}
                            className="flex-1 text-center text-xs font-semibold text-navy-700 hover:text-brand-600"
                          >
                            View Profile
                          </Link>

                          {quote.versions?.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setHistoryModalQuote(quote)}
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                              History ({quote.versions.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Buyer Notes and Bookmark Section */}
      <div className="mt-8 ts-card p-6 rounded-2xl bg-white border border-navy-100">
        <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
          <BookmarkCheck className="size-5 text-brand-600" />
          Buyer Comparison Notes & Shortlist
        </h2>
        <p className="mt-1 text-xs text-muted">
          Add confidential procurement notes and bookmark your top shortlisted supplier proposals for your team.
        </p>

        <div className="mt-4">
          <Textarea
            rows={3}
            placeholder="e.g. Supplier 2 provides the lowest total landed cost. Supplier 1 is 8 days faster for emergency backup..."
            value={buyerNotes}
            onChange={(e) => setBuyerNotes(e.target.value)}
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted">
              {shortlistedQuoteIds.size} quote(s) currently bookmarked.
            </span>
            <Button
              size="sm"
              variant="navy"
              onClick={handleSavePreferences}
              loading={savingPreferences}
            >
              Save Notes & Shortlist
            </Button>
          </div>
        </div>
      </div>

      {/* Counter Offer Modal */}
      <Modal
        open={counterModalOpen}
        onClose={() => setCounterModalOpen(false)}
        title={counterTargetQuote ? `Counter-Offer: ${counterTargetQuote.supplier.company}` : 'Counter-Offer'}
        size="md"
      >
        {counterTargetQuote && (
          <form onSubmit={handleSubmitCounter} className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
              <span className="font-bold">Negotiation Round {counterTargetQuote.currentVersion + 1} of 3: </span>
              TradeSphere allows up to 3 structured rounds of binding counter-proposals to ensure fast closing.
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-muted">Supplier's Current Price: </span>
                <span className="font-bold text-navy-900">{money(counterTargetQuote.unitPrice)}</span>
              </div>
              <div>
                <span className="text-muted">Supplier's Current Lead Time: </span>
                <span className="font-bold text-navy-900">{counterTargetQuote.leadTimeDays} Days</span>
              </div>
            </div>

            <div>
              <label htmlFor="counter-unit-price" className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                Your Counter Unit Price (₹ INR) *
              </label>
              <Input
                id="counter-unit-price"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={counterUnitPrice}
                onChange={(e) => setCounterUnitPrice(e.target.value)}
                placeholder="e.g. 1050"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="counter-lead-time" className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                Requested Dispatch Lead Time (Days)
              </label>
              <Input
                id="counter-lead-time"
                type="number"
                min="1"
                value={counterLeadTime}
                onChange={(e) => setCounterLeadTime(e.target.value)}
                placeholder="e.g. 10"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="counter-notes" className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                Counter Terms or Message
              </label>
              <Textarea
                id="counter-notes"
                rows={3}
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                placeholder="Explain justification for price, e.g. repeat purchase volume or expedited pickup..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <Button variant="outline" type="button" onClick={() => setCounterModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="navy" type="submit" loading={submittingCounter} icon={Send}>
                Submit Counter-Offer
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Negotiation History Modal */}
      <Modal
        open={Boolean(historyModalQuote)}
        onClose={() => setHistoryModalQuote(null)}
        title="Negotiation Version History"
        size="md"
      >
        {historyModalQuote && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Complete audit trail of price and lead time negotiations with <span className="font-bold text-navy-900">{historyModalQuote.supplier.company}</span>.
            </p>

            <ul className="divide-y divide-slate-100 rounded-xl border border-navy-100 overflow-hidden">
              {(historyModalQuote.versions || []).map((ver) => (
                <li key={ver.id || ver.versionNumber} className="p-3.5 text-xs bg-white">
                  <div className="flex items-center justify-between font-bold text-navy-900">
                    <span>Round {ver.versionNumber || ver.version}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      ver.proposedBy === 'BUYER' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      Proposed by {ver.proposedBy || 'Supplier'}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-muted">
                    <div>Unit Price: <span className="font-semibold text-navy-900">{money(ver.unitPrice)}</span></div>
                    <div>Lead Time: <span className="font-semibold text-navy-900">{ver.leadTimeDays} Days</span></div>
                  </div>

                  {ver.notes && (
                    <p className="mt-1.5 italic text-slate-600 bg-slate-50 p-2 rounded">
                      "{ver.notes}"
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
