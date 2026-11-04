import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import SixDigitOtpRow from '../common/SixDigitOtpRow';
import PasswordValidationIndicator from '../common/PasswordValidationIndicator';
import { AccountCard, DetailRow } from './AccountUi';
import { validatePassword } from '../../utils/passwordRules';
import { changePasswordWithCode, changePhone, completeEmailChange, requestEmailChange, sendAccountCode, sendPhoneCode, verifyAccountCode, verifyPhoneCode } from '../../services/accountApi';

/** Seconds left until `deadline` (ms timestamp), updated every second. */
function useSecondsLeft(deadline) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Stores the new login token issued after a password or email change (other sessions are signed out). */
function storeToken(token) {
  if (!token) return;
  try {
    localStorage.setItem('tradeexpress_auth_token', token);
    localStorage.setItem('tradesphere_auth_token', token);
  } catch {
    // Storage unavailable: the current tab keeps working until reload
  }
}

export function Steps({ steps, current }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold" aria-label="Progress">
      {steps.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span className={`inline-flex size-6 items-center justify-center rounded-full ${state === 'done' ? 'bg-success text-white' : state === 'current' ? 'bg-navy-900 text-white' : 'bg-surface text-muted'}`}>
              {state === 'done' ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={state === 'todo' ? 'text-muted' : 'text-navy-900'}>{label}</span>
            {index < steps.length - 1 ? <span className="mx-1 h-px w-5 bg-line" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function Notice({ message }) {
  if (!message) return null;
  return (
    <p role={message.type === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'bg-danger-50 text-danger' : 'bg-success-50 text-success'}`}>
      {message.text}
    </p>
  );
}

/**
 * Send-code + enter-code step. `send()` resolves with { maskedTarget, expiresInSeconds, resendAfterSeconds };
 * `verify(otp)` resolves when the code is accepted.
 */
export function CodeStep({ title, description, send, verify, onBack }) {
  const [sent, setSent] = useState(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const expiresIn = useSecondsLeft(sent?.expiresAt);
  const cooldown = useSecondsLeft(sent?.resendAt);

  const doSend = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await send();
      const now = Date.now();
      setSent({ ...result, expiresAt: now + result.expiresInSeconds * 1000, resendAt: now + result.resendAfterSeconds * 1000 });
      setOtp('');
    } catch (err) {
      setError(err.message || 'The code could not be sent.');
      if (err.cooldownRemaining) setSent((previous) => previous && { ...previous, resendAt: Date.now() + err.cooldownRemaining * 1000 });
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    if (busy) return;
    if (otp.length !== 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (sent && expiresIn === 0) {
      setError('This code has expired. Please request a new one.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verify(otp);
    } catch (err) {
      setError(err.message || 'The code could not be verified.');
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
        <ShieldCheck className="size-5 text-success" aria-hidden="true" /> {title}
      </h3>
      <p className="mt-1 text-sm text-muted">{description}</p>

      {!sent ? (
        <>
          {error ? <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {onBack ? <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Back</Button> : null}
            <Button icon={MailCheck} loading={busy} onClick={doSend}>Send verification code</Button>
          </div>
        </>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-navy-900">
            We sent a 6-digit code to <strong>{sent.maskedTarget}</strong>.{' '}
            {expiresIn > 0 ? <span className="text-muted">It expires in {clock(expiresIn)}.</span> : <span className="font-semibold text-danger">The code has expired; request a new one.</span>}
          </p>
          <SixDigitOtpRow
            otp={otp}
            onChange={(value) => { setOtp(value); setError(''); }}
            onVerify={doVerify}
            onResend={doSend}
            verifying={busy}
            resending={busy}
            cooldown={cooldown}
            label="Enter the 6-digit code"
            error={error}
          />
          {onBack ? <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>Back</Button> : null}
        </div>
      )}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, show, autoComplete }) {
  return (
    <Input id={id} label={label} required type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} maxLength={64} />
  );
}

/** Change Password: verify the registered email, then set a new password. */
export function AccountPasswordSection({ settings }) {
  const [step, setStep] = useState(0);
  const [grant, setGrant] = useState('');
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const check = validatePassword(values.password);
    if (!check.isValid) return setMessage({ type: 'error', text: check.message });
    if (values.password !== values.confirm) return setMessage({ type: 'error', text: 'The passwords do not match.' });
    setSaving(true);
    setMessage(null);
    try {
      const result = await changePasswordWithCode({ grant, newPassword: values.password, confirmPassword: values.confirm });
      storeToken(result.token);
      setGrant('');
      setValues({ password: '', confirm: '' });
      setStep(2);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Your password could not be updated.' });
      // An expired or used authorization means verifying the email again
      if (err.status === 400 && /verify your email again/i.test(err.message || '')) setStep(0);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <AccountCard>
      <Steps steps={['Verify your email', 'New password', 'Done']} current={step} />
      <Notice message={message} />
      {step === 0 ? (
        <CodeStep
          title="Verify your identity"
          description="For your account security, please verify your registered email address before changing your password."
          send={() => sendAccountCode('PASSWORD_CHANGE')}
          verify={async (otp) => {
            const result = await verifyAccountCode('PASSWORD_CHANGE', otp);
            setGrant(result.grant);
            setMessage(null);
            setStep(1);
          }}
        />
      ) : null}
      {step === 1 ? (
        <form onSubmit={submit} noValidate className="space-y-4">
          <dl><DetailRow label="Registered email">{settings.profile.maskedEmail}</DetailRow></dl>
          {/* Hidden username helps password managers save the new password against the right account */}
          <input type="email" name="username" autoComplete="username" value={settings.profile.email} readOnly hidden />
          <PasswordField id="new-password" label="New password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} show={show} autoComplete="new-password" />
          <PasswordValidationIndicator password={values.password} />
          <PasswordField id="confirm-password" label="Confirm new password" value={values.confirm} onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))} show={show} autoComplete="new-password" />
          <label className="inline-flex items-center gap-2 text-sm text-navy-800">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-success" />
            {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />} Show passwords
          </label>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Update password</Button>
          </div>
        </form>
      ) : null}
      {step === 2 ? (
        <div role="status" className="rounded-xl bg-success-50 p-5 text-success">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5" aria-hidden="true" /> Your password has been updated successfully.</p>
          <p className="mt-1 text-sm text-navy-900">Other devices have been signed out. A confirmation has been sent to your registered email.</p>
        </div>
      ) : null}
    </AccountCard>
  );
}

/** Change Email: verify the current email, enter and verify the new email, then the change is applied. */
export function AccountEmailSection({ settings, onEmailChanged }) {
  const [step, setStep] = useState(0);
  const [grant, setGrant] = useState('');
  const [values, setValues] = useState({ email: '', confirm: '' });
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState(null);

  const restart = (text) => {
    setGrant('');
    setStep(0);
    setMessage(text ? { type: 'error', text } : null);
  };

  const validateNewEmail = () => {
    const email = values.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(email)) return 'Enter a valid email address.';
    if (email !== values.confirm.trim().toLowerCase()) return 'The email addresses do not match.';
    if (email === settings.profile.email.toLowerCase()) return 'The new email address must be different from your current one.';
    return '';
  };

  return (
    <AccountCard>
      <Steps steps={['Verify current email', 'New email', 'Verify new email', 'Done']} current={step} />
      <Notice message={message} />
      {step === 0 ? (
        <CodeStep
          title="Verify your current email address"
          description={`We will send a code to ${settings.profile.maskedEmail}. Your email is not changed until the new address is verified too.`}
          send={() => sendAccountCode('EMAIL_CHANGE_CURRENT')}
          verify={async (otp) => {
            const result = await verifyAccountCode('EMAIL_CHANGE_CURRENT', otp);
            setGrant(result.grant);
            setMessage(null);
            setStep(1);
          }}
        />
      ) : null}
      {step === 1 ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const problem = validateNewEmail();
            if (problem) return setMessage({ type: 'error', text: problem });
            setNewEmail(values.email.trim().toLowerCase());
            setMessage(null);
            setStep(2);
            return undefined;
          }}
        >
          <dl><DetailRow label="Current email">{settings.profile.maskedEmail}</DetailRow></dl>
          <Input id="new-email" label="New email address" required type="email" autoComplete="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} maxLength={190} />
          <Input id="confirm-email" label="Confirm new email address" required type="email" autoComplete="off" value={values.confirm} onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))} maxLength={190} />
          <div className="flex justify-end">
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : null}
      {step === 2 ? (
        <CodeStep
          title="Verify your new email address"
          description={`We will send a code to ${newEmail}.`}
          onBack={() => { setMessage(null); setStep(1); }}
          send={async () => {
            try {
              return await requestEmailChange({ grant, newEmail });
            } catch (err) {
              if (err.status === 400 && /verify your current email again/i.test(err.message || '')) restart(err.message);
              throw err;
            }
          }}
          verify={async (otp) => {
            try {
              const result = await completeEmailChange({ grant, otp });
              storeToken(result.token);
              setGrant('');
              setStep(3);
              onEmailChanged(result.email);
            } catch (err) {
              if (err.status === 400 && /start the email change again/i.test(err.message || '')) restart(err.message);
              throw err;
            }
          }}
        />
      ) : null}
      {step === 3 ? (
        <div role="status" className="rounded-xl bg-success-50 p-5 text-success">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5" aria-hidden="true" /> Your email address has been changed successfully.</p>
          <p className="mt-1 text-sm text-navy-900">A notice was sent to your previous address and a confirmation to your new one.</p>
        </div>
      ) : null}
    </AccountCard>
  );
}

/** Change Phone Number: verify the registered email, enter the new number, verify it by SMS, then it is applied. */
export function AccountPhoneSection({ settings, onPhoneChanged }) {
  const [step, setStep] = useState(0);
  const [grant, setGrant] = useState('');
  const [digits, setDigits] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [message, setMessage] = useState(null);

  const restart = (text) => {
    setGrant('');
    setStep(0);
    setMessage(text ? { type: 'error', text } : null);
  };

  return (
    <AccountCard>
      <Steps steps={['Verify your email', 'New number', 'Verify by SMS', 'Done']} current={step} />
      <Notice message={message} />
      {step === 0 ? (
        <CodeStep
          title="Verify your identity"
          description={`We will send a code to ${settings.profile.maskedEmail}. Your number is not changed until the new one is verified by SMS.`}
          send={() => sendAccountCode('PHONE_CHANGE')}
          verify={async (otp) => {
            const result = await verifyAccountCode('PHONE_CHANGE', otp);
            setGrant(result.grant);
            setMessage(null);
            setStep(1);
          }}
        />
      ) : null}
      {step === 1 ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!/^[6-9]d{9}$/.test(digits)) return setMessage({ type: 'error', text: 'Enter a valid 10-digit Indian mobile number.' });
            if (settings.profile.phone && settings.profile.phone.replace(/D/g, '').endsWith(digits)) return setMessage({ type: 'error', text: 'This is already your phone number.' });
            setNewPhone(digits);
            setMessage(null);
            setStep(2);
            return undefined;
          }}
        >
          <dl><DetailRow label="Current number">{settings.profile.maskedPhone || 'Not added'}</DetailRow></dl>
          <Input
            id="new-phone"
            label="New mobile number (India)"
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/D/g, '').slice(0, 10))}
          />
          <div className="flex justify-end">
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : null}
      {step === 2 ? (
        <CodeStep
          title="Verify your new number"
          description={`We will send an SMS code to +91 ${newPhone}.`}
          onBack={() => { setMessage(null); setStep(1); }}
          send={async () => {
            const result = await sendPhoneCode(newPhone);
            return { maskedTarget: `+91 ******${newPhone.slice(-4)}`, expiresInSeconds: 600, resendAfterSeconds: result?.cooldownSeconds || 60 };
          }}
          verify={async (otp) => {
            const verified = await verifyPhoneCode(newPhone, otp);
            const verificationToken = verified?.verificationToken || verified?.data?.verificationToken;
            try {
              const result = await changePhone({ grant, phone: newPhone, verificationToken });
              setGrant('');
              setStep(3);
              onPhoneChanged?.(result);
            } catch (err) {
              if (err.status === 400 && /verify your email again/i.test(err.message || '')) restart(err.message);
              throw err;
            }
          }}
        />
      ) : null}
      {step === 3 ? (
        <div role="status" className="rounded-xl bg-success-50 p-5 text-success">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5" aria-hidden="true" /> Your phone number has been changed.</p>
          <p className="mt-1 text-sm text-navy-900">A confirmation has been sent to your registered email.</p>
        </div>
      ) : null}
    </AccountCard>
  );
}
