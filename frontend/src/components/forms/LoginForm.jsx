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
} from "lucide-react";
import Button from "../common/Button";
import useAuth from "../../hooks/useAuth";
import useNotifications from "../../hooks/useNotifications";
import { ROLE_HOME, COUNTRIES, COUNTRY_FLAGS, COUNTRY_PHONE_RULES } from "../../utils/constants";
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

/**
 * Enterprise B2B Sign-in form.
 * Supports primary Email + Password authentication, optional Mobile SMS OTP authentication,
 * and dedicated Admin / Super Admin console sign-in.
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
    country: "India",
    phone: "",
    mobileOtp: "",
    rememberMe: true,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Mobile OTP state (inline, without dummy popups)
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [sendingMobileOtp, setSendingMobileOtp] = useState(false);
  const [mobileCooldown, setMobileCooldown] = useState(0);

  // Custom Country Code Dropdown state
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef(null);

  const prefix = isAdmin ? "admin-login-" : "login-";

  // Reset form when role or login method changes
  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      email: "",
      password: "",
      phone: "",
      mobileOtp: "",
    }));
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

  /** Sends real SMS OTP to the entered mobile number */
  const handleSendMobileOtp = async () => {
    const parsed = parseMobile(values.phone, values.country);
    if (!values.phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "Mobile number is required." }));
      return;
    }
    if (!parsed.ok) {
      setErrors((prev) => ({
        ...prev,
        phone: `Enter a valid ${values.country} mobile number.`,
      }));
      return;
    }

    setSendingMobileOtp(true);
    setFormError("");
    setErrors((prev) => ({ ...prev, phone: "" }));

    try {
      const res = await authFetch("/auth/send-mobile-login-otp", {
        method: "POST",
        body: JSON.stringify({
          phone: values.phone.trim(),
          country: values.country,
          role: role ? role.toUpperCase() : undefined,
        }),
      });

      if (!res.ok || !res.data?.success) {
        setFormError(res.data?.message || res.error || "Failed to dispatch SMS verification code.");
      } else {
        setMobileOtpSent(true);
        setMobileCooldown(res.data?.cooldownSeconds || 60);
        showToast("Verification code dispatched to your mobile number.");
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

  /** Handles form submission for Email+Password, Mobile OTP, or Admin */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");

    // 1. Super Admin / Admin Flow
    if (isAdmin) {
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
      return;
    }

    // 2. Public Member Mobile OTP Flow
    if (loginMethod === "mobile") {
      const fieldErrors = {};
      const parsed = parseMobile(values.phone, values.country);
      if (!values.phone.trim()) {
        fieldErrors.phone = "Mobile number is required.";
      } else if (!parsed.ok) {
        fieldErrors.phone = `Enter a valid ${values.country} mobile number.`;
      }

      if (!mobileOtpSent) {
        if (fieldErrors.phone) {
          setErrors(fieldErrors);
          return;
        }
        await handleSendMobileOtp();
        return;
      }

      if (!values.mobileOtp.trim()) {
        fieldErrors.mobileOtp = "Please enter the 6-digit verification code.";
      } else if (values.mobileOtp.trim().length < 4) {
        fieldErrors.mobileOtp = "Verification code is incomplete.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setBusy(true);
      const result = await loginMobile({
        phone: values.phone.trim(),
        country: values.country,
        otp: values.mobileOtp.trim(),
        role,
      });
      setBusy(false);

      if (!result.ok) {
        setFormError(result.error || "Mobile sign-in failed. Please verify your OTP code.");
        return;
      }

      handlePostAuthNavigation(result.user);
      return;
    }

    // 3. Public Member Email + Password Flow (Real B2B Standard)
    const fieldErrors = {};
    const cleanEmail = normalizeEmail(values.email);
    if (!cleanEmail) {
      fieldErrors.email = "Business email address is required.";
    } else if (!emailRegex.test(cleanEmail)) {
      fieldErrors.email = "Please enter a valid business email address (e.g. name@company.com).";
    }

    if (!values.password) {
      fieldErrors.password = "Password is required.";
    } else if (values.password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setBusy(true);
    const result = await login(cleanEmail, values.password, role);
    setBusy(false);

    if (!result.ok) {
      setValues((prev) => ({ ...prev, password: "" }));
      setFormError(result.error || "The email or password you entered is incorrect.");
      return;
    }

    handlePostAuthNavigation(result.user);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
      className="space-y-4"
      aria-busy={busy || undefined}
    >
      {isAdmin && !isAdminConfigured ? (
        <p
          role="status"
          className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-800"
        >
          Admin sign-in is not configured for this site yet.
        </p>
      ) : null}

      {/* Login Method Switcher for Public Members */}
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
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                loginMethod === "email"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mail className="h-4 w-4" />
              <span>Email & Password</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginMethod("mobile");
                setFormError("");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                loginMethod === "mobile"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="h-4 w-4" />
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
                  Create your {role === "supplier" ? "Supplier" : "Buyer"} account now
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
                placeholder="admin@tradeexpress.com"
                value={values.email}
                onChange={handleChange("email")}
                className={`w-full rounded-xl border bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
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
                autoComplete="new-password"
                placeholder="••••••••"
                value={values.password}
                onChange={handleChange("password")}
                className={`w-full rounded-xl border bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
                  errors.password
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                }`}
                aria-invalid={errors.password ? "true" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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

      {/* PUBLIC MEMBER EMAIL + PASSWORD LOGIN (STANDARD B2B AUTHENTICATION) */}
      {!isAdmin && loginMethod === "email" ? (
        <>
          {/* Work Email Address */}
          <div>
            <label htmlFor={`${prefix}email`} className="block text-xs font-semibold text-slate-800 mb-1.5">
              Business / Work Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id={`${prefix}email`}
                type="email"
                required
                autoComplete="email"
                name="email"
                placeholder="e.g. name@company.com"
                value={values.email}
                onChange={handleChange("email")}
                className={`w-full rounded-xl border bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
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

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${prefix}password`} className="block text-xs font-semibold text-slate-800">
                Password <span className="text-red-500">*</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id={`${prefix}password`}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                name="password"
                placeholder="••••••••"
                value={values.password}
                onChange={handleChange("password")}
                className={`w-full rounded-xl border bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
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

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={values.rememberMe}
                onChange={handleChange("rememberMe")}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Remember this device</span>
            </label>
          </div>
        </>
      ) : null}

      {/* PUBLIC MEMBER MOBILE OTP FLOW (INLINE, CLEAN, NO POPUPS) */}
      {!isAdmin && loginMethod === "mobile" ? (
        <>
          <div>
            <label htmlFor={`${prefix}mobile`} className="block text-xs font-semibold text-slate-800 mb-1.5">
              Registered Mobile Number <span className="text-red-500">*</span>
            </label>
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
                  className="h-10 w-[88px] sm:w-[94px] rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 flex items-center justify-between gap-1 transition-all"
                >
                  <span className="flex items-center gap-1 truncate">
                    <span className="text-sm shrink-0">
                      {COUNTRY_FLAGS[values.country] || "🌐"}
                    </span>
                    <span className="font-bold text-slate-900">
                      +{COUNTRY_PHONE_RULES[values.country]?.dial || "91"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 text-slate-500 transition-transform ${
                      countryDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Country Dropdown Menu */}
                {countryDropdownOpen ? (
                  <div
                    role="listbox"
                    className="absolute left-0 top-full mt-1.5 z-50 w-72 max-h-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code..."
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48 p-1 divide-y divide-slate-50">
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
                            className={`w-full px-2.5 py-2 text-left text-xs flex items-center justify-between rounded-lg transition-colors ${
                              isSelected
                                ? "bg-emerald-50 text-emerald-950 font-bold"
                                : "text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{flag}</span>
                              <span className="truncate">{c}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-600 shrink-0 ml-2">
                              +{rule?.dial}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Mobile Number Input */}
              <input
                id={`${prefix}mobile`}
                type="tel"
                required
                autoComplete="tel"
                placeholder="e.g. 9876543210"
                value={values.phone}
                onChange={handleChange("phone")}
                className={`flex-1 min-w-0 rounded-xl border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
                  errors.phone
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                }`}
                aria-invalid={errors.phone ? "true" : undefined}
              />

              {/* Send / Resend OTP Action */}
              <button
                type="button"
                onClick={handleSendMobileOtp}
                disabled={sendingMobileOtp || mobileCooldown > 0}
                className="shrink-0 px-3 sm:px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {sendingMobileOtp ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {mobileCooldown > 0
                  ? `Resend (${mobileCooldown}s)`
                  : mobileOtpSent
                  ? "Resend"
                  : "Send OTP"}
              </button>
            </div>
            {errors.phone ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {errors.phone}
              </p>
            ) : null}
          </div>

          {/* Inline OTP Input when sent */}
          {mobileOtpSent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  SMS Code Dispatched
                </span>
                <span className="text-slate-500 text-[11px]">Valid for 10 mins</span>
              </div>

              <div>
                <label htmlFor={`${prefix}otp`} className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter 6-Digit Code <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${prefix}otp`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="• • • • • •"
                  value={values.mobileOtp}
                  onChange={handleChange("mobileOtp")}
                  className={`w-full text-center tracking-[0.4em] font-mono font-bold text-lg rounded-xl border bg-white py-2 px-3 text-slate-900 transition focus:outline-none focus:ring-2 ${
                    errors.mobileOtp
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                  }`}
                  aria-invalid={errors.mobileOtp ? "true" : undefined}
                />
                {errors.mobileOtp ? (
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600">
                    <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                    {errors.mobileOtp}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          full
          size="lg"
          icon={isAdmin ? ShieldCheck : LogIn}
          loading={busy || sendingMobileOtp}
          className="!bg-emerald-700 hover:!bg-emerald-800 !text-white font-bold py-3 rounded-xl shadow-md transition"
        >
          {busy
            ? "Verifying credentials..."
            : isAdmin
            ? adminType === "super_admin"
              ? "Sign in as Super Admin"
              : "Sign in as Admin"
            : !isAdmin && loginMethod === "mobile" && !mobileOtpSent
            ? "Send Mobile OTP"
            : !isAdmin && loginMethod === "mobile" && mobileOtpSent
            ? "Verify & Sign In"
            : role
            ? `Sign in as ${ROLE_NAMES[role] || role}`
            : "Sign In"}
        </Button>
      </div>

      {/* Account Registration Link */}
      {!isAdmin ? (
        <div className="pt-3 border-t border-slate-100 text-center space-y-2">
          <p className="text-xs text-slate-600">
            {role === 'supplier'
              ? "New supplier on TradeExpress?"
              : role === 'buyer'
              ? "New buyer on TradeExpress?"
              : "Don't have an account yet?"}
          </p>
          <div className="flex items-center justify-center gap-3 text-xs">
            {role === 'supplier' ? (
              <Link
                to="/supplier/register"
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <span>Join as a Supplier</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : role === 'buyer' ? (
              <Link
                to="/buyer/register"
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <span>Join as Buyer</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <>
                <Link
                  to="/buyer/register"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <span>Join as Buyer</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <span className="text-slate-300">|</span>
                <Link
                  to="/supplier/register"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <span>Join as a Supplier</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </form>
  );
}
