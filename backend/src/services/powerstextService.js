import axios from 'axios';

/**
 * Dispatches an SMS OTP via PowersText HTTP TokenKey API.
 * Uses the registered DLT header and template approved under Indian TRAI regulations.
 */
export const sendOtpSms = async ({ mobile, otp, expiryMinutes = 10 }) => {
  const rawUrl = process.env.SMS_API_URL || '';
  const smsApiUrl = rawUrl.trim().replace(/\?+$/, '');
  const smsAuthKey = process.env.SMS_AUTH_KEY;
  const smsSenderId = process.env.SMS_SENDER_ID;
  const smsRoute = process.env.SMS_ROUTE || '1';
  const smsTemplateId = process.env.SMS_TEMPLATE_ID;

  if (!smsApiUrl || !smsAuthKey || !smsSenderId || !smsTemplateId) {
    if (process.env.NODE_ENV !== 'production' || smsAuthKey === 'YOUR_ROTATED_POWERSTEXT_AUTH_KEY') {
      console.log(`[DEV SMS SERVICE] Fallback console OTP for mobile (ending ${String(mobile).slice(-4)}): ${otp}`);
      return true;
    }
    throw new Error('SMS service is not fully configured.');
  }

  // Format Indian mobile numbers: extract 10-digit national number for route 1
  let cleanMobile = String(mobile || '').replace(/\D/g, '');
  if (cleanMobile.startsWith('91') && cleanMobile.length === 12) {
    cleanMobile = cleanMobile.slice(2);
  }

  // Approved DLT template for Sender ID iVRDMN and Template ID 1107176399019144183
  // DLT scrubbing requires exact character match with registered entity template
  let message;
  if (process.env.SMS_TEMPLATE_MESSAGE && process.env.SMS_TEMPLATE_MESSAGE.includes('{otp}')) {
    message = process.env.SMS_TEMPLATE_MESSAGE
      .replace('{otp}', otp)
      .replace('{expiry}', String(expiryMinutes));
  } else {
    message =
      `Dear Customer, your OTP is ${otp}. ` +
      `This OTP is valid for ${expiryMinutes} minutes. ` +
      `Do not share this code with anyone. -Vardhman Finance`;
  }

  try {
    const mobileEnding = cleanMobile.slice(-4);
    console.log(`[SMS GATEWAY] Dispatching OTP to mobile ending in: ...${mobileEnding}`);

    const response = await axios.get(smsApiUrl, {
      params: {
        'authentic-key': smsAuthKey,
        senderid: smsSenderId,
        route: smsRoute,
        number: cleanMobile,
        message: message,
        templateid: smsTemplateId,
      },
      timeout: 15000,
    });

    const data = response.data;
    const dataStr = (typeof data === 'object' ? JSON.stringify(data) : String(data || '')).toLowerCase();

    // Check for success condition from PowersText gateway
    const isSuccess =
      (data && typeof data === 'object' && (data.Status === 'Success' || data.Code === '000')) ||
      (typeof data === 'string' && dataStr.includes('success'));

    if (!isSuccess) {
      console.error('[SMS GATEWAY ERROR] Powerstext rejected SMS dispatch:', data);
      throw new Error('PROVIDER_REJECTION');
    }

    console.log(`✓ [SMS GATEWAY SUCCESS] Powerstext SMS delivered to gateway (Message-Id: ${data?.['Message-Id'] || 'N/A'}, ending ...${mobileEnding})`);
    // Print OTP in development for convenience and test verification
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔑 [DEV OTP CODE] Mobile: ...${mobileEnding} | Code: ${otp}`);
    }

    return true;
  } catch (error) {
    if (error.message === 'PROVIDER_REJECTION') {
      throw new Error('OTP could not be sent. Please check the mobile number and try again.');
    }
    if (error.code === 'ECONNABORTED') {
      console.error('[SMS GATEWAY TIMEOUT] Powerstext connection timed out.');
      throw new Error('SMS gateway timed out. Please try again.');
    }
    console.error('[SMS GATEWAY FAILURE]', error.message);
    throw new Error('OTP SMS transmission failed. Please try again.');
  }
};
