import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { AccountCard, DetailRow, StatusBadge } from './AccountUi';
import { formatDate } from '../../utils/formatDate';

/** Member Profile: read-only facts from the server. */
export function AccountMemberSection({ settings }) {
  const { member } = settings;
  return (
    <AccountCard title="Member profile" description="These details are managed by TradeExpress and cannot be edited.">
      <dl>
        <DetailRow label="Member ID"><span className="font-mono">{member.memberId}</span></DetailRow>
        <DetailRow label="Account type">{member.accountType}</DetailRow>
        <DetailRow label="Registered on">{formatDate(member.registeredAt)}</DetailRow>
        <DetailRow label="Account status"><StatusBadge status={member.status} /></DetailRow>
        <DetailRow label="Email verification"><StatusBadge status={member.emailVerification} /></DetailRow>
        <DetailRow label="Phone verification"><StatusBadge status={member.phoneVerification} /></DetailRow>
        {member.businessVerification ? (
          <DetailRow label="Business verification">
            <span className="inline-flex flex-col items-start gap-1 sm:items-end">
              <StatusBadge status={member.businessVerification} />
              {member.businessVerificationNote ? <span className="text-xs text-danger">{member.businessVerificationNote}</span> : null}
            </span>
          </DetailRow>
        ) : null}
      </dl>
    </AccountCard>
  );
}

const PROVIDER_LOGOS = {
  google: (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  ),
};

/** Connected Accounts: only real links stored on the account. */
export function AccountConnectedSection({ settings }) {
  return (
    <AccountCard title="Connected accounts" description="Sign-in methods linked to your TradeExpress account.">
      <ul className="divide-y divide-line">
        {settings.connectedAccounts.map((account) => (
          <li key={account.provider} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <span className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-white">{PROVIDER_LOGOS[account.provider]}</span>
              <span>
                <span className="block font-semibold text-navy-900">{account.label}</span>
                <span className="block text-sm text-muted">{account.connected ? account.email : 'Not connected'}</span>
              </span>
            </span>
            <StatusBadge status={account.connected ? 'LINKED' : 'NOT_ADDED'} />
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-2 rounded-xl bg-surface p-3.5 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          Google is linked automatically the first time you use “Continue with Google” with this account’s email address.
          You can always sign in with a one-time code sent to your registered email.
        </span>
      </p>
    </AccountCard>
  );
}

/** Tax Information: masked values; changes go through the verification flows that control them. */
export function AccountTaxSection({ settings, role }) {
  const { tax } = settings;
  if (!tax) return null;
  return (
    <AccountCard title="Tax information" description="Tax identifiers are masked for your security.">
      <dl>
        <DetailRow label="Legal business name">{tax.legalBusinessName}</DetailRow>
        <DetailRow label="GSTIN"><span className="font-mono">{tax.gstin}</span></DetailRow>
        <DetailRow label="GST registration">{tax.gstStatus}</DetailRow>
        <DetailRow label="PAN"><span className="font-mono">{tax.pan}</span></DetailRow>
        <DetailRow label="PAN–Aadhaar link"><StatusBadge status={tax.panAadhaarStatus} /></DetailRow>
        <DetailRow label="Billing address">{tax.billingAddress}</DetailRow>
      </dl>
      {role === 'supplier' ? (
        <Link to="/supplier/verification" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-success hover:underline">
          Update tax details in Business Verification <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-4 text-sm text-muted">To change your GSTIN or PAN, please raise a support ticket so the new details can be verified.</p>
      )}
    </AccountCard>
  );
}
