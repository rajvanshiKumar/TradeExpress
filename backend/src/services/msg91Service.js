/**
 * MSG91 SMS OTP Service
 * Integrates with official MSG91 v5 OTP APIs for secure mobile verification.
 * Documentation: https://docs.msg91.com/p/tf9GTextN/e/7XqZ3dG/MSG91
 */

const MSG91_BASE_URL = 'https://control.msg91.com/api/v5/otp';

/**
 * Validates that required MSG91 credentials are configured in environment variables.
 */
function checkConfig() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    const error = new Error('SMS OTP service is not configured. MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set.');
    error.statusCode = 503;
    throw error;
  }

  return { authKey, templateId };
}

/**
 * Cleans phone number to numeric only with country code (e.g. 919876543210).
 */
export function sanitizeMobileForMsg91(mobile) {
  if (!mobile) return '';
  return String(mobile).replace(/\D/g, '');
}

/**
 * Sends OTP to a mobile number via MSG91 API v5.
 * @param {string} mobile - Mobile number with country dial code (e.g. "919876543210")
 * @returns {Promise<{ success: boolean, message: string, requestId?: string }>}
 */
export async function sendOtp(mobile) {
  const { authKey, templateId } = checkConfig();
  const cleanMobile = sanitizeMobileForMsg91(mobile);

  if (!cleanMobile || cleanMobile.length < 8) {
    const error = new Error('Invalid mobile number provided for OTP delivery.');
    error.statusCode = 400;
    throw error;
  }

  const otpExpiry = Number(process.env.MSG91_OTP_EXPIRY_MINUTES) || 10;
  const otpLength = Number(process.env.MSG91_OTP_LENGTH) || 6;

  try {
    const response = await fetch(MSG91_BASE_URL, {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: cleanMobile,
        otp_expiry: otpExpiry,
        otp_length: otpLength,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.type === 'success') {
      return {
        success: true,
        message: 'OTP sent successfully.',
        requestId: data.request_id || null,
      };
    }

    console.warn('[TradeExpress MSG91] Send OTP was rejected by the provider.');
    const error = new Error('The SMS provider could not deliver the verification code. Please try again shortly.');
    error.statusCode = response.status === 429 ? 429 : response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('[TradeExpress MSG91] Network error calling MSG91 sendOtp.', err.code || err.name || 'UNKNOWN');
    const error = new Error('Failed to send OTP via SMS gateway. Please try again.');
    error.statusCode = 502;
    throw error;
  }
}

/**
 * Verifies OTP entered by user via MSG91 API v5.
 * @param {string} mobile - Mobile number with country dial code
 * @param {string} otp - User-entered OTP code
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function verifyOtp(mobile, otp) {
  const { authKey } = checkConfig();
  const cleanMobile = sanitizeMobileForMsg91(mobile);
  const cleanOtp = String(otp || '').trim();

  if (!cleanMobile || !cleanOtp) {
    const error = new Error('Mobile number and OTP are required for verification.');
    error.statusCode = 400;
    throw error;
  }

  const url = `${MSG91_BASE_URL}/verify?mobile=${encodeURIComponent(cleanMobile)}&otp=${encodeURIComponent(cleanOtp)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authkey: authKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.type === 'success') {
      return {
        success: true,
        message: 'OTP verified successfully.',
      };
    }

    const error = new Error(response.status >= 500 ? 'OTP verification is temporarily unavailable.' : 'Invalid or expired OTP.');
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('[TradeExpress MSG91] Network error calling MSG91 verifyOtp.', err.code || err.name || 'UNKNOWN');
    const error = new Error('Failed to verify OTP with SMS gateway. Please try again.');
    error.statusCode = 502;
    throw error;
  }
}

/**
 * Resends / retries OTP to mobile number via MSG91 API v5.
 * @param {string} mobile - Mobile number with country dial code
 * @param {'text'|'voice'} retrytype - Retry delivery channel ('text' or 'voice')
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function resendOtp(mobile, retrytype = 'text') {
  const { authKey } = checkConfig();
  const cleanMobile = sanitizeMobileForMsg91(mobile);

  if (!cleanMobile) {
    const error = new Error('Valid mobile number is required to resend OTP.');
    error.statusCode = 400;
    throw error;
  }

  const url = `${MSG91_BASE_URL}/retry?authkey=${encodeURIComponent(authKey)}&mobile=${encodeURIComponent(cleanMobile)}&retrytype=${retrytype}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authkey: authKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.type === 'success') {
      return {
        success: true,
        message: 'OTP resent successfully.',
      };
    }

    const error = new Error(response.status >= 500 ? 'OTP resend is temporarily unavailable.' : 'The SMS provider could not resend the verification code.');
    error.statusCode = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
    throw error;
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('[TradeExpress MSG91] Network error calling MSG91 resendOtp.', err.code || err.name || 'UNKNOWN');
    const error = new Error('Failed to resend OTP via SMS gateway.');
    error.statusCode = 502;
    throw error;
  }
}
