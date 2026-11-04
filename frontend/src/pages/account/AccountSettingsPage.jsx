import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, LogOut, Pencil, RefreshCw } from 'lucide-react';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useAuth from '../../hooks/useAuth';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { getAccountSettings } from '../../services/accountApi';
import { ACCOUNT_CARDS, ACCOUNT_SECTION_TITLES, DASHBOARD_HOME } from '../../components/account/accountSections';
import { AccountAvatar, AccountSkeleton } from '../../components/account/AccountUi';
import AccountProfileSection from '../../components/account/AccountProfileSection';
import { AccountConnectedSection, AccountMemberSection, AccountTaxSection } from '../../components/account/AccountInfoSections';
import { AccountEmailSection, AccountPasswordSection, AccountPhoneSection } from '../../components/account/AccountVerificationFlows';
import AccountDeleteSection from '../../components/account/AccountDeleteSection';
import AccountSessionsSection from '../../components/account/AccountSessionsSection';
import { AccountEmailPreferencesSection, AccountLanguageSection, AccountNotificationPreferencesSection, AccountPrivacySection } from '../../components/account/AccountPreferenceSections';

const SECTION_COMPONENTS = {
  profile: AccountProfileSection,
  member: AccountMemberSection,
  connected: AccountConnectedSection,
  tax: AccountTaxSection,
  password: AccountPasswordSection,
  email: AccountEmailSection,
  phone: AccountPhoneSection,
  sessions: AccountSessionsSection,
  privacy: AccountPrivacySection,
  'email-preferences': AccountEmailPreferencesSection,
  notifications: AccountNotificationPreferencesSection,
  language: AccountLanguageSection,
  delete: AccountDeleteSection,
};

const ROLE_BADGE = {
  buyer: 'bg-sky-50 text-sky-800 ring-sky-200',
  supplier: 'bg-success-50 text-success ring-success/20',
  super_admin: 'bg-navy-900 text-white ring-navy-900',
};

/**
 * Account Settings for Buyers (/buyer/account-settings), Suppliers (/supplier/account-settings) and the
 * Super Admin (/super-admin/account-settings). One shared page; the data and rows depend on the role.
 */
export default function AccountSettingsPage() {
  const { section } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const role = user?.role;
  const basePath = `/${pathname.split('/')[1]}/account-settings`;
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const visibleCards = ACCOUNT_CARDS.map((card) => ({ ...card, rows: card.rows.filter((row) => !row.roles || row.roles.includes(role)) }));
  const sectionRow = visibleCards.flatMap((card) => card.rows).find((row) => row.id === section);
  const SectionComponent = sectionRow?.available ? SECTION_COMPONENTS[section] : null;
  useDocumentTitle(section && ACCOUNT_SECTION_TITLES[section] ? `${ACCOUNT_SECTION_TITLES[section]} | Account Settings` : 'Account Settings | TradeExpress');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSettings(await getAccountSettings());
    } catch (err) {
      setError(err.message || 'Your account settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unknown or not-yet-available sections go back to the overview
  useEffect(() => {
    if (section && !SectionComponent) navigate(basePath, { replace: true });
  }, [section, SectionComponent, navigate, basePath]);

  const handleUpdated = (next) => {
    setSettings(next);
    // Keep the header avatar and name in step with the saved profile
    updateProfile({ name: next.profile.name, avatarUrl: next.profile.avatarUrl });
  };

  // After a verified phone change: refresh the account and keep the local profile in step
  const handlePhoneChanged = async (result) => {
    if (result?.phone) updateProfile({ phone: result.phone });
    try {
      setSettings(await getAccountSettings());
    } catch {
      // The change succeeded; the page shows the new number after a refresh
    }
  };

  // After a verified email change: refresh the account and keep the local profile in step
  const handleEmailChanged = async (email) => {
    updateProfile({ email });
    try {
      setSettings(await getAccountSettings());
    } catch {
      // The change succeeded; the page shows the new email after a refresh
    }
  };

  const signOut = () => {
    logout();
    navigate('/', { replace: true });
  };

  const breadcrumbs = [
    { label: 'Dashboard', to: DASHBOARD_HOME[role] || '/' },
    section && SectionComponent ? { label: 'Account Settings', to: basePath } : { label: 'Account Settings' },
    ...(section && SectionComponent ? [{ label: ACCOUNT_SECTION_TITLES[section] }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <Breadcrumbs items={breadcrumbs} />
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
          {section && SectionComponent ? ACCOUNT_SECTION_TITLES[section] : 'Account Settings'}
        </h1>
      </div>

      {loading && !settings ? <AccountSkeleton /> : null}

      {error && !settings ? (
        <div role="alert" className="rounded-2xl border border-danger/20 bg-danger-50 p-5 text-sm text-danger">
          <p className="font-semibold">{error}</p>
          <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : null}

      {settings && section && SectionComponent ? (
        <div className="space-y-4">
          <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-success hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to Account Settings
          </Link>
          <SectionComponent settings={settings} role={role} onUpdated={handleUpdated} onEmailChanged={handleEmailChanged} onPhoneChanged={handlePhoneChanged} />
        </div>
      ) : null}

      {settings && !section ? (
        <>
          {/* Profile header */}
          <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <AccountAvatar name={settings.profile.name} avatarUrl={settings.profile.avatarUrl} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-display text-xl font-bold text-navy-900">{settings.profile.name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${ROLE_BADGE[role] || ROLE_BADGE.buyer}`}>{settings.profile.roleLabel}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">{settings.profile.maskedEmail}</p>
                <p className="mt-0.5 text-xs text-muted">Member ID <span className="font-mono font-semibold text-ink">{settings.member.memberId}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button to={`${basePath}/profile`} variant="navy" size="sm" icon={Pencil}>Edit profile</Button>
              <Button variant="outline" size="sm" icon={LogOut} onClick={() => setConfirmSignOut(true)}>Sign out</Button>
            </div>
            <ConfirmDialog
              open={confirmSignOut}
              title="Sign out of TradeExpress?"
              text="You will need to sign in again to view your orders, messages and account settings."
              confirmLabel="Sign out"
              cancelLabel="Stay signed in"
              onConfirm={signOut}
              onCancel={() => setConfirmSignOut(false)}
            />
          </section>

          {/* Settings cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <section key={card.id} aria-labelledby={`account-card-${card.id}`} className="rounded-2xl border border-line bg-white shadow-card">
                  <h2 id={`account-card-${card.id}`} className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-base font-bold text-navy-900">
                    <CardIcon className="size-4 text-success" aria-hidden="true" /> {card.title}
                  </h2>
                  <ul className="p-2">
                    {card.rows.map((row) => {
                      const RowIcon = row.icon;
                      const content = (
                        <>
                          <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${row.danger ? 'bg-danger-50 text-danger' : 'bg-success-50 text-success'}`}>
                            <RowIcon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-semibold ${row.danger ? 'text-danger' : 'text-navy-900'}`}>{row.label}</span>
                            <span className="block truncate text-xs text-muted">{row.description}</span>
                          </span>
                          {row.available ? (
                            <ChevronRight className="size-4 shrink-0 text-muted transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                          ) : (
                            <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">Coming soon</span>
                          )}
                        </>
                      );
                      return (
                        <li key={row.id}>
                          {row.available ? (
                            <Link to={`${basePath}/${row.id}`} className="group flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success">
                              {content}
                            </Link>
                          ) : (
                            <div className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 opacity-70" aria-disabled="true">
                              {content}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
