import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Building2,
  ShieldCheck,
  FileText,
  Eye,
  EyeOff,
  AlertCircle,
  MapPin,
  Briefcase,
  Clock,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  BadgeCheck,
  Tag,
} from 'lucide-react';

import CustomSelect from '../common/CustomSelect';
import SixDigitOtpRow from '../common/SixDigitOtpRow';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import {
  COUNTRIES,
  COUNTRY_FLAGS,
  COUNTRY_PHONE_RULES,
  INDIA_STATES,
  BUYER_TYPES,
  BUYER_GST_STATUS_OPTIONS,
  ROLE_HOME,
} from '../../utils/constants';
import { normalizeEmail, parseMobile, mobileExample } from '../../utils/validators';

const STEPS = [
  { id: 1, label: 'Account Details', desc: 'Credentials & contact' },
  { id: 2, label: 'Business Profile', desc: 'Categories, address & tax' },
  { id: 3, label: 'Review & Submit', desc: 'Confirm & register' },
];

const COUNTRY_DIAL_OPTIONS = COUNTRIES.map((c) => ({
  value: c,
  label: `+${COUNTRY_PHONE_RULES[c]?.dial || '91'}`.trim(),
  description: `${COUNTRY_FLAGS[c] || ''} ${c}`.trim(),
}));

