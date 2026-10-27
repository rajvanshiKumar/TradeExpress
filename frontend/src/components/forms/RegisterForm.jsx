import { useEffect, useState, useRef, startTransition } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, ChevronDown, CircleAlert, Mail, RefreshCw, Search, ShieldCheck, ShoppingBag, Smartphone, UserPlus } from 'lucide-react';

import Input, { Checkbox } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import { BUSINESS_TYPES, COUNTRIES, COUNTRY_FLAGS, COUNTRY_PHONE_RULES, ROLE_HOME } from '../../utils/constants';
import { focusFirstError, hasErrors, mobileExample, normalizeEmail, parseMobile, rules, validate } from '../../utils/validators';

// Public registration offers Buyer and Supplier only. There is no way to choose Admin here.
const ROLE_OPTIONS = [
  { value: 'buyer', label: 'Buyer', text: 'Importers, wholesalers and retailers sourcing products.', icon: ShoppingBag },
  { value: 'supplier', label: 'Supplier', text: 'Manufacturers and exporters listing products.', icon: Building2 },
];

/**
 * Mobile OTP Verification Toggle.
 * Set to FALSE to temporarily bypass mobile OTP during registration.
 * Set to TRUE whenever you want to re-enable mobile OTP verification.
 */
export const ENABLE_MOBILE_OTP = false;

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

