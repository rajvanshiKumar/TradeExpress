import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.join(__dirname, '../../sms-debug.log');

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
    const err = new Error('SMS service is not fully configured.');
    err.statusCode = 503;
    throw err;
  }

  // Format Indian mobile numbers: extract 10-digit national number for route 1
  let cleanMobile = String(mobile || '').replace(/\D/g, '');
  if (cleanMobile.startsWith('91') && cleanMobile.length === 12) {
    cleanMobile = cleanMobile.slice(2);
  } else if (cleanMobile.length === 11 && cleanMobile.startsWith('1') && /^[6-9]\d{9}$/.test(cleanMobile.slice(1))) {
    // Auto-heal accidental US country code (+1) on 10-digit Indian numbers (e.g. 19608819167 -> 9608819167)
    cleanMobile = cleanMobile.slice(1);
  } else if (cleanMobile.length > 10) {
    cleanMobile = cleanMobile.replace(/^0+/, '');
    if (cleanMobile.length > 10 && cleanMobile.startsWith('91')) {
      cleanMobile = cleanMobile.slice(2);
    }
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

  const mobileEnding = cleanMobile.slice(-4);
  console.log(`[SMS GATEWAY] Dispatching live OTP SMS to: ...${mobileEnding} (${cleanMobile})`);

  try {
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

    // Append to debug log
    try {
      const logLine = `[${new Date().toISOString()}] inputMobile=${mobile} cleanMobile=${cleanMobile} data=${JSON.stringify(data)}\n`;
      fs.appendFileSync(logPath, logLine);
    } catch {
      // Ignore
    }

    // Check for success condition from PowersText gateway
    const isSuccess =
      (data && typeof data === 'object' && (data.Status === 'Success' || data.Code === '000')) ||
      (typeof data === 'string' && dataStr.includes('success'));

    if (isSuccess) {
      console.log(`✓ [SMS GATEWAY SUCCESS] Real SMS delivered to carrier gateway (Message-Id: ${data?.['Message-Id'] || 'N/A'}, to ...${mobileEnding})`);
      return { success: true, delivered: true, messageId: data?.['Message-Id'] };
    }

    // Provider rejected request
    const desc = data?.Description || (typeof data === 'string' ? data : 'Invalid mobile number or carrier rejection');
    console.error(`[SMS GATEWAY REJECTION] Powerstext rejected SMS to ...${mobileEnding}:`, data);

    const err = new Error(`SMS delivery rejected by carrier: ${desc}. Please check that you entered a valid 10-digit mobile number.`);
    err.statusCode = 400;
    throw err;
  } catch (error) {
    if (error.statusCode) throw error;

    console.error('[SMS GATEWAY FAILURE]', error.message);
    try {
      const logLine = `[${new Date().toISOString()}] ERROR inputMobile=${mobile} cleanMobile=${cleanMobile} error=${error.message}\n`;
      fs.appendFileSync(logPath, logLine);
    } catch {
      // Ignore
    }

    const err = new Error('SMS gateway timed out or failed to reach carrier network. Please try again.');
    err.statusCode = 502;
    throw err;
  }
};
