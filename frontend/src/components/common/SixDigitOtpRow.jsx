import { useRef, useEffect } from 'react';
import { Check, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { enterOtpDigits, isCompleteOtp, isTypingElsewhere, otpBoxProps, otpSlots, pastedOtp } from '../../utils/otpDigits';

export default function SixDigitOtpRow({
  otp = '',
  onChange,
  onVerify,
  onResend,
  verifying = false,
  resending = false,
  cooldown = 0,
  label = 'Enter 6-digit verification code',
  targetHint = '',
  error = '',
  onClose,
  // Name of this code (e.g. "signup-mobile"): keeps two code rows on one page apart
  group = 'otp',
}) {
  const inputsRef = useRef([]);

  // One value per box; an empty box keeps its position (see utils/otpDigits)
  const digits = otpSlots(otp);
  const complete = isCompleteOtp(otp);

  // The first empty box takes the cursor when the row opens, unless the person is typing in another field
  useEffect(() => {
    if (isTypingElsewhere(inputsRef.current)) return;
    const firstEmptyIndex = digits.findIndex((d) => !d);
    const targetIdx = firstEmptyIndex === -1 ? 5 : firstEmptyIndex;
    inputsRef.current[targetIdx]?.focus();
  }, []);

  const handleDigitChange = (index, value) => {
    const { value: next, focusIndex } = enterOtpDigits(otp, index, value);
    onChange(next);
    if (focusIndex !== null) inputsRef.current[focusIndex]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (complete && !verifying) {
        onVerify();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = pastedOtp(e.clipboardData.getData('text/plain'));
    if (!pasted) return;

    onChange(pasted);
    const targetIndex = Math.min(5, pasted.length - 1);
    inputsRef.current[targetIndex]?.focus();
  };

  return (
    <div className="mt-2.5 p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-800 block">{label}</span>
          {targetHint ? (
            <span className="text-[11px] text-slate-500 block">Sent to {targetHint}</span>
          ) : null}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="Cancel"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 6 Digit Input Boxes and Submit Button Container */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <input
              key={index}
              ref={(el) => (inputsRef.current[index] = el)}
              {...otpBoxProps(group, index)}
              type="text"
              disabled={verifying}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={index === 0 ? 6 : 1}
              value={digits[index] || ''}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={`w-9 h-11 sm:w-11 sm:h-12 text-center text-base sm:text-lg font-black font-mono rounded-xl border bg-white transition-all outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                digits[index]
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-600/30'
                  : 'border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20'
              }`}
            />
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying || !complete}
          className="h-11 sm:h-12 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {verifying ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <Check className="size-4" />
              <span>Submit OTP</span>
            </>
          )}
        </button>
      </div>

      {/* Resend Footer */}
      <div className="flex items-center justify-end text-[11px] pt-1 border-t border-emerald-100">
        <button
          type="button"
          onClick={onResend}
          disabled={resending || cooldown > 0}
          className="font-bold text-emerald-700 hover:text-emerald-900 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {resending ? (
            'Sending...'
          ) : cooldown > 0 ? (
            `Resend OTP in ${cooldown}s`
          ) : (
            'Resend OTP'
          )}
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
          <ShieldAlert className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