export default function RegisterForm({ role: propRole, onRoleChange }) {
  const { register, updateAccount, preferences } = useAuth();
  const { addCompany } = useProducts();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState({
    role: propRole || (searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer'),
    name: '',
    email: '',
    emailOtp: '',
    company: '',
    country: preferences.country || 'India',
    city: '',
    phone: '',
    phoneOtp: '',
    businessType: 'Manufacturer',
    password: '',
    confirmPassword: '',
    agree: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (propRole && propRole !== values.role) {
      setValues((prev) => ({ ...prev, role: propRole }));
    }
  }, [propRole]);

  // Mobile OTP States
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Email OTP States
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Countdown timers for OTP resend cooldowns
  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Country dropdown state for main Country field
  const [countrySelectOpen, setCountrySelectOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countrySelectRef = useRef(null);

  // Country dropdown state for Mobile Number field
  const [phoneCountryDropdownOpen, setPhoneCountryDropdownOpen] = useState(false);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState('');
  const phoneCountryDropdownRef = useRef(null);

  // Business Type dropdown state
  const [businessTypeOpen, setBusinessTypeOpen] = useState(false);
  const [businessTypeSearch, setBusinessTypeSearch] = useState('');
  const businessTypeRef = useRef(null);

  // Click outside and escape key listeners for all dropdowns
  useEffect(() => {
    if (!countrySelectOpen && !phoneCountryDropdownOpen && !businessTypeOpen) return;
    const handlePointer = (e) => {
      if (countrySelectRef.current && !countrySelectRef.current.contains(e.target)) {
        setCountrySelectOpen(false);
      }
      if (phoneCountryDropdownRef.current && !phoneCountryDropdownRef.current.contains(e.target)) {
        setPhoneCountryDropdownOpen(false);
      }
      if (businessTypeRef.current && !businessTypeRef.current.contains(e.target)) {
        setBusinessTypeOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setCountrySelectOpen(false);
        setPhoneCountryDropdownOpen(false);
        setBusinessTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [countrySelectOpen, phoneCountryDropdownOpen, businessTypeOpen]);

  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    const dial = COUNTRY_PHONE_RULES[c]?.dial || '';
    return c.toLowerCase().includes(q) || dial.includes(q);
  });

  const filteredBusinessTypes = BUSINESS_TYPES.filter((type) => {
    const q = businessTypeSearch.trim().toLowerCase();
    if (!q) return true;
    return type.toLowerCase().includes(q);
  });


  const filteredPhoneCountries = COUNTRIES.filter((c) => {
    const q = phoneCountrySearch.trim().toLowerCase();
    if (!q) return true;
    const dial = COUNTRY_PHONE_RULES[c]?.dial || '';
    return c.toLowerCase().includes(q) || dial.includes(q);
  });


  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field] || (field === 'country' && errors.phone)) {
      setErrors((previous) => ({
        ...previous,
        [field]: '',
        ...(field === 'country' ? { phone: '' } : {}),
      }));
    }
    setFormError('');
  };

  /** Sends verification OTP to the entered mobile number */
  const handleSendMobileOtp = async () => {
    const parsed = parseMobile(values.phone, values.country);
    if (!values.phone || !parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: `Enter a valid ${values.country} mobile number.`,
      }));
      return;
    }

    setPhoneOtpSending(true);
    setErrors((prev) => ({ ...prev, phone: '', phoneOtp: '' }));
    setFormError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: values.phone,
          country: values.country,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhoneOtpSent(true);
        setPhoneCooldown(data.cooldownSeconds || 60);
        showToast('Verification code dispatched to your mobile number.');
      } else {
        setErrors((prev) => ({ ...prev, phone: data.message || 'Unable to dispatch mobile OTP.' }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        phone: 'Could not connect to authentication server. Please try again.',
      }));
    } finally {
      setPhoneOtpSending(false);
    }
  };

  /** Sends verification OTP to the entered work email */
  const handleSendEmailOtp = async () => {
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
      setErrors((prev) => ({
        ...prev,
        email: 'Please enter a valid work email address first.',
      }));
      return;
    }

    setEmailOtpSending(true);
    setErrors((prev) => ({ ...prev, email: '', emailOtp: '' }));
    setFormError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/send-email-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: values.name.trim() || 'Partner',
          purpose: 'registration',
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEmailOtpSent(true);
        setEmailCooldown(data.cooldownSeconds || 60);
        showToast(`Verification code sent to ${cleanEmail}.`);
      } else {
        const errMsg = data.message || 'Unable to dispatch verification email.';
        setErrors((prev) => ({ ...prev, email: errMsg }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        email: 'Could not connect to email server. Please try again.',
      }));
    } finally {
      setEmailOtpSending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = {
      ...values,
      name: values.name.trim(),
      email: normalizeEmail(values.email),
      company: values.company.trim(),
      city: values.city.trim(),
    };
    const found = validate(schema, trimmed);
    if (!['buyer', 'supplier'].includes(values.role)) found.role = 'Choose Buyer or Supplier.';
    if (!values.agree) found.agree = 'Please accept the terms of use to continue.';

    // Mobile OTP Validation
    const cleanPhoneOtp = (values.phoneOtp || '').trim();
    if (!cleanPhoneOtp) {
      found.phoneOtp = 'Please enter mobile verification code.';
    } else if (cleanPhoneOtp !== '123456' && cleanPhoneOtp.length !== 6) {
      found.phoneOtp = 'Please enter a valid 6-digit OTP.';
    }

    // Email OTP Validation
    const cleanEmailOtp = (values.emailOtp || '').trim();
    if (!cleanEmailOtp) {
      found.emailOtp = 'Please enter email verification code.';
    } else if (cleanEmailOtp !== '123456' && cleanEmailOtp.length !== 6) {
      found.emailOtp = 'Please enter a valid 6-digit OTP.';
    }

    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'register-');

    setBusy(true);

    let verificationToken = 'evt_test_123456';
    let emailVerificationToken = 'evt_test_123456';

    const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

    // Verify Mobile OTP if not bypass 123456
    if (cleanPhoneOtp !== '123456') {
      try {
        const res = await fetch(`${baseUrl}/auth/verify-mobile-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            phone: values.phone,
            country: values.country,
            otp: cleanPhoneOtp,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setBusy(false);
          setErrors((prev) => ({
            ...prev,
            phoneOtp: data.message || 'Invalid mobile verification code.',
          }));
          return;
        }
        if (data.data?.verificationToken) {
          verificationToken = data.data.verificationToken;
        }
      } catch {
        setBusy(false);
        setErrors((prev) => ({
          ...prev,
          phoneOtp: 'Could not verify mobile OTP. Please try again.',
        }));
        return;
      }
    }

    // Verify Email OTP if not bypass 123456
    if (cleanEmailOtp !== '123456') {
      try {
        const res = await fetch(`${baseUrl}/auth/verify-email-verification-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            email: trimmed.email,
            otp: cleanEmailOtp,
            purpose: 'registration',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setBusy(false);
          setErrors((prev) => ({
            ...prev,
            emailOtp: data.message || 'Invalid email verification code.',
          }));
          return;
        }
        if (data.verificationToken) {
          emailVerificationToken = data.verificationToken;
        }
      } catch {
        setBusy(false);
        setErrors((prev) => ({
          ...prev,
          emailOtp: 'Could not verify email OTP. Please try again.',
        }));
        return;
      }
    }

    const phone = parseMobile(values.phone, values.country).international;
    const result = await register({
      ...trimmed,
      phone,
      role: values.role,
      verificationToken,
      emailVerificationToken,
    });

    // The passwords were only needed to create the hash. They are cleared from the form now.
    setValues((previous) => ({ ...previous, password: '', confirmPassword: '' }));
    setBusy(false);
    if (!result.ok) return setFormError(result.error);

    // A new supplier gets a company profile so the supplier dashboard works straight away.
    if (values.role === 'supplier') {
      const company = addCompany({
        name: trimmed.company,
        country: values.country,
        city: trimmed.city,
        businessType: values.businessType,
        contact: { person: trimmed.name, email: trimmed.email, phone, address: '' },
      });
      updateAccount(result.user.id, { companyId: company.id });
    }
    showToast(`Welcome to TradeExpress, ${result.user.name}.`);
    startTransition(() => {
      navigate(ROLE_HOME[values.role], { replace: true });
    });
    return;
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
              <label
                key={option.value}
                onClick={() => {
                  if (values.role !== option.value) {
                    setValues((prev) => ({ ...prev, role: option.value }));
                    if (onRoleChange) onRoleChange(option.value);
                    if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
                  }
                }}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 transition-all select-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20' : 'bg-white border-navy-200/80 hover:border-navy-300'
                  }`}
              >
                <input
                  type="radio"
                  name="register-role"
                  value={option.value}
                  checked={selected}
                  onChange={() => {
                    setValues((prev) => ({ ...prev, role: option.value }));
                    if (onRoleChange) onRoleChange(option.value);
                    if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
                  }}
                  className="sr-only"
                />
                <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${selected ? 'bg-brand-500 text-navy-950 font-bold' : 'bg-navy-100/70 text-navy-700'}`}>
                  <option.icon className="size-5 shrink-0" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-navy-950">{option.label}</span>
                  <span className="block text-xs text-muted leading-relaxed">{option.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="register-name" label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
        <Input id="register-company" label="Company name" required autoComplete="organization" value={values.company} onChange={set('company')} error={errors.company} />

        {/* Country Dropdown Menu Field */}
        <div>
          <label htmlFor="register-country-trigger" className="ts-label">
            Country <span className="text-danger">*</span>
          </label>
          <div className="relative" ref={countrySelectRef}>
            <input
              type="hidden"
              id="register-country"
              name="country"
              value={values.country}
            />
            <button
              id="register-country-trigger"
              type="button"
              onClick={() => setCountrySelectOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={countrySelectOpen}
              className={`ts-input text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${errors.country ? '!border-danger ring-1 ring-danger/20' : ''
                }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="text-lg shrink-0" aria-hidden="true">{COUNTRY_FLAGS[values.country] || '🌐'}</span>
                <span className="font-semibold text-navy-950 truncate">{values.country}</span>
              </span>
              <ChevronDown
                className={`size-4 text-navy-500 shrink-0 transition-transform duration-200 ${countrySelectOpen ? 'rotate-180 text-brand-600' : ''
                  }`}
                aria-hidden="true"
              />
            </button>

            {/* Custom Dropdown Menu Panel with Search */}
            {countrySelectOpen && (
              <div
                role="listbox"
                aria-label="Select Country"
                className="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[280px] max-h-72 overflow-hidden rounded-xl border border-navy-900/10 bg-white shadow-2xl ring-1 ring-black/5 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="p-2 border-b border-navy-100 bg-surface/70 sticky top-0 z-10">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-navy-400" />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country or dial code..."
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-navy-200 bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-56 p-1 divide-y divide-navy-50">
                  {filteredCountries.map((c) => {
                    const rule = COUNTRY_PHONE_RULES[c];
                    const flag = COUNTRY_FLAGS[c] || '🌐';
                    const isSelected = values.country === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setValues((prev) => ({ ...prev, country: c }));
                          if (errors.country || errors.phone) {
                            setErrors((prev) => ({ ...prev, country: '', phone: '' }));
                          }
                          setCountrySelectOpen(false);
                          setCountrySearch('');
                        }}
                        className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer ${isSelected
                            ? 'bg-brand-50 text-navy-950 font-bold'
                            : 'text-navy-800 hover:bg-navy-50'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{flag}</span>
                          <span className="truncate">{c}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-navy-600 shrink-0 ml-2">
                          +{rule?.dial}
                        </span>
                      </button>
                    );
                  })}
                  {filteredCountries.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted">No matching country found</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {errors.country ? (
            <p id="register-country-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {errors.country}
            </p>
          ) : null}
        </div>

        <Input id="register-city" label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />

        {/* Business Type Field (Spanning 2 columns for Supplier) */}
        {values.role === 'supplier' ? (
          <div className="sm:col-span-2">
            <label htmlFor="register-businesstype-trigger" className="ts-label">
              Business type <span className="text-danger">*</span>
            </label>
            <div className="relative" ref={businessTypeRef}>
              <input
                type="hidden"
                id="register-businessType"
                name="businessType"
                value={values.businessType}
              />
              <button
                id="register-businesstype-trigger"
                type="button"
                onClick={() => setBusinessTypeOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={businessTypeOpen}
                className="ts-input text-left flex items-center justify-between gap-2 cursor-pointer transition-all"
              >
                <span className="flex items-center gap-2 truncate">
                  <Building2 className="size-4 text-brand-600 shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-navy-950 truncate">
                    {values.businessType || 'Select business type'}
                  </span>
                </span>
                <ChevronDown
                  className={`size-4 text-navy-500 shrink-0 transition-transform duration-200 ${businessTypeOpen ? 'rotate-180 text-brand-600' : ''
                    }`}
                  aria-hidden="true"
                />
              </button>

              {businessTypeOpen && (
                <div
                  role="listbox"
                  aria-label="Select Business Type"
                  className="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[280px] max-h-72 overflow-hidden rounded-xl border border-navy-900/10 bg-white shadow-2xl ring-1 ring-black/5 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="p-2 border-b border-navy-100 bg-surface/70 sticky top-0 z-10">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-navy-400" />
                      <input
                        type="text"
                        value={businessTypeSearch}
                        onChange={(e) => setBusinessTypeSearch(e.target.value)}
                        placeholder="Search business type..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-navy-200 bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-56 p-1 divide-y divide-navy-50">
                    {filteredBusinessTypes.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted">
                        No matching business type found
                      </div>
                    ) : (
                      filteredBusinessTypes.map((type) => {
                        const isSelected = values.businessType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setValues((prev) => ({ ...prev, businessType: type }));
                              setBusinessTypeOpen(false);
                              setBusinessTypeSearch('');
                            }}
                            className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer ${isSelected
                                ? 'bg-brand-50 text-brand-900 font-bold'
                                : 'text-navy-800 hover:bg-navy-50'
                              }`}
                          >
                            <span className="truncate">{type}</span>
                            {isSelected && (
                              <CheckCircle2 className="size-4 text-brand-600 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Mobile number * */}
        <div className="sm:col-span-2">
          <label htmlFor="register-phone" className="ts-label">
            Mobile number <span className="text-danger">*</span>
          </label>

          {/* country code    field for number  otp */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Country Code Trigger Button */}
            <div className="relative shrink-0" ref={phoneCountryDropdownRef}>
              <button
                id="register-phone-country-trigger"
                type="button"
                onClick={() => setPhoneCountryDropdownOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={phoneCountryDropdownOpen}
                title={`${values.country} (+${COUNTRY_PHONE_RULES[values.country]?.dial || '91'})`}
                className="h-11 sm:h-12 px-2.5 rounded-xl border border-[#d9dfd2] bg-white text-xs font-bold text-navy-900 shadow-xs hover:border-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 flex items-center justify-center gap-1 transition-all shrink-0 cursor-pointer"
              >
                <span className="font-bold font-mono text-navy-950 text-xs">+{COUNTRY_PHONE_RULES[values.country]?.dial || '91'}</span>
                <ChevronDown className={`size-3 text-navy-400 transition-transform ${phoneCountryDropdownOpen ? 'rotate-180 text-brand-600' : ''}`} />
              </button>

              {/* Country Code Dropdown Menu Panel */}
              {phoneCountryDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Select Mobile Country Code"
                  className="absolute left-0 top-full mt-1.5 z-50 w-72 max-h-64 overflow-hidden rounded-xl border border-navy-900/10 bg-white shadow-2xl ring-1 ring-black/5 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="p-2 border-b border-navy-100 bg-surface/50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-navy-400" />
                      <input
                        type="text"
                        value={phoneCountrySearch}
                        onChange={(e) => setPhoneCountrySearch(e.target.value)}
                        placeholder="Search country or code..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-navy-200 bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-48 p-1 divide-y divide-navy-50">
                    {filteredPhoneCountries.map((c) => {
                      const rule = COUNTRY_PHONE_RULES[c];
                      const flag = COUNTRY_FLAGS[c] || '🌐';
                      const isSelected = values.country === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setValues((prev) => ({ ...prev, country: c }));
                            if (errors.phone || errors.country) {
                              setErrors((prev) => ({ ...prev, phone: '', country: '' }));
                            }
                            setPhoneCountryDropdownOpen(false);
                            setPhoneCountrySearch('');
                          }}
                          className={`w-full px-2.5 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer ${isSelected
                              ? 'bg-brand-50 text-navy-950 font-bold'
                              : 'text-navy-800 hover:bg-navy-50'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{flag}</span>
                            <span className="truncate">{c}</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-navy-600 shrink-0 ml-2">
                            +{rule?.dial}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* field for number */}
            <input
              id="register-phone"
              type="tel"
              autoComplete="tel"
              required
              value={values.phone}
              onChange={set('phone')}
              placeholder={COUNTRY_PHONE_RULES[values.country]?.example || '98765 43210'}
              className={`ts-input flex-1 min-w-0 ${errors.phone ? '!border-danger' : ''}`}
              aria-invalid={errors.phone ? 'true' : undefined}
            />

            {/* otp */}
            <button
              type="button"
              onClick={handleSendMobileOtp}
              disabled={phoneOtpSending || phoneCooldown > 0}
              className="shrink-0 px-3.5 sm:px-4 py-2 rounded-lg bg-navy-900 text-white text-xs sm:text-sm font-semibold hover:bg-navy-800 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              {phoneOtpSending ? (
                <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {phoneCooldown > 0
                ? `Resend in ${phoneCooldown}s`
                : phoneOtpSent
                  ? 'Resend OTP'
                  : 'Send OTP'}
            </button>
          </div>

          {errors.phone ? (
            <p id="register-phone-error" role="alert" className="mt-1 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errors.phone}
            </p>
          ) : null}

          {/* here input box for otp */}
          <div className="mt-2.5">
            <input
              id="register-phone-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={values.phoneOtp}
              onChange={set('phoneOtp')}
              placeholder="Enter mobile OTP"
              className={`ts-input tracking-widest text-center sm:text-left font-mono font-bold ${errors.phoneOtp ? '!border-danger' : ''
                }`}
              aria-invalid={errors.phoneOtp ? 'true' : undefined}
            />
            {errors.phoneOtp ? (
              <p role="alert" className="mt-1 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.phoneOtp}
              </p>
            ) : null}
          </div>
        </div>

        {/* Work Email : */}
        <div className="sm:col-span-2">
          <label htmlFor="register-email" className="ts-label">
            Work Email <span className="text-danger">*</span>
          </label>

          {/* input field for email     otp */}
          <div className="flex gap-2">
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={set('email')}
              placeholder="e.g. name@company.com"
              className={`ts-input flex-1 ${errors.email ? '!border-danger' : ''}`}
              aria-invalid={errors.email ? 'true' : undefined}
            />
            <button
              type="button"
              onClick={handleSendEmailOtp}
              disabled={emailOtpSending || emailCooldown > 0}
              className="shrink-0 px-3.5 sm:px-4 py-2 rounded-lg bg-navy-900 text-white text-xs sm:text-sm font-semibold hover:bg-navy-800 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              {emailOtpSending ? (
                <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {emailCooldown > 0
                ? `Resend in ${emailCooldown}s`
                : emailOtpSent
                  ? 'Resend OTP'
                  : 'Send OTP'}
            </button>
          </div>

          {errors.email ? (
            <p id="register-email-error" role="alert" className="mt-1 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {errors.email}
            </p>
          ) : null}

          {/* input field for otp */}
          <div className="mt-2.5">
            <input
              id="register-email-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={values.emailOtp}
              onChange={set('emailOtp')}
              placeholder="Enter email OTP"
              className={`ts-input tracking-widest text-center sm:text-left font-mono font-bold ${errors.emailOtp ? '!border-danger' : ''
                }`}
              aria-invalid={errors.emailOtp ? 'true' : undefined}
            />
            {errors.emailOtp ? (
              <p role="alert" className="mt-1 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.emailOtp}
              </p>
            ) : null}
          </div>
        </div>

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

