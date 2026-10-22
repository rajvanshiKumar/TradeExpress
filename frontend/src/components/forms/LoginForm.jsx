import { useState, startTransition } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import Input from "../common/Input";
import Button from "../common/Button";
import useAuth from "../../hooks/useAuth";
import useNotifications from "../../hooks/useNotifications";
import { ROLE_HOME } from "../../utils/constants";
import {
  focusFirstError,
  hasErrors,
  normalizeEmail,
  rules,
  validate,
} from "../../utils/validators";

const schema = {
  email: [rules.required("Email"), rules.email()],
  password: [rules.required("Password")],
};

const ROLE_NAMES = { buyer: "Buyer", supplier: "Supplier", admin: "Admin", super_admin: "Super Admin" };

/**
 * Sign-in form. `mode="admin"` signs in against the separately configured admin account;
 * the default mode signs in Buyers and Suppliers.
 */
export default function LoginForm({ mode = "member", role = null, adminType = "admin" }) {
  const isAdmin = mode === "admin";
  const { login, loginAdmin, isAdminConfigured } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const prefix = isAdmin ? "admin-login-" : "login-";

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
    setFormError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(found, prefix);
      return;
    }
    setBusy(true);
    const result = isAdmin
      ? await loginAdmin(normalizeEmail(values.email), values.password)
      : await login(normalizeEmail(values.email), values.password, role);
    setBusy(false);
    if (!result.ok) {
      setValues((previous) => ({ ...previous, password: "" }));
      setFormError(result.error);
      return;
    }
    showToast(
      `Signed in as ${result.user.name} (${ROLE_NAMES[result.user.role] || result.user.role}).`,
    );
    const from = location.state?.from;
    const allowed =
      from &&
      from !== "/login" &&
      from !== "/admin/login" &&
      (result.user.role === "admin"
        ? from.startsWith("/admin") || from === "/messages"
        : result.user.role === "super_admin"
        ? from.startsWith("/super-admin") || from.startsWith("/admin") || from === "/messages"
        : !from.startsWith("/admin") && !from.startsWith("/super-admin"));
    startTransition(() => {
      navigate(allowed ? from : (ROLE_HOME[result.user.role] || "/"), { replace: true });
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4"
      aria-busy={busy || undefined}
    >
      {isAdmin && !isAdminConfigured ? (
        <p
          role="status"
          className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning"
        >
          Admin sign-in is not configured for this site yet. Set{" "}
          <code className="font-mono text-xs">VITE_ADMIN_PASSWORD_HASH</code> as
          described in the README.
        </p>
      ) : null}
      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-danger-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {formError}
        </p>
      ) : null}
      {isAdmin ? (
        <div className="rounded-xl border border-navy-900/10 bg-surface/90 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-800">
            <span>One-Click Demo Credentials:</span>
            <span className="text-[10px] text-muted font-normal">Click to auto-fill</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setValues({ email: "krajvanshi244@gmail.com", password: "super-raj@12345" });
                setErrors({});
                setFormError("");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all ${
                adminType === "super_admin"
                  ? "bg-emerald-950 text-emerald-300 ring-2 ring-emerald-500 shadow-xs"
                  : "bg-emerald-950/10 text-emerald-800 hover:bg-emerald-950/20"
              }`}
            >
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>👑 Super Admin Demo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setValues({ email: "krajvanshi244@gmail.com", password: "modiji@12345" });
                setErrors({});
                setFormError("");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all ${
                adminType !== "super_admin"
                  ? "bg-navy-900 text-white ring-2 ring-brand-400 shadow-xs"
                  : "bg-navy-100 text-navy-800 hover:bg-navy-200"
              }`}
            >
              <ShieldCheck className="size-3.5 text-brand-400" />
              <span>🛡️ Staff Admin Demo</span>
            </button>
          </div>
        </div>
      ) : null}
      <Input
        id={`${prefix}email`}
        label="Email"
        type="email"
        required
        autoComplete={isAdmin ? "username" : "email"}
        value={values.email}
        onChange={set("email")}
        error={errors.email}
        placeholder="name@company.com"
      />
      <div>
        <Input
          id={`${prefix}password`}
          label="Password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="current-password"
          value={values.password}
          onChange={set("password")}
          error={errors.password}
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-navy-700 hover:text-brand-600"
          aria-pressed={showPassword}
          aria-controls={`${prefix}password`}
        >
          {showPassword ? (
            <EyeOff className="size-3.5" aria-hidden="true" />
          ) : (
            <Eye className="size-3.5" aria-hidden="true" />
          )}
          {showPassword ? "Hide password" : "Show password"}
        </button>
      </div>
      {!isAdmin ? (
        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            YOU'RE LOKING HERE IT MEANS FORGET PASSWORD?
          </Link>
        </div>
      ) : null}
      <Button
        type="submit"
        full
        size="lg"
        icon={isAdmin ? ShieldCheck : LogIn}
        loading={busy}
        className={isAdmin && adminType === "super_admin" ? "!bg-emerald-950 !text-emerald-300 hover:!bg-emerald-900 border border-emerald-500/40" : ""}
      >
        {busy
          ? "Signing in…"
          : isAdmin
            ? adminType === "super_admin"
              ? "Sign in as Super Admin"
              : "Sign in as Admin"
            : role
              ? `Sign in as ${ROLE_NAMES[role]}`
              : "Sign In"}
      </Button>
      {!isAdmin ? (
        <p className="text-center text-sm text-muted">
          New to TradeSphere?{" "}
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
