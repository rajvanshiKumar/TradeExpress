import { storeAuthToken } from '../../utils/authSession';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OtpSendError from './OtpSendError';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  BadgeCheck,
  Sparkles,
  ArrowRight,
  Shield,
  FileCheck2,
  Eye,
  EyeOff,
} from 'lucide-react';

import CustomSelect from '../common/CustomSelect';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import {
  COUNTRIES,
  COUNTRY_FLAGS,
  COUNTRY_PHONE_RULES,
} from '../../utils/constants';
import { normalizeEmail, parseMobile, mobileExample } from '../../utils/validators';
import { enterOtpDigits, isCompleteOtp, otpBoxProps, otpSlots } from '../../utils/otpDigits';
import { GoogleSignInCancelled, isGoogleSignInConfigured, signInWithGoogle } from '../../services/googleAuth';
import { apiUrl } from '../../config/api.js';
import useAadhaarOtp from '../../hooks/useAadhaarOtp.js';
import AadhaarHolderCard from './AadhaarHolderCard.jsx';
import PasswordValidationIndicator from '../common/PasswordValidationIndicator';
import { evaluatePassword } from '../../utils/passwordRules.js';
import ShopVerificationStep from './ShopVerificationStep.jsx';
import { clearSignupSession, loadSignupSession, resolveResume, saveSignupSession } from '../../utils/signupSession.js';
import { apiErrorCode, identityReverifyScope, IDENTITY_EXPIRED_MESSAGE, IDENTITY_PROOF_LIFETIME_MS } from '../../utils/identityVerification.js';

const COUNTRY_DIAL_OPTIONS = COUNTRIES.map((c) => ({
  value: c,
  label: `+${COUNTRY_PHONE_RULES[c]?.dial || '91'}`.trim(),
}));

/** API URLs come from VITE_PUBLIC_API_BASE_URL (src/config/api.js) */
const getApiUrl = (endpoint) => apiUrl(endpoint);

const SERVER_UNREACHABLE = 'Unable to reach the TradeExpress server. Please check your connection and try again.';
// OTP and registration calls wait for email/SMS delivery and password hashing on the server
const AUTH_REQUEST_TIMEOUT_MS = 20000;

/** Aadhaar / PAN input: green once verified, red on error. */
const idFieldClass = (verified, hasError) => `w-full rounded-xl border pl-9 pr-[5rem] sm:pl-10 sm:pr-28 py-3 text-[13px] sm:text-sm font-mono sm:tracking-wider transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
  verified
    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-semibold'
    : hasError
      ? 'border-red-500 bg-red-50/20 focus:ring-red-500/20'
      : 'border-slate-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/30 disabled:bg-slate-50 disabled:text-slate-400'
}`;

/** Verify button that sits inside the right end of the Aadhaar / PAN input. */
const INLINE_VERIFY_BUTTON = 'inline-flex min-w-[4.25rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-800 px-3 py-2 sm:min-w-[4.75rem] sm:px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:shadow-none';

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-bold text-white shadow-xs sm:px-2.5">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Verified
    </span>
  );
}

