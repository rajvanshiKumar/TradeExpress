import { getTransporter } from '../src/config/mailer.js';
import * as powerstextService from '../src/services/powerstextService.js';
import * as otpService from '../src/services/otpService.js';

async function testEmailAndSms() {
  console.log('Testing Email Transport...');
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: 'TradeExpress Security <shivamsinghmahewa7698@gmail.com>',
      to: 'shivamsinghmahewa7698@gmail.com',
      subject: 'Test Email Verification',
      text: 'Your test OTP is 123456',
    });
    console.log('Email sent successfully! MessageId:', info.messageId);
  } catch (err) {
    console.error('Email failed:', err.message);
  }
}

testEmailAndSms();
