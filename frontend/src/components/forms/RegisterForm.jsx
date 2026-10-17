import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ShoppingBag, UserPlus } from 'lucide-react';
import Input, { Checkbox } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import { BUSINESS_TYPES, COUNTRIES, ROLE_HOME } from '../../utils/constants';
import { focusFirstError, hasErrors, mobileExample, normalizeEmail, parseMobile, rules, validate } from '../../utils/validators';

// Public registration offers Buyer and Supplier only. There is no way to choose Admin here.
const ROLE_OPTIONS = [
  { value: 'buyer', label: 'Buyer', text: 'Importers, wholesalers and retailers sourcing products.', icon: ShoppingBag },
  { value: 'supplier', label: 'Supplier', text: 'Manufacturers and exporters listing products.', icon: Building2 },
];

const schema = {
  name: [rules.required('Full name'), rules.minLength('Full name', 2), rules.maxLength('Full name', 80)],
  email: [rules.required('Email'), rules.email()],
  company: [rules.required('Company name'), rules.minLength('Company name', 2)],
  country: [rules.required('Country')],
  city: [rules.required('City'), rules.minLength('City', 2)],
  phone: [rules.required('Mobile number'), rules.mobile('country')],
  password: [rules.required('Password'), rules.password()],
  confirmPassword: [rules.required('Confirm password'), rules.matches('password', 'The two passwords do not match.')],
};

export default function RegisterForm() {
  const { register, updateAccount, preferences } = useAuth();
  const { addCompany } = useProducts();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState({
    role: searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer', name: '', email: '', company: '', country: preferences.country || 'India',
    city: '', phone: '', businessType: 'Manufacturer', password: '', confirmPassword: '', agree: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field] || (field === 'country' && errors.phone)) setErrors((previous) => ({ ...previous, [field]: '', ...(field === 'country' ? { phone: '' } : {}) }));
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = { ...values, name: values.name.trim(), email: normalizeEmail(values.email), company: values.company.trim(), city: values.city.trim() };
    const found = validate(schema, trimmed);
    if (!['buyer', 'supplier'].includes(values.role)) found.role = 'Choose Buyer or Supplier.';
    if (!values.agree) found.agree = 'Please accept the terms of use to continue.';
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'register-');

    setBusy(true);
    const phone = parseMobile(values.phone, values.country).international;
    const result = await register({ ...trimmed, phone, role: values.role });
    // The passwords were only needed to create the hash. They are cleared from the form now.
    setValues((previous) => ({ ...previous, password: '', confirmPassword: '' }));
    setBusy(false);
    if (!result.ok) return setFormError(result.error);

    // A new supplier gets a company profile so the supplier dashboard works straight away.
    if (values.role === 'supplier') {
      const company = addCompany({
        name: trimmed.company, country: values.country, city: trimmed.city, businessType: values.businessType,
        contact: { person: trimmed.name, email: trimmed.email, phone, address: '' },
      });
      updateAccount(result.user.id, { companyId: company.id });
    }
    showToast(`Welcome to TradeSphere, ${result.user.name}.`);
    return navigate(ROLE_HOME[values.role], { replace: true });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={busy || undefined}>
      {formError ? <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p> : null}

      <fieldset>
        <legend className="ts-label">I am joining as a</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const selected = values.role === option.value;
            return (
              <label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${selected ? 'border-brand-500 bg-brand-50' : 'bg-white hover:border-navy-200'}`}>
                <input type="radio" name="register-role" value={option.value} checked={selected} onChange={set('role')} className="sr-only" />
                <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-brand-500 text-navy-900' : 'bg-navy-50 text-navy-800'}`}><option.icon className="size-5" aria-hidden="true" /></span>
                <span>
                  <span className="block text-sm font-bold text-navy-900">{option.label}</span>
                  <span className="block text-xs text-muted">{option.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="register-name" label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
        <Input id="register-email" label="Work email" required type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <Input id="register-company" label="Company name" required autoComplete="organization" value={values.company} onChange={set('company')} error={errors.company} />
        {values.role === 'supplier' ? <Select id="register-businessType" label="Business type" options={BUSINESS_TYPES} value={values.businessType} onChange={set('businessType')} /> : <span className="hidden sm:block" aria-hidden="true" />}
        <Select id="register-country" label="Country" required options={COUNTRIES} value={values.country} onChange={set('country')} error={errors.country} />
        <Input id="register-city" label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />
        <Input id="register-phone" label="Mobile number" required type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} error={errors.phone} hint={`Format for ${values.country}: ${mobileExample(values.country)}`} wrapperClassName="sm:col-span-2" />
        <Input id="register-password" label="Password" required type="password" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} hint="At least 8 characters, with a letter and a number." />
        <Input id="register-confirmPassword" label="Confirm password" required type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
      </div>

      <div>
        <Checkbox id="register-agree" checked={values.agree} onChange={(checked) => { setValues((previous) => ({ ...previous, agree: checked })); setErrors((previous) => ({ ...previous, agree: '' })); }} label={<>I accept the <Link to="/info/terms" className="font-semibold text-brand-600">terms of use</Link> and <Link to="/info/privacy" className="font-semibold text-brand-600">privacy notice</Link>.</>} />
        {errors.agree ? <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">{errors.agree}</p> : null}
      </div>

      <Button type="submit" full size="lg" icon={UserPlus} loading={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
      <p className="text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link></p>
    </form>
  );
}
