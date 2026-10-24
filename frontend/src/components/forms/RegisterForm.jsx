import { useEffect, useState, useRef, startTransition } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, ChevronDown, CircleAlert, Mail, RefreshCw, Search, ShieldCheck, ShoppingBag, Smartphone, UserPlus } from 'lucide-react';

import Input, { Checkbox } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import Modal from '../common/Modal';
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
    company: '',
    country: preferences.country || 'India',
    city: '',
    phone: '',
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

  // Mobile OTP Verification Modal & State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpFeedback, setOtpFeedback] = useState({ type: '', message: '' });

  // Supplier Email OTP Verification State
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailOtpFeedback, setEmailOtpFeedback] = useState({ type: '', message: '' });

  // Countdown timer for Email OTP resend cooldown
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

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
    if (field === 'email' && isEmailVerified) {
      setIsEmailVerified(false);
      setEmailVerificationToken('');
      setEmailOtpSent(false);
      setEmailOtpCode('');
      setEmailOtpFeedback({ type: '', message: '' });
    }
    if (errors[field] || (field === 'country' && errors.phone)) {
      setErrors((previous) => ({
        ...previous,
        [field]: '',
        ...(field === 'country' ? { phone: '' } : {}),
      }));
    }
    setFormError('');
  };

  /** Dispatches Email verification OTP for supplier registration */
  const handleSendEmailOtp = async () => {
    if (emailOtpSending || emailCooldown > 0) return;
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid work email address first.' }));
      return;
    }

    setEmailOtpSending(true);
    setEmailOtpFeedback({ type: '', message: '' });
    setErrors((prev) => ({ ...prev, email: '' }));

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/send-email-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: values.name.trim() || 'Supplier Partner',
          purpose: 'registration',
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEmailOtpSent(true);
        setEmailCooldown(data.cooldownSeconds || 60);
        setEmailOtpFeedback({
          type: 'success',
          message: data.message || `OTP sent to ${cleanEmail}. Please check your inbox.`,
        });
        showToast('Verification code dispatched to your work email.');
      } else {
        const errMsg = data.message || 'Unable to dispatch verification email.';
        setEmailOtpFeedback({ type: 'error', message: errMsg });
        if (res.status === 409) {
          setErrors((prev) => ({ ...prev, email: errMsg }));
        }
      }
    } catch {
      setEmailOtpFeedback({
        type: 'error',
        message: 'Could not connect to email verification server. Please check your connection.',
      });
    } finally {
      setEmailOtpSending(false);
    }
  };

  /** Verifies submitted Email OTP code */
  const handleVerifyEmailOtp = async () => {
    const cleanCode = emailOtpCode.trim();
    if (emailOtpVerifying || cleanCode.length < 4) return;
    const cleanEmail = normalizeEmail(values.email);

    setEmailOtpVerifying(true);
    setEmailOtpFeedback({ type: '', message: '' });

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/verify-email-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanCode,
          purpose: 'registration',
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsEmailVerified(true);
        setEmailVerificationToken(data.verificationToken || 'verified');
        setEmailOtpFeedback({
          type: 'success',
          message: 'Work email verified successfully!',
        });
        setErrors((prev) => ({ ...prev, email: '' }));
        showToast('Work email verified successfully!');
      } else {
        setEmailOtpFeedback({
          type: 'error',
          message: data.message || 'Invalid or expired OTP. Please try again.',
        });
      }
    } catch {
      setEmailOtpFeedback({
        type: 'error',
        message: 'Unable to verify OTP with server. Please try again.',
      });
    } finally {
      setEmailOtpVerifying(false);
    }
  };


  /**
   * Opens the OTP Verification Popup and immediately dispatches the OTP request.
   */
  const handleOpenOtpModal = async () => {
    // 1. Validate phone number for selected country
    const parsed = parseMobile(values.phone, values.country);
    if (!parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: `Enter a valid ${values.country} mobile number, e.g. ${mobileExample(values.country)}.`,
      }));
      return;
    }

    // Clear any previous error on phone field
    setErrors((prev) => ({ ...prev, phone: '' }));

    // 2. Open the popup modal and keep it open
    setOtpModalOpen(true);
    setOtpValue('');
    setOtpFeedback({ type: '', message: '' });

    // 3. Dispatch OTP if not already sent with active cooldown
    if (cooldown <= 0) {
      await executeSendOtp(false);
    }
  };

  /**
   * Sends or resends OTP via backend API. Keeps modal open to display errors or countdown.
   */
  const executeSendOtp = async (isResend = false) => {
    if (otpSending || otpVerifying) return;

    const parsed = parseMobile(values.phone, values.country);
    if (!parsed.ok) return;

    setOtpSending(true);
    setOtpFeedback({ type: '', message: '' });

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const endpoint = isResend ? `${baseUrl}/auth/resend-mobile-otp` : `${baseUrl}/auth/send-mobile-otp`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phone: values.phone, country: values.country }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOtpSent(true);
        setCooldown(data.cooldownSeconds || 60);
        setOtpFeedback({
          type: 'success',
          message: data.message || `OTP sent via SMS to ${parsed.international}.`,
        });
        showToast(isResend ? 'OTP resent successfully.' : 'OTP sent to your mobile number.');
      } else {
        const errMsg = data.message || (isResend ? 'Unable to resend OTP.' : 'Unable to send OTP.');
        setOtpFeedback({ type: 'error', message: errMsg });
        if (res.status === 409) {
          setErrors((prev) => ({ ...prev, phone: errMsg }));
        }
      }
    } catch {
      setOtpFeedback({
        type: 'error',
        message: 'Could not connect to SMS verification server. Please check your connection.',
      });
    } finally {
      setOtpSending(false);
    }
  };

  /**
   * Verifies submitted OTP code with the backend.
   */
  const handleVerifyOtp = async () => {
    if (otpVerifying || !otpValue || otpValue.trim().length < 4) return;

    setOtpVerifying(true);
    setOtpFeedback({ type: '', message: '' });

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/verify-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phone: values.phone, country: values.country, otp: otpValue.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data?.verificationToken) {
        setIsMobileVerified(true);
        setVerificationToken(data.data.verificationToken);
        setVerifiedPhone(values.phone);
        setOtpSent(false);
        setOtpValue('');
        setOtpModalOpen(false); // Close popup upon successful verification
        setOtpFeedback({ type: '', message: '' });
        setErrors((prev) => ({ ...prev, phone: '', otp: '' }));
        showToast('Mobile number verified successfully.');
      } else {
        setOtpFeedback({
          type: 'error',
          message: data.message || 'Invalid or expired OTP. Please check and try again.',
        });
      }
    } catch {
      setOtpFeedback({
        type: 'error',
        message: 'Failed to verify OTP due to a network issue. Please try again.',
      });
    } finally {
      setOtpVerifying(false);
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

    // Mobile OTP verification validation (only when enabled)
    if (ENABLE_MOBILE_OTP && (!isMobileVerified || !verificationToken)) {
      found.phone = 'Please verify your mobile number with OTP before continuing.';
    }

    // Supplier Email OTP verification validation (required when role is supplier)
    if (values.role === 'supplier' && !isEmailVerified) {
      found.email = 'Supplier verification required: Please verify your work email with OTP.';
      if (!emailOtpSent && values.email) {
        handleSendEmailOtp();
      }
    }

    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'register-');

    setBusy(true);
    const phone = parseMobile(values.phone, values.country).international;
    const result = await register({
      ...trimmed,
      phone,
      role: values.role,
      ...(ENABLE_MOBILE_OTP ? { verificationToken } : {}),
      ...(values.role === 'supplier' ? { emailVerificationToken } : {}),
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
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 transition-all select-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                  selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20' : 'bg-white border-navy-200/80 hover:border-navy-300'
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
              className={`ts-input text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${
                errors.country ? '!border-danger ring-1 ring-danger/20' : ''
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="text-lg shrink-0" aria-hidden="true">{COUNTRY_FLAGS[values.country] || '🌐'}</span>
                <span className="font-semibold text-navy-950 truncate">{values.country}</span>
              </span>
              <ChevronDown
                className={`size-4 text-navy-500 shrink-0 transition-transform duration-200 ${
                  countrySelectOpen ? 'rotate-180 text-brand-600' : ''
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
                        className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                          isSelected
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
                  className={`size-4 text-navy-500 shrink-0 transition-transform duration-200 ${
                    businessTypeOpen ? 'rotate-180 text-brand-600' : ''
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
                            className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                              isSelected
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

        {/* Mobile Number Field with Small Country Code Button and Small OTP Button */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="register-phone" className="ts-label !mb-0">
              Mobile number <span className="text-danger">*</span>
            </label>
            {isMobileVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                Mobile Verified
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Small Country Code Trigger Button */}
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
                          className={`w-full px-2.5 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                            isSelected
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

            {/* Mobile Number Input */}
            <input
              id="register-phone"
              type="tel"
              autoComplete="tel"
              required
              disabled={isMobileVerified || otpVerifying}
              value={values.phone}
              onChange={(e) => {
                set('phone')(e);
                if (isMobileVerified) {
                  setIsMobileVerified(false);
                  setVerificationToken('');
                }
              }}
              placeholder={COUNTRY_PHONE_RULES[values.country]?.example || '98765 43210'}
              className={`ts-input flex-1 min-w-0 ${
                isMobileVerified ? '!bg-slate-50 !text-slate-700 !border-emerald-400' : ''
              } ${errors.phone ? '!border-danger' : ''}`}
              aria-invalid={errors.phone ? 'true' : undefined}
              aria-describedby={errors.phone ? 'register-phone-error' : 'register-phone-hint'}
            />

            {/* Small Button for OTP */}
            {!isMobileVerified ? (
              <button
                type="button"
                onClick={handleOpenOtpModal}
                disabled={otpSending || !values.phone}
                className="h-11 sm:h-12 px-3 sm:px-3.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 active:scale-95 shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <Smartphone className="size-3.5 shrink-0" />
                <span>{otpSending ? 'Sending...' : otpSent ? (cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend OTP') : 'Send OTP'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileVerified(false);
                  setVerificationToken('');
                  setOtpSent(false);
                  setOtpFeedback({ type: '', message: '' });
                }}
                className="h-11 sm:h-12 px-2.5 text-xs font-semibold text-brand-700 hover:text-brand-900 shrink-0 underline cursor-pointer"
              >
                Change
              </button>
            )}
          </div>

          {errors.phone ? (
            <p id="register-phone-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errors.phone}
            </p>
          ) : (
            <p id="register-phone-hint" className="mt-1.5 text-[0.8125rem] text-muted">
              Format for {values.country}: {mobileExample(values.country)}
            </p>
          )}
        </div>

        {/* Work Email Field (Moved Down, with Input Box & OTP Button Side-by-Side) */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="register-email" className="ts-label !mb-0">
              Work email <span className="text-danger">*</span>
            </label>
            {isEmailVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                Email Verified
              </span>
            ) : values.role === 'supplier' ? (
              <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md">
                Supplier Verification Required
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              disabled={isEmailVerified}
              value={values.email}
              onChange={set('email')}
              placeholder="e.g. name@company.com"
              className={`ts-input flex-1 min-w-0 ${
                isEmailVerified ? '!bg-slate-50 !text-slate-700 !border-emerald-300 cursor-not-allowed' : ''
              } ${errors.email ? '!border-danger' : ''}`}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
            />

            {!isEmailVerified ? (
              <button
                type="button"
                onClick={handleSendEmailOtp}
                disabled={emailOtpSending || !values.email}
                className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 active:scale-95 shadow-sm transition-all disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Mail className="size-3.5 sm:size-4 shrink-0" />
                <span>{emailOtpSending ? 'Sending...' : emailOtpSent ? (emailCooldown > 0 ? `Resend (${emailCooldown}s)` : 'Resend OTP') : 'Send OTP'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEmailVerified(false);
                  setEmailVerificationToken('');
                  setEmailOtpSent(false);
                  setEmailOtpCode('');
                  setEmailOtpFeedback({ type: '', message: '' });
                }}
                className="h-11 sm:h-12 px-2.5 text-xs font-semibold text-brand-700 hover:text-brand-900 shrink-0 underline cursor-pointer"
              >
                Change
              </button>
            )}
          </div>

          {/* Inline OTP Verification Box when OTP is dispatched */}
          {emailOtpSent && !isEmailVerified && (
            <div className="mt-2.5 rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <p className="text-navy-900 font-medium">
                  Enter the 6-digit code sent to <strong className="text-navy-950 font-semibold">{values.email}</strong>:
                </p>
                {emailCooldown > 0 && (
                  <span className="text-muted font-mono text-[11px]">Resend available in {emailCooldown}s</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  id="register-email-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={emailOtpCode}
                  onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-36 tracking-[0.3em] font-mono text-center text-sm font-bold py-2 px-3 rounded-lg border border-navy-300 bg-white text-navy-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleVerifyEmailOtp}
                  disabled={emailOtpVerifying || emailOtpCode.length < 4}
                  className="h-10 px-4 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>{emailOtpVerifying ? 'Verifying...' : 'Verify OTP'}</span>
                </button>
              </div>

              {emailOtpFeedback.message && (
                <p className={`text-xs font-medium ${emailOtpFeedback.type === 'error' ? 'text-danger' : 'text-emerald-700'}`}>
                  {emailOtpFeedback.message}
                </p>
              )}
            </div>
          )}

          {errors.email ? (
            <p id="register-email-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {errors.email}
            </p>
          ) : null}
        </div>


        {/* Mobile OTP Verification Popup Modal */}
        <Modal
          open={otpModalOpen}
          onClose={() => {
            if (!otpVerifying) {
              setOtpModalOpen(false);
            }
          }}
          title="Verify Mobile Number"
          description="We have sent a 6-digit one-time password (OTP) via SMS to verify your mobile number."
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-navy-100 bg-surface/80 p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Smartphone className="size-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sent to mobile</p>
                  <p className="text-sm font-bold text-navy-950">
                    {parseMobile(values.phone, values.country).international || values.phone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
              >
                Change
              </button>
            </div>

            <div>
              <label htmlFor="modal-otp-input" className="block text-xs font-bold uppercase tracking-wider text-navy-900 mb-1.5">
                Enter 6-Digit OTP <span className="text-danger">*</span>
              </label>
              <input
                id="modal-otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={otpValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpValue(val);
                  if (otpFeedback.type === 'error') {
                    setOtpFeedback({ type: '', message: '' });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otpValue.length >= 4 && !otpVerifying) {
                    e.preventDefault();
                    handleVerifyOtp();
                  }
                }}
                placeholder="••••••"
                className="w-full rounded-xl border-2 border-navy-200 px-4 py-3 font-mono text-center text-2xl font-bold tracking-[0.4em] text-navy-950 placeholder:text-navy-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {otpFeedback.message ? (
              <div
                role={otpFeedback.type === 'error' ? 'alert' : 'status'}
                className={`flex items-start gap-2 rounded-xl p-3 text-xs font-medium ${
                  otpFeedback.type === 'error'
                    ? 'border border-danger/20 bg-danger-50/80 text-red-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {otpFeedback.type === 'error' ? (
                  <CircleAlert className="size-4 shrink-0 mt-0.5 text-danger" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                )}
                <span>{otpFeedback.message}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted">Didn't receive the SMS code?</span>
              {cooldown > 0 ? (
                <span className="font-semibold text-muted">
                  Resend in <strong className="text-navy-900 font-mono">{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => executeSendOtp(true)}
                  disabled={otpSending}
                  className="font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1.5"
                >
                  <RefreshCw className={`size-3.5 ${otpSending ? 'animate-spin' : ''}`} />
                  Resend OTP
                </button>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                full
                onClick={() => setOtpModalOpen(false)}
                disabled={otpVerifying}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                full
                onClick={handleVerifyOtp}
                loading={otpVerifying}
                disabled={otpValue.length < 4 || otpVerifying}
              >
                Verify OTP
              </Button>
            </div>
          </div>
        </Modal>

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

