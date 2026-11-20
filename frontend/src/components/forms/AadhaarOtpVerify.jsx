import { AlertCircle, BadgeCheck, KeyRound, RefreshCw, Smartphone } from 'lucide-react';
import useAadhaarOtp from '../../hooks/useAadhaarOtp.js';
import AadhaarHolderCard from './AadhaarHolderCard.jsx';

/**
 * Aadhaar OTP verification panel (used by Supplier signup; Buyer signup uses useAadhaarOtp inline).
 *
 * Props:
 *   aadhaarNumber  12 digits
 *   consent        the user's consent checkbox
 *   verified       parent state: this number is already verified
 *   verifiedName   name returned by the provider (shown once verified)
 *   holder         UIDAI details and photo of the verified holder (shown once verified)
 *   environment    'uat' | 'prod' of the verified result
 *   onVerified({ verificationToken, fullName, aadhaarLast4, environment })
 */
export default function AadhaarOtpVerify({ aadhaarNumber, consent, verified, verifiedName, holder, environment, onVerified }) {
  const otp = useAadhaarOtp({ aadhaarNumber, onVerified });
  const ready = otp.digits.length === 12 && consent;

  if (verified) {
    return (
      <div>
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span className="min-w-0">
            Aadhaar verified with OTP{verifiedName ? ` (${verifiedName})` : ''}.
            {environment === 'uat' && <span className="ml-1 font-medium text-amber-700">UAT test result</span>}
          </span>
        </div>
        <AadhaarHolderCard holder={holder} />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-slate-600">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span className="min-w-0">
            {otp.request
              ? `OTP sent to the mobile number linked with Aadhaar ending ${otp.request.aadhaarLast4}.`
              : 'Step 1: verify your Aadhaar with an OTP sent to your Aadhaar-linked mobile.'}
          </span>
        </p>
        <button
          type="button"
          onClick={otp.send}
          disabled={!ready || otp.sending || otp.cooldown > 0}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-40 sm:w-auto"
        >
          {otp.sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          <span>
            {otp.sending ? 'Sending OTP...' : otp.cooldown > 0 ? `Resend in ${otp.cooldown}s` : otp.request ? 'Resend OTP' : 'Send Aadhaar OTP'}
          </span>
        </button>
      </div>

      {!ready && !otp.request && (
        <p className="text-[11px] text-slate-500">Enter all 12 digits and tick the consent box to receive the OTP.</p>
      )}

      {otp.request && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label htmlFor={`aadhaar-otp-${otp.request.verificationId}`} className="sr-only">Aadhaar OTP</label>
          <input
            id={`aadhaar-otp-${otp.request.verificationId}`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            name="aadhaar-otp"
            data-lpignore="true"
            data-1p-ignore="true"
            disabled={otp.verifying}
            maxLength={6}
            placeholder="6-digit OTP"
            value={otp.otp}
            onChange={(e) => otp.setOtp(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); otp.verify(); } }}
            className="min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm tracking-[0.3em] transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
          <button
            type="button"
            onClick={otp.verify}
            disabled={!/^\d{6}$/.test(otp.otp) || otp.verifying}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            {otp.verifying && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            <span>{otp.verifying ? 'Verifying...' : 'Verify OTP'}</span>
          </button>
        </div>
      )}

      {otp.request?.environment === 'uat' && (
        <p className="text-[11px] font-medium text-amber-700">UAT test mode: the provider returns a simulated result, so any 6-digit OTP is accepted.</p>
      )}

      {otp.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span className="min-w-0">{otp.error}</span>
        </div>
      )}
    </div>
  );
}
