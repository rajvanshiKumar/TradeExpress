import { storeAuthToken } from '../../utils/authSession';
import { useCallback, useEffect, useState } from 'react';
import { Laptop, LogOut, MonitorSmartphone, RefreshCw, Smartphone } from 'lucide-react';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import { TableSkeleton } from '../common/Skeleton';
import { AccountCard } from './AccountUi';
import { Notice } from './AccountVerificationFlows';
import { listSessions, revokeOtherSessions, revokeSession } from '../../services/accountApi';
import { formatDateTime } from '../../utils/formatDate';

const METHOD_LABELS = { PASSWORD: 'Password', OTP: 'One-time code', GOOGLE: 'Google', SIGNUP: 'Account sign-up', ADMIN: 'Admin sign-in' };

function storeToken(token) {
  if (token) storeAuthToken(token);
}

const DeviceIcon = ({ device }) => (/iOS|Android/.test(device) ? <Smartphone className="size-5" aria-hidden="true" /> : <Laptop className="size-5" aria-hidden="true" />);

/** Active Login Sessions: every device signed in to the account, with sign-out for one or all others. */
export default function AccountSessionsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await listSessions());
    } catch (err) {
      setError(err.message || 'Your sessions could not be loaded.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signOut = async (session) => {
    if (busyId) return;
    setBusyId(session.id);
    setMessage(null);
    try {
      await revokeSession(session.id);
      setMessage({ type: 'success', text: `${session.device} has been signed out.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'That device could not be signed out.' });
    } finally {
      setBusyId('');
    }
  };

  const signOutOthers = async () => {
    setBusyId('all');
    setMessage(null);
    try {
      const result = await revokeOtherSessions();
      storeToken(result.token);
      setConfirmAll(false);
      setMessage({ type: 'success', text: result.revoked ? 'All other devices have been signed out.' : 'Other sign-ins have been ended. You stay signed in here.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Other devices could not be signed out.' });
    } finally {
      setBusyId('');
    }
  };

  const others = data?.sessions.filter((s) => !s.current) || [];

  return (
    <AccountCard title="Active login sessions" description="Devices currently signed in to your TradeExpress account. Sign out any you do not recognise, then change your password.">
      <Notice message={message} />
      {error ? (
        <div className="rounded-xl bg-danger-50 p-4 text-sm text-danger">
          {error} <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Try again</Button>
        </div>
      ) : !data ? <TableSkeleton rows={3} /> : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface text-navy-800"><DeviceIcon device={s.device} /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">
                    {s.device}
                    {s.current ? <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success">This device</span> : null}
                  </p>
                  <p className="text-[12px] text-muted">
                    {METHOD_LABELS[s.method] || s.method} sign-in {formatDateTime(s.signedInAt)}
                    {s.ipAddress ? ` · IP ${s.ipAddress}` : ''} · last active {formatDateTime(s.lastActiveAt)}
                  </p>
                </div>
                {!s.current ? (
                  <Button variant="outline" size="sm" icon={LogOut} loading={busyId === s.id} disabled={Boolean(busyId)} onClick={() => signOut(s)}>Sign out</Button>
                ) : null}
              </li>
            ))}
            {!data.sessions.length ? <li className="px-4 py-3 text-sm text-muted">No tracked sessions.</li> : null}
          </ul>
          {!data.currentSessionId ? (
            <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">This device signed in before session tracking was added, so it is not listed. Signing out all other devices also refreshes this one.</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[13px] text-muted"><MonitorSmartphone className="size-4" aria-hidden="true" />{others.length ? `${others.length} other device${others.length === 1 ? '' : 's'} signed in` : 'No other devices signed in'}</p>
            <Button variant="danger" size="sm" icon={LogOut} disabled={Boolean(busyId)} onClick={() => setConfirmAll(true)}>Sign out all other devices</Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmAll}
        title="Sign out all other devices?"
        text="Every other browser and phone signed in to your account will be signed out immediately, including older sign-ins. You stay signed in on this device."
        confirmLabel="Sign out others"
        cancelLabel="Cancel"
        loading={busyId === 'all'}
        onConfirm={signOutOthers}
        onCancel={() => setConfirmAll(false)}
      />
    </AccountCard>
  );
}
