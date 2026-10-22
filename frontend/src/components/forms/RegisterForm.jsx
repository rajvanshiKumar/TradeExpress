import { useEffect, useState, startTransition } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck, ShoppingBag, Smartphone, UserPlus } from 'lucide-react';
import Input, { Checkbox } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import Modal from '../common/Modal';
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
    role: searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer',
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
    if (errors[field] || (field === 'country' && errors.phone)) {
      setErrors((previous) => ({
        ...previous,
        [field]: '',
        ...(field === 'country' ? { phone: '' } : {}),
      }));
    }
    setFormError('');
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

    // Mobile OTP verification validation
    if (!isMobileVerified || !verificationToken) {
      found.phone = 'Please verify your mobile number with OTP before continuing.';
    }

    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'register-');

    setBusy(true);
    const phone = parseMobile(values.phone, values.country).international;
    const result = await register({
      ...trimmed,
      phone,
      role: values.role,
      verificationToken,
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
    showToast(`Welcome to TradeSphere, ${result.user.name}.`);
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
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                  selected ? 'border-brand-500 bg-brand-50' : 'bg-white hover:border-navy-200'
                }`}
              >
                <input type="radio" name="register-role" value={option.value} checked={selected} onChange={set('role')} className="sr-only" />
                <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-brand-500 text-navy-900' : 'bg-navy-50 text-navy-800'}`}>
                  <option.icon className="size-5" aria-hidden="true" />
                </span>
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
        {values.role === 'supplier' ? (
          <Select id="register-businessType" label="Business type" options={BUSINESS_TYPES} value={values.businessType} onChange={set('businessType')} />
        ) : (
          <span className="hidden sm:block" aria-hidden="true" />
        )}
        <Select id="register-country" label="Country" required options={COUNTRIES} value={values.country} onChange={set('country')} error={errors.country} />
        <Input id="register-city" label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />

        {/* Mobile Number Field with Send OTP Button & Verified Status Indicator */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="register-phone" className="ts-label !mb-0">
              Mobile number <span className="text-danger" aria-hidden="true">*</span>
            </label>
            {isMobileVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                Verified
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
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
                placeholder={mobileExample(values.country)}
                className={`ts-input ${
                  isMobileVerified
                    ? '!bg-slate-50 !text-slate-700 !border-emerald-400 cursor-not-allowed'
                    : ''
                }`}
                aria-invalid={errors.phone ? 'true' : undefined}
                aria-describedby={errors.phone ? 'register-phone-error' : 'register-phone-hint'}
              />
            </div>
            {!isMobileVerified ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleOpenOtpModal}
                loading={otpSending && !otpModalOpen}
                disabled={!values.phone}
                className="shrink-0 font-semibold"
              >
                {otpSent ? 'Enter OTP' : 'Send OTP'}
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileVerified(false);
                  setVerificationToken('');
                  setOtpSent(false);
                  setOtpFeedback({ type: '', message: '' });
                }}
                className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 self-center px-2 py-1"
              >
                Change number
              </button>
            )}
          </div>
          {errors.phone ? (
            <p id="register-phone-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errors.phone}
            </p>
          ) : !isMobileVerified ? (
            <p id="register-phone-hint" className="mt-1.5 text-[0.8125rem] text-muted">
              Format for {values.country}: {mobileExample(values.country)}. Click Send OTP to verify your number.
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

