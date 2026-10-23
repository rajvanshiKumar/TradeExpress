import { useState, useEffect, useRef, startTransition } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Mail,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  Search,
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
  mobileExample,
  rules,
  validate,
} from "../../utils/validators";

const COUNTRY_FLAGS = {
  India: "🇮🇳",
  "United States": "🇺🇸",
  Canada: "🇨🇦",
  "United Kingdom": "🇬🇧",
  "United Arab Emirates": "🇦🇪",
  "Saudi Arabia": "🇸🇦",
  Singapore: "🇸🇬",
  Australia: "🇦🇺",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  Netherlands: "🇳🇱",
  "South Africa": "🇿🇦",
  Brazil: "🇧🇷",
  Mexico: "🇲🇽",
  Japan: "🇯🇵",
  "South Korea": "🇰🇷",
  China: "🇨🇳",
  Vietnam: "🇻🇳",
  Bangladesh: "🇧🇩",
  "Türkiye": "🇹🇷",
  Kenya: "🇰🇪",
  Nigeria: "🇳🇬",
};

const ROLE_NAMES = {
  buyer: "Buyer",
  supplier: "Supplier",
  admin: "Admin",
  super_admin: "Super Admin",
};

const adminSchema = {
  email: [rules.required("Email"), rules.email()],
  password: [rules.required("Password")],
};

/**
 * Sign-in form. `mode="admin"` signs in against the dedicated Super Admin console at /super-admin/login;
 * the default mode signs in public Buyers and Suppliers using either Email (with OTP + password)
 * or Mobile (with SMS OTP).
 */
