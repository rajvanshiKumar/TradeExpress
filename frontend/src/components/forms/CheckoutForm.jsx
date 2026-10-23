import { useState } from 'react';
import { Banknote, CreditCard, Landmark, Plane, Ship, Smartphone, Truck, Wallet } from 'lucide-react';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import useCurrency from '../../hooks/useCurrency';
import { COUNTRIES, PAYMENT_METHODS, SHIPPING_METHODS } from '../../utils/constants';
import { calculateCartTotals } from '../../utils/calculateTotals';
import { focusFirstError, hasErrors, mobileExample, normalizeEmail, parseMobile, rules, validate } from '../../utils/validators';

/* The individual forms used by the checkout steps (see pages/Checkout.jsx). */

const contactSchema = {
  name: [rules.required('Full name'), rules.minLength('Full name', 2)],
  email: [rules.required('Email'), rules.email()],
  country: [rules.required('Country')],
  phone: [rules.required('Mobile number'), rules.mobile('country')],
};

/** Step 1: who is placing the order. */
export function ContactForm({ initial, onSubmit }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const submit = (event) => {
    event.preventDefault();
    const found = validate(contactSchema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'contact-');
    return onSubmit({ name: values.name.trim(), email: normalizeEmail(values.email), country: values.country, phone: parseMobile(values.phone, values.country).international, company: values.company.trim() });
  };
  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input id="contact-name" label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
      <Input id="contact-company" label="Company" autoComplete="organization" value={values.company} onChange={set('company')} />
      <Input id="contact-email" label="Email" required type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
      <Select id="contact-country" label="Country" required options={COUNTRIES} value={values.country} onChange={set('country')} error={errors.country} />
      <Input id="contact-phone" label="Mobile number" required type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} error={errors.phone} hint={`e.g. ${mobileExample(values.country)}`} />
      <div className="flex justify-end sm:col-span-2"><Button type="submit">Continue to delivery address</Button></div>
    </form>
  );
}

function OptionCard({ name, value, checked, onChange, icon: Icon, title, text, aside }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3.5 rounded-xl border-2 p-4 transition-colors ${checked ? 'border-brand-500 bg-brand-50' : 'bg-white hover:border-navy-200'}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="size-4 shrink-0 accent-brand-500" />
      <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-brand-500 text-navy-900' : 'bg-navy-50 text-navy-800'}`}><Icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-navy-900">{title}</span>
        <span className="block text-[0.8125rem] text-muted">{text}</span>
      </span>
      {aside ? <span className="shrink-0 text-right text-sm font-bold text-navy-900">{aside}</span> : null}
    </label>
  );
}

const SHIPPING_ICONS = { sea: Ship, air: Plane, express: Truck };

/** Step 3: shipping method, priced from the cart with the shipping rules in constants.js. */
export function ShippingOptions({ value, onChange, lines }) {
  const { money } = useCurrency();
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Shipping method</legend>
      {SHIPPING_METHODS.map((method) => (
        <OptionCard
          key={method.id} name="shipping-method" value={method.id} checked={value === method.id} onChange={onChange} icon={SHIPPING_ICONS[method.id] ?? Truck}
          title={method.label} text={`${method.eta} · ${method.note}`} aside={money(calculateCartTotals(lines, method.id).shipping)}
        />
      ))}
      <p className="text-xs text-muted">Shipping costs and delivery times are estimates.</p>
    </fieldset>
  );
}

const PAYMENT_ICONS = { upi: Smartphone, card: CreditCard, netbanking: Landmark, wallet: Wallet, cod: Banknote };
const PAYMENT_TEXT = {
  upi: 'Pay from any UPI app.', card: 'Visa, Mastercard, RuPay and others.', netbanking: 'Pay from your bank account online.',
  wallet: 'Use a digital wallet balance.', cod: 'Pay the carrier when the goods arrive. Nothing is charged now.',
};

/** Step 4: choose a payment method. Only the choice is recorded: there are no detail fields. */
export function PaymentOptions({ value, onChange }) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Payment method</legend>
      {PAYMENT_METHODS.map((method) => (
        <OptionCard key={method.id} name="payment-method" value={method.id} checked={value === method.id} onChange={onChange} icon={PAYMENT_ICONS[method.id] ?? CreditCard} title={method.label} text={PAYMENT_TEXT[method.id]} />
      ))}
      <p className="rounded-lg bg-navy-50 px-4 py-3 text-[0.8125rem] text-navy-800">
        Online payment processing is not available on TradeExpress yet. You will never be asked for card numbers, UPI PINs or bank logins here. If an online payment cannot be completed, you can place the order with payment pending and arrange payment with the supplier, or choose Cash on Delivery.
      </p>
    </fieldset>
  );
}
