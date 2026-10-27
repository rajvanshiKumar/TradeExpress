import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, ShoppingBag, Zap } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import Image from '../components/common/Image';
import { TableSkeleton } from '../components/common/Skeleton';
import CheckoutSteps, { CHECKOUT_STEPS } from '../components/forms/CheckoutSteps';
import { ContactForm, PaymentOptions, ShippingOptions } from '../components/forms/CheckoutForm';
import AddressForm, { AddressBlock } from '../components/forms/AddressForm';
import OrderSummary from '../components/forms/OrderSummary';
import PaymentDialog from '../components/forms/PaymentDialog';
import QuantityInput from '../components/common/QuantityInput';
import { startPayment } from '../services/paymentService';
import EmptyState from '../components/common/EmptyState';
import useAuth from '../hooks/useAuth';
import useCart from '../hooks/useCart';
import useOrders from '../hooks/useOrders';
import useProducts from '../hooks/useProducts';
import useCurrency from '../hooks/useCurrency';
import useNotifications from '../hooks/useNotifications';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { DEFAULT_SHIPPING_METHOD, PAYMENT_METHODS, PAYMENT_STATUS } from '../utils/constants';
import { calculateCartTotals, getShippingMethod } from '../utils/calculateTotals';
import { quantityLabel } from '../utils/units';

// Why a Buy Now selection cannot be checked out, and what to tell the buyer.
const BUY_NOW_PROBLEMS = {
  none: ['No Buy Now item selected', 'Choose a product and press Buy Now to check out a single item. Your cart has not been changed.'],
  expired: ['This Buy Now selection has expired', 'For your safety a Buy Now selection is kept for 30 minutes. Please start again from the product page.'],
  missing: ['Product not found', 'The product you selected no longer exists in the catalogue.'],
  unavailable: ['Product unavailable', 'This product is not available to order at the moment.'],
  'out-of-stock': ['Out of stock', 'This product has sold out since you selected it.'],
  'below-moq': ['Quantity below the minimum order', 'The selected quantity is lower than this product’s minimum order. Please choose a quantity on the product page.'],
  'above-stock': ['Not enough stock', 'The selected quantity is higher than the stock now available. Please choose a smaller quantity on the product page.'],
  'bad-variant': ['Option no longer available', 'The option you selected is no longer offered. Please choose again on the product page.'],
};

const HEADINGS = ['Contact details', 'Delivery address', 'Shipping method', 'Payment method', 'Review your order'];