export default function BuyerRegisterForm({ onRoleChange }) {
  const { preferences, setAuthUser } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  // Form State: Starts 100% blank with no auto-filled data
  const [values, setValues] = useState({
    // Step 1: Account Details
    name: '',
    companyName: '',
    email: '',
    phone: '',
    countryCode: 'India',
    password: '',
    confirmPassword: '',

    // Step 2: Business Profile
    buyerTypes: [],
    buyerTypeOther: '',
    country: '',
    state: '',
    city: '',
    postalCode: '',
    businessAddress: '',
    businessDescription: '',

    // Tax and Identity Details
    gstStatus: '',
    gstin: '',
    panNumber: '',
    taxId: '',

    // Step 3: Terms Agreement
    agreeTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email OTP Verification State
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailToken, setEmailToken] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');

  // Mobile OTP Verification State
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneToken, setPhoneToken] = useState('');
  const [phoneOtpError, setPhoneOtpError] = useState('');

  // Countdown timer for email OTP cooldown
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Countdown timer for mobile OTP cooldown
  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  // Ensure email and password start strictly blank and resist browser autofill
  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      email: '',
      password: '',
      confirmPassword: '',
    }));
  }, []);

  // Robust Input Change Handler: Guarantees string/boolean values and never stores objects
  const handleChange = (field) => (e) => {
    let val = '';
    if (e && typeof e === 'object') {
      if ('target' in e && e.target) {
        val = e.target.type === 'checkbox' ? Boolean(e.target.checked) : (e.target.value ?? '');
      } else if ('value' in e) {
        val = e.value ?? '';
      }
    } else if (typeof e === 'string' || typeof e === 'number' || typeof e === 'boolean') {
      val = e;
    }
    // Strict guard: ensure val is never an object
    if (typeof val === 'object') {
      val = '';
    }

    setValues((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Reset verified status if email or phone is edited
  const handleEmailChange = (e) => {
    let val = '';
    if (e && typeof e === 'object' && 'target' in e && e.target) {
      val = e.target.value ?? '';
    } else if (typeof e === 'string') {
      val = e;
    }
    if (typeof val === 'object') val = '';

    setValues((prev) => ({ ...prev, email: val }));
    if (emailVerified) {
      setEmailVerified(false);
      setEmailToken('');
      setEmailOtpSent(false);
      setEmailOtp('');
    }
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handlePhoneChange = (e) => {
    let val = '';
    if (e && typeof e === 'object' && 'target' in e && e.target) {
      val = e.target.value ?? '';
    } else if (typeof e === 'string') {
      val = e;
    }
    if (typeof val === 'object') val = '';

    setValues((prev) => ({ ...prev, phone: val }));
    if (phoneVerified) {
      setPhoneVerified(false);
      setPhoneToken('');
      setPhoneOtpSent(false);
      setPhoneOtp('');
    }

    const digits = val.replace(/\D/g, '');
    const country = values.countryCode || values.country || 'India';
    const dial = COUNTRY_PHONE_RULES[country]?.dial || '91';
    const example = mobileExample(country) || '98765 43210';
    const invalidMsg = `Please enter a valid mobile number for the selected country (e.g. +${dial} ${example}).`;

    if (digits.length > 10) {
      setErrors((prev) => ({ ...prev, phone: invalidMsg }));
    } else {
      setErrors((prev) => {
        if (prev.phone && prev.phone.includes('Please enter a valid mobile number')) {
          const { phone, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }
  };

  // When Country changes, reset dependent state / tax fields cleanly without auto-filling mock data
  const handleCountryChange = (newCountry) => {
    const c = typeof newCountry === 'string' ? newCountry : (newCountry?.target?.value ?? '');
    setValues((prev) => ({
      ...prev,
      country: c,
      countryCode: c || prev.countryCode || 'India',
      state: '',
      postalCode: '',
      gstStatus: '',
      gstin: '',
      panNumber: c === 'India' ? prev.panNumber : '',
      taxId: c !== 'India' ? prev.taxId : '',
    }));
    setErrors((prev) => ({
      ...prev,
      country: '',
      state: '',
      postalCode: '',
      gstStatus: '',
      gstin: '',
    }));
  };

  // Toggle multi-select Buyer Types
  const toggleBuyerType = (type) => {
    setValues((prev) => {
      const exists = prev.buyerTypes.includes(type);
      const updated = exists ? prev.buyerTypes.filter((t) => t !== type) : [...prev.buyerTypes, type];
      return { ...prev, buyerTypes: updated };
    });
    if (errors.buyerTypes) {
      setErrors((prev) => ({ ...prev, buyerTypes: '' }));
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-200', text: 'text-slate-400' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500', text: 'text-red-600' };
    if (score === 2 || score === 3) return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
    if (score === 4) return { score: 3, label: 'Good', color: 'bg-blue-600', text: 'text-blue-600' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-600', text: 'text-emerald-700' };
  };

  const strength = getPasswordStrength(values.password);

  // Email OTP Request
  const handleSendEmailOtp = async () => {
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Enter a valid business email address before requesting an OTP.' }));
      return;
    }

    setEmailOtpSending(true);
    setFormError('');
    setEmailOtpError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/send-email-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: values.name.trim() || 'Valued Buyer',
          purpose: 'buyer_registration',
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.message || 'Could not send verification email.';
        setFormError(msg);
        setEmailOtpError(msg);
        setEmailOtpSending(false);
        return;
      }

      setEmailOtpSent(true);
      setEmailCooldown(data.cooldownSeconds || 60);
    } catch {
      setEmailOtpError('Network error while requesting email OTP.');
    } finally {
      setEmailOtpSending(false);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setEmailOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setEmailVerifying(true);
    setEmailOtpError('');
    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/verify-email-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: normalizeEmail(values.email),
          otp: emailOtp.trim(),
          purpose: 'buyer_registration',
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.message || 'Invalid or expired verification code.';
        setEmailOtpError(msg);
        setEmailVerifying(false);
        return;
      }

      setEmailVerified(true);
      setEmailOtpSent(false);
      setEmailToken(data.verificationToken || 'evt_verified');
      setErrors((prev) => ({ ...prev, email: '' }));
    } catch {
      setEmailOtpError('Error validating email OTP code.');
    } finally {
      setEmailVerifying(false);
    }
  };

  // Mobile OTP Request
  const handleSendMobileOtp = async () => {
    // 1. Before mobile verification indicate to fill Full Name and Company Name first
    const nameMissing = !values.name || !values.name.trim();
    const companyMissing = !values.companyName || !values.companyName.trim();

    if (nameMissing || companyMissing) {
      setErrors((prev) => ({
        ...prev,
        ...(nameMissing ? { name: 'Full Name is required before mobile verification.' } : {}),
        ...(companyMissing ? { companyName: 'Business / Company Name is required before mobile verification.' } : {}),
        phone: 'Please fill Full Name * and Business / Company Name * before mobile verification.',
      }));
      return;
    }

    // 2. Validate phone length & country format
    const country = values.countryCode || values.country || 'India';
    const dial = COUNTRY_PHONE_RULES[country]?.dial || '91';
    const example = mobileExample(country) || '98765 43210';
    const invalidMsg = `Please enter a valid mobile number for the selected country (e.g. +${dial} ${example}).`;

    const digits = String(values.phone || '').replace(/\D/g, '');
    const parsed = parseMobile(values.phone, country);
    if (digits.length > 10 || !parsed.ok) {
      setErrors((prev) => ({ ...prev, phone: invalidMsg }));
      return;
    }

    setPhoneOtpSending(true);
    setFormError('');
    setPhoneOtpError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: values.phone.trim(),
          country: values.countryCode || values.country || 'India',
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'SMS service is temporarily unavailable.';
        setFormError(errorMsg);
        setPhoneOtpError(errorMsg);
        setPhoneOtpSending(false);
        return;
      }

      setPhoneOtpSent(true);
      setPhoneCooldown(data.cooldownSeconds || 60);
    } catch {
      setPhoneOtpError('Network error while requesting mobile OTP.');
    } finally {
      setPhoneOtpSending(false);
    }
  };

  // Verify Mobile OTP
  const handleVerifyMobileOtp = async () => {
    if (!phoneOtp.trim() || phoneOtp.trim().length !== 6) {
      setPhoneOtpError('Please enter the 6-digit OTP received via SMS.');
      return;
    }

    setPhoneVerifying(true);
    setPhoneOtpError('');
    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/verify-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: values.phone.trim(),
          country: values.countryCode || values.country || 'India',
          otp: phoneOtp.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.message || 'Invalid or expired mobile OTP code.';
        setPhoneOtpError(msg);
        setPhoneVerifying(false);
        return;
      }

      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneToken(data.data?.verificationToken || 'pvt_verified');
      setErrors((prev) => ({ ...prev, phone: '' }));
    } catch {
      setPhoneOtpError('Error validating mobile OTP code.');
    } finally {
      setPhoneVerifying(false);
    }
  };

  // Step Validation Logic
  const validateStep = (step) => {
    const stepErrors = {};

    if (step === 1) {
      if (!values.name.trim()) {
        stepErrors.name = 'Full name is required.';
      } else if (values.name.trim().length < 2) {
        stepErrors.name = 'Full name must be at least 2 characters.';
      }

      if (!values.companyName.trim()) {
        stepErrors.companyName = 'Company name is required.';
      } else if (values.companyName.trim().length < 2) {
        stepErrors.companyName = 'Company name must be at least 2 characters.';
      }

      if (!values.email.trim()) {
        stepErrors.email = 'Work email address is required.';
      } else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(values.email.trim())) {
        stepErrors.email = 'Please enter a valid work email address.';
      }

      if (!values.phone.trim()) {
        stepErrors.phone = 'Mobile number is required.';
      } else {
        const parsed = parseMobile(values.phone, values.countryCode || values.country || 'India');
        if (!parsed.ok) {
          stepErrors.phone = `Enter a valid mobile number for ${values.countryCode || 'India'}.`;
        }
      }

      if (!values.password) {
        stepErrors.password = 'Password is required.';
      } else if (values.password.length < 8) {
        stepErrors.password = 'Password must be at least 8 characters long.';
      } else if (!/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
        stepErrors.password = 'Password must contain at least one letter and one number.';
      }

      if (!values.confirmPassword) {
        stepErrors.confirmPassword = 'Confirm your password.';
      } else if (values.password !== values.confirmPassword) {
        stepErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (step === 2) {
      if (!values.buyerTypes || values.buyerTypes.length === 0) {
        stepErrors.buyerTypes = 'Please select at least one Buyer Type category.';
      }

      if (values.buyerTypes?.includes('Other') && !values.buyerTypeOther.trim()) {
        stepErrors.buyerTypeOther = 'Please specify your buyer business model.';
      }

      if (!values.country) {
        stepErrors.country = 'Country is required.';
      }

      if (!values.state?.trim()) {
        stepErrors.state = 'State / Province / Region is required.';
      }

      if (!values.city?.trim()) {
        stepErrors.city = 'City is required.';
      }

      if (!values.postalCode?.trim()) {
        stepErrors.postalCode = values.country === 'India' ? 'PIN code is required.' : 'Postal code is required.';
      } else if (values.country === 'India') {
        if (!/^[1-9][0-9]{5}$/.test(values.postalCode.trim())) {
          stepErrors.postalCode = 'Enter a valid 6-digit Indian PIN code.';
        }
      }

      if (!values.businessAddress?.trim()) {
        stepErrors.businessAddress = 'Full business address is required.';
      }

      // GST Validation for India
      if (values.country === 'India') {
        if (!values.gstStatus) {
          stepErrors.gstStatus = 'Please select your GST registration status.';
        }
        if (!values.gstin?.trim()) {
          stepErrors.gstin = 'Certificate / registration number is required.';
        } else if (values.gstStatus === 'GST Certificate') {
          const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
          if (!gstinRegex.test(values.gstin.trim().toUpperCase())) {
            stepErrors.gstin = 'Enter a valid 15-character Indian GSTIN.';
          }
        }
      }
    }

    if (step === 3) {
      if (!values.agreeTerms) {
        stepErrors.agreeTerms = 'You must accept the Buyer Terms of Service and Privacy Notice.';
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setFormError('');
      setCurrentStep((prev) => Math.min(prev + 1, 3));
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setFormError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setFormError('Please resolve all highlighted validation errors before submitting.');
      return;
    }

    setBusy(true);
    setFormError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const payload = {
        name: values.name.trim(),
        company: values.companyName.trim(),
        companyName: values.companyName.trim(),
        email: normalizeEmail(values.email),
        password: values.password,
        phone: parseMobile(values.phone, values.countryCode || values.country || 'India').international || values.phone.trim(),
        country: values.country,
        state: values.state.trim(),
        city: values.city.trim(),
        postalCode: values.postalCode.trim(),
        businessAddress: values.businessAddress.trim(),
        buyerTypes: values.buyerTypes,
        buyerType: values.buyerTypes.join(', '),
        buyerTypeOther: values.buyerTypes.includes('Other') ? values.buyerTypeOther.trim() : '',
        businessDescription: values.businessDescription.trim(),
        gstStatus: values.country === 'India' ? values.gstStatus : 'Not Applicable',
        gstin: values.country === 'India' && values.gstin ? values.gstin.trim().toUpperCase() : '',
        panNumber: values.panNumber ? values.panNumber.trim().toUpperCase() : '',
        pan: values.panNumber ? values.panNumber.trim().toUpperCase() : '',
        taxId: values.country !== 'India' && values.taxId ? values.taxId.trim().toUpperCase() : '',
        verificationToken: phoneToken || '',
        emailVerificationToken: emailToken || '',
        agree: true,
        agreeTerms: true,
      };

      const res = await fetch(`${baseUrl}/auth/register-buyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || 'Buyer registration failed. Please review your details.');
        setBusy(false);
        return;
      }

      // Store auth session token and activate session
      if (data.data?.token) {
        localStorage.setItem('tradeexpress_auth_token', data.data.token);
        localStorage.setItem('tradesphere_auth_token', data.data.token);
      }
      if (setAuthUser && data.data) {
        await setAuthUser(data.data.user || data.data, data.data.token, payload.password);
      }

      setSubmittedData({
        ...data.data,
        buyerCode: data.data?.buyerCode || 'BYR-ACTIVATED',
        name: payload.name,
        email: payload.email,
        companyName: payload.companyName,
      });

      setBusy(false);
      window.scrollTo({ top: 80, behavior: 'smooth' });
    } catch {
      setFormError('Network connection failed. Please ensure the backend server is reachable.');
      setBusy(false);
    }
  };

  // SUCCESS CONFIRMATION STATE
  if (submittedData) {
    return (
      <div className="mx-auto max-w-2xl py-8 px-4 text-center animate-in fade-in duration-300">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-500/10 shadow-sm">
          <BadgeCheck className="h-10 w-10 text-emerald-600" />
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-900">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          <span>Role: Verified B2B Buyer</span>
        </div>

        <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Welcome to TradeExpress, {submittedData.name || 'Valued Buyer'}!
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Your buyer account has been created successfully. You can now explore manufacturers, request bulk price quotes, and purchase with confidence.
        </p>

        {/* Account Summary Card */}
        <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-6 text-left shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 border-b border-slate-100 pb-2">
            Buyer Account Credentials & Reference
          </h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Buyer Reference Code</dt>
              <dd className="font-mono font-bold text-emerald-800 text-base">{submittedData.buyerCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Business / Company</dt>
              <dd className="font-semibold text-slate-800">{submittedData.companyName || values.companyName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Registered Email</dt>
              <dd className="font-medium text-slate-700">{submittedData.email || values.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Verification Status</dt>
              <dd className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Active Sourcing Profile
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-950 leading-relaxed">
            <strong>What's Next?</strong> You have immediate access to RFQ submissions, direct supplier messaging, and dynamic price comparisons across verified global manufacturers.
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.href = ROLE_HOME.buyer;
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <ShoppingBag className="h-4 w-4" />
            Proceed to Buyer Dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const isIndia = values.country === 'India';

  return (
    <div className="w-full">
      {/* 3-STEP PROGRESS INDICATOR */}
      <div className="mb-8 select-none">
        <div className="flex items-center justify-between">
          {STEPS.map((step) => {
            const isCurrent = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div key={step.id} className="flex-1 text-center relative">
                <div className="flex items-center justify-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                      isCurrent
                        ? 'bg-emerald-700 text-white shadow-md ring-4 ring-emerald-600/20'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4 stroke-[2.5]" /> : step.id}
                  </div>
                </div>
                <div className="mt-2 hidden sm:block">
                  <p
                    className={`text-xs font-semibold leading-tight ${
                      isCurrent ? 'text-emerald-900' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-400">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="relative mt-4 h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-emerald-700 transition-all duration-300 rounded-full"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Global Form Error Alert */}
      {formError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p>{formError}</p>
        </div>
      )}

      {/* FORM BODY */}
      <form onSubmit={(e) => e.preventDefault()} noValidate autoComplete="off">
        {/* ============================================================ */}
        {/* STEP 1: ACCOUNT DETAILS */}
        {/* ============================================================ */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-700" />
                Account & Primary Contact
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Provide your primary business representative credentials and verify your contact channels for order notifications.
              </p>
            </div>

            {/* Hidden dummy fields to prevent browser password managers from autofilling saved credentials into email & password */}
            <input type="text" name="fake_username_remembered" tabIndex={-1} aria-hidden="true" className="sr-only opacity-0 pointer-events-none absolute -top-96" />
            <input type="password" name="fake_password_remembered" tabIndex={-1} aria-hidden="true" className="sr-only opacity-0 pointer-events-none absolute -top-96" />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={typeof values.name === 'string' ? values.name : ''}
                  onChange={handleChange('name')}
                  autoComplete="off"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.name ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              {/* Business / Company Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={typeof values.companyName === 'string' ? values.companyName : ''}
                  onChange={handleChange('companyName')}
                  autoComplete="off"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.companyName ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>}
              </div>

              {/* Business Email Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Email Address <span className="text-red-500">*</span>
                </label>

                {/* Email input with Get OTP button inside the same box at the right corner */}
                <div className="relative flex items-center w-full">
                  <input
                    type="email"
                    id="buyer-email"
                    name="buyer_registration_email"
                    placeholder="e.g. buyer@company.com"
                    value={typeof values.email === 'string' ? values.email : ''}
                    onChange={handleEmailChange}
                    disabled={emailVerified}
                    autoComplete="off"
                    className={`w-full h-11 rounded-xl border bg-white pl-3.5 pr-28 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.email ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    } ${emailVerified ? 'bg-slate-100/70 text-slate-600' : ''}`}
                  />
                  <div className="absolute right-1.5 flex items-center">
                    {emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={emailOtpSending || emailCooldown > 0 || !values.email}
                        className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                      >
                        {emailOtpSending ? (
                          <>
                            <RefreshCw className="size-3 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : emailCooldown > 0 ? (
                          `Resend (${emailCooldown}s)`
                        ) : (
                          'Get OTP'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}

                {/* 6-box OTP row below the input box */}
                {!emailVerified && emailOtpSent && (
                  <SixDigitOtpRow
                    otp={emailOtp}
                    onChange={(val) => setEmailOtp(val)}
                    onVerify={handleVerifyEmailOtp}
                    onResend={handleSendEmailOtp}
                    verifying={emailVerifying}
                    resending={emailOtpSending}
                    cooldown={emailCooldown}
                    label="Enter Email Verification Code"
                    targetHint={values.email}
                    error={emailOtpError}
                    onClose={() => setEmailOtpSent(false)}
                  />
                )}
              </div>

              {/* Mobile Number */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>

                <div className="flex items-center gap-2 w-full">
                  {/* Small Box for Country Code (e.g. +91, +1) ONLY */}
                  <div className="w-20 shrink-0">
                    <CustomSelect
                      id="buyer-country-code"
                      value={typeof values.countryCode === 'string' ? values.countryCode : 'India'}
                      onChange={(val) => {
                        const c = typeof val === 'string' ? val : (val?.target?.value ?? 'India');
                        setValues((prev) => ({ ...prev, countryCode: c }));
                      }}
                      options={COUNTRY_DIAL_OPTIONS}
                      compact={true}
                      searchable={true}
                      panelClassName="!w-64 !left-0"
                      className="h-11 text-xs font-bold !px-2 border-slate-300 text-center"
                    />
                  </div>

                  {/* Mobile input with Get OTP button inside the same box at the right corner */}
                  <div className="relative flex items-center flex-1 min-w-0">
                    <input
                      type="tel"
                      placeholder={`e.g. ${mobileExample(values.countryCode || 'India')}`}
                      value={typeof values.phone === 'string' ? values.phone : ''}
                      onChange={handlePhoneChange}
                      disabled={phoneVerified}
                      autoComplete="off"
                      className={`w-full h-11 rounded-xl border bg-white pl-3.5 pr-28 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.phone ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      } ${phoneVerified ? 'bg-slate-100/70 text-slate-600' : ''}`}
                    />
                    <div className="absolute right-1.5 flex items-center">
                      {phoneVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendMobileOtp}
                          disabled={phoneOtpSending || phoneCooldown > 0 || !values.phone}
                          className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                        >
                          {phoneOtpSending ? (
                            <>
                              <RefreshCw className="size-3 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : phoneCooldown > 0 ? (
                            `Resend (${phoneCooldown}s)`
                          ) : (
                            'Get OTP'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}

                {/* 6-box OTP row below the input box */}
                {!phoneVerified && phoneOtpSent && (
                  <SixDigitOtpRow
                    otp={phoneOtp}
                    onChange={(val) => setPhoneOtp(val)}
                    onVerify={handleVerifyMobileOtp}
                    onResend={handleSendMobileOtp}
                    verifying={phoneVerifying}
                    resending={phoneOtpSending}
                    cooldown={phoneCooldown}
                    label="Enter Mobile Verification Code"
                    targetHint={`${COUNTRY_PHONE_RULES[values.countryCode]?.dial ? `+${COUNTRY_PHONE_RULES[values.countryCode].dial} ` : ''}${values.phone}`}
                    error={phoneOtpError}
                    onClose={() => setPhoneOtpSent(false)}
                  />
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="buyer-password"
                    name="buyer_new_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={typeof values.password === 'string' ? values.password : ''}
                    onChange={handleChange('password')}
                    autoComplete="new-password"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.password ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}

                {/* Password Strength Meter */}
                {values.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Strength:</span>
                      <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                    </div>
                    <div className="flex h-1.5 gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            strength.score >= level ? strength.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="buyer-confirm-password"
                    name="buyer_confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={typeof values.confirmPassword === 'string' ? values.confirmPassword : ''}
                    onChange={handleChange('confirmPassword')}
                    autoComplete="new-password"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.confirmPassword ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                {values.confirmPassword && values.password === values.confirmPassword && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <Check className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: BUSINESS PROFILE */}
        {/* ============================================================ */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-700" />
                Business Profile & Operating Address
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify your sourcing profile, physical business location, and statutory tax details for trade compliance.
              </p>
            </div>

            <div className="space-y-6">
              {/* Buyer Type Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Buyer Business Type(s) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Select categories that describe your business</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {BUYER_TYPES.map((type) => {
                    const isSelected = values.buyerTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleBuyerType(type)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : <Tag className="h-3 w-3 text-slate-400" />}
                        {type}
                      </button>
                    );
                  })}
                </div>
                {errors.buyerTypes && <p className="mt-1 text-xs text-red-600">{errors.buyerTypes}</p>}

                {/* If "Other" Buyer Type selected */}
                {values.buyerTypes.includes('Other') && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Specify Business Model Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Specify business type"
                      value={typeof values.buyerTypeOther === 'string' ? values.buyerTypeOther : ''}
                      onChange={handleChange('buyerTypeOther')}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.buyerTypeOther ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      }`}
                    />
                    {errors.buyerTypeOther && <p className="mt-1 text-xs text-red-600">{errors.buyerTypeOther}</p>}
                  </div>
                )}
              </div>

              {/* Physical Operating Address Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-700" />
                  Physical Operating & Billing Address
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Country Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country / Region <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
                      id="buyer-country"
                      value={typeof values.country === 'string' ? values.country : ''}
                      onChange={(val) => {
                        const c = typeof val === 'string' ? val : (val?.target?.value ?? '');
                        handleCountryChange(c);
                      }}
                      options={COUNTRIES}
                      placeholder="Select Country"
                      searchable={true}
                    />
                    {errors.country && <p className="mt-1 text-xs text-red-600">{errors.country}</p>}
                  </div>

                  {/* State / Province (Dynamic based on country) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isIndia ? 'State / Union Territory' : 'State / Province / Region'} <span className="text-red-500">*</span>
                    </label>
                    {isIndia ? (
                      <CustomSelect
                        id="buyer-state"
                        value={typeof values.state === 'string' ? values.state : ''}
                        onChange={(val) => {
                          const s = typeof val === 'string' ? val : (val?.target?.value ?? '');
                          handleChange('state')(s);
                        }}
                        options={INDIA_STATES}
                        placeholder="Select State / UT"
                        searchable={true}
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="State / Province"
                        value={typeof values.state === 'string' ? values.state : ''}
                        onChange={handleChange('state')}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                          errors.state ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                        }`}
                      />
                    )}
                    {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state}</p>}
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="City"
                      value={typeof values.city === 'string' ? values.city : ''}
                      onChange={handleChange('city')}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.city ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      }`}
                    />
                    {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
                  </div>

                  {/* Postal / PIN Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isIndia ? 'PIN Code (6 digits)' : 'Postal Code'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={isIndia ? 6 : 12}
                      placeholder={isIndia ? 'PIN code' : 'Postal code'}
                      value={typeof values.postalCode === 'string' ? values.postalCode : ''}
                      onChange={handleChange('postalCode')}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.postalCode ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      }`}
                    />
                    {errors.postalCode && <p className="mt-1 text-xs text-red-600">{errors.postalCode}</p>}
                  </div>

                  {/* Full Business Street Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Street address"
                      value={typeof values.businessAddress === 'string' ? values.businessAddress : ''}
                      onChange={handleChange('businessAddress')}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.businessAddress ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      }`}
                    />
                    {errors.businessAddress && <p className="mt-1 text-xs text-red-600">{errors.businessAddress}</p>}
                  </div>
                </div>
              </div>

              {/* Tax Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Tax & Business Registration Details
                </h4>

                {isIndia ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* GST Registration Status Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        GST Registration Status <span className="text-red-500">*</span>
                      </label>
                      <CustomSelect
                        id="buyer-gst-status"
                        value={typeof values.gstStatus === 'string' ? values.gstStatus : ''}
                        onChange={(val) => {
                          const g = typeof val === 'string' ? val : (val?.target?.value ?? '');
                          handleChange('gstStatus')(g);
                        }}
                        options={BUYER_GST_STATUS_OPTIONS}
                        placeholder="Select GST Registration Status"
                        searchable={true}
                      />
                      {errors.gstStatus && <p className="mt-1 text-xs text-red-600">{errors.gstStatus}</p>}
                    </div>

                    {/* Certificate / Registration Number Input Field Box */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {values.gstStatus === 'GST Certificate'
                          ? 'GSTIN'
                          : values.gstStatus
                          ? `${values.gstStatus} Number`
                          : 'Certificate / Registration Number'}{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={values.gstStatus === 'GST Certificate' ? 15 : 30}
                        placeholder={
                          values.gstStatus === 'GST Certificate'
                            ? '15-character GSTIN'
                            : 'Certificate number'
                        }
                        value={typeof values.gstin === 'string' ? values.gstin : ''}
                        onChange={(e) => {
                          const v = typeof e === 'string' ? e : (e?.target?.value ?? '');
                          handleChange('gstin')(v.toUpperCase());
                        }}
                        autoComplete="off"
                        className={`w-full font-mono uppercase rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                          errors.gstin ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                        }`}
                      />
                      {errors.gstin && <p className="mt-1 text-xs text-red-600">{errors.gstin}</p>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      International Tax ID / VAT / EIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Tax ID / VAT"
                      value={typeof values.taxId === 'string' ? values.taxId : ''}
                      onChange={handleChange('taxId')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                    />
                  </div>
                )}
              </div>

              {/* Sourcing Needs & Business Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Sourcing Requirements (Optional)
                  </label>
                  <span className={`text-[11px] ${values.businessDescription.length > 900 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                    {values.businessDescription.length} / 1000 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe your purchasing requirements..."
                  value={typeof values.businessDescription === 'string' ? values.businessDescription : ''}
                  onChange={handleChange('businessDescription')}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Help verified suppliers understand your purchasing requirements when responding to RFQs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: REVIEW & SUBMIT */}
        {/* ============================================================ */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                Review & Confirm Buyer Registration
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Carefully verify your account and business details before final submission.
              </p>
            </div>

            <div className="space-y-4">
              {/* Card 1: Account & Credentials */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-emerald-700" />
                    Account Details
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    Edit
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Representative:</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{values.name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Company Name:</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{values.companyName || '—'}</p>
                  </div>
                </dl>
              </div>

              {/* Card 2: Contact & OTP Verification Status */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                    Contact & OTP Verification
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    Edit
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Work Email:</span>
                    <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      {values.email || '—'}
                      {emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Pending
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Mobile Phone:</span>
                    <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      {values.phone || '—'}
                      {phoneVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Pending
                        </span>
                      )}
                    </p>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-slate-400 leading-normal border-t border-slate-100 pt-2">
                  * Note: OTP verification authenticates your contact channels for order dispatches. It does not replace statutory compliance or trade credit approval.
                </p>
              </div>

              {/* Card 3: Business Profile & Address */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-emerald-700" />
                    Business Profile & Operating Address
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    Edit
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Buyer Type(s):</span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {values.buyerTypes.length > 0 ? values.buyerTypes.join(', ') : '—'}
                      {values.buyerTypes.includes('Other') && values.buyerTypeOther && ` (${values.buyerTypeOther})`}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Location:</span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {values.city || '—'}, {values.state} {values.postalCode}, {values.country}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Operating Address:</span>
                    <p className="font-medium text-slate-700 mt-0.5">{values.businessAddress || '—'}</p>
                  </div>
                  {values.businessDescription && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400">Sourcing Overview:</span>
                      <p className="font-medium text-slate-700 mt-0.5 italic text-[11px]">{values.businessDescription}</p>
                    </div>
                  )}
                </dl>
              </div>

              {/* Card 4: Tax & Statutory Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                    Tax Details
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    Edit
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">GST Registration Status:</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{values.gstStatus || 'Not Applicable'}</p>
                  </div>
                  {values.gstin && (
                    <div>
                      <span className="text-slate-400">
                        {values.gstStatus === 'GST Certificate' ? 'GSTIN:' : 'Certificate / Reg Number:'}
                      </span>
                      <p className="font-mono font-semibold text-slate-800 mt-0.5">{values.gstin}</p>
                    </div>
                  )}
                  {values.taxId && (
                    <div>
                      <span className="text-slate-400">Tax ID / VAT:</span>
                      <p className="font-mono font-semibold text-slate-800 mt-0.5">{values.taxId}</p>
                    </div>
                  )}
                </dl>
              </div>

              {/* Terms of Service Acceptance Checkbox */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={values.agreeTerms}
                    onChange={(e) => handleChange('agreeTerms')(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    I confirm that I am an authorized representative of <strong>{values.companyName || 'this business'}</strong>.
                    I agree to the{' '}
                    <Link to="/info/terms" target="_blank" className="font-semibold text-emerald-700 underline hover:text-emerald-900">
                      Buyer Terms of Service
                    </Link>{' '}
                    and acknowledge the{' '}
                    <Link to="/info/privacy" target="_blank" className="font-semibold text-emerald-700 underline hover:text-emerald-900">
                      Privacy Notice
                    </Link>
                    .
                  </span>
                </label>
                {errors.agreeTerms && <p className="mt-2 text-xs text-red-600">{errors.agreeTerms}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP CONTROLS & NAVIGATION */}
        {/* ============================================================ */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Step
            </button>
          ) : (
            <span className="text-xs text-slate-400">Step 1 of 3</span>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
            >
              Continue to {STEPS[currentStep].label}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-7 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Buyer Account
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
