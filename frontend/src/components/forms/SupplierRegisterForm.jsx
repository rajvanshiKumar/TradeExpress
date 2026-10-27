import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Building2,
  ShieldCheck,
  FileText,
  UploadCloud,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  MapPin,
  Briefcase,
  Clock,
  Sparkles,
  Trash2,
  ExternalLink,
  Lock,
  RefreshCw,
  File,
  Image as ImageIcon,
  ArrowRight,
  BadgeCheck,
} from 'lucide-react';

import CustomSelect from '../common/CustomSelect';
import OtpModal from '../common/OtpModal';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import {
  COUNTRIES,
  COUNTRY_PHONE_RULES,
  INDIA_STATES,
  SUPPLIER_BUSINESS_TYPES,
  GST_REGISTRATION_TYPES,
  SUPPLIER_DOC_TYPES,
  ROLE_HOME,
} from '../../utils/constants';
import { normalizeEmail, parseMobile, mobileExample, rules, validate, hasErrors } from '../../utils/validators';

const STEPS = [
  { id: 1, label: 'Account Details', desc: 'Credentials & contact' },
  { id: 2, label: 'Business Info', desc: 'Category & tax profile' },
  { id: 3, label: 'Business Address', desc: 'Operating & factory location' },
  { id: 4, label: 'Verification & Docs', desc: 'PAN, KYC & documents' },
  { id: 5, label: 'Review & Submit', desc: 'Confirm & register' },
];

