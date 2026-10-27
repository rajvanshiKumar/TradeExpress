import { useState, useEffect, useRef } from 'react';
import { Mail, Smartphone, RefreshCw, CircleAlert, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

/**
 * Universal OTP verification popup modal for both Email and Phone verification
 * across Sign In and Sign Up flows.
 */
export default function OtpModal({
  open,
  onClose,
  type = 'email', // 'email' | 'phone'
  destination = '',
  devOtp = '',
  cooldown = 0,
  onResend,
  resending = false,
  onVerify,
  verifying = false,
  error = '',
  title,
  submitLabel = 'Verify & Continue',
}) {
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  // Reset and auto-focus when modal opens
  useEffect(() => {
    if (open) {
      setOtp('');
      setLocalError('');
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(val);
    if (localError) setLocalError('');
  };

  const handleFillDevCode = () => {
    if (devOtp) {
      setOtp(devOtp);
      if (localError) setLocalError('');
    }
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (otp.length !== 6) {
      setLocalError('Please enter the complete 6-digit verification code.');
      return;
    }
    setLocalError('');
    if (onVerify) {
      await onVerify(otp);
    }
  };

  const isEmail = type === 'email';
  const displayTitle = title || (isEmail ? 'Verify Your Email' : 'Verify Mobile Number');
  const activeError = error || localError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {isEmail ? <Mail className="size-5" /> : <Smartphone className="size-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-navy-950">{displayTitle}</h3>
            <p className="text-xs text-muted font-normal">One-Time Password (OTP)</p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Destination Information */}
        <p className="text-xs text-navy-700 leading-relaxed">
          We have dispatched a 6-digit verification code to{' '}
          <strong className="font-bold text-navy-950 font-mono break-all">{destination}</strong>.
          Please enter it below to proceed.
        </p>

        {/* Demo / Dev Code Quick-fill Tag */}
        {devOtp ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs">
            <span className="text-emerald-900 font-medium">Demo Code:</span>
            <button
              type="button"
              onClick={handleFillDevCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer active:scale-95"
              title="Click to auto-fill verification code"
            >
              <span>{devOtp}</span>
              <span className="text-[10px] opacity-90 font-sans font-normal">(Click to fill)</span>
            </button>
          </div>
        ) : null}

        {/* 6-Digit OTP Input Field */}
        <div>
          <label htmlFor="modal-otp-input" className="block text-xs font-bold text-navy-800 mb-1.5 text-center">
            Enter 6-Digit Code
          </label>
          <input
            id="modal-otp-input"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={handleChange}
            placeholder="• • • • • •"
            className={`w-full py-3 px-4 text-center tracking-[0.45em] font-mono font-extrabold text-2xl rounded-xl border bg-white shadow-inner focus:outline-none focus:ring-2 transition-all ${
              activeError
                ? 'border-danger focus:border-danger focus:ring-danger/20 text-danger'
                : 'border-navy-200 focus:border-brand-500 focus:ring-brand-500/20 text-navy-950'
            }`}
          />

          {activeError ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-danger">
              <CircleAlert className="size-3.5 shrink-0" />
              <span>{activeError}</span>
            </p>
          ) : null}
        </div>

        {/* Resend OTP Bar */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <span className="text-muted">Didn&apos;t receive the code?</span>
          <button
            type="button"
            disabled={cooldown > 0 || resending}
            onClick={onResend}
            className="font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
          >
            {resending ? (
              <>
                <RefreshCw className="size-3 animate-spin" />
                <span>Sending…</span>
              </>
            ) : cooldown > 0 ? (
              <span>Resend in {cooldown}s</span>
            ) : (
              <span>Resend OTP</span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            full
            onClick={onClose}
            className="flex-1 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            full
            loading={verifying}
            disabled={otp.length !== 6 || verifying}
            className="flex-1 text-xs font-bold"
          >
            {verifying ? 'Verifying…' : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
