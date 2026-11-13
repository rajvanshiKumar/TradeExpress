import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  FileText,
  Lock,
  Package,
  Send,
  ShieldCheck,
  Truck,
  UploadCloud,
} from 'lucide-react';
import Input, { Textarea } from '../common/Input';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useCurrency, { currencySymbol, formatMoney } from '../../hooks/useCurrency';
import useInquiries from '../../hooks/useInquiries';
import useNotifications from '../../hooks/useNotifications';
import { quantityLabel } from '../../utils/units';
import { photoUrl } from '../../utils/images';
import { productPhoto, productUnit as unitOf, validMoq, validPrice } from '../../utils/productDisplay';
import { apiGet, apiPost, isApiConfigured } from '../../services/apiClient';

/**
 * Direct RFQ from Product Details Page
 * Automatically locks and prefills product & supplier information.
 * Asks only for required quantity (>= MOQ), target price, specifications,
 * delivery location, delivery time, message, and attachments.
 */
export default function ProductRfqForm({ product, company = null, supplierId: requestedSupplierId = '', onDone = null }) {
  const { user, preferences, addresses } = useAuth();
  const { submitInquiry } = useInquiries();
  const { showToast } = useNotifications();

  // The supplier this request goes to: the one the buyer picked on the product page, otherwise the listing's own
  // supplier account. Their details come from the supplier records on the server, never from assumptions.
  const targetSupplierId = requestedSupplierId || product?.supplierId || '';
  const [offer, setOffer] = useState(null);
  const [offerChecked, setOfferChecked] = useState(!product?.supplierId || !isApiConfigured);
  useEffect(() => {
    if (!product?.supplierId || !isApiConfigured || String(product.id || '').startsWith('inq-') || String(product.id || '').startsWith('custom-')) return undefined;
    let active = true;
    apiGet(`products/${encodeURIComponent(product.slug || product.id)}/suppliers`)
      .then((res) => {
        const match = (res?.data?.suppliers || []).find((s) => s.supplierId === targetSupplierId) || null;
        if (active) setOffer(match);
      })
      .catch(() => {})
      .finally(() => { if (active) setOfferChecked(true); });
    return () => { active = false; };
  }, [product?.id, product?.slug, product?.supplierId, targetSupplierId]);

  const ownListing = targetSupplierId && targetSupplierId === product?.supplierId ? product?.supplier : null;
  const supplierName = offer?.companyName || ownListing?.company || ownListing?.name || company?.name || product?.company || 'TradeExpress Verified Supplier';
  const supplierCity = offer?.city || ownListing?.city || company?.city || '';
  const supplierCountry = offer?.country || ownListing?.country || company?.country || '';
  const supplierLocation = [supplierCity, supplierCountry].filter(Boolean).join(', ');
  const isVerified = (offer?.kycStatus || ownListing?.kycStatus) === 'VERIFIED' || Boolean(company?.verified);
  // A request is routed to one supplier only when that supplier has a real account; otherwise it is an open request
  const routedSupplierId = offer?.supplierId || (ownListing ? targetSupplierId : company?.id || '');

  // The chosen supplier's own listing terms when they differ from the product shown
  const minOrderQty = validMoq(offer?.moq) ?? validMoq(product?.moq) ?? 1;
  const productUnit = unitOf(product) || 'piece';
  const listedPrice = validPrice(offer?.price) ?? validPrice(product?.price);
  const priceCurrency = offer?.currency || product?.currency || 'INR';
  const { displayMoney } = useCurrency();
  const money = (value) => displayMoney(value, priceCurrency);
  const photo = productPhoto(product);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Variant / Size Options
  const variantEntries = Object.entries(product?.variants ?? {});
  const [selectedVariants, setSelectedVariants] = useState({});

  // Form State
  const initialLocation = addresses?.[0]?.city
    ? `${addresses[0].city}, ${addresses[0].country || 'India'}`
    : (preferences?.country || 'India');

  const [values, setValues] = useState({
    quantity: String(minOrderQty),
    // Optional: the buyer's own target, not the listed price
    targetPrice: '',
    customVariant: '',
    specifications: '',
    deliveryLocation: initialLocation,
    destinationCountry: addresses?.[0]?.country || preferences?.country || 'India',
    deliveryPincode: addresses?.[0]?.pincode || addresses?.[0]?.postalCode || '',
    deliveryDate: '',
    deliveryTime: 'Within 30 days',
    additionalMessage: '',
    attachmentUrl: '',
    buyerName: user?.name || '',
    buyerEmail: user?.email || '',
  });

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRfq, setSubmittedRfq] = useState(null);
  const [errors, setErrors] = useState({});

  // When the chosen supplier's own MOQ arrives, a quantity below it is raised to it
  useEffect(() => {
    setValues((prev) => (Number(prev.quantity) < minOrderQty ? { ...prev, quantity: String(minOrderQty) } : prev));
  }, [minOrderQty]);

  const setField = (field) => (event) => {
    const val = event.target.value;
    setValues((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      const res = await apiPost('upload', formData);
      const url = res?.data?.url || res?.data?.file?.path || res?.url;
      if (url) {
        setValues((prev) => ({ ...prev, attachmentUrl: url }));
        showToast('Attachment uploaded successfully!', 'success');
      } else {
        setValues((prev) => ({ ...prev, attachmentUrl: file.name }));
        showToast('File selected: ' + file.name, 'info');
      }
    } catch {
      // In offline/mock mode, preserve file name as reference
      setValues((prev) => ({ ...prev, attachmentUrl: file.name }));
      showToast('Attachment noted: ' + file.name, 'info');
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate Quantity >= MOQ (Mandatory)
    const qtyNum = Number(values.quantity);
    if (!values.quantity || isNaN(qtyNum) || qtyNum < 1) {
      newErrors.quantity = 'Please enter a valid quantity.';
    } else if (qtyNum < minOrderQty) {
      newErrors.quantity = `Requested quantity must meet or exceed the minimum order quantity of ${minOrderQty} ${productUnit}s.`;
    }

    // Validate Delivery Location (Mandatory)
    const loc = (values.deliveryLocation || values.destinationCountry || '').trim();
    if (!loc) {
      newErrors.deliveryLocation = 'Delivery location is required.';
    }

    // Validate Delivery Pincode if specified
    if (values.deliveryPincode && (values.destinationCountry === 'India' || !values.destinationCountry)) {
      if (!/^\d{6}$/.test(values.deliveryPincode.trim())) {
        newErrors.deliveryPincode = 'Please enter a valid 6-digit Indian PIN code.';
      }
    }

    // Buyer info
    if (!values.buyerName.trim()) {
      newErrors.buyerName = 'Buyer name is required.';
    }
    if (!values.buyerEmail.trim() || !/\S+@\S+\.\S+/.test(values.buyerEmail)) {
      newErrors.buyerEmail = 'Valid email address is required.';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const variantList = [
        ...Object.entries(selectedVariants).filter(([_, v]) => Boolean(v)).map(([k, v]) => `${k}: ${v}`),
        values.customVariant?.trim() && !Object.values(selectedVariants).includes(values.customVariant.trim())
          ? `Size/Variant: ${values.customVariant.trim()}`
          : null,
      ].filter(Boolean);

      const variantStr = Array.from(new Set(variantList)).join(', ');

      const defaultSpec = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications).map(([k, v]) => `${k}: ${v}`).join(', ')
        : (product.description || `Wholesale quotation request for ${product.name}`);

      const finalSpecifications = [
        variantStr ? `Selected Variant/Size: ${variantStr}` : null,
        values.specifications.trim() || defaultSpec,
      ].filter(Boolean).join('\n\n');

      const record = await submitInquiry(
        {
          productName: product.name,
          quantity: Number(values.quantity),
          unit: productUnit,
          targetPrice: values.targetPrice ? Number(values.targetPrice) : null,
          specifications: finalSpecifications,
          deliveryLocation: values.deliveryLocation.trim(),
          destinationCountry: values.destinationCountry || 'India',
          deliveryPincode: values.deliveryPincode.trim(),
          deliveryDate: values.deliveryDate || null,
          deliveryTime: values.deliveryDate ? `Required by ${values.deliveryDate}` : values.deliveryTime,
          message: values.additionalMessage.trim(),
          attachmentUrl: values.attachmentUrl || null,
          buyerName: values.buyerName.trim(),
          buyerEmail: values.buyerEmail.trim(),
        },
        {
          // The chosen supplier's own listing is the product quoted on
          product: {
            ...(offer?.productId ? { ...product, id: offer.productId, supplierId: offer.supplierId } : product),
            variant: Object.keys(selectedVariants).length > 0 ? selectedVariants : null,
          },
          company,
          buyer: user,
          source: 'product_page',
          targetSupplierIds: routedSupplierId ? [routedSupplierId] : [],
          targetSuppliers: routedSupplierId ? [{ id: routedSupplierId, name: supplierName, company: supplierName }] : [],
          deliveryLocation: values.deliveryLocation.trim(),
          expectedDeliveryDate: values.deliveryDate || null,
          deliveryTime: values.deliveryDate ? `Required by ${values.deliveryDate}` : values.deliveryTime,
          deliveryPincode: values.deliveryPincode.trim(),
        }
      );

      setSubmittedRfq(record);
      showToast('Your quote request has been sent directly to the supplier!', 'success');
      onDone?.(record);
    } catch (err) {
      showToast(err?.message || 'Failed to submit quote request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // If submitted successfully, show confirmation screen
  if (submittedRfq) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 text-center shadow-xs">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-navy-900">Request for Quotation Sent Directly!</h3>
        <p className="mt-1 text-sm text-muted">
          Your RFQ reference is <span className="font-mono font-bold text-navy-900">{submittedRfq.rfqNumber || submittedRfq.id}</span>
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-xl bg-slate-50 p-4 text-left text-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-muted">Targeted Supplier:</span>
            <span className="font-semibold text-navy-900">{supplierName}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 py-2">
            <span className="text-muted">Product:</span>
            <span className="font-semibold text-navy-900">{product.name}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 py-2">
            <span className="text-muted">Requested Quantity:</span>
            <span className="font-semibold text-navy-900">{quantityLabel(submittedRfq.quantity, submittedRfq.unit)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-muted">Status:</span>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
              Sent to Supplier
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted max-w-lg mx-auto">
          The supplier has received your RFQ in their Supplier Dashboard. You will receive an independent quotation once they respond.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" to="/buyer/quotes">
            View in Buyer Dashboard
          </Button>
          <Button variant="outline" to={`/products/${product.slug || product.id}`}>
            Back to Product
          </Button>
          <Button variant="ghost" onClick={() => setSubmittedRfq(null)}>
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* 1. Locked Product & Supplier Information Card */}
      <div className="overflow-hidden rounded-2xl border border-navy-200 bg-gradient-to-br from-slate-50 via-white to-navy-50/30 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-navy-900 text-white">
              <Lock className="size-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Product & Supplier Locked
            </span>
          </div>
          <span className="text-xs text-muted">
            Prefilled from listing · Direct routing
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[5rem_1fr] md:grid-cols-[6rem_1fr_auto]">
          {/* Product Thumbnail */}
          <div className="size-20 sm:size-24 overflow-hidden rounded-xl border border-navy-100 bg-white">
            {product.photo || product.images?.[0]?.url ? (
              <img
                src={product.photo || product.images[0].url}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-slate-100 text-slate-400">
                <Package className="size-8" />
              </div>
            )}
          </div>

          {/* Product & Supplier Details */}
          <div className="min-w-0">
            <h3 className="text-base font-bold text-navy-900 sm:text-lg">
              {product.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>SKU / ID: <strong className="font-mono text-slate-700">{product.id}</strong></span>
              {product.category && <span>· Category: <strong className="text-slate-700">{product.category}</strong></span>}
            </div>

            {/* Supplier Information */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 ring-1 ring-slate-200 text-xs">
              <Building2 className="size-3.5 text-navy-700 shrink-0" />
              <span className="text-muted">Assigned Supplier:</span>
              <strong className="text-navy-900">{supplierName}</strong>
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800 text-[0.6875rem]">
                  <ShieldCheck className="size-3" /> Verified
                </span>
              )}
              {supplierLocation ? (
                <span className="text-muted">({supplierLocation})</span>
              ) : null}
            </div>

            {/* Available Specifications */}
            {product.specifications && typeof product.specifications === 'object' && Object.keys(product.specifications).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                {Object.entries(product.specifications).slice(0, 4).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5">
                    <span className="font-semibold text-slate-800">{k}:</span> {String(v)}
                  </span>
                ))}
              </div>
            )}

            {/* Variant / Size Options */}
            {variantEntries.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-200/70 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Select Size / Variant (Optional)
                </span>
                <div className="flex flex-wrap gap-3">
                  {variantEntries.map(([name, options]) => (
                    <div key={name} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800">{name}:</span>
                      <div className="flex flex-wrap gap-1">
                        {options.map((opt) => {
                          const isSelected = selectedVariants[name] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                setSelectedVariants((prev) => {
                                  const next = {
                                    ...prev,
                                    [name]: isSelected ? undefined : opt,
                                  };
                                  const activeStr = Object.entries(next)
                                    .filter(([_, v]) => Boolean(v))
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ');
                                  setValues((vPrev) => ({ ...vPrev, customVariant: activeStr }));
                                  return next;
                                });
                              }}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                isSelected
                                  ? 'bg-emerald-700 text-white shadow-2xs ring-2 ring-emerald-600/30'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-500'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MOQ and Unit Price Summary */}
          <div className="flex flex-row sm:flex-col justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4 text-left sm:text-right">
            <div>
              <span className="text-xs text-muted block">Minimum Order (MOQ)</span>
              <span className="text-sm font-bold text-brand-600">
                {minOrderQty} {productUnit}s
              </span>
            </div>
            {product.price ? (
              <div className="sm:mt-2">
                <span className="text-xs text-muted block">Catalog Price</span>
                <span className="text-sm font-bold text-navy-900">
                  {money(product.price)} <span className="text-xs font-normal text-muted">/{productUnit}</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. Buyer Quote Requirements */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-navy-800 border-b border-slate-100 pb-1">
          Your RFQ Requirements
        </h4>

        {/* Size / Variant & Target Price */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="rfq-size-variant"
            label="Product Size / Variant (Optional)"
            value={values.customVariant}
            onChange={(e) => {
              const val = e.target.value;
              setValues((prev) => ({ ...prev, customVariant: val }));
            }}
            placeholder="e.g. Tool only, With 2 batteries, or enter custom size..."
            hint="Choose from the options above or enter your required size / variant."
          />

          <Input
            id="rfq-target-price"
            label={`Target Unit Price (₹ / ${productUnit}) - Optional`}
            type="number"
            min="0"
            step="0.01"
            value={values.targetPrice}
            onChange={setField('targetPrice')}
            placeholder={product.price ? String(product.price) : 'e.g. 450'}
            hint="Leave blank to receive the supplier's best quote."
          />
        </div>

        {/* Quantity & Delivery Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Input
              id="rfq-qty"
              label={`Required Quantity (${productUnit}s)`}
              type="number"
              min={minOrderQty}
              required
              value={values.quantity}
              onChange={setField('quantity')}
              error={errors.quantity}
              placeholder={`Min ${minOrderQty}`}
            />
            <p className="mt-1 text-xs text-muted">
              Must be at least the supplier's MOQ of {minOrderQty} {productUnit}s.
            </p>
          </div>

          <Input
            id="rfq-location"
            label="Delivery Location"
            required
            value={values.deliveryLocation}
            onChange={setField('deliveryLocation')}
            error={errors.deliveryLocation}
            placeholder="e.g. Mumbai, Maharashtra or Nhava Sheva Port"
          />

          <Input
            id="rfq-delivery-date"
            label="Required Delivery Date (Optional)"
            type="date"
            min={new Date().toISOString().split('T')[0]}
            value={values.deliveryDate}
            onChange={setField('deliveryDate')}
            error={errors.deliveryDate}
          />
        </div>

        {/* Delivery PIN Code */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            id="rfq-pincode"
            label="Delivery PIN / Postal Code (Optional)"
            value={values.deliveryPincode}
            onChange={setField('deliveryPincode')}
            error={errors.deliveryPincode}
            placeholder="e.g. 400001"
            maxLength={10}
          />
        </div>

        {/* Specifications */}
        <Textarea
          id="rfq-specs"
          label="Custom Specifications & Quality Requirements (Optional)"
          rows={3}
          value={values.specifications}
          onChange={setField('specifications')}
          error={errors.specifications}
          placeholder="Specify exact material grade, custom dimensions, branding/logo, packaging, or special tolerances (optional - catalog specifications apply by default)..."
        />

        {/* Additional Message */}
        <Textarea
          id="rfq-message"
          label="Additional Message to Supplier (Optional)"
          rows={2}
          value={values.additionalMessage}
          onChange={setField('additionalMessage')}
          placeholder="e.g. Please provide freight options to Mumbai port and specify sample availability."
        />

        {/* Attachment Upload */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-800">
            Supporting Attachments (Drawings, Spec Sheets, Reference Photos) - Optional
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-navy-800 hover:bg-slate-50">
              <UploadCloud className="size-4 text-brand-600" />
              <span>{uploading ? 'Uploading...' : 'Choose File to Upload'}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.mp4,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            <span className="text-xs text-muted">or specify URL:</span>
            <input
              type="text"
              value={values.attachmentUrl}
              onChange={(e) => setValues((p) => ({ ...p, attachmentUrl: e.target.value }))}
              placeholder="https://example.com/spec.pdf"
              className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
            />
          </div>
          {values.attachmentUrl && (
            <p className="mt-1 text-xs text-emerald-700 font-medium">
              Attached: {values.attachmentUrl}
            </p>
          )}
        </div>

        {/* Buyer Contact Information */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl bg-slate-50 p-3.5">
          <Input
            id="rfq-buyer-name"
            label="Your Name"
            required
            value={values.buyerName}
            onChange={setField('buyerName')}
            error={errors.buyerName}
            placeholder="John Doe"
          />
          <Input
            id="rfq-buyer-email"
            label="Business Email Address"
            type="email"
            required
            value={values.buyerEmail}
            onChange={setField('buyerEmail')}
            error={errors.buyerEmail}
            placeholder="john@company.com"
          />
        </div>
      </div>

      {/* Submit Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <p className="text-xs text-muted max-w-sm">
          Submitting sends this RFQ directly to <strong className="text-navy-900">{supplierName}</strong>. You will be notified in your Buyer Dashboard when a quotation is received.
        </p>

        <Button
          type="submit"
          variant="primary"
          icon={Send}
          disabled={submitting}
          className="min-w-[180px]"
        >
          {submitting ? 'Sending Request...' : 'Send RFQ to Supplier'}
        </Button>
      </div>
    </form>
  );
}

