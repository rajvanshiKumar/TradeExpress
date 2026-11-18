import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, KeyRound, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { TableSkeleton } from '../common/Skeleton';
import { AccountCard } from './AccountUi';
import { Notice } from './AccountVerificationFlows';
import { confirmTwoFactorSetup, disableTwoFactor, getTwoFactorStatus, regenerateRecoveryCodes, startTwoFactorSetup } from '../../services/accountApi';
import { formatDateTime } from '../../utils/formatDate';

const digits = (v) => v.replace(/\D/g, '').slice(0, 6);

function RecoveryCodes({ codes, onDone }) {
  const text = codes.join('\n');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`TradeExpress recovery codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tradeexpress-recovery-codes.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Save these recovery codes somewhere safe. Each one signs you in once if you lose your phone. <strong>They will not be shown again.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-4 font-mono text-sm text-ink sm:grid-cols-5">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" icon={Copy} onClick={copy}>{copied ? 'Copied' : 'Copy codes'}</Button>
        <Button variant="outline" size="sm" icon={Download} onClick={download}>Download .txt</Button>
        <Button variant="primary" size="sm" onClick={onDone}>I have saved my codes</Button>
      </div>
    </div>
  );
}

/** Password + code form used to turn 2FA off or create new recovery codes. */
function StepUpForm({ submitLabel, danger, busy, onSubmit, onCancel }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  return (
    <form className="mt-4 space-y-3 rounded-xl border border-line p-4" onSubmit={(e) => { e.preventDefault(); onSubmit(password, code.trim()); }}>
      <Input id="tf-step-password" type="password" label="Current password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Input id="tf-step-code" label="Authenticator code or recovery code" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.slice(0, 11))} required />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={danger ? 'danger' : 'primary'} size="sm" loading={busy} disabled={busy || !password || code.trim().length < 6}>{submitLabel}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

/** Two-Factor Authentication: authenticator-app setup, recovery codes, and turning it off. */
export default function AccountTwoFactorSection() {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('idle'); // idle | password | scan | codes | disable | regenerate
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState([]);

  const load = useCallback(async () => {
    setLoadError('');
    try { setStatus(await getTwoFactorStatus()); } catch (err) { setLoadError(err.message || 'Two-factor settings could not be loaded.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await fn(); } catch (err) { setMessage({ type: 'error', text: err.message || 'That did not work. Please try again.' }); } finally { setBusy(false); }
  };

  const begin = () => run(async () => {
    const result = await startTwoFactorSetup(password);
    setPassword('');
    setSetup(result);
    setCode('');
    setStep('scan');
  });
  const confirm = () => run(async () => {
    const result = await confirmTwoFactorSetup(code);
    setSetup(null);
    setCodes(result.recoveryCodes);
    setStep('codes');
    setMessage({ type: 'success', text: 'Two-factor authentication is on. You will need a code from your app each time you sign in.' });
    await load();
  });
  const turnOff = (pw, c) => run(async () => {
    await disableTwoFactor(pw, c);
    setStep('idle');
    setMessage({ type: 'success', text: 'Two-factor authentication is off.' });
    await load();
  });
  const regenerate = (pw, c) => run(async () => {
    const result = await regenerateRecoveryCodes(pw, c);
    setCodes(result.recoveryCodes);
    setStep('codes');
    setMessage({ type: 'success', text: 'New recovery codes created. Your old codes no longer work.' });
    await load();
  });

  if (loadError) {
    return (
      <AccountCard title="Two-factor authentication">
        <div className="rounded-xl bg-danger-50 p-4 text-sm text-danger">{loadError} <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Try again</Button></div>
      </AccountCard>
    );
  }
  if (!status) return <AccountCard title="Two-factor authentication"><TableSkeleton rows={3} /></AccountCard>;

  return (
    <AccountCard title="Two-factor authentication" description="Protect your account with a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) in addition to your sign-in.">
      <Notice message={message} />

      {step === 'codes' ? <RecoveryCodes codes={codes} onDone={() => { setCodes([]); setStep('idle'); }} /> : null}

      {step !== 'codes' && status.enabled ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/20 bg-success-50 px-4 py-3">
            <ShieldCheck className="size-5 text-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-900">On since {formatDateTime(status.enabledAt)}</p>
              <p className="text-[13px] text-muted">{status.recoveryCodesLeft} recovery code{status.recoveryCodesLeft === 1 ? '' : 's'} left</p>
            </div>
          </div>
          {step === 'idle' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={KeyRound} onClick={() => setStep('regenerate')}>New recovery codes</Button>
              <Button variant="danger" size="sm" icon={ShieldOff} onClick={() => setStep('disable')}>Turn off</Button>
            </div>
          ) : null}
          {step === 'regenerate' ? <StepUpForm submitLabel="Create new codes" busy={busy} onSubmit={regenerate} onCancel={() => setStep('idle')} /> : null}
          {step === 'disable' ? <StepUpForm submitLabel="Turn off two-factor authentication" danger busy={busy} onSubmit={turnOff} onCancel={() => setStep('idle')} /> : null}
        </>
      ) : null}

      {step !== 'codes' && !status.enabled ? (
        !status.eligible ? (
          <p className="text-sm text-muted">Two-factor authentication is available for supplier and administrator accounts.</p>
        ) : !status.available ? (
          <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">Two-factor authentication is not available yet on this server. It will appear here once the update is applied.</p>
        ) : !status.hasPassword ? (
          <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
            Your account signs in without a password. <Link to="../password" relative="path" className="font-semibold text-success hover:underline">Set a password</Link> first, then come back to turn on two-factor authentication.
          </p>
        ) : step === 'scan' && setup ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>Open your authenticator app and scan this QR code.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <img src={setup.qrDataUrl} alt="QR code to add TradeExpress to your authenticator app" width="180" height="180" className="rounded-xl border border-line bg-white p-2" />
              <div className="min-w-0 text-sm">
                <p className="text-muted">Can’t scan? Enter this key in the app:</p>
                <p className="mt-1 break-all rounded-lg bg-surface px-3 py-2 font-mono text-[13px] tracking-wider text-ink">{setup.secret.match(/.{1,4}/g).join(' ')}</p>
              </div>
            </div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); confirm(); }}>
              <div className="w-44">
                <Input id="tf-confirm-code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(digits(e.target.value))} />
              </div>
              <Button type="submit" variant="primary" size="sm" loading={busy} disabled={busy || code.length !== 6}>Turn on</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setSetup(null); setStep('idle'); }} disabled={busy}>Cancel</Button>
            </form>
          </div>
        ) : step === 'password' ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); begin(); }}>
            <Input id="tf-password" type="password" label="Confirm your current password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" size="sm" loading={busy} disabled={busy || !password}>Continue</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setPassword(''); setStep('idle'); }} disabled={busy}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-ink"><ShieldOff className="size-5 text-muted" aria-hidden="true" /> Off</p>
            <Button variant="primary" size="sm" icon={ShieldCheck} onClick={() => setStep('password')}>Set up two-factor authentication</Button>
          </div>
        )
      ) : null}
    </AccountCard>
  );
}
