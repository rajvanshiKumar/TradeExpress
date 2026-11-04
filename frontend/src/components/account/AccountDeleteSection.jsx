import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import { AccountCard } from './AccountUi';
import { CodeStep, Notice, Steps } from './AccountVerificationFlows';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import { deleteAccount, getDeletionStatus, sendAccountCode, verifyAccountCode } from '../../services/accountApi';

const CONSEQUENCES = [
  'You will be signed out on every device and will not be able to sign in to this account again.',
  'Your name, email address, phone number, photo, saved addresses and saved cards will be removed.',
  'Your email address can be used to register a new account later.',
  'Records we must keep by law, such as past orders and tax invoices, are retained.',
];

const SUPPLIER_CONSEQUENCES = ['Your products will be removed from the marketplace and open quotations will be withdrawn.'];
const BUYER_CONSEQUENCES = ['Your open requests for quotation (RFQs) will be closed.'];

const BLOCKER_LINKS = {
  buyer: { ACTIVE_ORDERS: '/buyer/orders', ESCROW_HELD: '/buyer/orders', OPEN_DISPUTES: '/buyer/disputes' },
  supplier: { ACTIVE_ORDERS: '/supplier/orders', ESCROW_HELD: '/supplier/payments', OPEN_DISPUTES: '/supplier/orders', PENDING_PAYOUTS: '/supplier/payments' },
};

/** Delete Account: review consequences and blockers, verify by email, confirm, then a final "are you sure" dialog. */
export default function AccountDeleteSection({ settings, role }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useNotifications();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [grant, setGrant] = useState('');
  const [typed, setTyped] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);

  const loadStatus = async () => {
    setStatusError('');
    setStatus(null);
    try {
      setStatus(await getDeletionStatus());
    } catch (err) {
      setStatusError(err.message || 'We could not check your account. Please try again.');
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const confirmed = typed.trim() === 'DELETE' && understood;

  const finalDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setMessage(null);
    try {
      await deleteAccount({ grant, confirmation: typed.trim() });
      setConfirmOpen(false);
      logout();
      showToast('Your account has been deleted. We are sorry to see you go.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setConfirmOpen(false);
      setMessage({ type: 'error', text: err.message || 'Your account could not be deleted. Please try again.' });
      // An expired or used authorization means verifying the email again
      if (err.status === 400 && /verify your email again/i.test(err.message || '')) {
        setGrant('');
        setStep(1);
      }
      if (err.status === 409) {
        setGrant('');
        setStep(0);
        loadStatus();
      }
    } finally {
      setDeleting(false);
    }
  };

  const consequences = [...CONSEQUENCES, ...(role === 'supplier' ? SUPPLIER_CONSEQUENCES : BUYER_CONSEQUENCES)];

  return (
    <AccountCard>
      <Steps steps={['Review', 'Verify your email', 'Confirm']} current={step} />
      <Notice message={message} />

      {step === 0 ? (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-danger/20 bg-danger-50 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h3 className="font-display text-base font-bold text-danger">Deleting your account is permanent</h3>
              <p className="mt-1 text-sm text-navy-900">Please read what will happen before you continue. This cannot be undone.</p>
            </div>
          </div>

          <ul className="list-disc space-y-2 pl-5 text-sm text-ink marker:text-danger">
            {consequences.map((line) => <li key={line}>{line}</li>)}
          </ul>

          {statusError ? (
            <div role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger">
              <p>{statusError}</p>
              <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={loadStatus}>Try again</Button>
            </div>
          ) : null}

          {!status && !statusError ? <p className="text-sm text-muted" role="status">Checking your account…</p> : null}

          {status && !status.canDelete ? (
            <div className="rounded-xl border border-warning/30 bg-warning-50 p-4">
              <p className="text-sm font-semibold text-navy-900">Your account can’t be deleted yet. Please finish the following first:</p>
              <ul className="mt-3 space-y-2">
                {status.blockers.map((blocker) => {
                  const to = BLOCKER_LINKS[role]?.[blocker.type];
                  return (
                    <li key={blocker.type} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                      <span>{blocker.message}</span>
                      {to ? <Link to={to} className="inline-flex items-center gap-1 font-semibold text-success hover:underline">Review <ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button to={`/${role === 'supplier' ? 'supplier' : 'buyer'}/account-settings`} variant="ghost">Keep my account</Button>
            <Button variant="danger" iconRight={ArrowRight} disabled={!status?.canDelete} onClick={() => { setMessage(null); setStep(1); }}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <CodeStep
          title="Verify it’s you"
          description={`To protect your account, we will send a code to ${settings.profile.maskedEmail} before deleting it.`}
          onBack={() => setStep(0)}
          send={() => sendAccountCode('ACCOUNT_DELETE')}
          verify={async (otp) => {
            const result = await verifyAccountCode('ACCOUNT_DELETE', otp);
            setGrant(result.grant);
            setMessage(null);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmed) setConfirmOpen(true);
          }}
        >
          <p className="text-sm text-ink">To confirm, type <strong className="font-mono">DELETE</strong> in capital letters below.</p>
          <Input id="delete-confirmation" label="Confirmation" required autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={10} />
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 size-4 accent-danger" />
            I understand that my account will be deleted permanently and this cannot be undone.
          </label>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(0)}>Back</Button>
            <Button type="submit" variant="danger" icon={Trash2} disabled={!confirmed}>Delete my account</Button>
          </div>
        </form>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => { if (!deleting) setConfirmOpen(false); }}
        title="Delete your TradeExpress account?"
        description="This action is permanent and cannot be undone."
        size="sm"
        footer={(
          <>
            <Button variant="outline" disabled={deleting} onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={deleting} onClick={finalDelete}>Yes, delete my account</Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-ink">
          <p>Are you sure you want to permanently delete the account for <strong>{settings.profile.maskedEmail}</strong>?</p>
          <p className="text-muted">You will be signed out immediately, and your personal details, saved addresses and saved cards will be removed.</p>
        </div>
      </Modal>
    </AccountCard>
  );
}
