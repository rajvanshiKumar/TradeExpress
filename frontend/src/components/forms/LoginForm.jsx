import { useState, useEffect, useRef, startTransition } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Mail,
  Lock,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  Search,
  ArrowRight,
  Check,
} from "lucide-react";
import Button from "../common/Button";
import useAuth from "../../hooks/useAuth";
import useNotifications from "../../hooks/useNotifications";
import { ROLE_HOME, COUNTRIES, COUNTRY_PHONE_RULES } from "../../utils/constants";
import {
  focusFirstError,
  hasErrors,
  normalizeEmail,
  parseMobile,
  rules,
  validate,
} from "../../utils/validators";
import { authFetch } from "../../api/authClient";

const ROLE_NAMES = {
  buyer: "Buyer",
  supplier: "Supplier",
  admin: "Admin",
  super_admin: "Super Admin",
};

const adminSchema = {
  email: [rules.required("Admin Email"), rules.email()],
  password: [rules.required("Password")],
};

const emailRegex = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

// Deduplicated list of country dial codes (strictly dial codes only, no country name or short code)
const UNIQUE_DIAL_OPTIONS = (() => {
  const seen = new Set();
  const list = [];
  for (const c of COUNTRIES) {
    const dial = COUNTRY_PHONE_RULES[c]?.dial;
    if (dial && !seen.has(dial)) {
      seen.add(dial);
      list.push({ country: c, dial });
    }
  }
  return list;
})();

/**
 * Enterprise B2B Sign-in form.
 * Fast, production-ready OTP authentication for Buyers & Suppliers:
 * 1. Email OTP (Default, 6-digit box code)
 * 2. Mobile OTP (6-digit box code)
 * 3. Connecting to Google (Google OAuth)
 * 4. Dedicated Admin / Super Admin console sign-in.
 * 
 * Strict requirement: All input boxes start totally blank by default with no pre-filled or dummy values.
 */
