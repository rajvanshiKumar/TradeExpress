import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Send } from 'lucide-react';
import Input, { Textarea } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useInquiries from '../../hooks/useInquiries';
import useNotifications from '../../hooks/useNotifications';
import { COUNTRIES } from '../../utils/constants';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';

const DELIVERY_OPTIONS = ['Within 15 days', 'Within 30 days', 'Within 45 days', 'Within 60 days', 'Flexible'];

const schema = {
  productName: [rules.required('Product'), rules.maxLength('Product', 120)],
  quantity: [rules.required('Quantity'), rules.number('Quantity', { min: 1, integer: true })],
  specifications: [rules.required('Specifications'), rules.minLength('Specifications', 10), rules.maxLength('Specifications', 1000)],
  targetPrice: [rules.number('Target price', { min: 0 })],
  destinationCountry: [rules.required('Destination country')],
  deliveryTime: [rules.required('Delivery time')],
  buyerName: [rules.required('Your name'), rules.minLength('Your name', 2)],
  buyerEmail: [rules.required('Email'), rules.email()],
  message: [rules.maxLength('Message', 1000)],
};

/**
 * Request-for-quote form. Pass `product` to lock it to one listing, or leave it out
 * to let the buyer pick from the catalogue or describe something else.
 * The request is stored locally through InquiryContext and is not sent to anyone.
 */
export default function InquiryForm({ product: fixedProduct = null, company: fixedCompany = null, idPrefix = 'rfq-', onDone, initialName = '', initialQuantity = '' }) {
  const { user, preferences } = useAuth();
  const { products, getCompany, getProduct } = useProducts();
  const { submitInquiry } = useInquiries();
  const { showToast } = useNotifications();

  const blank = useMemo(() => ({
    productId: fixedProduct?.id ?? '', productName: fixedProduct?.name ?? initialName, quantity: fixedProduct ? String(fixedProduct.moq) : initialQuantity, specifications: '',
    targetPrice: '', destinationCountry: preferences.country, deliveryTime: 'Within 30 days', buyerName: user?.name ?? '', buyerEmail: user?.email ?? '', message: '',
  }), [fixedProduct, preferences.country, user, initialName, initialQuantity]);

  const [values, setValues] = useState(blank);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    setValues(blank);
    setErrors({});
    setSubmitted(null);
  }, [fixedProduct?.id, fixedCompany?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const product = fixedProduct ?? (values.productId ? getProduct(values.productId) : null);
  const company = product ? getCompany(product.companyId) : fixedCompany;
  const choices = useMemo(() => products
    .filter((item) => item.status === 'Active' && (!fixedCompany || item.companyId === fixedCompany.id))
    .sort((a, b) => a.name.localeCompare(b.name)), [products, fixedCompany]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const chooseProduct = (event) => {
    const chosen = getProduct(event.target.value);
    setValues((previous) => ({ ...previous, productId: chosen?.id ?? '', productName: chosen?.name ?? '', quantity: chosen ? String(chosen.moq) : previous.quantity }));
    setErrors((previous) => ({ ...previous, productName: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(schema, values);
    if (!found.quantity && product && Number(values.quantity) < product.moq) found.quantity = `The minimum order for this product is ${product.moq} ${product.unit}s.`;
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(found, idPrefix);
      return;
    }
    setSubmitting(true);
    try {
      const record = await submitInquiry(values, { product, company, buyer: user });
      setSubmitted(record);
      showToast('Quote request saved.');
      onDone?.(record);
    } catch {
      showToast('The request could not be saved. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-success-50 p-6 text-center" role="status">
        <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-bold">Quote request saved</h3>
        <p className="mt-1 text-sm text-ink">Reference <span className="font-semibold">{submitted.id}</span> for {submitted.quantity} × {submitted.productName}.</p>
        <p className="mx-auto mt-2 max-w-md text-[0.8125rem] text-muted">The supplier can reply from their dashboard. Requests are stored in this browser in this version of TradeExpress.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button to={user?.role === 'buyer' ? '/buyer/quotes' : '/rfq?tab=history'} variant="navy" size="sm">View my requests</Button>
          <Button variant="outline" size="sm" onClick={() => { setSubmitted(null); setValues(blank); }}>Send another request</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fixedProduct ? (
        <div className="rounded-xl bg-surface px-4 py-3 text-sm sm:col-span-2">
          <p className="text-muted">Product</p>
          <p className="font-semibold text-ink">{fixedProduct.name}</p>
          {company ? <p className="text-[0.8125rem] text-muted">Supplier: <Link to={`/suppliers/${company.slug}`} className="font-medium text-navy-800 hover:text-brand-600">{company.name}</Link></p> : null}
        </div>
      ) : (
        <>
          <Select id={`${idPrefix}productId`} label="Choose a listed product" placeholder="Not listed: I will describe it" value={values.productId} onChange={chooseProduct} options={choices.map((item) => ({ value: item.id, label: item.name }))} wrapperClassName="sm:col-span-2" hint={fixedCompany ? `Showing products from ${fixedCompany.name}.` : 'Optional. Pick a product from the catalogue.'} />
          {!values.productId ? <Input id={`${idPrefix}productName`} label="Product name" required value={values.productName} onChange={set('productName')} error={errors.productName} placeholder="e.g. Stainless steel water bottle 750 ml" wrapperClassName="sm:col-span-2" /> : null}
        </>
      )}

      <Input id={`${idPrefix}quantity`} label={`Quantity${product ? ` (${product.unit}s)` : ''}`} required type="number" min="1" inputMode="numeric" value={values.quantity} onChange={set('quantity')} error={errors.quantity} hint={product ? `Minimum order: ${product.moq} ${product.unit}s` : undefined} />
      <Input id={`${idPrefix}targetPrice`} label="Target unit price (₹)" type="number" min="0" step="0.01" inputMode="decimal" value={values.targetPrice} onChange={set('targetPrice')} error={errors.targetPrice} hint="Optional" />
      <Textarea id={`${idPrefix}specifications`} label="Specifications" required rows={3} value={values.specifications} onChange={set('specifications')} error={errors.specifications} placeholder="Material, size, colour, branding, packaging…" wrapperClassName="sm:col-span-2" />
      <Select id={`${idPrefix}destinationCountry`} label="Destination country" required options={COUNTRIES} value={values.destinationCountry} onChange={set('destinationCountry')} error={errors.destinationCountry} />
      <Select id={`${idPrefix}deliveryTime`} label="Required delivery time" required options={DELIVERY_OPTIONS} value={values.deliveryTime} onChange={set('deliveryTime')} error={errors.deliveryTime} />
      <Input id={`${idPrefix}buyerName`} label="Your name" required autoComplete="name" value={values.buyerName} onChange={set('buyerName')} error={errors.buyerName} />
      <Input id={`${idPrefix}buyerEmail`} label="Email" required type="email" autoComplete="email" value={values.buyerEmail} onChange={set('buyerEmail')} error={errors.buyerEmail} />
      <Textarea id={`${idPrefix}message`} label="Message to the supplier" rows={3} value={values.message} onChange={set('message')} error={errors.message} hint="Optional" wrapperClassName="sm:col-span-2" />

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs text-muted">Your request goes to the supplier's inquiry inbox on TradeExpress.</p>
        <Button type="submit" icon={Send} loading={submitting} className="shrink-0">{submitting ? 'Saving…' : 'Submit request'}</Button>
      </div>
    </form>
  );
}