export default function BuyerRegisterForm({ onRoleChange }) {
  const { setAuthUser } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  // Registration Steps: 1: Account, 2: Phone Verification, 3: Identity (Aadhaar + PAN), 4: Shop (live photo + location)
  const [currentStep, setCurrentStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  // Form State: Starts strictly blank
  const [values, setValues] = useState({
    name: '',
    email: '',
    phone: '',
    countryCode: 'India',
    companyName: '',
    aadhaarNumber: '',
    panNumber: '',
  });

  const [errors, setErrors] = useState({});
  const [highlightedFields, setHighlightedFields] = useState({ name: false, companyName: false });

  // Step 1: Email OTP Verification State
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailToken, setEmailToken] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  // Set when the server locks the current code (too many wrong attempts): only a new code can be verified
  const [emailOtpLocked, setEmailOtpLocked] = useState(false);

  // Step 2: Mobile OTP Verification State
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneToken, setPhoneToken] = useState('');
  const [phoneOtpError, setPhoneOtpError] = useState('');
  const [phoneOtpLocked, setPhoneOtpLocked] = useState(false);

  // Signup session: once the email is verified, progress survives a refresh (see utils/signupSession).
  // resumeStep is where to continue after re-verifying an email whose session expired.
  const [resumeStep, setResumeStep] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const sessionRestoredRef = useRef(false);

  useEffect(() => {
    const session = loadSignupSession('buyer');
    sessionRestoredRef.current = true;
    if (!session) return;
    const resume = resolveResume(session);
    setValues((prev) => ({
      ...prev,
      name: session.name || '',
      email: session.email || '',
      phone: session.phone || '',
      countryCode: session.countryCode || 'India',
    }));
    if (resume.emailValid) {
      setEmailVerified(true);
      setEmailToken(session.emailToken);
    }
    if (resume.phoneValid) {
      setPhoneVerified(true);
      setPhoneToken(session.phoneToken);
    }
    // Aadhaar / PAN proofs and the live shop photo are not stored, so a restored signup continues at most at Step 3
    setCurrentStep(Math.min(resume.step, 3));
    setResumeStep(resume.resumeStep ? Math.min(resume.resumeStep, 3) : null);
    setSessionNotice(resume.emailValid ? '' : 'Your session has expired. Please verify your email again to continue where you left off.');
  }, []);

  useEffect(() => {
    // A session exists only after the email is verified; a finished signup clears it instead
    if (!sessionRestoredRef.current || submittedData || !emailVerified || !emailToken) return;
    const previous = loadSignupSession('buyer');
    const phoneProof = phoneVerified && phoneToken
      ? { phoneToken, phoneVerifiedAt: previous?.phoneToken === phoneToken && previous.phoneVerifiedAt ? previous.phoneVerifiedAt : Date.now() }
      : {};
    saveSignupSession('buyer', {
      email: values.email,
      name: values.name,
      phone: values.phone,
      countryCode: values.countryCode,
      emailToken,
      step: currentStep,
      ...phoneProof,
    });
  }, [emailVerified, emailToken, phoneVerified, phoneToken, currentStep, values.name, values.email, values.phone, values.countryCode, submittedData]);

  // Step 3: PAN-Aadhaar Link Verification States
  const [panAadhaarVerifying, setPanAadhaarVerifying] = useState(false);
  const [panAadhaarLinked, setPanAadhaarLinked] = useState(false);
  // Server-signed proof of the LINKED result; registration only accepts LINKED with this token
  const [panAadhaarToken, setPanAadhaarToken] = useState(null);
  const [maskedAadhaar, setMaskedAadhaar] = useState('');
  const [maskedPan, setMaskedPan] = useState('');
  const [linkError, setLinkError] = useState('');
  // Aadhaar verified with OTP (step 1); the PAN–Aadhaar link check (step 2) needs its token
  const [aadhaarOtp, setAadhaarOtp] = useState(null);
  const aadhaarFlow = useAadhaarOtp({
    aadhaarNumber: values.aadhaarNumber,
    onVerified: (result) => {
      setAadhaarOtp(result);
      setLinkError('');
      setErrors((prev) => {
        const next = { ...prev };
        delete next.panAadhaar;
        delete next.aadhaarNumber;
        return next;
      });
    },
  });
  // Terms & Conditions, accepted on Step 4 where the account is created
  const [agreeTerms, setAgreeTerms] = useState(false);
  // Step 4: the account password (kept in memory only, never in the saved signup session)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordCheck = evaluatePassword(password, confirmPassword);
  const passwordReady = passwordCheck.allPassed && passwordCheck.confirmMatch === true;
  // Step 4: live shop photo with its live location, optional shop name and social links
  const [shopCapture, setShopCapture] = useState(null);
  const [shopName, setShopName] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);

  /** Clears the PAN proof (scope 'pan') or both proofs (scope 'aadhaar') so the user verifies again. */
  const resetIdentityVerification = (message, scope = 'aadhaar') => {
    if (scope === 'aadhaar') setAadhaarOtp(null);
    setPanAadhaarLinked(false);
    setPanAadhaarToken(null);
    setMaskedPan('');
    setAgreeTerms(false);
    setLinkError(message || '');
  };

  // The server's proofs last 30 minutes: expire them here first, so an old proof is never submitted
  useEffect(() => {
    if (!aadhaarOtp) return undefined;
    const timer = setTimeout(() => resetIdentityVerification(IDENTITY_EXPIRED_MESSAGE), IDENTITY_PROOF_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [aadhaarOtp]);

  // Compatibility aliases
  const aadhaarVerified = panAadhaarLinked;
  const panVerified = panAadhaarLinked;

  // Google sign-in (Google's own account chooser; see services/googleAuth.js)
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // OTP Inputs Reference for Step 2 (6 boxes)
  const phoneOtpInputsRef = useRef([]);
  // OTP Inputs Reference for Step 1 (6 boxes)
  const emailOtpInputsRef = useRef([]);
  const submitLockRef = useRef(false);
  const emailOtpLockRef = useRef(false);
  const phoneOtpLockRef = useRef(false);
  const emailVerifyLockRef = useRef(false);
  const phoneVerifyLockRef = useRef(false);
  const aadhaarOtpInputsRef = useRef([]);

  // Countdown timers for OTP cooldowns
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => setEmailCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [emailCooldown > 0]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => setPhoneCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown > 0]);

  // Handle Input Changes
  const handleChange = (field) => (e) => {
    let val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;

    if (field === 'name' && (val || '').trim()) {
      setHighlightedFields((prev) => ({ ...prev, name: false }));
    }
    if (field === 'companyName' && (val || '').trim()) {
      setHighlightedFields((prev) => ({ ...prev, companyName: false }));
    }

    if (field === 'phone') {
      val = String(val || '').replace(/\D/g, '');
      setPhoneVerified(false);
      setPhoneOtpSent(false);
      setPhoneOtp('');
      setPhoneOtpError('');
      setPhoneToken('');

      const digits = String(val || '').replace(/\D/g, '');
      if (digits.length > 0) {
        const nameMissing = !values.name || !values.name.trim();
        if (nameMissing) {
          setHighlightedFields((prev) => ({
            ...prev,
            name: nameMissing,
          }));
        }
      }
      if (digits.length > 10) {
        setErrors((prev) => ({ ...prev, phone: 'Please enter a valid mobile number (e.g. 98765 43210).' }));
      }
    } else if (field === 'countryCode') {
      setPhoneVerified(false);
      setPhoneOtpSent(false);
      setPhoneOtp('');
      setPhoneOtpError('');
      setPhoneToken('');
    } else if (field === 'aadhaarNumber') {
      val = String(val || '').replace(/\D/g, '').slice(0, 12);
      setPanAadhaarLinked(false);
      setPanAadhaarToken(null);
      if (val !== values.aadhaarNumber) setAadhaarOtp(null);
      setLinkError('');
    } else if (field === 'panNumber') {
      val = String(val || '').toUpperCase().slice(0, 10);
      setPanAadhaarLinked(false);
      setLinkError('');
    }

    setValues((prev) => ({ ...prev, [field]: val }));

    const text = String(val ?? '');
    let fieldError = '';
    if (field === 'name' && text.trim() && text.trim().length < 2) fieldError = 'Full name must be at least 2 characters.';
    // The email is only checked when Verify is clicked, so typing never shows a red message
    if (field === 'phone' && text && !parseMobile(text, values.countryCode || 'India').ok) fieldError = 'Please enter a valid Indian mobile number (e.g. 98765 43210).';
    if (['name', 'email', 'phone'].includes(field)) {
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Restrict mobile input keypress to digits only
  const handlePhoneKeyDown = (e) => {
    const isNav = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
    ].includes(e.key);
    const isModifier = e.ctrlKey || e.metaKey || e.altKey;
    if (isNav || isModifier) return;

    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // ============================================================
  // STEP 1: EMAIL OTP & GOOGLE OAUTH
  // ============================================================
  const handleSendEmailOtp = async () => {
    if (emailOtpLockRef.current) return;
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Enter a valid business email address.' }));
      return;
    }

    if (!values.name.trim() || values.name.trim().length < 2) {
      setErrors((prev) => ({ ...prev, name: 'Full name is required (minimum 2 characters).' }));
      return;
    }

    emailOtpLockRef.current = true;
    setEmailOtpSending(true);
    setEmailOtpError('');

    try {
      const res = await fetch(getApiUrl('/auth/send-email-verification-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: values.name.trim(), purpose: 'registration', role: 'BUYER' }),
        signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setEmailOtpSent(true);
        setEmailOtpLocked(false);
        setEmailCooldown(data.cooldownSeconds || 30);
        setEmailOtp('');
        if (data.resumeSignup) showToast(data.message, 'warning');
        setTimeout(() => emailOtpInputsRef.current[0]?.focus(), 150);
      } else if (data.code === 'OTP_COOLDOWN' && data.cooldownRemaining > 0) {
        // A code was sent to this address moments ago: keep the entry open and resume the countdown
        setEmailOtpSent(true);
        setEmailCooldown(data.cooldownRemaining);
        setEmailOtpError(data.message);
      } else {
        setEmailOtpError(data.message || 'Unable to dispatch verification email. Please try again.');
      }
    } catch {
      setEmailOtpError(SERVER_UNREACHABLE);
    } finally {
      setEmailOtpSending(false);
      emailOtpLockRef.current = false;
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailVerifyLockRef.current) return;
    const cleanOtp = String(emailOtp || '').trim();
    if (!isCompleteOtp(cleanOtp)) {
      setEmailOtpError('Enter the complete 6-digit verification code.');
      return;
    }

    emailVerifyLockRef.current = true;
    setEmailVerifying(true);
    setEmailOtpError('');

    try {
      const cleanEmail = normalizeEmail(values.email);
      const res = await fetch(getApiUrl('/auth/verify-email-verification-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
        signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.verificationToken) {
        setEmailVerified(true);
        setEmailToken(data.verificationToken);
        setEmailOtpSent(false);
        // Same email as the expired session: continue on the step the user was on; otherwise start Step 2
        const saved = loadSignupSession('buyer');
        const continueAt = resumeStep && saved?.email === cleanEmail ? resumeStep : 2;
        if (saved && saved.email !== cleanEmail) {
          clearSignupSession('buyer');
          setPhoneVerified(false);
          setPhoneToken('');
        }
        setResumeStep(null);
        setSessionNotice('');
        setTimeout(() => {
          setCurrentStep(continueAt);
          window.scrollTo({ top: 80, behavior: 'smooth' });
        }, 300);
      } else if (res.status === 429) {
        // The server no longer accepts this code: block further attempts until a new code is sent
        setEmailOtpLocked(true);
        setEmailOtp('');
        setEmailOtpError(data.message || 'Too many incorrect verification attempts. Please request a new OTP.');
      } else {
        setEmailOtpError(data.message || `Verification failed (error ${res.status}). Please try again.`);
      }
    } catch {
      setEmailOtpError(SERVER_UNREACHABLE);
    } finally {
      setEmailVerifying(false);
      emailVerifyLockRef.current = false;
    }
  };

  /** Continue with Google: one click registers a new buyer (or signs in an existing one) from the verified Google profile. */
  const handleGoogleContinue = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const result = await signInWithGoogle('buyer');
      if (result.status !== 'SIGNED_IN') throw new Error('Google sign-in could not be completed. Please try again.');
      await setAuthUser(result.user, result.token);
      navigate('/', { replace: true }); // signed in: Home; the dashboard opens from the profile menu
    } catch (err) {
      if (!(err instanceof GoogleSignInCancelled)) setGoogleError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ============================================================
  // STEP 2: PHONE OTP VERIFICATION
  // ============================================================
  const handleSendPhoneOtp = async () => {
    if (phoneOtpLockRef.current) return;
    const nameMissing = !values.name || !values.name.trim();
    if (nameMissing) {
      setHighlightedFields((prev) => ({ ...prev, name: true }));
      return;
    }

    const rawPhone = values.phone.trim();
    if (!rawPhone) {
      setErrors((prev) => ({ ...prev, phone: 'Mobile number is required.' }));
      return;
    }

    const parsed = parseMobile(rawPhone, values.countryCode || 'India');
    if (!parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: 'Please enter a valid mobile number (e.g. 98765 43210).',
      }));
      return;
    }

    phoneOtpLockRef.current = true;
    setPhoneOtpSending(true);
    setPhoneOtpError('');

    try {
      const res = await fetch(getApiUrl('/auth/send-mobile-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: parsed.international || rawPhone,
          country: values.countryCode || 'India',
          role: 'BUYER', // a number already used by a supplier account is refused before any OTP
        }),
        signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPhoneOtpSent(true);
        setPhoneOtpLocked(false);
        setPhoneCooldown(data.cooldownSeconds || 30);
        setPhoneOtp('');
        setTimeout(() => phoneOtpInputsRef.current[0]?.focus(), 150);
      } else if (data.code === 'OTP_COOLDOWN' && data.cooldownRemaining > 0) {
        // A code was sent to this number moments ago: keep the entry open and resume the countdown
        setPhoneOtpSent(true);
        setPhoneCooldown(data.cooldownRemaining);
        setPhoneOtpError(data.message);
      } else {
        setPhoneOtpError(data.message || 'Failed to dispatch SMS OTP. Please try again.');
      }
    } catch {
      setPhoneOtpError(SERVER_UNREACHABLE);
    } finally {
      setPhoneOtpSending(false);
      phoneOtpLockRef.current = false;
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneVerifyLockRef.current) return;
    const cleanOtp = String(phoneOtp || '').trim();
    if (!isCompleteOtp(cleanOtp)) {
      setPhoneOtpError('Please enter all 6 digits of the verification code.');
      return;
    }

    phoneVerifyLockRef.current = true;
    setPhoneVerifying(true);
    setPhoneOtpError('');

    try {
      const parsed = parseMobile(values.phone, values.countryCode || 'India');
      const res = await fetch(getApiUrl('/auth/verify-mobile-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phone: parsed.international || values.phone.trim(),
          country: values.countryCode || 'India',
          otp: cleanOtp,
        }),
        signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && (data.data?.verificationToken || data.verificationToken)) {
        setPhoneVerified(true);
        setPhoneToken(data.data?.verificationToken || data.verificationToken);
        setPhoneOtpSent(false);
        // Automatically redirect to Step 3 upon successful mobile verification
        setTimeout(() => {
          setCurrentStep(3);
          window.scrollTo({ top: 80, behavior: 'smooth' });
        }, 300);
      } else if (res.status === 429) {
        setPhoneOtpLocked(true);
        setPhoneOtp('');
        setPhoneOtpError(data.message || 'Too many incorrect verification attempts. Please request a new OTP.');
      } else {
        setPhoneOtpError(data.message || `Verification failed (error ${res.status}). Please try again.`);
      }
    } catch {
      setPhoneOtpError(SERVER_UNREACHABLE);
    } finally {
      setPhoneVerifying(false);
      phoneVerifyLockRef.current = false;
    }
  };

  // Helper for 6-box OTP input management (positions are kept when a box is cleared; see utils/otpDigits)
  const otpBoxes = (type) => ({
    phone: { value: phoneOtp, set: setPhoneOtp, ref: phoneOtpInputsRef, submit: () => handleVerifyPhoneOtp() },
    email: { value: emailOtp, set: setEmailOtp, ref: emailOtpInputsRef, submit: () => handleVerifyEmailOtp() },
    aadhaar: { value: aadhaarFlow.otp, set: aadhaarFlow.setOtp, ref: aadhaarOtpInputsRef, submit: () => aadhaarFlow.verify() },
  })[type];

  const handleOtpBoxChange = (type, index, value) => {
    const { value: currentVal, set: setOtpVal, ref: inputsRef } = otpBoxes(type);

    const { value: next, focusIndex } = enterOtpDigits(currentVal, index, value);
    setOtpVal(next);
    if (focusIndex !== null) inputsRef.current[focusIndex]?.focus();
  };

  const handleOtpBoxKeyDown = (type, index, e) => {
    const { value: currentVal, ref: inputsRef, submit } = otpBoxes(type);

    if (e.key === 'Backspace' && !otpSlots(currentVal)[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const handleOtpBoxPaste = (type, e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const { set, ref } = otpBoxes(type);
    set(pasted);
    ref.current[Math.min(5, pasted.length - 1)]?.focus();
  };

  // ============================================================
  // STEP 3: AADHAAR & PAN LINK VERIFICATION (SINGLE VERIFY ACTION)
  // ============================================================
  const handleVerifyPanAadhaarLink = async () => {
    const rawAadhaar = (values.aadhaarNumber || '').replace(/\D/g, '');
    if (rawAadhaar.length !== 12) {
      setLinkError('Aadhaar number must be exactly 12 numeric digits.');
      return;
    }

    const rawPan = (values.panNumber || '').trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(rawPan)) {
      setLinkError('PAN must be a valid 10-character alphanumeric tax ID (e.g. ABCDE1234F).');
      return;
    }

    if (!aadhaarOtp?.verificationToken) {
      setLinkError('Please verify your Aadhaar with OTP first.');
      return;
    }

    setPanAadhaarVerifying(true);
    setLinkError('');

    try {
      // Only the backend from VITE_PUBLIC_API_BASE_URL; a network failure is handled by the catch below
      const res = await fetch(getApiUrl('/verification/pan-aadhaar/link-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          aadhaarNumber: rawAadhaar,
          pan: rawPan,
          userConsent: true,
          aadhaarVerificationToken: aadhaarOtp.verificationToken,
        }),
        signal: AbortSignal.timeout(35000),
      });

      const data = await res.json().catch(() => ({}));
      const linkData = data.data || data;

      if (res.ok && data.success && linkData?.linked === true && linkData.verificationToken) {
        setPanAadhaarLinked(true);
        setPanAadhaarToken(linkData.verificationToken);
        setMaskedAadhaar(`•••• •••• ${rawAadhaar.slice(-4)}`);
        setMaskedPan(linkData.maskedPan || `${rawPan.slice(0, 2)}XXXXXX${rawPan.slice(-2)}`);
        setLinkError('');
        setErrors((prev) => {
          const next = { ...prev };
          delete next.panAadhaar;
          delete next.aadhaarNumber;
          delete next.panNumber;
          return next;
        });
      } else {
        setPanAadhaarLinked(false);
        setPanAadhaarToken(null);
        const errorMsg =
          linkData?.message ||
          data.message ||
          'Aadhaar is not linked with the entered PAN in Income Tax statutory records.';
        // An expired / used Aadhaar proof (or too many PAN attempts) needs a fresh Aadhaar OTP
        if (identityReverifyScope(apiErrorCode(data)) === 'aadhaar') resetIdentityVerification(errorMsg);
        else setLinkError(errorMsg);
      }
    } catch (err) {
      setPanAadhaarLinked(false);
      setPanAadhaarToken(null);
      const isTimeout = err?.name === 'TimeoutError' || String(err?.message || '').toLowerCase().includes('timeout');
      setLinkError(
        isTimeout
          ? 'Income Tax verification server timed out. Please verify your internet connection and try again.'
          : 'Unable to connect to Income Tax verification service. Please try again.'
      );
    } finally {
      setPanAadhaarVerifying(false);
    }
  };

  // ============================================================
  // STEP VALIDATIONS & NAVIGATION
  // ============================================================
  const validateStep1 = () => {
    const stepErrors = {};
    if (!values.name.trim() || values.name.trim().length < 2) {
      stepErrors.name = 'Full name is required (minimum 2 characters).';
    }

    if (!values.email.trim()) {
      stepErrors.email = 'Business email address is required.';
    } else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(values.email.trim())) {
      stepErrors.email = 'Enter a valid business email address.';
    } else if (!emailVerified) {
      stepErrors.email = 'Please verify your email address to proceed.';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep2 = () => {
    const stepErrors = {};
    if (!values.phone.trim()) {
      stepErrors.phone = 'Mobile number is required.';
    } else if (!phoneVerified) {
      stepErrors.phone = 'Please complete mobile OTP verification to proceed.';
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep3 = () => {
    const stepErrors = {};
    if (!aadhaarOtp?.verificationToken) {
      stepErrors.panAadhaar = 'Please verify your Aadhaar with OTP first.';
    } else if (!panAadhaarLinked) {
      stepErrors.panAadhaar = 'Please verify that your Aadhaar is linked with your PAN card to proceed.';
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep4 = () => {
    const stepErrors = {};
    if (!shopCapture?.photoUrl) stepErrors.shop = 'Please take a live photo of your shop.';
    if (!password) stepErrors.password = 'Create a password for your account.';
    else if (!passwordCheck.allPassed) stepErrors.password = 'Your password does not meet all the requirements below.';
    if (!confirmPassword) stepErrors.confirmPassword = 'Confirm your password.';
    else if (password !== confirmPassword) stepErrors.confirmPassword = 'Passwords do not match.';
    if (!agreeTerms) stepErrors.agreeTerms = 'Please accept the TradeExpress Terms & Conditions.';
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNextStep = () => {
    setFormError('');
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
      window.scrollTo({ top: 80, behavior: 'smooth' });
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
      setCurrentStep(3);
      window.scrollTo({ top: 80, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setFormError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 80, behavior: 'smooth' });
  };

  // ============================================================
  // FINAL BUYER REGISTRATION SUBMISSION
  // ============================================================
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (busy || submitLockRef.current) return;

    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      setCurrentStep(3);
      return;
    }
    if (!validateStep4()) {
      setCurrentStep(4);
      return;
    }

    submitLockRef.current = true;
    setBusy(true);
    setFormError('');

    const parsedPhone = parseMobile(values.phone, values.countryCode || 'India');
    const rawPan = values.panNumber.trim().toUpperCase();
    const rawAadhaar = values.aadhaarNumber.replace(/\D/g, '');

    const payload = {
      name: values.name.trim(),
      company: shopName.trim() || values.companyName?.trim() || `${values.name.trim()}'s Business`,
      companyName: shopName.trim() || values.companyName?.trim() || `${values.name.trim()}'s Business`,
      email: normalizeEmail(values.email),
      phone: parsedPhone.international || values.phone.trim(),
      country: values.countryCode || 'India',
      pan: rawPan,
      panNumber: rawPan,
      aadhaarNumber: rawAadhaar,
      aadhaarConsent: true,
      aadhaarLast4: rawAadhaar.slice(-4),
      panAadhaarStatus: panAadhaarLinked ? 'LINKED' : 'NOT_STARTED',
      panAadhaarLinked: Boolean(panAadhaarLinked),
      panAadhaarToken: panAadhaarLinked ? panAadhaarToken : null,
      aadhaarVerificationToken: aadhaarOtp?.verificationToken || null,
      // Step 4 (the server resolves the address from the coordinates itself)
      shopName: shopName.trim(),
      shopPhotoUrl: shopCapture?.photoUrl || null,
      shopLatitude: shopCapture?.latitude ?? null,
      shopLongitude: shopCapture?.longitude ?? null,
      shopLocationAccuracy: shopCapture?.accuracy ?? null,
      shopCapturedAt: shopCapture?.capturedAt || null,
      socialLinks: socialLinks.map((link) => link.url),
      verificationToken: phoneToken,
      emailVerificationToken: emailToken,
      password,
      confirmPassword,
      agree: true,
      agreeTerms: true,
    };

    try {
      const res = await fetch(getApiUrl('/auth/register-buyer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (data.data?.token) {
          storeAuthToken(data.data.token);
        }
        clearSignupSession('buyer');
        // The password is not kept in memory once the account exists
        setPassword('');
        setConfirmPassword('');
        if (setAuthUser && data.data) {
          await setAuthUser(data.data.user || data.data, data.data.token, '');
        }

        setSubmittedData({
          ...data.data,
          buyerCode: data.data?.buyerCode || 'BYR-ACTIVATED',
          name: payload.name,
          email: payload.email,
        });
        window.scrollTo({ top: 80, behavior: 'smooth' });
        return;
      }

      // The server refused the shop details (old photo, missing location, bad link): fix them on Step 4
      const shopCode = apiErrorCode(data);
      if (shopCode && (shopCode.startsWith('SHOP_') || shopCode === 'INVALID_SOCIAL_LINKS')) {
        if (shopCode.startsWith('SHOP_PHOTO') || shopCode === 'SHOP_LOCATION_INVALID') setShopCapture(null);
        setErrors((prev) => ({ ...prev, shop: data.message }));
        setFormError('');
        setCurrentStep(4);
        return;
      }

      // The server refused the Aadhaar / PAN proof (expired, used, different number): verify again on Step 3
      const reverify = identityReverifyScope(apiErrorCode(data));
      if (reverify) {
        resetIdentityVerification(data.message, reverify);
        setFormError('');
        setCurrentStep(3);
        return;
      }

      if (data.code === 'EMAIL_VERIFICATION_EXPIRED') {
        setEmailVerified(false);
        setEmailToken('');
        setEmailOtpSent(false);
        setErrors((prev) => ({ ...prev, email: data.message }));
        setFormError('');
        setCurrentStep(1);
        return;
      }

      if (res.status >= 400 && res.status < 500 && data.message) {
        setFormError(data.message || 'Buyer registration failed. Please review your details.');
        return;
      }

      // 5xx: the account was not created, so never show a success screen
      setFormError(data.message || 'We could not complete your registration. Please try again.');
    } catch {
      // No response: retrying is safe because a completed registration is reported as an existing account
      setFormError(SERVER_UNREACHABLE);
    } finally {
      setBusy(false);
      submitLockRef.current = false;
    }
  };

  // ============================================================
  // SUCCESS CONFIRMATION STATE
  // ============================================================
  if (submittedData) {
    return (
      <div className="mx-auto max-w-xl py-6 px-4 text-center animate-in fade-in duration-300">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-500/10 shadow-sm">
          <BadgeCheck className="h-10 w-10 text-emerald-700" />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-950">
          <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
          <span>Role: Verified Enterprise Buyer</span>
        </div>

        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Welcome to TradeExpress, {submittedData.name || 'Valued Buyer'}!
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Your buyer account has been created and verified. You can now discover global manufacturers, request wholesale quotations, and purchase securely with Escrow protection.
        </p>

        {/* Verification Summary Card */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buyer Code</span>
            <span className="font-mono font-bold text-emerald-800 text-sm">{submittedData.buyerCode || 'BYR-ACTIVATED'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Email:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <Check className="size-3 text-emerald-600" />
                {submittedData.email}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Phone Verification:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <Check className="size-3 text-emerald-600" />
                Verified (+91)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Aadhaar Status:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="size-3 text-emerald-600" />
                Verified ({maskedAadhaar || 'UIDAI Compliant'})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">PAN Status:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <FileCheck2 className="size-3 text-emerald-600" />
                Verified ({maskedPan || 'ITD Active'})
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/buyer')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Go to Buyer Dashboard
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Explore Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl sm:max-w-2xl mx-auto">
      {/* Hidden Decoy Fields to Prevent Password Managers from Pre-filling */}
      <input type="text" name="fake_username_remembered" className="hidden" tabIndex="-1" autoComplete="off" />
      <input type="password" name="fake_password_remembered" className="hidden" tabIndex="-1" autoComplete="off" />

      {/* Top Header & Reference Eyebrow */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
          <span>
            {currentStep === 1
              ? 'CREATE ACCOUNT'
              : currentStep === 2
              ? 'PHONE VERIFICATION'
              : currentStep === 3
              ? 'IDENTITY VERIFICATION'
              : 'SHOP VERIFICATION'}
          </span>
        </div>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {currentStep === 1
            ? 'Create your account'
            : currentStep === 2
            ? 'Verify your mobile number'
            : currentStep === 3
            ? 'Statutory Identity & Profile'
            : 'Your shop'}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          {currentStep === 1
            ? 'Start with your name and verify your email.'
            : currentStep === 2
            ? 'We will send a 6-digit verification code to your mobile number.'
            : currentStep === 3
            ? 'Verify your Aadhaar and PAN to activate your enterprise buyer privileges.'
            : 'Take a live photo of your shop. We record its location so suppliers can trust your business.'}
        </p>
      </div>

      {/* 3-Step Professional Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {/* Step 1 Indicator */}
          <button
            type="button"
            onClick={() => {
              setCurrentStep(1);
              window.scrollTo({ top: 80, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 cursor-pointer text-left bg-transparent border-0 p-0"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                currentStep > 1
                  ? 'bg-emerald-800 text-white'
                  : currentStep === 1
                  ? 'bg-emerald-800 text-white ring-4 ring-emerald-600/20 shadow-xs'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <span
              className={`text-xs font-semibold ${currentStep === 1 ? '' : 'hidden sm:inline'} ${
                currentStep >= 1 ? 'text-slate-900 font-bold' : 'text-slate-400'
              }`}
            >
              Account
            </span>
          </button>

          <div
            className={`flex-1 mx-2 sm:mx-3 h-0.5 min-w-4 rounded-full transition-all ${
              currentStep > 1 ? 'bg-emerald-800' : 'bg-slate-200'
            }`}
          />

          {/* Step 2 Indicator */}
          <button
            type="button"
            disabled={!emailVerified}
            onClick={() => {
              if (emailVerified) {
                setCurrentStep(2);
                window.scrollTo({ top: 80, behavior: 'smooth' });
              }
            }}
            className={`flex items-center gap-2 text-left bg-transparent border-0 p-0 ${
              emailVerified ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                currentStep > 2
                  ? 'bg-emerald-800 text-white'
                  : currentStep === 2
                  ? 'bg-emerald-800 text-white ring-4 ring-emerald-600/20 shadow-xs'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
            </div>
            <span
              className={`text-xs font-semibold ${currentStep === 2 ? '' : 'hidden sm:inline'} ${
                currentStep >= 2 ? 'text-slate-900 font-bold' : 'text-slate-400'
              }`}
            >
              Phone
            </span>
          </button>

          <div
            className={`flex-1 mx-2 sm:mx-3 h-0.5 min-w-4 rounded-full transition-all ${
              currentStep > 2 ? 'bg-emerald-800' : 'bg-slate-200'
            }`}
          />

          {/* Step 3 Indicator */}
          <button
            type="button"
            disabled={!phoneVerified}
            onClick={() => {
              if (phoneVerified) {
                setCurrentStep(3);
                window.scrollTo({ top: 80, behavior: 'smooth' });
              }
            }}
            className={`flex items-center gap-2 text-left bg-transparent border-0 p-0 ${
              phoneVerified ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                currentStep > 3
                  ? 'bg-emerald-800 text-white'
                  : currentStep === 3
                  ? 'bg-emerald-800 text-white ring-4 ring-emerald-600/20 shadow-xs'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {currentStep > 3 ? <Check className="h-4 w-4" /> : '3'}
            </div>
            <span
              className={`text-xs font-semibold ${currentStep === 3 ? '' : 'hidden sm:inline'} ${
                currentStep >= 3 ? 'text-slate-900 font-bold' : 'text-slate-400'
              }`}
            >
              Identity
            </span>
          </button>

          <div
            className={`flex-1 mx-2 sm:mx-3 h-0.5 min-w-4 rounded-full transition-all ${
              currentStep > 3 ? 'bg-emerald-800' : 'bg-slate-200'
            }`}
          />

          {/* Step 4 Indicator */}
          <button
            type="button"
            disabled={!(aadhaarOtp && panAadhaarLinked)}
            onClick={() => {
              if (aadhaarOtp && panAadhaarLinked) {
                setCurrentStep(4);
                window.scrollTo({ top: 80, behavior: 'smooth' });
              }
            }}
            className={`flex items-center gap-2 text-left bg-transparent border-0 p-0 ${
              aadhaarOtp && panAadhaarLinked ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                currentStep === 4
                  ? 'bg-emerald-800 text-white ring-4 ring-emerald-600/20 shadow-xs'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              4
            </div>
            <span
              className={`text-xs font-semibold ${currentStep === 4 ? '' : 'hidden sm:inline'} ${
                currentStep === 4 ? 'text-slate-900 font-bold' : 'text-slate-400'
              }`}
            >
              Shop
            </span>
          </button>
        </div>
      </div>

      {/* Signup session expired: verify the email again to continue */}
      {sessionNotice && currentStep === 1 && (
        <div role="status" className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>{sessionNotice}</span>
        </div>
      )}

      {/* Global Form Error Alert */}
      {formError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: ACCOUNT INFORMATION */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="space-y-5">
          {/* Full Name Field */}
          <div>
            <label htmlFor="buyer-signup-name" className="block text-xs font-bold text-slate-800 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="buyer-signup-name"
                type="text"
                placeholder="Enter your full name"
                value={values.name}
                onChange={handleChange('name')}
                className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
                  errors.name || highlightedFields?.name ? 'border-red-500 bg-red-50/20 ring-2 ring-red-400/20' : 'border-slate-300 focus:border-emerald-700'
                }`}
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-red-600 font-medium">{errors.name}</p>}
          </div>

          {/* Business Email Address Field with Inline Verify Button */}
          <div>
            <label htmlFor="buyer-signup-email" className="block text-xs font-bold text-slate-800 mb-1.5">
              Business Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="buyer-signup-email"
                type="email"
                placeholder="you@example.com"
                value={values.email}
                disabled={emailVerified}
                onChange={handleChange('email')}
                className={`w-full rounded-xl border pl-10 pr-24 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:bg-slate-50 disabled:text-slate-600 ${
                  errors.email ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-emerald-700'
                }`}
              />

              {/* Inline Verify Button or Verified Indicator */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={emailOtpSending || !values.email || emailCooldown > 0}
                    className="rounded-lg bg-emerald-800 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                  >
                    {emailOtpSending ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : emailCooldown > 0 ? (
                      `${emailCooldown}s`
                    ) : (
                      'Verify'
                    )}
                  </button>
                )}
              </div>
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-600 font-medium">{errors.email}</p>}
            {!emailOtpSent ? <OtpSendError message={emailOtpError} role="buyer" /> : null}

            {/* Inline Email OTP Verification Box (Appears when Verify is clicked) */}
            {emailOtpSent && !emailVerified && (
              <div className="mt-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Enter 6-digit email code</span>
                  <span className="text-[11px] text-slate-500">Sent to {values.email}</span>
                </div>

                {/* 6 OTP Boxes */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => (emailOtpInputsRef.current[index] = el)}
                      {...otpBoxProps('buyer-email', index)}
                      disabled={emailVerifying}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={otpSlots(emailOtp)[index]}
                      onChange={(e) => handleOtpBoxChange('email', index, e.target.value)}
                      onKeyDown={(e) => handleOtpBoxKeyDown('email', index, e)}
                      onPaste={(e) => handleOtpBoxPaste('email', e)}
                      className="w-10 h-11 sm:w-11 sm:h-12 text-center text-lg font-bold font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 outline-none transition"
                    />
                  ))}
                </div>

                {emailOtpError && (
                  <p className="text-xs text-rose-600 font-medium">{emailOtpError}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={emailCooldown > 0 || emailOtpSending}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 disabled:text-slate-400"
                  >
                    {emailCooldown > 0 ? `Resend OTP in ${emailCooldown}s` : 'Resend Code'}
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    disabled={emailVerifying || emailOtpLocked || !isCompleteOtp(emailOtp)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition shadow-xs"
                  >
                    {emailVerifying ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Verify Code
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* OR Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-bold text-slate-400">OR</span>
            </div>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleContinue}
            disabled={googleLoading || !isGoogleSignInConfigured}
            aria-describedby={googleError || !isGoogleSignInConfigured ? 'buyer-google-status' : undefined}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {googleLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{googleLoading ? 'Waiting for Google...' : 'Continue with Google'}</span>
          </button>
          {googleError ? (
            <p id="buyer-google-status" role="alert" className="text-center text-xs font-medium text-red-600">{googleError}</p>
          ) : !isGoogleSignInConfigured ? (
            <p id="buyer-google-status" className="text-center text-[11px] text-slate-500">Google sign-in is not available yet.</p>
          ) : null}

          <p className="text-center text-[11px] text-slate-400">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>

          {/* Email Verified Direct Navigation if user returns to Step 1 */}
          {emailVerified && (
            <div className="pt-2 text-center animate-in fade-in">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(2);
                  window.scrollTo({ top: 80, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4"
              >
                <span>Email verified — Proceed to Step 2 (Phone Verification)</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: PHONE NUMBER & COMBINED OTP VERIFICATION BOX */}
      {/* ============================================================ */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* COMBINED PHONE VERIFICATION BOX */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-5">
            <div>
              <label htmlFor="buyer-signup-phone" className="block text-xs font-bold text-slate-800 mb-1.5">
                Mobile Number <span className="text-red-500">*</span>
              </label>

              {/* Combined Phone Input Row: on phones the button drops below at full width */}
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 sm:flex">
                {/* Country Dial Selector */}
                <div className="sm:w-28 sm:shrink-0">
                  <CustomSelect
                    id="buyer-country-dial"
                    value={values.countryCode}
                    onChange={(e) => handleChange('countryCode')(e.target.value)}
                    options={COUNTRY_DIAL_OPTIONS}
                    searchable={true}
                  />
                </div>

                {/* Mobile Input */}
                <div className="relative min-w-0 sm:flex-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    id="buyer-signup-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="e.g. 98765 43210"
                    disabled={phoneVerified}
                    value={values.phone}
                    onKeyDown={handlePhoneKeyDown}
                    onChange={handleChange('phone')}
                    maxLength={10}
                    className={`w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:bg-slate-50 disabled:text-slate-600 ${
                      errors.phone ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-emerald-700'
                    }`}
                  />
                </div>

                {/* Get OTP Button or Verified Badge */}
                <div className="col-span-2 sm:col-span-1 sm:shrink-0">
                  {phoneVerified ? (
                    <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-100 text-emerald-800 px-3.5 py-2.5 text-xs font-bold sm:inline-flex sm:w-auto">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={phoneOtpSending || values.phone.length < 10 || phoneCooldown > 0}
                      className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition sm:inline-flex sm:w-auto"
                    >
                      {phoneOtpSending ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : phoneCooldown > 0 ? (
                        `Resend (${phoneCooldown}s)`
                      ) : phoneOtpSent ? (
                        'Resend OTP'
                      ) : (
                        'Get OTP'
                      )}
                    </button>
                  )}
                </div>
              </div>
              {errors.phone && <p className="mt-1 text-xs text-red-600 font-medium">{errors.phone}</p>}
              {!phoneOtpSent ? <OtpSendError message={phoneOtpError} role="buyer" /> : null}
            </div>

            {/* OTP VERIFICATION SECTION: DISPLAYED DIRECTLY BELOW PHONE NUMBER, INSIDE SAME COMBINED BOX */}
            {phoneOtpSent && !phoneVerified && (
              <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  <span className="font-bold text-slate-800">Enter 6-digit verification code</span>
                  <span className="text-[11px] text-slate-500">
                    Dispatched to +91 {values.phone}
                  </span>
                </div>

                {/* EXACTLY SIX SEPARATE OTP INPUT BOXES IN ONE HORIZONTAL ROW */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => (phoneOtpInputsRef.current[index] = el)}
                      {...otpBoxProps('buyer-mobile', index)}
                      disabled={phoneVerifying}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={otpSlots(phoneOtp)[index]}
                      onChange={(e) => handleOtpBoxChange('phone', index, e.target.value)}
                      onKeyDown={(e) => handleOtpBoxKeyDown('phone', index, e)}
                      onPaste={(e) => handleOtpBoxPaste('phone', e)}
                      className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-black font-mono rounded-xl border bg-white transition outline-none ${
                        phoneOtp[index]
                          ? 'border-emerald-700 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-600/30'
                          : 'border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20'
                      }`}
                    />
                  ))}
                </div>

                {phoneOtpError && (
                  <p className="text-xs text-rose-600 font-medium">{phoneOtpError}</p>
                )}

                {/* VERIFY OTP BUTTON PLACED BELOW THE SIX OTP BOXES */}
                <button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={phoneVerifying || phoneOtpLocked || !isCompleteOtp(phoneOtp)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition"
                >
                  {phoneVerifying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Verify Mobile OTP</span>
                    </>
                  )}
                </button>

                {/* 30-Second Countdown & Resend Option */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Didn't receive code?</span>
                  <button
                    type="button"
                    onClick={handleSendPhoneOtp}
                    disabled={phoneCooldown > 0 || phoneOtpSending}
                    className="font-bold text-emerald-800 hover:text-emerald-950 disabled:text-slate-400"
                  >
                    {phoneCooldown > 0 ? `Resend OTP in ${phoneCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* Success State Indicator Inside Box */}
            {phoneVerified && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Mobile number verified successfully. You may proceed to profile verification.</span>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            {phoneVerified && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(3);
                  window.scrollTo({ top: 80, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4"
              >
                <span>Phone verified — Proceed to Step 3</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: AADHAAR & PAN PROFILE VERIFICATION */}
      {/* ============================================================ */}
      {currentStep === 3 && (
        <div className="space-y-4">
          {/* Identity verification: Aadhaar by OTP, then PAN matched with the PAN linked to that Aadhaar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 sm:flex">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Identity verification</p>
                  <p className="text-[11px] text-slate-500">Verify your Aadhaar first, then your PAN.</p>
                </div>
              </div>
              <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${aadhaarOtp && panAadhaarLinked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                {(aadhaarOtp ? 1 : 0) + (panAadhaarLinked ? 1 : 0)}/2 verified
              </span>
            </div>

            {/* 1. Aadhaar: Verify sends an OTP to the Aadhaar-linked mobile */}
            <div>
              <label htmlFor="buyer-signup-aadhaar" className="mb-1.5 block text-xs font-bold text-slate-800">
                Aadhaar Card Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Shield className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${aadhaarOtp ? 'text-emerald-600' : 'text-slate-400'}`} />
                <input
                  id="buyer-signup-aadhaar"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12-digit Aadhaar number"
                  disabled={Boolean(aadhaarOtp)}
                  value={aadhaarOtp ? `•••• •••• ${aadhaarOtp.aadhaarLast4}` : values.aadhaarNumber}
                  onChange={handleChange('aadhaarNumber')}
                  maxLength={12}
                  className={idFieldClass(Boolean(aadhaarOtp), errors.aadhaarNumber)}
                />
                <div className="absolute inset-y-0 right-1.5 flex items-center">
                  {aadhaarOtp ? (
                    <VerifiedBadge />
                  ) : (
                    <button
                      type="button"
                      onClick={aadhaarFlow.send}
                      disabled={aadhaarFlow.digits.length !== 12 || aadhaarFlow.sending || aadhaarFlow.cooldown > 0}
                      className={INLINE_VERIFY_BUTTON}
                    >
                      {aadhaarFlow.sending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      <span>
                        {aadhaarFlow.sending ? 'Sending' : aadhaarFlow.cooldown > 0 ? `${aadhaarFlow.cooldown}s` : aadhaarFlow.request ? 'Resend' : 'Verify'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {aadhaarOtp ? (
                <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                  Aadhaar verified{aadhaarOtp.fullName ? ` · ${aadhaarOtp.fullName}` : ''}
                  {aadhaarOtp.environment === 'uat' && <span className="ml-1.5 font-medium text-amber-600">(UAT test)</span>}
                </p>
              ) : errors.aadhaarNumber ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.aadhaarNumber}</p>
              ) : !aadhaarFlow.request && (
                <p className="mt-1.5 text-[11px] text-slate-500">An OTP will be sent to the mobile number linked with your Aadhaar.</p>
              )}
              {aadhaarOtp ? <AadhaarHolderCard holder={aadhaarOtp.holder} /> : null}

              {/* 6-digit OTP, shown after Verify */}
              {!aadhaarOtp && aadhaarFlow.request && (
                <div className="mt-3 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="font-bold text-slate-800">Enter 6-digit OTP</span>
                    <span className="text-[11px] text-slate-500">
                      Sent to mobile linked with Aadhaar •••• {aadhaarFlow.request.aadhaarLast4}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2.5">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        ref={(el) => (aadhaarOtpInputsRef.current[index] = el)}
                        {...otpBoxProps('buyer-aadhaar', index)}
                        aria-label={`Aadhaar OTP digit ${index + 1}`}
                        disabled={aadhaarFlow.verifying}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={otpSlots(aadhaarFlow.otp)[index]}
                        onChange={(e) => handleOtpBoxChange('aadhaar', index, e.target.value)}
                        onKeyDown={(e) => handleOtpBoxKeyDown('aadhaar', index, e)}
                        onPaste={(e) => handleOtpBoxPaste('aadhaar', e)}
                        className={`h-12 min-w-0 flex-1 sm:h-14 sm:max-w-14 text-center text-xl font-black font-mono rounded-xl border bg-white transition outline-none ${
                          otpSlots(aadhaarFlow.otp)[index]
                            ? 'border-emerald-700 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-600/30'
                            : 'border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={aadhaarFlow.verify}
                    disabled={!isCompleteOtp(aadhaarFlow.otp) || aadhaarFlow.verifying}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition"
                  >
                    {aadhaarFlow.verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    <span>{aadhaarFlow.verifying ? 'Verifying Aadhaar...' : 'Verify OTP'}</span>
                  </button>
                  {aadhaarFlow.request.environment === 'uat' && (
                    <p className="text-[11px] font-medium text-amber-700">UAT test mode: any 6-digit OTP is accepted.</p>
                  )}
                </div>
              )}

              {aadhaarFlow.error && (
                <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">{aadhaarFlow.error}</span>
                </p>
              )}
            </div>

            {/* 2. PAN: verified when it matches the PAN linked with the verified Aadhaar (Income Tax records) */}
            <div className="border-t border-slate-100 pt-5">
              <label htmlFor="buyer-signup-pan" className="mb-1.5 block text-xs font-bold text-slate-800">
                PAN Card Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileCheck2 className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${panAadhaarLinked ? 'text-emerald-600' : 'text-slate-400'}`} />
                <input
                  id="buyer-signup-pan"
                  type="text"
                  autoComplete="off"
                  placeholder="ABCDE1234F"
                  disabled={panAadhaarLinked}
                  value={panAadhaarLinked ? maskedPan : values.panNumber}
                  onChange={handleChange('panNumber')}
                  maxLength={10}
                  className={`${idFieldClass(panAadhaarLinked, errors.panNumber)} uppercase placeholder:normal-case`}
                />
                <div className="absolute inset-y-0 right-1.5 flex items-center">
                  {panAadhaarLinked ? (
                    <VerifiedBadge />
                  ) : (
                    <button
                      type="button"
                      onClick={handleVerifyPanAadhaarLink}
                      disabled={panAadhaarVerifying || !aadhaarOtp || values.panNumber.length !== 10}
                      className={INLINE_VERIFY_BUTTON}
                    >
                      {panAadhaarVerifying && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      <span>{panAadhaarVerifying ? 'Checking' : 'Verify'}</span>
                    </button>
                  )}
                </div>
              </div>

              {panAadhaarLinked ? (
                <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                  PAN verified: matches the PAN linked with Aadhaar {maskedAadhaar}
                </p>
              ) : errors.panNumber ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.panNumber}</p>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {aadhaarOtp
                    ? 'We check that this PAN is the one linked with your Aadhaar in Income Tax records.'
                    : 'Verify your Aadhaar first; your PAN is then matched with it.'}
                </p>
              )}

              {linkError && (
                <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">{linkError}</span>
                </p>
              )}
            </div>

            {errors.panAadhaar && (
              <p className="text-xs text-red-600 font-medium">{errors.panAadhaar}</p>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            By verifying, you consent to Aadhaar and PAN verification under the Aadhaar Act, 2016 and DPDP Act, 2023.
          </p>

          {/* Step 3 navigation: the account is created on Step 4 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!validateStep3()) return;
                setFormError('');
                setCurrentStep(4);
                window.scrollTo({ top: 80, behavior: 'smooth' });
              }}
              disabled={!aadhaarOtp || !panAadhaarLinked}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-7 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              <span>Next: Shop details</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: SHOP (LIVE PHOTO + LIVE LOCATION) AND REGISTRATION */}
      {/* ============================================================ */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <ShopVerificationStep
            capture={shopCapture}
            onCapture={(next) => {
              setShopCapture(next);
              if (next) setErrors((prev) => { const rest = { ...prev }; delete rest.shop; return rest; });
            }}
            shopName={shopName}
            onShopNameChange={setShopName}
            socialLinks={socialLinks}
            onSocialLinksChange={setSocialLinks}
            error={errors.shop}
          />

          {/* Account password: the last details before the account is created */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">Set your password</h3>
            <p className="mt-0.5 text-xs text-slate-500">You can sign in with this password, or with an email / mobile OTP.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="buyer-password" className="mb-1 block text-xs font-semibold text-slate-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="buyer-password"
                    name="buyer_new_password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((prev) => { const next = { ...prev }; delete next.password; return next; }); }}
                    aria-invalid={Boolean(errors.password)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${errors.password ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs font-medium text-red-600">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor="buyer-confirm-password" className="mb-1 block text-xs font-semibold text-slate-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="buyer-confirm-password"
                  name="buyer_confirm_password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => { const next = { ...prev }; delete next.confirmPassword; return next; }); }}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${errors.confirmPassword ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-emerald-600'}`}
                />
                {errors.confirmPassword && <p className="mt-1 text-xs font-medium text-red-600">{errors.confirmPassword}</p>}
              </div>
            </div>
            <PasswordValidationIndicator password={password} confirmPassword={confirmPassword} showConfirmMatch />
          </div>

          {/* Terms & Conditions: accepted where the account is created */}
          {(
            <div>
              <label className="flex cursor-pointer select-none items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    if (e.target.checked) setErrors((prev) => { const next = { ...prev }; delete next.agreeTerms; return next; });
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span className="text-xs text-slate-700">
                  I have read and agree to TradeExpress{' '}
                  <Link to="/terms" target="_blank" className="font-semibold text-emerald-800 hover:underline">Terms &amp; Conditions</Link>.
                </span>
              </label>
              {errors.agreeTerms && <p className="mt-1 text-xs font-medium text-red-600">{errors.agreeTerms}</p>}
            </div>
          )}

          {/* Final Navigation & Submit */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy || !aadhaarVerified || !panVerified || !shopCapture || !passwordReady || !agreeTerms}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-7 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Creating Buyer Account...</span>
                </>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  <span>Complete Buyer Registration</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
