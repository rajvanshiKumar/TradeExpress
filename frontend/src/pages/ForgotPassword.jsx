import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import AuthShell from './AuthShell';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import PasswordValidationIndicator from '../components/common/PasswordValidationIndicator';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { isEmail, normalizeEmail } from '../utils/validators';
import { validatePassword } from '../utils/passwordRules';
import { apiPost } from '../services/apiClient';

export default function ForgotPassword() {
  const [step, setStep] = useState('request'); // 'request' | 'reset' | 'success'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  useDocumentTitle('Forgot password');

  const handleRequestReset = async (event) => {
    event.preventDefault();
    const value = normalizeEmail(email);
    if (!value) return setError('Email is required.');
    if (!isEmail(value)) return setError('Enter a valid email address.');
    setError('');
    setLoading(true);

    try {
      const response = await apiPost('auth/forgot-password', { email: value });
      setStep('reset');
      setSuccessMsg(response?.message || 'Password reset code sent to your registered email.');
    } catch (err) {
      if (err.status === 404) {
        setError('No account found with this email address.');
      } else {
        setStep('reset');
        setSuccessMsg('If an account exists, a reset code was sent to ' + value);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (!otp.trim()) return setError('Please enter the 6-digit OTP code or reset token.');

    const passEval = validatePassword(newPassword);
    if (!passEval.isValid) {
      return setError(passEval.message);
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setError('');
    setLoading(true);

    try {
      await apiPost('auth/reset-password', {
        email: normalizeEmail(email),
        token: otp.trim(),
        newPassword,
      });
      setStep('success');
    } catch (err) {
      setError(err.message || 'Invalid or expired reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === 'success' ? 'Password Reset Complete' : step === 'reset' ? 'Enter Reset Code' : 'Reset your password'}
      subtitle={
        step === 'success'
          ? 'You can now login with your new password.'
          : step === 'reset'
          ? `Enter the 6-digit OTP sent to ${email}`
          : 'Enter the email you use for TradeExpress.'
      }
    >
      {step === 'success' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" role="status">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-ink">Password updated successfully!</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Your TradeExpress account password has been reset. You can now login to your dashboard.
          </p>
          <div className="mt-6 flex justify-center">
            <Button to="/login" variant="primary" size="lg">
              Login now
            </Button>
          </div>
        </div>
      ) : step === 'reset' ? (
        <form onSubmit={handleResetSubmit} noValidate className="space-y-4">
          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <MailCheck className="size-4 shrink-0 text-blue-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <Input
            id="reset-otp"
            label="6-Digit Reset Code or Token"
            type="text"
            required
            placeholder="e.g. 123456"
            value={otp}
            onChange={(e) => { setOtp(e.target.value); setError(''); }}
          />

          {/* New Password with Eye visibility toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="reset-new-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password with Eye visibility toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Real-time Password Requirements Checklist & Confirm Match Status */}
          <PasswordValidationIndicator
            password={newPassword}
            confirmPassword={confirmPassword}
            showConfirmMatch={true}
          />

          <Button type="submit" full size="lg" disabled={loading}>
            {loading ? 'Updating Password...' : 'Save New Password'}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setStep('request'); setError(''); }}
              className="text-xs text-muted hover:text-ink"
            >
              ← Back to enter email
            </button>
            <Link to="/login" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Back to login
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRequestReset} noValidate className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <Input
            id="forgot-email"
            label="Email address"
            type="email"
            required
            autoComplete="email"
            placeholder="supplier@company.com"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); }}
          />
          <Button type="submit" full size="lg" disabled={loading}>
            {loading ? 'Sending code...' : 'Send Reset Code'}
          </Button>
          <p className="text-center text-sm text-muted">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
