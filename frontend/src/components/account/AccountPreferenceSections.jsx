import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import Button from '../common/Button';
import CustomSelect from '../common/CustomSelect';
import { TableSkeleton } from '../common/Skeleton';
import { AccountCard } from './AccountUi';
import { Notice } from './AccountVerificationFlows';
import { useTranslation } from '../../i18n/LanguageContext';
import { SUPPORTED_COUNTRIES, SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { exportAccountData, getPreferences, updatePreferences } from '../../services/accountApi';
import { formatDateTime } from '../../utils/formatDate';

/** Loads the account's preferences and saves partial changes. */
function usePreferences() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await getPreferences());
    } catch (err) {
      setError(err.message || 'Your preferences could not be loaded.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (changes, successText) => {
    setSaving(true);
    setMessage(null);
    try {
      setData(await updatePreferences(changes));
      setMessage({ type: 'success', text: successText || 'Your preferences have been saved.' });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Your preferences could not be saved.' });
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { data, error, message, saving, load, save };
}

function Toggle({ id, label, description, checked, disabled, onChange, locked }) {
  return (
    <label htmlFor={id} className={`flex items-start justify-between gap-4 px-4 py-3 ${disabled || locked ? '' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-sm font-semibold text-navy-900">{label}</span>
        {description ? <span className="block text-[13px] text-muted">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled || locked} onChange={(e) => onChange?.(e.target.checked)} />
        <span className={`h-6 w-11 rounded-full transition-colors ${checked ? 'bg-success' : 'bg-slate-300'} ${locked ? 'opacity-60' : ''} peer-focus-visible:ring-2 peer-focus-visible:ring-success/40`} aria-hidden="true" />
        <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} aria-hidden="true" />
      </span>
    </label>
  );
}

function LoadState({ error, onRetry }) {
  if (!error) return <TableSkeleton rows={4} />;
  return <div className="rounded-xl bg-danger-50 p-4 text-sm text-danger">{error} <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRetry}>Try again</Button></div>;
}

/** Notification Preferences: in-app alert categories. The server skips muted ones. */
export function AccountNotificationPreferencesSection() {
  const { data, error, message, saving, load, save } = usePreferences();
  return (
    <AccountCard title="Notification preferences" description="Choose which in-app alerts you receive in the notification bell.">
      <Notice message={message} />
      {!data ? <LoadState error={error} onRetry={load} /> : (
        <>
          <div className="divide-y divide-line rounded-xl border border-line">
            {data.categories.map((category) => (
              <Toggle
                key={category.id}
                id={`notify-${category.id}`}
                label={category.label}
                checked={data.preferences.notifications[category.id] !== false}
                disabled={saving}
                onChange={(on) => save({ notifications: { [category.id]: on } }, `${category.label} alerts turned ${on ? 'on' : 'off'}.`)}
              />
            ))}
            <Toggle id="notify-account" label="Account, security and dispute alerts" description="Always on so you never miss sign-in, password or dispute notices." checked locked />
          </div>
          <p className="mt-3 text-[13px] text-muted">Turning a category off stops new alerts of that kind. Emails you need, such as order confirmations and delivery codes, are still sent.</p>
        </>
      )}
    </AccountCard>
  );
}

/** Email Preferences: transactional emails are always sent; product news needs consent. */
export function AccountEmailPreferencesSection() {
  const { data, error, message, saving, load, save } = usePreferences();
  return (
    <AccountCard title="Email preferences" description="Emails TradeExpress sends to your registered address.">
      <Notice message={message} />
      {!data ? <LoadState error={error} onRetry={load} /> : (
        <>
          <div className="divide-y divide-line rounded-xl border border-line">
            <Toggle id="email-transactional" label="Orders, deliveries and payments" description="Order confirmations, delivery codes and payment receipts. Required to use TradeExpress." checked locked />
            <Toggle id="email-security" label="Security and sign-in" description="Verification codes and notices about password, email or phone changes. Required for your safety." checked locked />
            <Toggle
              id="email-product"
              label="Product news and offers"
              description="Occasional updates about new TradeExpress features and offers."
              checked={Boolean(data.preferences.email.productUpdates)}
              disabled={saving}
              onChange={(on) => save({ email: { productUpdates: on } }, on ? 'You have opted in to product news.' : 'You have opted out of product news.')}
            />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            TradeExpress does not currently send marketing emails; your choice is recorded and respected if it does.
            {data.preferences.email.consentUpdatedAt ? ` Last changed ${formatDateTime(data.preferences.email.consentUpdatedAt)}.` : ''}
          </p>
        </>
      )}
    </AccountCard>
  );
}

/** Language Preferences: saved to the account and applied on every sign-in. */
export function AccountLanguageSection() {
  const { data, error, message, saving, load, save } = usePreferences();
  const { setLanguage, setCountry } = useTranslation();
  const [draft, setDraft] = useState(null);
  useEffect(() => { if (data && !draft) setDraft(data.preferences.language); }, [data, draft]);

  const submit = async (event) => {
    event.preventDefault();
    if (!draft || saving) return;
    if (await save({ language: draft }, 'Language and region saved. They will be used whenever you sign in.')) {
      setLanguage(draft.language);
      setCountry(draft.country);
    }
  };

  return (
    <AccountCard title="Language preferences" description="The language and region TradeExpress uses for you on every device.">
      <Notice message={message} />
      {!data || !draft ? <LoadState error={error} onRetry={load} /> : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pref-language" className="ts-label">Language</label>
              <CustomSelect id="pref-language" value={draft.language} onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))} searchable={false} options={SUPPORTED_LANGUAGES.filter((l) => data.languages.includes(l.code)).map((l) => ({ value: l.code, label: `${l.nativeName} (${l.label})` }))} />
            </div>
            <div>
              <label htmlFor="pref-country" className="ts-label">Country / region</label>
              <CustomSelect id="pref-country" value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} searchable={false} options={SUPPORTED_COUNTRIES.filter((c) => data.countries.includes(c.name)).map((c) => ({ value: c.name, label: `${c.flag} ${c.name}`, description: `Prices in ${c.currency}` }))} />
            </div>
          </div>
          <div className="flex justify-end"><Button type="submit" loading={saving}>Save language & region</Button></div>
        </form>
      )}
    </AccountCard>
  );
}

/** Privacy Settings: download a copy of your data, and who can see what. */
export function AccountPrivacySection({ role }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tradeexpress-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Your data has been downloaded.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Your data could not be exported.' });
    } finally {
      setBusy(false);
    }
  };

  const visibility = role === 'supplier'
    ? [
      ['Buyers and visitors', 'Your company profile, products, prices and ratings (that is how buyers find you).'],
      ['Buyers you trade with', 'Your company name, business address and invoice details on their orders.'],
      ['TradeExpress staff', 'Your account, KYC documents and orders, to verify and support you.'],
    ]
    : [
      ['Suppliers you order from', 'Your name, company, delivery address and phone on their orders, so they can deliver.'],
      ['Other buyers and visitors', 'Nothing. Your account and orders are private.'],
      ['TradeExpress staff', 'Your account and orders, to support you and resolve disputes.'],
    ];

  return (
    <AccountCard title="Privacy settings" description="What is shared about you, and a copy of your data.">
      <Notice message={message} />
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy-900"><Eye className="size-4" aria-hidden="true" />Who can see your information</h3>
        <dl className="mt-2 divide-y divide-line rounded-xl border border-line">
          {visibility.map(([who, what]) => (
            <div key={who} className="px-4 py-3 text-sm"><dt className="font-semibold text-navy-900">{who}</dt><dd className="text-muted">{what}</dd></div>
          ))}
        </dl>
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Passwords and verification codes are never visible to anyone, including TradeExpress staff.</p>
      </section>
      <section className="mt-5 rounded-xl border border-line p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy-900"><ShieldCheck className="size-4" aria-hidden="true" />Download your data</h3>
        <p className="mt-1 text-sm text-muted">A file with your profile, saved addresses, orders, sign-in history, preferences and recent notifications.</p>
        <Button className="mt-3" variant="outline" icon={Download} loading={busy} onClick={download}>Download my data</Button>
      </section>
    </AccountCard>
  );
}