export default function Checkout() {
  const { user, addresses, saveAddress } = useAuth();
  const { lines: cartLines, clearCart, buyNow, clearBuyNow, startBuyNow } = useCart();
  const [searchParams] = useSearchParams();
  // Buy Now checks out one separately selected product. The cart is not read or changed.
  const isBuyNow = searchParams.get('mode') === 'buynow';
  const lines = isBuyNow ? (buyNow.line ? [buyNow.line] : []) : cartLines;
  const { loading, getCompany } = useProducts();
  const { placeOrder } = useOrders();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  useDocumentTitle('Checkout');

  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({
    name: user?.name || '',
    email: user?.email || '',
    country: user?.country || 'India',
    phone: user?.phone || addresses?.find((item) => item.isDefault)?.phone || '',
    company: user?.company || '',
    gstin: user?.gstin || ''
  });
  const [addressId, setAddressId] = useState(() => addresses?.find((item) => item.isDefault)?.id ?? addresses?.[0]?.id ?? '');
  const [addingAddress, setAddingAddress] = useState(!addresses || addresses.length === 0);

  useEffect(() => {
    if (user) {
      setContact((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
        company: prev.company || user.company || '',
        gstin: prev.gstin || user.gstin || '',
      }));
    }
  }, [user]);
  const [addressError, setAddressError] = useState('');
  const [shippingMethod, setShippingMethod] = useState(DEFAULT_SHIPPING_METHOD);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [payment, setPayment] = useState({ open: false, state: 'pending', message: '' }); // online payment dialog
  const paymentAbort = useRef(null);
  const [notice, setNotice] = useState('');
  const placed = useRef(false);
  const submitting = useRef(false); // guards against double clicks creating two orders
  const headingRef = useRef(null);

  const address = addresses.find((item) => item.id === addressId) ?? null;
  const baseTotals = calculateCartTotals(lines, shippingMethod);

  // Group lines by supplier for Split Cart by Supplier
  const supplierGroups = useMemo(() => {
    const groups = {};
    lines.forEach((line) => {
      const companyId = line.product?.companyId || 'TS-CO-DEFAULT';
      if (!groups[companyId]) {
        groups[companyId] = {
          companyId,
          company: getCompany(companyId),
          lines: [],
        };
      }
      groups[companyId].lines.push(line);
    });
    return Object.values(groups);
  }, [lines, getCompany]);

  // GST intra-state vs inter-state calculation
  const gstBreakup = useMemo(() => {
    const primarySupplier = supplierGroups[0]?.company;
    const supplierState = (primarySupplier?.warehouseState || 'Maharashtra').trim().toLowerCase();
    const buyerState = (address?.state || contact?.state || 'Maharashtra').trim().toLowerCase();
    const isInter = buyerState !== supplierState;
    const gstRate = 0.18;
    const totalTax = Math.round(baseTotals.subtotal * gstRate * 100) / 100;

    if (isInter) {
      return {
        isInterState: true,
        cgst: 0,
        sgst: 0,
        igst: totalTax,
        rate: '18% IGST',
      };
    } else {
      const half = Math.round((totalTax / 2) * 100) / 100;
      return {
        isInterState: false,
        cgst: half,
        sgst: half,
        igst: 0,
        rate: '9% CGST + 9% SGST',
      };
    }
  }, [supplierGroups, address, contact, baseTotals.subtotal]);

  // Partial Payment (20% advance, 80% on delivery)
  const advanceAmount = Math.round(baseTotals.total * 0.2);
  const balanceDue = Math.round(baseTotals.total * 0.8);

  const totals = {
    ...baseTotals,
    gstBreakup,
    isPartialPayment,
    advanceAmount,
    balanceDue,
  };

  // Move focus to the step heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  if (loading) return <div className="ts-container py-10"><div className="ts-card"><TableSkeleton rows={6} /></div></div>;
  if (isBuyNow && !placed.current && buyNow.status !== 'ready') {
    if (buyNow.status === 'loading') return <div className="ts-container py-10"><div className="ts-card"><TableSkeleton rows={6} /></div></div>;
    const [title, text] = BUY_NOW_PROBLEMS[buyNow.status] ?? BUY_NOW_PROBLEMS.none;
    return (
      <div className="ts-container py-12">
        <div className="ts-card">
          <EmptyState
            icon={ShoppingBag} headingLevel={1} title={title} text={text}
            action={(
              <>
                {buyNow.product && buyNow.product.status === 'Active' ? <Button to={`/products/${buyNow.product.slug}`} onClick={clearBuyNow}>Back to the product</Button> : null}
                <Button to="/products" variant="navy" onClick={clearBuyNow}>Browse the catalogue</Button>
                {cartLines.length ? <Button to="/cart" variant="outline">Go to my cart ({cartLines.length})</Button> : null}
              </>
            )}
          />
        </div>
      </div>
    );
  }
  if (!lines.length && !placed.current) return <Navigate to="/cart" replace />;

  const goTo = (next) => setStep(next);

  const continueFromAddress = () => {
    if (!address) return setAddressError('Choose a delivery address or add a new one.');
    setAddressError('');
    return goTo(3);
  };

  const continueFromPayment = () => {
    if (!paymentMethod) return setPaymentError('Choose a payment method to continue.');
    setPaymentError('');
    return goTo(5);
  };

  /** Creates exactly one order. `submitting` makes repeated clicks harmless. */
  const createOrder = async (paymentStatus) => {
    if (submitting.current || placed.current) return;
    if (!address || !paymentMethod || !lines.length || !contact.phone) {
      setNotice('Some checkout details are missing. Please review the earlier steps.');
      setPayment((previous) => ({ ...previous, open: false }));
      return;
    }
    submitting.current = true;
    setPlacing(true);
    setPayment((previous) => ({ ...previous, state: 'placing' }));
    try {
      const order = await placeOrder({
        lines,
        totals,
        shippingMethod,
        paymentMethod,
        paymentStatus,
        isPartialPayment,
        advanceAmount: isPartialPayment ? advanceAmount : null,
        balanceDue: isPartialPayment ? balanceDue : null,
        buyerGstin: contact.gstin || user?.gstin || null,
        supplierGstin: supplierGroups[0]?.company?.gstin || null,
        source: isBuyNow ? 'buy-now' : 'cart',
        contact,
        address,
        buyer: user,
      });
      placed.current = true;
      if (isBuyNow) clearBuyNow(); else clearCart();
      navigate(`/order-confirmation/${order.orderNumber || order.id}`, { replace: true });
    } catch (err) {
      showToast(err.message || 'The order could not be saved. Please try again.', 'error');
      submitting.current = false;
      setPlacing(false);
      setPayment({ open: false, state: 'pending', message: '' });
    }
  };

  /** Online payment: creates order first, requests payment from gateway, and marks paid upon verification. */
  const payOnline = async () => {
    if (submitting.current || placed.current) return;
    if (!address || !paymentMethod || !lines.length || !contact.phone) {
      setNotice('Some checkout details are missing. Please review the earlier steps.');
      return;
    }
    paymentAbort.current?.abort();
    const controller = new AbortController();
    paymentAbort.current = controller;
    setPayment({ open: true, state: 'pending', message: '' });

    try {
      submitting.current = true;
      // 1. Create order on server to establish MySQL record and validate inventory
      const order = await placeOrder({
        lines,
        totals,
        shippingMethod,
        paymentMethod,
        paymentStatus: isPartialPayment ? PAYMENT_STATUS.pending : PAYMENT_STATUS.pending,
        isPartialPayment,
        advanceAmount: isPartialPayment ? advanceAmount : null,
        balanceDue: isPartialPayment ? balanceDue : null,
        buyerGstin: contact.gstin || user?.gstin || null,
        supplierGstin: supplierGroups[0]?.company?.gstin || null,
        source: isBuyNow ? 'buy-now' : 'cart',
        contact,
        address,
        buyer: user,
      });

      // 2. Process online payment with gateway (advance amount or full total)
      const payableAmount = isPartialPayment ? advanceAmount : totals.total;
      const result = await startPayment({
        order,
        orderId: order.backendId || order.orderNumber || order.id,
        amount: payableAmount,
        method: paymentMethod,
        buyerInfo: contact,
        signal: controller.signal,
      });

      if (paymentAbort.current !== controller) return;
      paymentAbort.current = null;

      if (result.status === 'paid') {
        setPayment({ open: true, state: 'success', message: '' });
        placed.current = true;
        if (isBuyNow) clearBuyNow(); else clearCart();
        window.setTimeout(() => {
          navigate(`/order-confirmation/${order.orderNumber || order.id}`, { replace: true });
        }, 700);
      } else if (result.status === 'cancelled') {
        submitting.current = false;
        setPayment({ open: true, state: 'cancelled', message: '' });
      } else {
        submitting.current = false;
        setPayment({ open: true, state: 'failed', message: result.message || 'Payment could not be completed.' });
      }
    } catch (err) {
      if (paymentAbort.current !== controller) return;
      paymentAbort.current = null;
      submitting.current = false;
      setPayment({ open: true, state: 'failed', message: err.message || 'Order could not be processed. Please check details and try again.' });
    }
  };

  const confirm = () => {
    setNotice('');
    if (paymentMethod === 'cod') return createOrder(PAYMENT_STATUS.cod);
    return payOnline();
  };

  const cancelPayment = () => {
    paymentAbort.current?.abort();
  };

  const closePayment = () => {
    setPayment({ open: false, state: 'pending', message: '' });
    setNotice('Payment was not completed, so no order was placed. You can retry, choose another payment method, or place the order with payment pending.');
  };

  const changeMethod = () => {
    setPayment({ open: false, state: 'pending', message: '' });
    goTo(4);
  };

  const paymentChoice = PAYMENT_METHODS.find((item) => item.id === paymentMethod);
  const reviewBlock = (title, editStep, children) => (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <button type="button" onClick={() => goTo(editStep)} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700"><Pencil className="size-3.5" aria-hidden="true" />Edit<span className="sr-only"> {title.toLowerCase()}</span></button>
      </div>
      <div className="mt-2 text-sm text-ink">{children}</div>
    </div>
  );

  return (
    <>
      <PageHeader breadcrumbs={isBuyNow ? [{ label: 'Products', to: '/products' }, { label: 'Buy Now checkout' }] : [{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} title={isBuyNow ? 'Buy Now checkout' : 'Checkout'} description={isBuyNow ? 'Buy this product directly. Your cart is not changed.' : 'Review your wholesale order in six steps.'} />
      <div className="ts-container py-6 sm:py-8">
        <div className="mx-auto mb-8 max-w-3xl"><CheckoutSteps current={step} onStepClick={goTo} /></div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="checkout-step-title" className="ts-card p-5 sm:p-7">
            <p className="ts-eyebrow">Step {step} of {CHECKOUT_STEPS.length}</p>
            <h2 id="checkout-step-title" ref={headingRef} tabIndex={-1} className="mb-5 mt-1 text-xl font-extrabold focus:outline-none">{HEADINGS[step - 1]}</h2>

            {step === 1 ? <ContactForm initial={contact} onSubmit={(values) => { setContact(values); goTo(2); }} /> : null}

            {step === 2 ? (
              <div>
                {addresses.length ? (
                  <fieldset>
                    <legend className="sr-only">Saved addresses</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {addresses.map((item) => (
                        <label key={item.id} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors ${addressId === item.id ? 'border-brand-500 bg-brand-50' : 'bg-white hover:border-navy-200'}`}>
                          <input type="radio" name="checkout-address" checked={addressId === item.id} onChange={() => { setAddressId(item.id); setAddressError(''); }} className="mt-1 size-4 shrink-0 accent-brand-500" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-navy-900">{item.label}{item.isDefault ? <span className="ml-2 text-xs font-medium text-muted">Default</span> : null}</span>
                            <AddressBlock address={item} className="mt-1 !text-[0.8125rem]" />
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : <p className="mb-4 text-sm text-muted">You have no saved addresses yet. Add one below.</p>}

                {addingAddress ? (
                  <div className="mt-5 rounded-xl border bg-surface/60 p-4 sm:p-5">
                    <h3 className="mb-4 text-base font-bold">New delivery address</h3>
                    <AddressForm
                      idPrefix="checkout-address-" submitLabel="Save and use this address" onCancel={addresses.length ? () => setAddingAddress(false) : undefined}
                      initial={{ name: contact.name, company: contact.company, phone: contact.phone, isDefault: addresses.length === 0 }}
                      onSubmit={(values) => { const saved = saveAddress(values); setAddressId(saved.id); setAddingAddress(false); setAddressError(''); showToast('Address saved to your address book.'); }}
                    />
                  </div>
                ) : <Button variant="outline" size="sm" icon={Plus} className="mt-4" onClick={() => setAddingAddress(true)}>Add a new address</Button>}

                {addressError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{addressError}</p> : null}
                <div className="mt-6 flex justify-between gap-3">
                  <Button variant="outline" onClick={() => goTo(1)}>Back</Button>
                  <Button onClick={continueFromAddress} disabled={addingAddress}>Continue to shipping</Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <ShippingOptions value={shippingMethod} onChange={setShippingMethod} lines={lines} />
                <div className="mt-6 flex justify-between gap-3">
                  <Button variant="outline" onClick={() => goTo(2)}>Back</Button>
                  <Button onClick={() => goTo(4)}>Continue to payment</Button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                {/* Payment Terms Option: Full vs Partial Advance */}
                <div className="rounded-xl border border-navy-900/[0.08] bg-ivory/60 p-4">
                  <h3 className="text-sm font-bold text-navy-900 mb-2">B2B Payment Terms</h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-all ${!isPartialPayment ? 'border-brand-600 bg-white shadow-sm' : 'border-navy-900/[0.08] bg-white/60'}`}>
                      <input
                        type="radio"
                        name="payment-terms"
                        checked={!isPartialPayment}
                        onChange={() => setIsPartialPayment(false)}
                        className="mt-0.5 accent-brand-600"
                      />
                      <div>
                        <span className="block text-xs font-bold text-ink">100% Full Payment</span>
                        <span className="text-[11px] text-muted">Pay entire order value of {money(totals.total)} now.</span>
                      </div>
                    </label>

                    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-all ${isPartialPayment ? 'border-brand-600 bg-white shadow-sm' : 'border-navy-900/[0.08] bg-white/60'}`}>
                      <input
                        type="radio"
                        name="payment-terms"
                        checked={isPartialPayment}
                        onChange={() => setIsPartialPayment(true)}
                        className="mt-0.5 accent-brand-600"
                      />
                      <div>
                        <span className="block text-xs font-bold text-ink">20% Advance Partial Payment</span>
                        <span className="text-[11px] text-muted">Pay {money(advanceAmount)} now, balance {money(balanceDue)} upon delivery.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <PaymentOptions value={paymentMethod} onChange={(value) => { setPaymentMethod(value); setPaymentError(''); }} />
                {paymentError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{paymentError}</p> : null}
                <div className="mt-6 flex justify-between gap-3">
                  <Button variant="outline" onClick={() => goTo(3)}>Back</Button>
                  <Button onClick={continueFromPayment}>Review order</Button>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {reviewBlock('Contact', 1, <>{contact.name}{contact.company ? `, ${contact.company}` : ''}<br />{contact.email}<br />{contact.phone}</>)}
                  {reviewBlock('Delivery address', 2, <AddressBlock address={address} />)}
                  {reviewBlock('Shipping', 3, <>{getShippingMethod(shippingMethod).label}<br /><span className="text-muted">{getShippingMethod(shippingMethod).eta}</span></>)}
                  {reviewBlock('Payment & Terms', 4, <>{paymentChoice?.label} {isPartialPayment ? <span className="font-semibold text-brand-700">(20% Advance)</span> : <span className="text-muted">(100% Full)</span>}<br /><span className="text-muted">{paymentMethod === 'cod' ? 'Pay the carrier when the goods arrive.' : isPartialPayment ? `Pay ₹${advanceAmount} advance now via gateway.` : 'You will be asked to pay full amount now.'}</span></>)}
                </div>

                {/* Split Cart by Supplier Display */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">Cart Items Grouped by Supplier ({supplierGroups.length} supplier{supplierGroups.length > 1 ? 's' : ''})</h3>
                  </div>

                  {supplierGroups.map((group) => {
                    const supplier = group.company;
                    return (
                      <div key={group.companyId} className="rounded-xl border overflow-hidden bg-white">
                        <div className="bg-slate-50/80 px-4 py-2.5 border-b border-navy-900/[0.06] flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-navy-950 uppercase tracking-wide">
                              Supplier: {supplier?.name || 'Verified Marketplace Supplier'}
                            </span>
                            <p className="text-[11px] text-muted">
                              Origin: {supplier?.warehouseState || supplier?.city || 'Maharashtra'} · GSTIN: {supplier?.gstin || '27AABCT1234F1Z1'}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                            {group.lines.length} item(s)
                          </span>
                        </div>
                        <ul className="divide-y divide-navy-900/[0.06]">
                          {group.lines.map(({ product, quantity, variant, unitPrice, lineTotal }) => (
                            <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                              <Image photo={product.photo} illustration={product.illustration} width={120} height={120} alt="" className="size-14 shrink-0 rounded-lg bg-surface object-cover" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
                                <p className="text-xs text-muted">{quantityLabel(quantity, product.unit)} × {money(unitPrice)}{variant ? ` · ${Object.values(variant).join(', ')}` : ''}</p>
                              </div>
                              <p className="shrink-0 text-sm font-bold text-navy-900">{money(lineTotal)}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <p className="rounded-lg bg-navy-50 px-4 py-3 text-[0.8125rem] text-navy-800">
                  {paymentMethod === 'cod'
                    ? 'Your order will be placed with Cash on Delivery. Payment is made when the goods are delivered.'
                    : isPartialPayment
                      ? `20% advance of ${money(advanceAmount)} will be processed now. Remaining balance of ${money(balanceDue)} will be payable on delivery.`
                      : 'Online payment is processed securely via payment gateway sandbox with cryptographic signature verification.'}
                </p>

                {notice ? <p role="alert" className="rounded-lg bg-warning-50 px-4 py-3 text-sm font-medium text-warning">{notice}</p> : null}

                <div className="flex justify-between gap-3">
                  <Button variant="outline" onClick={() => goTo(4)} disabled={placing}>Back</Button>
                  <Button size="lg" onClick={confirm} loading={placing && paymentMethod === 'cod'} disabled={placing}>
                    {paymentMethod === 'cod'
                      ? (placing ? 'Placing order…' : 'Place order (Cash on Delivery)')
                      : isPartialPayment
                        ? `Pay Advance ${money(advanceAmount)}`
                        : `Pay Total ${money(totals.total)}`}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>


          <aside className="h-fit space-y-4 lg:sticky lg:top-36">
            {isBuyNow && lines[0] ? (
              <section aria-label="Buy Now item" className="ts-card p-4">
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700"><Zap className="size-3.5" aria-hidden="true" />Buy Now: this item only</p>
                <div className="flex gap-3">
                  <Image photo={lines[0].product.photo} illustration={lines[0].product.illustration} width={120} height={120} alt="" className="size-16 shrink-0 rounded-lg bg-surface object-cover" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{lines[0].product.name}</p>
                    <p className="text-xs text-muted">{money(lines[0].unitPrice)} / {lines[0].product.unit}{lines[0].variant ? ` · ${Object.values(lines[0].variant).join(', ')}` : ''}</p>
                    <p className="text-xs text-muted">MOQ: {quantityLabel(lines[0].product.moq, lines[0].product.unit)} · {quantityLabel(lines[0].product.stock, lines[0].product.unit)} in stock</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <label htmlFor="buy-now-quantity" className="ts-label">Quantity ({lines[0].product.unit}s)</label>
                    <QuantityInput
                      id="buy-now-quantity" size="sm" value={lines[0].quantity} min={lines[0].product.moq} max={lines[0].product.stock}
                      step={lines[0].product.moq >= 100 ? 50 : lines[0].product.moq >= 10 ? 5 : 1} label={`Quantity of ${lines[0].product.name}`}
                      onChange={(value) => !placing && startBuyNow(lines[0].product, value, lines[0].variant)}
                    />
                  </div>
                  <p className="font-display text-lg font-extrabold text-navy-900">{money(lines[0].lineTotal)}</p>
                </div>
                {cartLines.length ? <p className="mt-3 text-xs text-muted">Your cart ({cartLines.length} {cartLines.length === 1 ? 'product' : 'products'}) is saved and is not part of this order.</p> : null}
              </section>
            ) : null}
            <OrderSummary totals={totals} title="Order summary">
              {isBuyNow && buyNow.product
                ? <Link to={`/products/${buyNow.product.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">Change quantity or options</Link>
                : <Link to="/cart" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">Edit cart</Link>}
            </OrderSummary>
          </aside>
        </div>
      </div>
      <PaymentDialog
        open={payment.open} state={payment.state} message={payment.message} method={paymentChoice} amount={totals.total}
        onCancel={cancelPayment} onRetry={payOnline} onPayLater={() => createOrder(PAYMENT_STATUS.pending)} onChangeMethod={changeMethod} onClose={closePayment}
      />
    </>
  );
}