export default function LoginForm({ mode = "member", role = null, adminType = "admin" }) {
  const isAdmin = mode === "admin";
  const { loginMobile, loginEmailOtp, loginAdmin, isAdminConfigured } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Primary login method for public members: 'email' (Email OTP) | 'mobile' (Mobile OTP)
  const [loginMethod, setLoginMethod] = useState("email");

  // Form field state strictly initialized to blank empty strings
  const [values, setValues] = useState({
    email: "",
    password: "",
    country: "India",
    phone: "",
    rememberMe: true,
  });

  // 6 separate OTP box digits for Email and Mobile OTP
  const [emailOtpDigits, setEmailOtpDigits] = useState(["", "", "", "", "", ""]);
  const [mobileOtpDigits, setMobileOtpDigits] = useState(["", "", "", "", "", ""]);

  const emailOtpRefs = useRef([]);
  const mobileOtpRefs = useRef([]);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Mobile OTP state
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [sendingMobileOtp, setSendingMobileOtp] = useState(false);
  const [mobileCooldown, setMobileCooldown] = useState(0);

  // Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState("");

  // Custom Country Code Dropdown state
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef(null);

  const prefix = isAdmin ? "admin-login-" : "login-";

  // Reset form inputs & OTP states when role or login method changes
  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      email: "",
      password: "",
      phone: "",
    }));
    setEmailOtpDigits(["", "", "", "", "", ""]);
    setMobileOtpDigits(["", "", "", "", "", ""]);
    setEmailOtpSent(false);
    setMobileOtpSent(false);
    setErrors({});
    setFormError("");
  }, [role, loginMethod]);

  // Click outside and ESC listener for country dropdown
  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
        setCountryDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setCountryDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [countryDropdownOpen]);

  // Email OTP countdown timer
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Mobile OTP cooldown countdown timer
  useEffect(() => {
    if (mobileCooldown <= 0) return;
    const timer = setInterval(() => {
      setMobileCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [mobileCooldown]);

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    setFormError("");
  };

  /** Prevents non-numeric / alphabet keys when typing mobile number */
  const handlePhoneKeyDown = (e) => {
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Tab" ||
      e.key === "Enter" ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    // Strictly prevent alphabets and any non-digit character
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  /** Strips all alphabet / non-numeric characters from mobile number */
  const handlePhoneChange = (e) => {
    const onlyDigits = e.target.value.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, phone: onlyDigits }));
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: "" }));
    }
    setFormError("");
  };

  /** Handles OTP box change (digits 0..5), auto-advancing on input */
  const handleOtpBoxChange = (method, index, val) => {
    const raw = val.replace(/\D/g, "");
    const current = method === "email" ? [...emailOtpDigits] : [...mobileOtpDigits];
    const setDigits = method === "email" ? setEmailOtpDigits : setMobileOtpDigits;
    const refs = method === "email" ? emailOtpRefs : mobileOtpRefs;
    const otpErrorKey = method === "email" ? "emailOtp" : "mobileOtp";

    if (errors[otpErrorKey]) {
      setErrors((prev) => ({ ...prev, [otpErrorKey]: "" }));
    }
    setFormError("");

    if (!raw) {
      current[index] = "";
      setDigits(current);
      return;
    }

    if (raw.length > 1) {
      // Pasted or multi-digit input
      const chars = raw.slice(0, 6).split("");
      chars.forEach((c, i) => {
        if (index + i < 6) current[index + i] = c;
      });
      setDigits(current);
      const nextIdx = Math.min(5, index + chars.length);
      refs.current[nextIdx]?.focus();
      return;
    }

    current[index] = raw[0];
    setDigits(current);

    if (index < 5 && raw[0]) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpBoxKeyDown = (method, index, e) => {
    const current = method === "email" ? emailOtpDigits : mobileOtpDigits;
    const refs = method === "email" ? emailOtpRefs : mobileOtpRefs;

    if (e.key === "Backspace" && !current[index] && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (method === "email") {
        handleVerifyEmailOtp();
      } else {
        handleVerifyMobileOtp();
      }
    }
  };

  const handleOtpBoxPaste = (method, e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const current = Array(6).fill("");
    const chars = pasted.split("");
    chars.forEach((c, i) => {
      current[i] = c;
    });
    const setDigits = method === "email" ? setEmailOtpDigits : setMobileOtpDigits;
    const refs = method === "email" ? emailOtpRefs : mobileOtpRefs;
    const otpErrorKey = method === "email" ? "emailOtp" : "mobileOtp";

    setDigits(current);
    if (errors[otpErrorKey]) {
      setErrors((prev) => ({ ...prev, [otpErrorKey]: "" }));
    }
    setFormError("");

    const focusIdx = Math.min(5, chars.length);
    refs.current[focusIdx]?.focus();
  };

  /** Sends 6-digit email OTP for Buyer & Supplier sign-in */
  const handleSendEmailOtp = async () => {
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail) {
      setErrors((prev) => ({ ...prev, email: "Email address is required." }));
      return;
    }
    if (!emailRegex.test(cleanEmail)) {
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email address." }));
      return;
    }

    setSendingEmailOtp(true);
    setFormError("");
    setErrors((prev) => ({ ...prev, email: "", emailOtp: "" }));

    try {
      const res = await authFetch("/auth/send-email-otp", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          role: role ? role.toUpperCase() : undefined,
        }),
      });

      if (!res.ok || !res.data?.success) {
        setFormError(res.data?.message || res.error || "Failed to dispatch email verification code.");
      } else {
        setEmailOtpSent(true);
        setEmailCooldown(res.data?.cooldownSeconds || 30);
        setEmailOtpDigits(["", "", "", "", "", ""]);
        showToast("Verification code dispatched to your email address.");
        setTimeout(() => emailOtpRefs.current[0]?.focus(), 150);
      }
    } catch (err) {
      setFormError(err?.message || "Unable to contact authentication server. Please check your connection.");
    } finally {
      setSendingEmailOtp(false);
    }
  };

  /** Sends real SMS OTP to the entered mobile number */
  const handleSendMobileOtp = async () => {
    const rawPhone = values.phone.trim();
    if (!rawPhone) {
      setErrors((prev) => ({ ...prev, phone: "Mobile number is required." }));
      return;
    }
    const parsed = parseMobile(rawPhone, values.country);
    if (!parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: "Enter a valid mobile number.",
      }));
      return;
    }

    setSendingMobileOtp(true);
    setFormError("");
    setErrors((prev) => ({ ...prev, phone: "", mobileOtp: "" }));

    try {
      const res = await authFetch("/auth/send-mobile-login-otp", {
        method: "POST",
        body: JSON.stringify({
          phone: rawPhone,
          country: values.country,
          role: role ? role.toUpperCase() : undefined,
        }),
      });

      if (!res.ok || !res.data?.success) {
        setFormError(res.data?.message || res.error || "Failed to dispatch SMS verification code.");
      } else {
        setMobileOtpSent(true);
        setMobileCooldown(res.data?.cooldownSeconds || 30);
        setMobileOtpDigits(["", "", "", "", "", ""]);
        showToast("Verification code dispatched to your mobile number.");
        setTimeout(() => mobileOtpRefs.current[0]?.focus(), 150);
      }
    } catch (err) {
      setFormError(err?.message || "Unable to contact authentication server. Please check your connection.");
    } finally {
      setSendingMobileOtp(false);
    }
  };

  const handlePostAuthNavigation = (authUser) => {
    showToast(`Welcome back, ${authUser.name}! Signed in successfully.`);
    const from = location.state?.from;
    const isLoginPath = from && (from.includes("/login") || from.includes("/sign-in"));
    const allowed =
      from &&
      !isLoginPath &&
      (authUser.role === "admin"
        ? from.startsWith("/admin") || from === "/messages"
        : authUser.role === "super_admin"
        ? from.startsWith("/super-admin") || from.startsWith("/admin") || from === "/messages"
        : !from.startsWith("/admin") && !from.startsWith("/super-admin"));

    const targetHome = ROLE_HOME[authUser.role] || (authUser.role === "supplier" ? "/supplier" : "/buyer");
    startTransition(() => {
      navigate(allowed ? from : targetHome, { replace: true });
    });
  };

  /** Fast verification and sign-in via Email OTP */
  const handleVerifyEmailOtp = async () => {
    const cleanEmail = normalizeEmail(values.email);
    const otpCode = emailOtpDigits.join("").trim();
    if (!cleanEmail) {
      setErrors((prev) => ({ ...prev, email: "Email address is required." }));
      return;
    }
    if (otpCode.length < 6) {
      setErrors((prev) => ({ ...prev, emailOtp: "Please enter all 6 digits of the verification code." }));
      return;
    }

    setBusy(true);
    setFormError("");
    setErrors({});

    const result = await loginEmailOtp({
      email: cleanEmail,
      otp: otpCode,
      role,
    });
    setBusy(false);

    if (!result.ok) {
      setFormError(result.error || "Invalid or expired verification code. Please try again.");
      return;
    }

    handlePostAuthNavigation(result.user);
  };

  /** Fast verification and sign-in via Mobile OTP */
  const handleVerifyMobileOtp = async () => {
    const rawPhone = values.phone.trim();
    const otpCode = mobileOtpDigits.join("").trim();
    if (!rawPhone) {
      setErrors((prev) => ({ ...prev, phone: "Mobile number is required." }));
      return;
    }
    if (otpCode.length < 6) {
      setErrors((prev) => ({ ...prev, mobileOtp: "Please enter all 6 digits of the verification code." }));
      return;
    }

    setBusy(true);
    setFormError("");
    setErrors({});

    const result = await loginMobile({
      phone: rawPhone,
      country: values.country,
      otp: otpCode,
      role,
    });
    setBusy(false);

    if (!result.ok) {
      setFormError(result.error || "Mobile sign-in failed. Please verify your OTP code.");
      return;
    }

    handlePostAuthNavigation(result.user);
  };

  /** Google Sign-in Handler */
  const handleGoogleSignIn = async () => {
    // Check if Google Sign-In is already initialized in window
    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      try {
        setGoogleLoading(true);
        window.google.accounts.id.prompt();
        return;
      } catch {
        setGoogleLoading(false);
      }
    }
    // Open clean Google OAuth dialog
    setGoogleEmailInput(values.email || "");
    setShowGoogleModal(true);
  };

  const handleConfirmGoogleAuth = async (e) => {
    if (e) e.preventDefault();
    const gEmail = normalizeEmail(googleEmailInput);
    if (!gEmail || !emailRegex.test(gEmail)) {
      showToast("Enter a valid Google email address.", "error");
      return;
    }

    setGoogleLoading(true);
    try {
      const res = await authFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          email: gEmail,
          name: gEmail.split("@")[0],
          googleId: `gid_${Date.now()}`,
        }),
      });

      if (!res.ok || !res.data?.success) {
        setFormError(res.data?.message || res.error || "Google sign-in failed.");
        setShowGoogleModal(false);
        return;
      }

      const googleData = res.data?.data;
      if (googleData?.token && googleData?.user) {
        // Existing user account -> log them in
        localStorage.setItem("tradeexpress_auth_token", googleData.token);
        localStorage.setItem("tradesphere_auth_token", googleData.token);
        setShowGoogleModal(false);
        handlePostAuthNavigation(googleData.user);
        return;
      }

      // If new account, redirect to registration
      setShowGoogleModal(false);
      showToast("No account found with this Google email. Redirecting to registration...", "info");
      navigate(role === "supplier" ? "/supplier/register" : "/buyer/register", {
        state: { email: gEmail, name: googleData?.name || gEmail.split("@")[0], verified: true },
      });
    } catch (err) {
      setFormError(err?.message || "Google sign-in error.");
    } finally {
      setGoogleLoading(false);
    }
  };

  /** Admin / Super Admin console sign-in */
  const handleAdminLogin = async () => {
    const found = validate(adminSchema, values);
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(found, prefix);
      return;
    }
    setBusy(true);
    const result = await loginAdmin(normalizeEmail(values.email), values.password);
    setBusy(false);
    if (!result.ok) {
      setValues((prev) => ({ ...prev, password: "" }));
      setFormError(result.error || "Invalid admin credentials.");
      return;
    }
    handlePostAuthNavigation(result.user);
  };

  /** Master submit router */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");

    if (isAdmin) {
      return handleAdminLogin();
    }

    if (loginMethod === "email") {
      if (!emailOtpSent) {
        return handleSendEmailOtp();
      }
      return handleVerifyEmailOtp();
    }

    if (loginMethod === "mobile") {
      if (!mobileOtpSent) {
        return handleSendMobileOtp();
      }
      return handleVerifyMobileOtp();
    }
  };

  const emailOtpComplete = emailOtpDigits.join("").trim().length === 6;
  const mobileOtpComplete = mobileOtpDigits.join("").trim().length === 6;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
      className="space-y-4"
      aria-busy={busy || undefined}
    >
      {/* Invisible decoy inputs to strictly suppress browser password managers from auto-filling */}
      <div
        style={{
          position: "absolute",
          top: -9999,
          left: -9999,
          opacity: 0,
          height: 0,
          width: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <input type="text" name="decoy_user_field" tabIndex={-1} readOnly autoComplete="new-password" />
        <input type="password" name="decoy_pass_field" tabIndex={-1} readOnly autoComplete="new-password" />
      </div>

      {isAdmin && !isAdminConfigured ? (
        <p
          role="status"
          className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-800"
        >
          Admin sign-in is not configured for this site yet.
        </p>
      ) : null}

      {/* Login Method Switcher for Public Members (Email OTP vs Mobile OTP) */}
      {!isAdmin ? (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("email");
                setFormError("");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                loginMethod === "email"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mail className="h-4 w-4 text-emerald-700" />
              <span>Email OTP</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginMethod("mobile");
                setFormError("");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                loginMethod === "mobile"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="h-4 w-4 text-emerald-700" />
              <span>Mobile OTP</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Global Form Error Message */}
      {formError ? (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2.5 animate-in fade-in duration-200"
        >
          <CircleAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{formError}</p>
            {formError.toLowerCase().includes("no account found") && (
              <p className="text-[11px] text-red-700">
                Don't have an account yet?{" "}
                <Link
                  to={role === "supplier" ? "/supplier/register" : "/buyer/register"}
                  className="font-bold underline text-red-900 hover:text-red-950"
                >
                  Sign up as {role === "supplier" ? "Supplier" : "Buyer"} now
                </Link>
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* ADMIN SIGN-IN FIELDS */}
      {isAdmin ? (
        <>
          <div>
            <label htmlFor={`${prefix}email`} className="block text-xs font-semibold text-slate-800 mb-1.5">
              Admin Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id={`${prefix}email`}
                type="email"
                required
                autoComplete="off"
                placeholder=""
                value={values.email}
                onChange={handleChange("email")}
                className={`w-full rounded-xl border bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 transition focus:outline-none focus:ring-2 ${
                  errors.email
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                }`}
                aria-invalid={errors.email ? "true" : undefined}
              />
            </div>
            {errors.email ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {errors.email}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${prefix}password`} className="block text-xs font-semibold text-slate-800">
                Password <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id={`${prefix}password`}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="off"
                placeholder=""
                value={values.password}
                onChange={handleChange("password")}
                className={`w-full rounded-xl border bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 transition focus:outline-none focus:ring-2 ${
                  errors.password
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                }`}
                aria-invalid={errors.password ? "true" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {errors.password}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {/* 1. PUBLIC MEMBER EMAIL OTP FLOW (FAST, VERIFIED, TOTALLY BLANK INPUTS) */}
      {!isAdmin && loginMethod === "email" ? (
        <div className="space-y-3.5">
          <div>
            <label htmlFor={`${prefix}email`} className="block text-xs font-semibold text-slate-800 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id={`${prefix}email`}
                type="email"
                required
                autoComplete="off"
                name="user_email_address"
                placeholder=""
                value={values.email}
                onChange={handleChange("email")}
                className={`w-full rounded-xl border bg-white pl-10 pr-28 sm:pr-32 py-2.5 text-sm text-slate-900 transition focus:outline-none focus:ring-2 ${
                  errors.email
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                }`}
                aria-invalid={errors.email ? "true" : undefined}
              />

              {/* Get OTP / Resend Button Sitting Directly Inside The Input Field */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={sendingEmailOtp || emailCooldown > 0 || !values.email.trim()}
                  className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {sendingEmailOtp ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                  {emailCooldown > 0
                    ? `Resend (${emailCooldown}s)`
                    : emailOtpSent
                    ? "Resend"
                    : "Get OTP"}
                </button>
              </div>
            </div>
            {errors.email ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {errors.email}
              </p>
            ) : null}
          </div>

          {/* 6-DIGIT OTP INPUT SECTION (APPEARS SMOOTHLY BELOW EMAIL ONCE OTP SENT) */}
          {emailOtpSent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  Verification code sent to your email
                </span>
                <span className="text-slate-500 text-[11px]">Valid 10 mins</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Enter 6-Digit OTP Code <span className="text-red-500">*</span>
                </label>

                {/* 6 Separate OTP Boxes in a Row */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {emailOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (emailOtpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      autoComplete="off"
                      placeholder=""
                      value={digit}
                      onChange={(e) => handleOtpBoxChange("email", idx, e.target.value)}
                      onKeyDown={(e) => handleOtpBoxKeyDown("email", idx, e)}
                      onPaste={(e) => handleOtpBoxPaste("email", e)}
                      className={`w-10 h-12 sm:w-12 sm:h-13 text-center text-xl font-bold font-mono rounded-xl border transition outline-none ${
                        digit
                          ? "border-emerald-700 bg-white text-emerald-950 ring-2 ring-emerald-600/30 font-black"
                          : "border-slate-300 bg-white text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20"
                      }`}
                    />
                  ))}
                </div>

                {errors.emailOtp ? (
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600">
                    <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                    {errors.emailOtp}
                  </p>
                ) : null}
              </div>

              {/* Resend Link and Status */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-slate-600 text-[11px]">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={emailCooldown > 0 || sendingEmailOtp}
                  className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline disabled:text-slate-400 cursor-pointer"
                >
                  {emailCooldown > 0 ? `Resend OTP in ${emailCooldown}s` : "Resend OTP"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2. PUBLIC MEMBER MOBILE OTP FLOW (FAST, VERIFIED, TOTALLY BLANK INPUTS) */}
      {!isAdmin && loginMethod === "mobile" ? (
        <div className="space-y-3.5">
          <div>
            <label htmlFor={`${prefix}mobile`} className="block text-xs font-semibold text-slate-800 mb-1.5">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {/* Compact Country Code Dropdown Trigger (Code only, no country name, no short country name) */}
              <div className="relative shrink-0" ref={countryDropdownRef}>
                <button
                  id={`${prefix}country-trigger`}
                  type="button"
                  onClick={() => setCountryDropdownOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={countryDropdownOpen}
                  title={`+${COUNTRY_PHONE_RULES[values.country]?.dial || '91'}`}
                  className="h-10 w-[64px] sm:w-[70px] rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 flex items-center justify-between gap-1 transition-all cursor-pointer"
                >
                  <span className="font-bold text-slate-900">
                    +{COUNTRY_PHONE_RULES[values.country]?.dial || "91"}
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 text-slate-500 transition-transform ${
                      countryDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Country Dropdown Menu (Only country codes, NO country name, NO short name) */}
                {countryDropdownOpen ? (
                  <div
                    role="listbox"
                    className="absolute left-0 top-full mt-1.5 z-50 w-28 max-h-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="p-1.5 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value.replace(/\D/g, ""))}
                          placeholder=""
                          className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48 p-1 divide-y divide-slate-50">
                      {UNIQUE_DIAL_OPTIONS.filter((item) => {
                        const q = countrySearch.trim();
                        if (!q) return true;
                        return item.dial.includes(q);
                      }).map((item) => {
                        const rule = COUNTRY_PHONE_RULES[item.country];
                        const isSelected = COUNTRY_PHONE_RULES[values.country]?.dial === item.dial;
                        return (
                          <button
                            key={item.dial}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setValues((prev) => ({ ...prev, country: item.country }));
                              setCountryDropdownOpen(false);
                              setCountrySearch("");
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-emerald-50 text-emerald-950 font-bold"
                                : "text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            <span className="font-mono text-xs font-bold text-slate-800">
                              +{rule?.dial}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Mobile Number Input with Get OTP button Sitting Directly Inside The Input Field */}
              <div className="relative flex-1 min-w-0 flex items-center">
                <input
                  id={`${prefix}mobile`}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  required
                  autoComplete="off"
                  name="user_mobile_number"
                  placeholder=""
                  value={values.phone}
                  onChange={handlePhoneChange}
                  onKeyDown={handlePhoneKeyDown}
                  className={`w-full rounded-xl border bg-white px-3.5 pr-28 sm:pr-32 py-2.5 text-sm text-slate-900 transition focus:outline-none focus:ring-2 ${
                    errors.phone
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                  }`}
                  aria-invalid={errors.phone ? "true" : undefined}
                />

                {/* Get OTP / Resend Button Sitting Directly Inside Mobile Input Field */}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    disabled={sendingMobileOtp || mobileCooldown > 0 || !values.phone.trim()}
                    className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {sendingMobileOtp ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                    {mobileCooldown > 0
                      ? `Resend (${mobileCooldown}s)`
                      : mobileOtpSent
                      ? "Resend"
                      : "Get OTP"}
                  </button>
                </div>
              </div>
            </div>
            {errors.phone ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {errors.phone}
              </p>
            ) : null}
          </div>

          {/* 6-DIGIT OTP INPUT SECTION (APPEARS SMOOTHLY BELOW PHONE ONCE OTP SENT) */}
          {mobileOtpSent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  SMS verification code dispatched
                </span>
                <span className="text-slate-500 text-[11px]">Valid 10 mins</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Enter 6-Digit OTP Code <span className="text-red-500">*</span>
                </label>

                {/* 6 Separate OTP Boxes in a Row */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {mobileOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (mobileOtpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      autoComplete="off"
                      placeholder=""
                      value={digit}
                      onChange={(e) => handleOtpBoxChange("mobile", idx, e.target.value)}
                      onKeyDown={(e) => handleOtpBoxKeyDown("mobile", idx, e)}
                      onPaste={(e) => handleOtpBoxPaste("mobile", e)}
                      className={`w-10 h-12 sm:w-12 sm:h-13 text-center text-xl font-bold font-mono rounded-xl border transition outline-none ${
                        digit
                          ? "border-emerald-700 bg-white text-emerald-950 ring-2 ring-emerald-600/30 font-black"
                          : "border-slate-300 bg-white text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20"
                      }`}
                    />
                  ))}
                </div>

                {errors.mobileOtp ? (
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600">
                    <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                    {errors.mobileOtp}
                  </p>
                ) : null}
              </div>

              {/* Resend Link and Status */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-slate-600 text-[11px]">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleSendMobileOtp}
                  disabled={mobileCooldown > 0 || sendingMobileOtp}
                  className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline disabled:text-slate-400 cursor-pointer"
                >
                  {mobileCooldown > 0 ? `Resend OTP in ${mobileCooldown}s` : "Resend OTP"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Verify & Login Button (Shown ONLY when OTP code has been sent) */}
      {!isAdmin && (emailOtpSent || mobileOtpSent) ? (
        <div className="pt-2">
          <Button
            type="submit"
            full
            size="lg"
            icon={Check}
            loading={busy}
            disabled={
              (loginMethod === "email" && !emailOtpComplete) ||
              (loginMethod === "mobile" && !mobileOtpComplete) ||
              busy
            }
            className="!bg-emerald-700 hover:!bg-emerald-800 !text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Verifying & logging in..." : "Verify & Login"}
          </Button>
        </div>
      ) : null}

      {/* Admin Login Submit Button */}
      {isAdmin ? (
        <div className="pt-2">
          <Button
            type="submit"
            full
            size="lg"
            icon={ShieldCheck}
            loading={busy}
            disabled={busy}
            className="!bg-emerald-700 hover:!bg-emerald-800 !text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50"
          >
            {busy
              ? "Verifying credentials..."
              : adminType === "super_admin"
              ? "Login as Super Admin"
              : "Login as Admin"}
          </Button>
        </div>
      ) : null}

      {/* Connecting to Google (Google OAuth Button) for Public Members */}
      {!isAdmin ? (
        <div className="space-y-3 pt-1">
          <div className="relative my-3 flex items-center justify-center">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              OR
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            {googleLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Connecting to Google</span>
              </>
            )}
          </button>
        </div>
      ) : null}

      {/* Account Registration Link */}
      {!isAdmin ? (
        <div className="pt-3 border-t border-slate-100 text-center space-y-2">
          <p className="text-xs text-slate-600">
            {role === "supplier"
              ? "New supplier on TradeExpress?"
              : role === "buyer"
              ? "New buyer on TradeExpress?"
              : "Don't have an account yet?"}
          </p>
          <div className="flex items-center justify-center gap-3 text-xs">
            {role === "supplier" ? (
              <Link
                to="/supplier/register"
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <span>Sign up as Supplier</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : role === "buyer" ? (
              <Link
                to="/buyer/register"
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <span>Sign up as Buyer</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <>
                <Link
                  to="/buyer/register"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <span>Sign up as Buyer</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <span className="text-slate-300">|</span>
                <Link
                  to="/supplier/register"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <span>Sign up as Supplier</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Google OAuth Dialog Modal for Development / Prompt */}
      {showGoogleModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-bold text-slate-800 text-sm">Login with Google</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Login with your Google Account to access TradeExpress.
            </p>
            <form onSubmit={handleConfirmGoogleAuth} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Google Email</label>
                <input
                  type="email"
                  required
                  placeholder=""
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="flex-1 rounded-xl bg-emerald-800 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {googleLoading ? "Connecting..." : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </form>
  );
}
