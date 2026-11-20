import { useEffect, useRef, useState } from 'react';
import { sendAadhaarOtp, verifyAadhaarOtp } from '../services/aadhaarVerificationApi.js';

// Errors after which the current OTP request can no longer be used
const REQUEST_ENDED = ['OTP_LOCKED', 'OTP_EXPIRED', 'OTP_REQUEST_NOT_FOUND', 'AADHAAR_VERIFICATION_USED', 'AADHAAR_OTP_ALREADY_USED'];

/**
 * Aadhaar OTP state for signup forms: send an OTP to the Aadhaar-linked mobile, then verify it.
 * Everything resets when the Aadhaar number changes. onVerified receives
 * { verificationToken, fullName, aadhaarLast4, environment, holder, providerResponse }.
 */
export default function useAadhaarOtp({ aadhaarNumber, onVerified }) {
  const digits = String(aadhaarNumber || '').replace(/\D/g, '');
  const [request, setRequest] = useState(null); // { verificationId, aadhaarLast4, environment }
  const [otp, setOtpState] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const lockRef = useRef(false);

  useEffect(() => {
    setRequest(null);
    setOtpState('');
    setError('');
    setCooldown(0);
  }, [digits]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  // Kept as typed (six-box entry stores empty boxes as spaces, see utils/otpDigits); only a full 6-digit code is sent
  const setOtp = (value) => setOtpState(String(value || '').slice(0, 6));

  const send = async () => {
    if (digits.length !== 12 || sending || cooldown > 0 || lockRef.current) return;
    lockRef.current = true;
    setSending(true);
    setError('');
    try {
      const result = await sendAadhaarOtp(digits);
      setRequest(result);
      setOtpState('');
      setCooldown(result.resendAfterSeconds || 45);
    } catch (err) {
      setError(err.message);
      if (err.retryAfterSeconds) setCooldown(err.retryAfterSeconds);
    } finally {
      setSending(false);
      lockRef.current = false;
    }
  };

  const verify = async () => {
    if (!request || !/^\d{6}$/.test(otp) || verifying || lockRef.current) return;
    lockRef.current = true;
    setVerifying(true);
    setError('');
    try {
      const result = await verifyAadhaarOtp({ verificationId: request.verificationId, aadhaarNumber: digits, otp });
      setRequest(null);
      setOtpState('');
      onVerified({
        verificationToken: result.verificationToken,
        fullName: result.fullName || '',
        aadhaarLast4: result.aadhaarLast4,
        environment: result.environment,
        // The holder's own details and photo from UIDAI, and the provider's full reply (kept in memory only)
        holder: result.holder || null,
        providerResponse: result.providerResponse || null,
      });
    } catch (err) {
      setError(err.message);
      if (REQUEST_ENDED.includes(err.code)) {
        setRequest(null);
        setOtpState('');
      }
    } finally {
      setVerifying(false);
      lockRef.current = false;
    }
  };

  return { digits, request, otp, setOtp, sending, verifying, cooldown, error, send, verify };
}
