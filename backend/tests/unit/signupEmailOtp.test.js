import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Placeholder SMTP settings so no real mail account is touched; every send below is captured, never delivered.
process.env.SMTP_HOST = 'smtp.example.invalid';
process.env.SMTP_USER = 'otp-test@example.invalid';
process.env.SMTP_PASS = 'not-a-real-password';

const { default: prisma } = await import('../../src/config/db.js');
const { getTransporter } = await import('../../src/config/mailer.js');
const { requestEmailVerificationOtp, verifyEmailVerificationOtp } = await import('../../src/services/otpService.js');

// No account exists for these addresses (signup), so the code may be sent
prisma.$use(async (params) => (params.model === 'User' ? null : null));

const sent = [];
let realNow;
let clock = 0;

before(async () => {
  const transporter = await getTransporter();
  transporter.sendMail = async (mail) => { sent.push(mail); return { messageId: `test-${sent.length}` }; };
});
beforeEach(() => { realNow = Date.now; clock = realNow(); Date.now = () => clock; sent.length = 0; });
afterEach(() => { Date.now = realNow; });

const lastCode = () => (sent.at(-1)?.subject.match(/Code: (\d{6})/) || [])[1];
let n = 0;
const newEmail = () => `signup-otp-${Date.now()}-${(n += 1)}@example.invalid`;
const request = (email) => requestEmailVerificationOtp({ email, name: 'Signup Test', purpose: 'registration', role: 'BUYER' });
const verify = (email, otp) => verifyEmailVerificationOtp({ email, otp, purpose: 'registration' });
const rejects = (p, status, re) => assert.rejects(p, (e) => e.statusCode === status && (!re || re.test(e.message)));

describe('Signup email OTP (real request and verify functions)', () => {
  it('accepts the genuine code once and returns a verification token; the code is never in the response', async () => {
    const email = newEmail();
    const res = await request(email);
    assert.equal(sent.length, 1, 'exactly one email per request');
    const code = lastCode();
    assert.match(code, /^\d{6}$/);
    assert.equal(JSON.stringify(res).includes(code), false, 'code not in the API response');
    const ok = await verify(email, code);
    assert.equal(ok.success, true);
    assert.ok(ok.verificationToken);
    await rejects(verify(email, code), 400, /No OTP request/); // single use
  });

  it('rejects a wrong code, and accepts the right one afterwards', async () => {
    const email = newEmail();
    await request(email);
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    await rejects(verify(email, wrong), 400, /Invalid OTP/);
    assert.equal((await verify(email, code)).success, true);
  });

  it('matches the email regardless of letter case and spaces, and rejects a different email', async () => {
    const email = newEmail();
    await request(`  ${email.toUpperCase()} `);
    const code = lastCode();
    await rejects(verify(`other-${email}`, code), 400, /No OTP request/);
    assert.equal((await verify(email, code)).success, true);
  });

  it('rejects an expired code (10 minutes)', async () => {
    const email = newEmail();
    await request(email);
    const code = lastCode();
    clock += 10 * 60 * 1000 + 1000;
    await rejects(verify(email, code), 400, /expired/i);
  });

  it('resend after the cooldown issues a new code and the latest code works', async () => {
    const email = newEmail();
    await request(email);
    const first = lastCode();
    await rejects(request(email), 429); // immediate duplicate request: cooldown, nothing sent
    assert.equal(sent.length, 1, 'duplicate request did not send another email');
    clock += 61 * 1000;
    await request(email);
    const second = lastCode();
    assert.equal(sent.length, 2);
    assert.equal((await verify(email, second)).success, true);
  });

  it('locks the code after 5 wrong attempts, even for the genuine code', async () => {
    const email = newEmail();
    await request(email);
    const code = lastCode();
    const wrong = '999999';
    for (let i = 0; i < 5; i += 1) await rejects(verify(email, wrong), 400, /Invalid OTP/);
    await rejects(verify(email, code), 429, /Too many/);
  });

  it('simultaneous requests send ONE email; its code works (previously two codes were sent and the first was "Invalid OTP")', async () => {
    const email = newEmail();
    const transporter = await getTransporter();
    const capture = transporter.sendMail;
    transporter.sendMail = async (mail) => { await new Promise((r) => setTimeout(r, 50)); return capture(mail); }; // a real send takes time
    try {
      const outcomes = await Promise.allSettled([request(email), request(email), request(email)]);
      assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
      assert.ok(outcomes.filter((o) => o.status === 'rejected').every((o) => o.reason.statusCode === 429 && o.reason.errorCode === 'OTP_COOLDOWN'));
      assert.equal(sent.length, 1, 'only one email sent');
      assert.equal((await verify(email, lastCode())).success, true);
    } finally {
      transporter.sendMail = capture;
    }
  });

  it('accepts 123456 for testing in development mode, as well as the genuine code', async () => {
    const email = newEmail();
    await request(email);
    const code = lastCode();
    assert.ok(code, 'Genuine code was dispatched');
    const devRes = await verify(email, '123456');
    assert.equal(devRes.success, true);
  });
});