export default function SupplierRegisterForm() {
  const { preferences } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  // Form State
  const [values, setValues] = useState({
    // Step 1: Account Details
    name: '',
    companyName: '',
    phone: '',
    countryCode: 'India',
    email: '',
    password: '',
    confirmPassword: '',

    // Step 2: Business Information
    businessType: 'Manufacturer',
    businessTypeOther: '',
    gstStatus: 'Regular GST Registration',
    taxId: '',
    businessPhone: '',
    yearEstablished: '',
    companyDescription: '',
    logoUrl: '',
    businessImages: [],

    // Step 3: Address
    country: preferences.country || 'India',
    state: 'Maharashtra',
    city: '',
    postalCode: '',
    businessAddress: '',
    factoryAddressSame: true,
    factoryAddress: '',

    // Step 4: Verification & Documents
    panNumber: '',
    voluntaryAadhaar: false,
    aadhaarConsent: false,
    aadhaarLast4: '',
    documents: [], // Array of { type, docNumber, fileUrl, fileName, fileSize }
    agreeTerms: false,
  });

  const [errors, setErrors] = useState({});

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Verification States
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneToken, setPhoneToken] = useState('');
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const [emailVerified, setEmailVerified] = useState(false);
  const [emailToken, setEmailToken] = useState('');
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Universal OtpModal states
  const [otpModalType, setOtpModalType] = useState(null); // 'phone' | 'email' | null
  const [otpModalError, setOtpModalError] = useState('');
  const [otpModalVerifying, setOtpModalVerifying] = useState(false);

  // Media upload loading states
  const [logoUploading, setLogoUploading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);

  // New Document Input temporary state
  const [currentDocType, setCurrentDocType] = useState('GST_CERTIFICATE');
  const [currentDocNumber, setCurrentDocNumber] = useState('');

  // Countdown timers for OTP cooldowns
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

  // Handle Input Changes
  const handleChange = (field) => (e) => {
    const val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setValues((prev) => {
      const updated = { ...prev, [field]: val };
      // Safely reset dependent state when country changes
      if (field === 'country') {
        if (val === 'India') {
          updated.state = 'Maharashtra';
          updated.gstStatus = 'Regular GST Registration';
        } else {
          updated.state = '';
          updated.gstStatus = 'Not Registered / Not Applicable';
          updated.taxId = '';
          updated.panNumber = '';
        }
      }
      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Password Strength Calculation
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 3 || score === 4) return { score: 2, label: 'Good', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-600' };
  };

  const passwordStrength = calculatePasswordStrength(values.password);

  // Send Mobile OTP
  const handleSendMobileOtp = async () => {
    const country = values.countryCode || values.country || 'India';
    const parsed = parseMobile(values.phone, country);
    if (!parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: `Please enter a valid ${country} mobile number (e.g. ${mobileExample(country)}).`,
      }));
      return;
    }

    setPhoneOtpSending(true);
    setErrors((prev) => ({ ...prev, phone: '' }));
    setOtpModalError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/auth/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: values.phone,
          country,
          purpose: 'registration',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhoneCooldown(data.cooldownSeconds || 60);
        showToast(data.devOtp ? `OTP Sent! Dev Code: ${data.devOtp}` : `Verification code sent to ${values.phone}`);
        setOtpModalType('phone');
      } else {
        setErrors((prev) => ({ ...prev, phone: data.message || 'Unable to send mobile verification code.' }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, phone: 'Connection failed. Please check your network and try again.' }));
    } finally {
      setPhoneOtpSending(false);
    }
  };

  // Send Email OTP
  const handleSendEmailOtp = async () => {
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid business email address.' }));
      return;
    }

    setEmailOtpSending(true);
    setErrors((prev) => ({ ...prev, email: '' }));
    setOtpModalError('');

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
        setEmailCooldown(data.cooldownSeconds || 60);
        showToast(data.devOtp ? `OTP Sent! Dev Code: ${data.devOtp}` : `Verification code sent to ${cleanEmail}`);
        setOtpModalType('email');
      } else {
        setErrors((prev) => ({ ...prev, email: data.message || 'Unable to dispatch verification email.' }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, email: 'Could not connect to verification server. Please try again.' }));
    } finally {
      setEmailOtpSending(false);
    }
  };

  // Verify OTP inside modal
  const handleVerifyOtpModal = async (code) => {
    setOtpModalVerifying(true);
    setOtpModalError('');
    const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

    try {
      if (otpModalType === 'phone') {
        const country = values.countryCode || values.country || 'India';
        const res = await fetch(`${baseUrl}/auth/verify-mobile-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            phone: values.phone,
            country,
            otp: code,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setOtpModalError(data.message || 'Invalid mobile verification code.');
          return;
        }
        setPhoneVerified(true);
        setPhoneToken(data.data?.verificationToken || 'evt_verified_mobile');
        setOtpModalType(null);
        showToast('Mobile number verified successfully!');
      } else if (otpModalType === 'email') {
        const cleanEmail = normalizeEmail(values.email);
        const res = await fetch(`${baseUrl}/auth/verify-email-verification-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            otp: code,
            purpose: 'registration',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setOtpModalError(data.message || 'Invalid email verification code.');
          return;
        }
        setEmailVerified(true);
        setEmailToken(data.verificationToken || 'evt_verified_email');
        setOtpModalType(null);
        showToast('Business email verified successfully!');
      }
    } catch {
      setOtpModalError('Failed to verify OTP. Please try again.');
    } finally {
      setOtpModalVerifying(false);
    }
  };

  // Upload Logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Logo file size must be less than 5 MB.');
      return;
    }
    setLogoUploading(true);
    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setValues((prev) => ({ ...prev, logoUrl: data.fileUrl || data.url }));
        showToast('Company logo uploaded successfully.');
      } else {
        showToast(data.message || 'Logo upload failed.');
      }
    } catch {
      showToast('Error uploading logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Upload Business Images
  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (values.businessImages.length + files.length > 8) {
      showToast('You can upload a maximum of 8 business photos/videos.');
      return;
    }
    setMediaUploading(true);
    const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${baseUrl}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.success) {
          setValues((prev) => ({
            ...prev,
            businessImages: [...prev.businessImages, data.fileUrl || data.url],
          }));
        }
      }
      showToast('Media uploaded successfully.');
    } catch {
      showToast('Error uploading media.');
    } finally {
      setMediaUploading(false);
    }
  };

  // Remove Business Image
  const handleRemoveMedia = (index) => {
    setValues((prev) => ({
      ...prev,
      businessImages: prev.businessImages.filter((_, i) => i !== index),
    }));
  };

  // Upload Supporting Document
  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Document file size must be less than 10 MB.');
      return;
    }
    setDocUploading(true);
    const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseUrl}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        const newDoc = {
          type: currentDocType,
          docNumber: currentDocNumber.trim(),
          fileUrl: data.fileUrl || data.url,
          fileName: file.name,
          fileSize: file.size,
        };
        setValues((prev) => ({
          ...prev,
          documents: [...prev.documents, newDoc],
        }));
        setCurrentDocNumber('');
        showToast('Document added to compliance package.');
      } else {
        showToast(data.message || 'Document upload failed.');
      }
    } catch {
      showToast('Error uploading document.');
    } finally {
      setDocUploading(false);
    }
  };

  const handleRemoveDoc = (index) => {
    setValues((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  };

  // Step Validations
  const validateStep = (step) => {
    const stepErrors = {};

    if (step === 1) {
      if (!values.name.trim()) stepErrors.name = 'Full name is required.';
      if (!values.companyName.trim()) stepErrors.companyName = 'Company / Legal Business name is required.';
      if (!values.phone.trim()) {
        stepErrors.phone = 'Mobile number is required.';
      } else {
        const parsed = parseMobile(values.phone, values.countryCode || 'India');
        if (!parsed.ok) stepErrors.phone = 'Enter a valid mobile number for the selected country.';
      }
      if (!values.email.trim()) {
        stepErrors.email = 'Business email address is required.';
      } else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(values.email.trim())) {
        stepErrors.email = 'Enter a valid business email address.';
      }
      if (!values.password) {
        stepErrors.password = 'Password is required.';
      } else if (values.password.length < 8) {
        stepErrors.password = 'Password must be at least 8 characters.';
      }
      if (!values.confirmPassword) {
        stepErrors.confirmPassword = 'Confirm your password.';
      } else if (values.password !== values.confirmPassword) {
        stepErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (step === 2) {
      if (!values.businessType) stepErrors.businessType = 'Please select your business type.';
      if (values.businessType === 'Other' && !values.businessTypeOther.trim()) {
        stepErrors.businessTypeOther = 'Please specify your business type.';
      }

      // GST Validation for India
      if (values.country === 'India') {
        const selectedGstType = GST_REGISTRATION_TYPES.find((g) => g.value === values.gstStatus);
        if (selectedGstType?.requiresGstin) {
          if (!values.taxId?.trim()) {
            stepErrors.taxId = 'GSTIN is required for this registration status.';
          } else {
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(values.taxId.trim().toUpperCase())) {
              stepErrors.taxId = 'Enter a valid 15-character Indian GSTIN (e.g. 27ABCDE1234F1Z5).';
            }
          }
        }
      }

      // Year Established validation
      if (values.yearEstablished) {
        const yr = Number(values.yearEstablished);
        const curr = new Date().getFullYear();
        if (Number.isNaN(yr) || yr < 1800 || yr > curr) {
          stepErrors.yearEstablished = `Enter a plausible established year between 1800 and ${curr}.`;
        }
      }

      if (!values.companyDescription.trim()) {
        stepErrors.companyDescription = 'Company description is required.';
      } else if (values.companyDescription.trim().length < 20) {
        stepErrors.companyDescription = 'Please provide at least 20 characters describing your business.';
      }
    }

    if (step === 3) {
      if (!values.country) stepErrors.country = 'Country is required.';
      if (!values.state?.trim()) stepErrors.state = 'State / Province is required.';
      if (!values.city?.trim()) stepErrors.city = 'City is required.';

      if (!values.postalCode?.trim()) {
        stepErrors.postalCode = values.country === 'India' ? 'PIN code is required.' : 'Postal code is required.';
      } else if (values.country === 'India') {
        if (!/^[1-9][0-9]{5}$/.test(values.postalCode.trim())) {
          stepErrors.postalCode = 'Enter a valid 6-digit Indian PIN code (e.g. 400001).';
        }
      }

      if (!values.businessAddress?.trim()) {
        stepErrors.businessAddress = 'Full business address is required.';
      }

      if (!values.factoryAddressSame && !values.factoryAddress?.trim()) {
        stepErrors.factoryAddress = 'Please enter your factory or operational address.';
      }
    }

    if (step === 4) {
      if (values.country === 'India' && values.panNumber) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(values.panNumber.trim().toUpperCase())) {
          stepErrors.panNumber = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
        }
      }

      if (values.voluntaryAadhaar) {
        if (!values.aadhaarConsent) {
          stepErrors.aadhaarConsent = 'Consent is required to submit voluntary identity details.';
        }
        if (!values.aadhaarLast4 || !/^\d{4}$/.test(values.aadhaarLast4.trim())) {
          stepErrors.aadhaarLast4 = 'Please enter the exact last 4 digits.';
        }
      }

      if (!values.agreeTerms) {
        stepErrors.agreeTerms = 'You must accept the Supplier Terms of Service and Privacy Notice to proceed.';
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setFormError('');
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setFormError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Final Form Submission
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (busy) return;

    // Validate all steps
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        setFormError('Please resolve all validation errors before submitting.');
        return;
      }
    }

    setBusy(true);
    setFormError('');

    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
      const payload = {
        name: values.name.trim(),
        companyName: values.companyName.trim(),
        email: normalizeEmail(values.email),
        password: values.password,
        phone: parseMobile(values.phone, values.countryCode || values.country || 'India').international || values.phone.trim(),
        country: values.country,
        state: values.state.trim(),
        city: values.city.trim(),
        postalCode: values.postalCode.trim(),
        businessAddress: values.businessAddress.trim(),
        factoryAddressSame: values.factoryAddressSame,
        factoryAddress: values.factoryAddressSame ? '' : values.factoryAddress.trim(),
        businessType: values.businessType,
        businessTypeOther: values.businessType === 'Other' ? values.businessTypeOther.trim() : '',
        gstStatus: values.country === 'India' ? values.gstStatus : 'Not Applicable',
        taxId: values.taxId ? values.taxId.trim().toUpperCase() : '',
        panNumber: values.panNumber ? values.panNumber.trim().toUpperCase() : '',
        businessPhone: values.businessPhone.trim(),
        yearEstablished: values.yearEstablished ? parseInt(values.yearEstablished, 10) : null,
        companyDescription: values.companyDescription.trim(),
        logoUrl: values.logoUrl,
        businessImages: values.businessImages,
        aadhaarConsent: values.voluntaryAadhaar ? values.aadhaarConsent : false,
        aadhaarLast4: values.voluntaryAadhaar ? values.aadhaarLast4.trim() : null,
        documents: values.documents,
        verificationToken: phoneToken || 'evt_supplier_phone',
        emailVerificationToken: emailToken || 'evt_supplier_email',
      };

      const res = await fetch(`${baseUrl}/auth/register-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || 'Supplier registration failed. Please review your details.');
        setBusy(false);
        return;
      }

      // Store tokens for automatic sign-in if provided
      if (data.data?.token) {
        localStorage.setItem('tradeexpress_auth_token', data.data.token);
        localStorage.setItem('tradesphere_auth_token', data.data.token);
      }

      setSubmittedData({
        ...data.data,
        supplierCode: data.data?.user?.supplierCode || 'SUP-PENDING',
        email: payload.email,
        phone: payload.phone,
        companyName: payload.companyName,
      });
      setBusy(false);
      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (err) {
      setFormError('Network error connecting to TradeExpress servers. Please retry.');
      setBusy(false);
    }
  };

  // If submitted successfully, show Confirmation Screen
  if (submittedData) {
    return (
      <div className="mx-auto max-w-2xl text-center py-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-500/10">
          <BadgeCheck className="h-10 w-10 text-emerald-600" />
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-900">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <span>Application Under Review</span>
        </div>

        <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Supplier Registration Submitted
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Welcome, <span className="font-semibold text-slate-900">{submittedData.companyName}</span>! Your supplier application has been received and entered into our verification queue.
        </p>

        {/* Supplier ID Badge */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Assigned Supplier Code
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-emerald-800">
            {submittedData.supplierCode}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Please quote this reference number in all communications with our merchant support team.
          </p>
        </div>

        {/* Verification Status Overview */}
        <div className="mt-6 space-y-3 text-left">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Account Credentials Configured</p>
              <p className="text-xs text-slate-500">Password and primary authentication details saved.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Business Verification (KYC) Pending</p>
              <p className="text-xs text-slate-500">
                Our compliance officers are verifying your business profile, GSTIN/Tax ID and uploaded documents. Estimated review time is 24 to 48 business hours.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate('/supplier')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Access Supplier Workspace
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Sign In to Account
          </Link>
        </div>
      </div>
    );
  }

  const isIndia = values.country === 'India';

  return (
    <div className="w-full">
      {/* Stepper Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            return (
              <div
                key={step.id}
                className="flex-1 text-center cursor-pointer group"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id);
                }}
              >
                <div className="flex items-center justify-center">
                  <div
                    className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                      isCompleted
                        ? 'bg-emerald-700 text-white'
                        : isCurrent
                        ? 'border-2 border-emerald-600 bg-white text-emerald-800 ring-4 ring-emerald-500/15'
                        : 'border border-slate-200 bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : step.id}
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
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p>{formError}</p>
        </div>
      )}

      {/* FORM BODY */}
      <form onSubmit={(e) => e.preventDefault()} noValidate>
        {/* ============================================================ */}
        {/* STEP 1: ACCOUNT DETAILS */}
        {/* ============================================================ */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-700" />
                Account & Primary Contact
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Establish the authorized login credentials and primary business representative for this supplier account.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name of Representative <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={values.name}
                  onChange={handleChange('name')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.name ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              {/* Company Legal Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name / Legal Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Industrial Solutions Ltd."
                  value={values.companyName}
                  onChange={handleChange('companyName')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.companyName ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>}
              </div>

              {/* Mobile Number with Country Code & OTP trigger */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-48">
                    <CustomSelect
                      id="phone-country-code"
                      value={values.countryCode}
                      onChange={(e) => handleChange('countryCode')(e.target.value)}
                      options={COUNTRIES.map((c) => ({
                        value: c,
                        label: `${c} (+${COUNTRY_PHONE_RULES[c]?.dial || '91'})`,
                      }))}
                      placeholder="Country Code"
                      searchable={true}
                    />
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="tel"
                      placeholder={`e.g. ${mobileExample(values.countryCode || 'India')}`}
                      value={values.phone}
                      onChange={handleChange('phone')}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.phone ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    disabled={phoneOtpSending || phoneCooldown > 0 || phoneVerified}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                      phoneVerified
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default'
                        : 'bg-emerald-800 text-white hover:bg-emerald-700 disabled:opacity-50'
                    }`}
                  >
                    {phoneVerified ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Verified
                      </span>
                    ) : phoneOtpSending ? (
                      'Sending OTP...'
                    ) : phoneCooldown > 0 ? (
                      `Resend (${phoneCooldown}s)`
                    ) : (
                      'Verify via OTP'
                    )}
                  </button>
                </div>
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                <p className="mt-1 text-[11px] text-slate-400">
                  Buyer inquiries and trade notifications will be dispatched to this mobile number.
                </p>
              </div>

              {/* Work Email Address with OTP trigger */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Email Address <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="e.g. sales@apexsolutions.com"
                    value={values.email}
                    onChange={handleChange('email')}
                    className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.email ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={emailOtpSending || emailCooldown > 0 || emailVerified}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                      emailVerified
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default'
                        : 'bg-emerald-800 text-white hover:bg-emerald-700 disabled:opacity-50'
                    }`}
                  >
                    {emailVerified ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Verified
                      </span>
                    ) : emailOtpSending ? (
                      'Sending...'
                    ) : emailCooldown > 0 ? (
                      `Resend (${emailCooldown}s)`
                    ) : (
                      'Verify via OTP'
                    )}
                  </button>
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={values.password}
                    onChange={handleChange('password')}
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.password ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}

                {/* Password Strength Indicator */}
                {values.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex h-1.5 w-full gap-1">
                      <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Password strength: <span className="font-semibold text-slate-700">{passwordStrength.label}</span>
                    </p>
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
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={values.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.confirmPassword ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: BUSINESS INFORMATION */}
        {/* ============================================================ */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-700" />
                Business Profile & Tax Information
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define your operational business model, legal registration status, and brand assets for global B2B buyers.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Business Type Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Business Type <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  id="supplier-business-type"
                  value={values.businessType}
                  onChange={(e) => handleChange('businessType')(e.target.value)}
                  options={SUPPLIER_BUSINESS_TYPES}
                  placeholder="Select primary business type"
                  searchable={true}
                />
                {errors.businessType && <p className="mt-1 text-xs text-red-600">{errors.businessType}</p>}
              </div>

              {/* If "Other" Business Type */}
              {values.businessType === 'Other' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specify Business Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Turnkey EPC Contractor"
                    value={values.businessTypeOther}
                    onChange={handleChange('businessTypeOther')}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.businessTypeOther ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  {errors.businessTypeOther && <p className="mt-1 text-xs text-red-600">{errors.businessTypeOther}</p>}
                </div>
              )}

              {/* GST Registration Status (Indian Suppliers) */}
              {isIndia ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GST Registration Category / Status <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    id="supplier-gst-status"
                    value={values.gstStatus}
                    onChange={(e) => handleChange('gstStatus')(e.target.value)}
                    options={GST_REGISTRATION_TYPES}
                    placeholder="Select GST Registration Category"
                    searchable={true}
                  />
                  <div className="mt-1.5 rounded-lg bg-amber-50/80 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-relaxed">
                    <strong>Note:</strong> Options represent statutory registration categories and statuses under Indian GST law. Suppliers dealing exclusively in exempt commodities or under threshold limits are not mandated to provide a GSTIN.
                  </div>
                </div>
              ) : (
                /* Non-Indian: General Tax ID */
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tax ID / VAT / EIN (Optional for International)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. US EIN or EU VAT Number"
                    value={values.taxId}
                    onChange={handleChange('taxId')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                  />
                </div>
              )}

              {/* Conditionally Display GSTIN for Indian businesses when status requires it */}
              {isIndia && GST_REGISTRATION_TYPES.find((g) => g.value === values.gstStatus)?.requiresGstin && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN (Goods and Services Tax Identification Number) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="15-character GSTIN (e.g. 27ABCDE1234F1Z5)"
                    value={values.taxId}
                    onChange={(e) => handleChange('taxId')(e.target.value.toUpperCase())}
                    className={`w-full font-mono uppercase rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.taxId ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  {errors.taxId && <p className="mt-1 text-xs text-red-600">{errors.taxId}</p>}
                </div>
              )}

              {/* Business Landline / Secondary Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Office Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 22 4567 8900 ext 102"
                  value={values.businessPhone}
                  onChange={handleChange('businessPhone')}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
              </div>

              {/* Year Established */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Year Established (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2012"
                  value={values.yearEstablished}
                  onChange={handleChange('yearEstablished')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.yearEstablished ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.yearEstablished && <p className="mt-1 text-xs text-red-600">{errors.yearEstablished}</p>}
              </div>

              {/* Company Description with Live Counter */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Company Description / Overview <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-[11px] ${values.companyDescription.length > 950 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                    {values.companyDescription.length} / 1000 characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="Describe your manufacturing capacity, products, quality certifications, and standard export markets..."
                  value={values.companyDescription}
                  onChange={handleChange('companyDescription')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.companyDescription ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.companyDescription && <p className="mt-1 text-xs text-red-600">{errors.companyDescription}</p>}
              </div>

              {/* Company Logo Upload */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Logo (Optional)
                </label>
                <div className="flex items-center gap-4">
                  {values.logoUrl ? (
                    <div className="relative h-16 w-16 rounded-xl border border-slate-200 overflow-hidden bg-white p-1 shrink-0">
                      <img src={values.logoUrl} alt="Company Logo" className="h-full w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setValues((prev) => ({ ...prev, logoUrl: '' }))}
                        className="absolute right-0.5 top-0.5 rounded-full bg-red-500 text-white p-0.5 shadow-sm hover:bg-red-600"
                        title="Remove Logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 shrink-0">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}

                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                      <UploadCloud className="h-4 w-4 text-emerald-700" />
                      <span>{values.logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={logoUploading}
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Recommended: Square PNG/JPEG, 500x500px, max 5 MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Media Gallery (Factory, Warehouse, Office) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Factory & Facility Images (Up to 8 files)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {values.businessImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-video rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group">
                      <img src={img} alt={`Facility ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(idx)}
                        className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-white hover:bg-red-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {values.businessImages.length < 8 && (
                    <label className="flex flex-col items-center justify-center aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-slate-500 hover:border-emerald-600 hover:bg-emerald-50/30 cursor-pointer transition p-2 text-center">
                      <UploadCloud className="h-5 w-5 text-emerald-700 mb-1" />
                      <span className="text-xs font-medium">Add Facility Media</span>
                      <span className="text-[10px] text-slate-400">Photos / Videos</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/mp4"
                        className="hidden"
                        onChange={handleMediaUpload}
                        disabled={mediaUploading}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: BUSINESS ADDRESS */}
        {/* ============================================================ */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-700" />
                Physical Business & Operational Address
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Accurate physical location details ensure smooth shipping, customs documentation, and buyer site-audit verifications.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Country Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Country / Region <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  id="supplier-country"
                  value={values.country}
                  onChange={(e) => handleChange('country')(e.target.value)}
                  options={COUNTRIES}
                  placeholder="Select Country"
                  searchable={true}
                />
                {errors.country && <p className="mt-1 text-xs text-red-600">{errors.country}</p>}
              </div>

              {/* State / Province (Dynamic for India vs International) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndia ? 'State / Union Territory' : 'State / Province / Region'} <span className="text-red-500">*</span>
                </label>
                {isIndia ? (
                  <CustomSelect
                    id="supplier-state"
                    value={values.state}
                    onChange={(e) => handleChange('state')(e.target.value)}
                    options={INDIA_STATES}
                    placeholder="Select State"
                    searchable={true}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. California, Ontario, Bavaria"
                    value={values.state}
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
                  placeholder="e.g. Mumbai, Surat, Frankfurt"
                  value={values.city}
                  onChange={handleChange('city')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.city ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
              </div>

              {/* PIN Code / Postal Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndia ? 'PIN Code' : 'Postal / ZIP Code'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={isIndia ? '6-digit PIN (e.g. 400001)' : 'Postal / ZIP Code'}
                  value={values.postalCode}
                  onChange={handleChange('postalCode')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.postalCode ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.postalCode && <p className="mt-1 text-xs text-red-600">{errors.postalCode}</p>}
              </div>

              {/* Full Business Address (Street, Building, Industrial Estate) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Business Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Building No., Floor, Industrial Estate, Street details (City and State are entered above)..."
                  value={values.businessAddress}
                  onChange={handleChange('businessAddress')}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                    errors.businessAddress ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.businessAddress && <p className="mt-1 text-xs text-red-600">{errors.businessAddress}</p>}
              </div>

              {/* Factory Address Checkbox & Separate Fields */}
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={values.factoryAddressSame}
                    onChange={(e) => handleChange('factoryAddressSame')(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Factory or manufacturing unit address is the same as registered business address
                  </span>
                </label>

                {!values.factoryAddressSame && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Separate Factory / Warehouse Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Plot No., Industrial Zone, Sector, Manufacturing Plant address..."
                      value={values.factoryAddress}
                      onChange={handleChange('factoryAddress')}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                        errors.factoryAddress ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                      }`}
                    />
                    {errors.factoryAddress && <p className="mt-1 text-xs text-red-600">{errors.factoryAddress}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: VERIFICATION & DOCUMENTS */}
        {/* ============================================================ */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                Business Compliance & Verification Documents
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload verified business evidence to gain the TradeExpress Verified Gold Supplier Trust Badge.
              </p>
            </div>

            <div className="space-y-5">
              {/* PAN Number for Indian Suppliers */}
              {isIndia && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-800">
                      Permanent Account Number (PAN)
                    </label>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <Lock className="h-3 w-3 text-slate-400" />
                      Confidential / Private
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="10-character PAN (e.g. ABCDE1234F)"
                    value={values.panNumber}
                    onChange={(e) => handleChange('panNumber')(e.target.value.toUpperCase())}
                    className={`mt-1.5 w-full font-mono uppercase rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                      errors.panNumber ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  {errors.panNumber && <p className="mt-1 text-xs text-red-600">{errors.panNumber}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    PAN is stored securely for statutory compliance and is never disclosed on public product catalogs or buyer APIs.
                  </p>
                </div>
              )}

              {/* Aadhaar Data Minimization & Voluntary Consent Card */}
              {isIndia && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Voluntary Authorized Identity Verification (Optional)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        In compliance with data minimization laws, TradeExpress does not mandate Aadhaar card collection. You may voluntarily confirm authorized signer verification.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={values.voluntaryAadhaar}
                        onChange={(e) => handleChange('voluntaryAadhaar')(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-700"></div>
                    </label>
                  </div>

                  {values.voluntaryAadhaar && (
                    <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Last 4 Digits of Authorized Signatory Aadhaar <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="•••• 1234"
                          value={values.aadhaarLast4}
                          onChange={(e) => handleChange('aadhaarLast4')(e.target.value.replace(/\D/g, ''))}
                          className={`w-36 font-mono text-center tracking-widest rounded-xl border px-3.5 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                            errors.aadhaarLast4 ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'
                          }`}
                        />
                        {errors.aadhaarLast4 && <p className="mt-1 text-xs text-red-600">{errors.aadhaarLast4}</p>}
                      </div>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={values.aadhaarConsent}
                          onChange={(e) => handleChange('aadhaarConsent')(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span className="text-[11px] text-slate-600 leading-normal">
                          I voluntarily consent to submit my identity verification details strictly for authorized business KYC verification in accordance with applicable laws.
                        </span>
                      </label>
                      {errors.aadhaarConsent && <p className="text-xs text-red-600">{errors.aadhaarConsent}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Supporting Business Documents Upload Area */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <p className="text-sm font-bold text-slate-900">Supporting Business Documents & Licenses</p>
                  <p className="text-xs text-slate-500">
                    Upload official certificates (MSME/Udyam, Incorporation, IEC, Trade License, ISO). Stored in private object storage.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Document Category
                    </label>
                    <CustomSelect
                      id="doc-type-select"
                      value={currentDocType}
                      onChange={(e) => setCurrentDocType(e.target.value)}
                      options={SUPPLIER_DOC_TYPES}
                      placeholder="Select Document"
                      searchable={false}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Document / Certificate # (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UDYAM-MH-01-0012345"
                      value={currentDocNumber}
                      onChange={(e) => setCurrentDocNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <label className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition">
                      <UploadCloud className="h-4 w-4" />
                      <span>{docUploading ? 'Uploading...' : 'Upload File'}</span>
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleDocUpload}
                        disabled={docUploading}
                      />
                    </label>
                  </div>
                </div>

                {/* Uploaded Documents List */}
                {values.documents.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {values.documents.map((doc, idx) => {
                      const docTypeObj = SUPPLIER_DOC_TYPES.find((d) => d.value === doc.type);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                              <File className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {docTypeObj?.label || doc.type}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {doc.fileName} {doc.docNumber ? `• Ref: ${doc.docNumber}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-white"
                              title="Preview Document"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(idx)}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-white"
                              title="Delete Document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                    No compliance documents attached yet. You can also upload them later in your Supplier Dashboard.
                  </div>
                )}
              </div>

              {/* Terms and Privacy Acceptance */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.agreeTerms}
                    onChange={(e) => handleChange('agreeTerms')(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    I confirm that I am an authorized representative of{' '}
                    <strong>{values.companyName || 'the registered business'}</strong>. I agree to the{' '}
                    <Link to="/info/terms" target="_blank" className="font-semibold text-emerald-700 underline">
                      Supplier Terms of Service
                    </Link>{' '}
                    and acknowledge the{' '}
                    <Link to="/info/privacy" target="_blank" className="font-semibold text-emerald-700 underline">
                      Privacy Notice
                    </Link>
                    .
                  </span>
                </label>
                {errors.agreeTerms && <p className="mt-1 text-xs text-red-600">{errors.agreeTerms}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: REVIEW & SUBMIT */}
        {/* ============================================================ */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-700" />
                Review Your Supplier Application
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Carefully review all submitted parameters before generating your supplier profile.
              </p>
            </div>

            <div className="space-y-4">
              {/* Account Details Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    1. Account & Credentials
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Representative:</span>
                    <span className="font-semibold text-slate-800">{values.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Company Name:</span>
                    <span className="font-semibold text-slate-800">{values.companyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Business Email:</span>
                    <span className="font-semibold text-slate-800">{values.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Mobile Number:</span>
                    <span className="font-semibold text-slate-800">{values.phone}</span>
                  </div>
                </div>
              </div>

              {/* Business Information Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    2. Business Information
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Business Type:</span>
                    <span className="font-semibold text-slate-800">
                      {values.businessType === 'Other' ? values.businessTypeOther : values.businessType}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{isIndia ? 'GST Registration Status:' : 'Tax Status:'}</span>
                    <span className="font-semibold text-slate-800">{values.gstStatus}</span>
                  </div>
                  {values.taxId && (
                    <div>
                      <span className="text-slate-400 block">{isIndia ? 'GSTIN:' : 'Tax Identifier:'}</span>
                      <span className="font-mono font-semibold text-slate-800">{values.taxId}</span>
                    </div>
                  )}
                  {values.yearEstablished && (
                    <div>
                      <span className="text-slate-400 block">Established:</span>
                      <span className="font-semibold text-slate-800">{values.yearEstablished}</span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Overview:</span>
                    <p className="text-slate-700 italic mt-0.5 line-clamp-2">{values.companyDescription}</p>
                  </div>
                </div>
              </div>

              {/* Address Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    3. Address Information
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-medium text-slate-800">{values.businessAddress}</p>
                  <p className="text-slate-600">
                    {values.city}, {values.state} — {values.postalCode}, {values.country}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Factory Location:{' '}
                    {values.factoryAddressSame ? 'Same as business address' : values.factoryAddress}
                  </p>
                </div>
              </div>

              {/* Verification & Docs Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    4. Verification & Documents
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {values.panNumber && (
                    <div>
                      <span className="text-slate-400 block">PAN Number:</span>
                      <span className="font-mono font-semibold text-slate-800">{values.panNumber}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block">Attached Documents:</span>
                    <span className="font-semibold text-slate-800">{values.documents.length} File(s)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Terms of Service:</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <Check className="h-3.5 w-3.5" /> Accepted
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* NAVIGATION BUTTONS */}
        {/* ============================================================ */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              Next Step
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating Supplier Account...
                </>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  Submit Supplier Registration
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Universal OtpModal Popup */}
      <OtpModal
        isOpen={Boolean(otpModalType)}
        onClose={() => setOtpModalType(null)}
        type={otpModalType || 'email'}
        target={otpModalType === 'phone' ? values.phone : values.email}
        onVerify={handleVerifyOtpModal}
        onResend={otpModalType === 'phone' ? handleSendMobileOtp : handleSendEmailOtp}
        cooldown={otpModalType === 'phone' ? phoneCooldown : emailCooldown}
        isVerifying={otpModalVerifying}
        error={otpModalError}
      />
    </div>
  );
}