export default function LoginForm({ mode = "member", role = null, adminType = "admin" }) {
  const isAdmin = mode === "admin";
  const { login, loginMobile, loginAdmin, isAdminConfigured } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Login method toggle for public members: 'email' | 'mobile'
  const [loginMethod, setLoginMethod] = useState("email");

  const [values, setValues] = useState({
    email: "",
    password: "",
    emailOtp: "",
    country: "India",
    phone: "",
    mobileOtp: "",
  });
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

  // Custom Country Code Dropdown state
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef(null);

  const prefix = isAdmin ? "admin-login-" : "login-";

  // Ensure all credentials are fully blank on mount or role/method change
  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      email: "",
      password: "",
      emailOtp: "",
      phone: "",
      mobileOtp: "",
    }));
    setErrors({});
    setFormError("");
  }, [role, loginMethod]);

  // Click outside and ESC key listener for country dropdown
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

  // Cooldown countdown timers
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (mobileCooldown <= 0) return;
    const timer = setInterval(() => {
      setMobileCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [mobileCooldown]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
    setFormError("");
  };

  /** Sends real OTP to the entered email */
  const handleSendEmailOtp = async () => {
    const clean = normalizeEmail(values.email);
    if (!clean || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(clean)) {
      setErrors((prev) => ({
        ...prev,
        email: "Please enter a valid email address first.",
      }));
      return;
    }

    setSendingEmailOtp(true);
    setFormError("");
    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/auth/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: clean,
          role: role ? role.toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.message || "Failed to dispatch email verification code.");
      } else {
        setEmailOtpSent(true);
        setEmailCooldown(data.cooldownSeconds || 60);
        showToast("Verification code dispatched to your email inbox.");
      }
    } catch {
      setFormError("Unable to contact authentication server. Please check your connection.");
    } finally {
      setSendingEmailOtp(false);
    }
  };

  /** Sends real SMS OTP to the entered mobile number */
  const handleSendMobileOtp = async () => {
    const parsed = parseMobile(values.phone, values.country);
    if (!parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: `Enter a valid ${values.country} mobile number.`,
      }));
      return;
    }

    setSendingMobileOtp(true);
    setFormError("");
    try {
      const baseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/auth/send-mobile-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          phone: values.phone,
          country: values.country,
          role: role ? role.toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.message || "Failed to dispatch SMS verification code.");
      } else {
        setMobileOtpSent(true);
        setMobileCooldown(data.cooldownSeconds || 60);
        showToast("Verification code dispatched to your mobile number.");
      }
    } catch {
      setFormError("Unable to contact authentication server. Please check your connection.");
    } finally {
      setSendingMobileOtp(false);
    }
  };

  const handlePostAuthNavigation = (authUser) => {
    showToast(
      `Signed in as ${authUser.name} (${ROLE_NAMES[authUser.role] || authUser.role}).`
    );
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

    startTransition(() => {
      navigate(allowed ? from : (ROLE_HOME[authUser.role] || "/"), { replace: true });
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    if (isAdmin) {
      // Super Admin form validation
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
        setValues((previous) => ({ ...previous, password: "" }));
        setFormError(result.error);
        return;
      }
      handlePostAuthNavigation(result.user);
      return;
    }

    // Public Buyer/Supplier login flows
    if (loginMethod === "email") {
      const fieldErrors = {};
      const cleanEmail = normalizeEmail(values.email);
      if (!cleanEmail) {
        fieldErrors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
        fieldErrors.email = "Enter a valid email address.";
      }

      const cleanOtp = values.emailOtp.trim();
      if (!cleanOtp) {
        fieldErrors.emailOtp = "Email verification code is required. Click 'Send OTP' and enter the 6-digit code.";
      } else if (cleanOtp.length !== 6) {
        fieldErrors.emailOtp = "Please enter the 6-digit verification code.";
      }

      if (!values.password) {
        fieldErrors.password = "Password is required.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setBusy(true);
      const result = await login(cleanEmail, values.password, role, { otp: cleanOtp });
      setBusy(false);
      if (!result.ok) {
        setValues((previous) => ({ ...previous, password: "" }));
        setFormError(result.error);
        return;
      }
      handlePostAuthNavigation(result.user);
    } else {
      // Mobile login flow
      const fieldErrors = {};
      const parsed = parseMobile(values.phone, values.country);
      if (!values.phone) {
        fieldErrors.phone = "Mobile number is required.";
      } else if (!parsed.ok) {
        fieldErrors.phone = `Enter a valid ${values.country} mobile number.`;
      }

      const cleanOtp = values.mobileOtp.trim();
      if (!cleanOtp) {
        fieldErrors.mobileOtp = "Mobile verification code is required. Click 'Send OTP' and enter the 6-digit code.";
      } else if (cleanOtp.length !== 6) {
        fieldErrors.mobileOtp = "Please enter the 6-digit verification code.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setBusy(true);
      const result = await loginMobile({
        phone: values.phone,
        country: values.country,
        otp: cleanOtp,
        role,
      });
      setBusy(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      handlePostAuthNavigation(result.user);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      autoComplete="off"
      className="space-y-4"
      aria-busy={busy || undefined}
    >
      {isAdmin && !isAdminConfigured ? (
        <p
          role="status"
          className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning"
        >
          Admin sign-in is not configured for this site yet.
        </p>
      ) : null}

      {/* Login Method Switcher (Styled like the Sign Up / Get Started Buyer and Supplier buttons) */}
      {!isAdmin ? (
        <div className="mb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("email");
                setFormError("");
              }}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                loginMethod === "email"
                  ? "border-brand-500 bg-brand-50"
                  : "border-navy-200 bg-white hover:border-navy-300"
              }`}
            >
              <span
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  loginMethod === "email"
                    ? "bg-brand-500 text-navy-900"
                    : "bg-navy-50 text-navy-800"
                }`}
              >
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-navy-900">Sign in with Email</span>
                <span className="block text-xs text-muted">Email OTP &amp; password</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginMethod("mobile");
                setFormError("");
              }}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                loginMethod === "mobile"
                  ? "border-brand-500 bg-brand-50"
                  : "border-navy-200 bg-white hover:border-navy-300"
              }`}
            >
              <span
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  loginMethod === "mobile"
                    ? "bg-brand-500 text-navy-900"
                    : "bg-navy-50 text-navy-800"
                }`}
              >
                <Smartphone className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-navy-900">Sign in with Mobile</span>
                <span className="block text-xs text-muted">Instant mobile OTP</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-danger-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {formError}
        </p>
      ) : null}

      {/* ADMIN SIGN-IN FIELDS */}
      {isAdmin ? (
        <>
          <div>
            <label htmlFor={`${prefix}email`} className="ts-label">
              Admin Email <span className="text-danger">*</span>
            </label>
            <input
              id={`${prefix}email`}
              type="email"
              required
              autoComplete="off"
              value={values.email}
              onChange={set("email")}
              className="ts-input"
              aria-invalid={errors.email ? "true" : undefined}
            />
            {errors.email ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.email}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${prefix}password`} className="ts-label !mb-0">
                Password <span className="text-danger">*</span>
              </label>
            </div>
            <div className="relative">
              <input
                id={`${prefix}password`}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={values.password}
                onChange={set("password")}
                className="ts-input pr-10"
                aria-invalid={errors.password ? "true" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.password}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {/* PUBLIC EMAIL LOGIN FLOW */}
      {!isAdmin && loginMethod === "email" ? (
        <>
          {/* Email + Send OTP Action */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${prefix}email`} className="ts-label !mb-0">
                Email Address <span className="text-danger">*</span>
              </label>
              {emailOtpSent ? (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                  Code sent
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <input
                id={`${prefix}email`}
                type="email"
                required
                autoComplete="off"
                name={`ts_auth_email_${role || 'user'}`}
                data-lpignore="true"
                data-form-type="other"
                value={values.email}
                onChange={set("email")}
                className="ts-input flex-1"
                aria-invalid={errors.email ? "true" : undefined}
              />
              <button
                type="button"
                onClick={handleSendEmailOtp}
                disabled={sendingEmailOtp || emailCooldown > 0}
                className="shrink-0 px-3.5 sm:px-4 py-2 rounded-lg bg-navy-900 text-white text-xs sm:text-sm font-semibold hover:bg-navy-800 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {sendingEmailOtp ? (
                  <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {emailCooldown > 0
                  ? `Resend in ${emailCooldown}s`
                  : emailOtpSent
                  ? "Resend OTP"
                  : "Send OTP"}
              </button>
            </div>
            {errors.email ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.email}
              </p>
            ) : null}
          </div>

          {/* Email OTP Verification Step */}
          <div>
            <label htmlFor={`${prefix}email-otp`} className="ts-label">
              Email Verification Code (OTP) <span className="text-danger">*</span>
            </label>
            <input
              id={`${prefix}email-otp`}
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              value={values.emailOtp}
              onChange={set("emailOtp")}
              className="ts-input tracking-widest text-center sm:text-left font-mono font-bold"
              aria-invalid={errors.emailOtp ? "true" : undefined}
            />
            {errors.emailOtp ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.emailOtp}
              </p>
            ) : null}
          </div>

          {/* Password Field + FORGET PASSWORD link placed after password field on right side */}
          <div>
            <label htmlFor={`${prefix}password`} className="ts-label">
              Password <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                id={`${prefix}password`}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                name={`ts_auth_password_${role || 'user'}`}
                data-lpignore="true"
                data-form-type="other"
                value={values.password}
                onChange={set("password")}
                className="ts-input pr-10"
                aria-invalid={errors.password ? "true" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.password}
              </p>
            ) : null}
            <div className="mt-2.5 flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-bold uppercase tracking-wider text-brand-600 hover:text-brand-700 hover:underline"
              >
                FORGET PASSWORD
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {/* PUBLIC MOBILE LOGIN FLOW */}
      {!isAdmin && loginMethod === "mobile" ? (
        <>
          {/* Mobile Number + Country selector + Send OTP */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${prefix}mobile`} className="ts-label !mb-0">
                Mobile Number <span className="text-danger">*</span>
              </label>
              {mobileOtpSent ? (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                  Code sent
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {/* Compact Country Code Dropdown Trigger */}
              <div className="relative shrink-0" ref={countryDropdownRef}>
                <button
                  id={`${prefix}country-trigger`}
                  type="button"
                  onClick={() => setCountryDropdownOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={countryDropdownOpen}
                  title={`${values.country} (+${COUNTRY_PHONE_RULES[values.country]?.dial || '91'})`}
                  className="h-10 sm:h-11 w-[84px] sm:w-[90px] rounded-lg border border-navy-900/15 bg-white px-2 py-1 text-xs sm:text-sm font-semibold text-navy-900 shadow-xs hover:border-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 flex items-center justify-between gap-1 transition-all"
                >
                  <span className="flex items-center gap-1 truncate">
                    <span className="text-base shrink-0">
                      {COUNTRY_FLAGS[values.country] || "🌐"}
                    </span>
                    <span className="font-bold text-navy-900">
                      +{COUNTRY_PHONE_RULES[values.country]?.dial || "91"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-3 text-navy-500 transition-transform ${
                      countryDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Sleek Custom Dropdown Menu Anchored Below */}
                {countryDropdownOpen ? (
                  <div
                    role="listbox"
                    className="absolute left-0 top-full mt-1.5 z-50 w-72 max-h-64 overflow-hidden rounded-xl border border-navy-900/10 bg-white shadow-2xl ring-1 ring-black/5 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="p-2 border-b border-navy-100 bg-surface/50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-navy-400" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code..."
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-navy-200 bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48 p-1 divide-y divide-navy-50">
                      {COUNTRIES.filter((c) => {
                        const q = countrySearch.trim().toLowerCase();
                        if (!q) return true;
                        const dial = COUNTRY_PHONE_RULES[c]?.dial || "";
                        return c.toLowerCase().includes(q) || dial.includes(q);
                      }).map((c) => {
                        const rule = COUNTRY_PHONE_RULES[c];
                        const flag = COUNTRY_FLAGS[c] || "🌐";
                        const isSelected = values.country === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setValues((prev) => ({ ...prev, country: c }));
                              setCountryDropdownOpen(false);
                              setCountrySearch("");
                            }}
                            className={`w-full px-2.5 py-2 text-left text-xs sm:text-sm flex items-center justify-between rounded-lg transition-colors ${
                              isSelected
                                ? "bg-brand-50 text-navy-950 font-bold"
                                : "text-navy-800 hover:bg-navy-50"
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
                ) : null}
              </div>

              {/* Spacious Mobile Number Input */}
              <input
                id={`${prefix}mobile`}
                type="tel"
                required
                autoComplete="off"
                name={`ts_auth_phone_${role || 'user'}`}
                data-lpignore="true"
                data-form-type="other"
                value={values.phone}
                onChange={set("phone")}
                className="ts-input flex-1 min-w-0"
                aria-invalid={errors.phone ? "true" : undefined}
              />

              {/* Send OTP button */}
              <button
                type="button"
                onClick={handleSendMobileOtp}
                disabled={sendingMobileOtp || mobileCooldown > 0}
                className="shrink-0 px-3.5 sm:px-4 py-2 rounded-lg bg-navy-900 text-white text-xs sm:text-sm font-semibold hover:bg-navy-800 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {sendingMobileOtp ? (
                  <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {mobileCooldown > 0
                  ? `Resend in ${mobileCooldown}s`
                  : mobileOtpSent
                  ? "Resend OTP"
                  : "Send OTP"}
              </button>
            </div>
            {errors.phone ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.phone}
              </p>
            ) : null}
          </div>

          {/* Mobile OTP Verification Step */}
          <div>
            <label htmlFor={`${prefix}mobile-otp`} className="ts-label">
              Mobile Verification Code (OTP) <span className="text-danger">*</span>
            </label>
            <input
              id={`${prefix}mobile-otp`}
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              value={values.mobileOtp}
              onChange={set("mobileOtp")}
              className="ts-input tracking-widest text-center sm:text-left font-mono font-bold"
              aria-invalid={errors.mobileOtp ? "true" : undefined}
            />
            {errors.mobileOtp ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errors.mobileOtp}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="pt-3 sm:pt-4">
        <Button
          type="submit"
          full
          size="lg"
          icon={isAdmin ? ShieldCheck : LogIn}
          loading={busy}
          className={
            isAdmin && adminType === "super_admin"
              ? "!bg-emerald-950 !text-emerald-300 hover:!bg-emerald-900 border border-emerald-500/40"
              : ""
          }
        >
          {busy
            ? "Signing in…"
            : isAdmin
            ? adminType === "super_admin"
              ? "Sign in as Super Admin"
              : "Sign in as Admin"
            : role
            ? `Sign in as ${ROLE_NAMES[role] || role}`
            : "Sign In"}
        </Button>
      </div>

      {!isAdmin ? (
        <p className="text-center text-sm text-muted">
          New to TradeExpress?{" "}
          <Link
            to="/register"
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            Join free as a Buyer or Supplier
          </Link>
        </p>
      ) : null}
    </form>
  );
}
