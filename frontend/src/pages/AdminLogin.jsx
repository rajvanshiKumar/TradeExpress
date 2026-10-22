import { useState, useEffect } from 'react';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, KeyRound, Sparkles, ArrowLeft } from 'lucide-react';
import AuthShell from './AuthShell';
import LoginForm from '../components/forms/LoginForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

/** Sign-in page for Super Admin and Staff Admin accounts */
export default function AdminLogin({ defaultTab = 'super_admin' }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get('type') || searchParams.get('role');
  const [activeTab, setActiveTab] = useState(
    requestedType === 'admin' ? 'admin' : (defaultTab === 'admin' ? 'admin' : 'super_admin')
  );

  useEffect(() => {
    if (requestedType === 'admin') setActiveTab('admin');
    else if (requestedType === 'super' || requestedType === 'super_admin') setActiveTab('super_admin');
  }, [requestedType]);

  useDocumentTitle(activeTab === 'super_admin' ? 'Super Admin Sign In' : 'Admin Sign In');
  
  if (user) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;

  const isSuper = activeTab === 'super_admin';

  const roleSwitcher = (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-center">
        <div role="radiogroup" aria-label="Admin Portal Type" className="inline-flex rounded-full bg-navy-950/10 p-1.5 ring-1 ring-navy-900/10">
          <button
            type="button"
            role="radio"
            aria-checked={isSuper}
            onClick={() => {
              setActiveTab('super_admin');
              setSearchParams({ type: 'super_admin' });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              isSuper
                ? 'bg-emerald-950 text-emerald-300 shadow-md ring-1 ring-emerald-500/40'
                : 'text-navy-700 hover:text-navy-950 hover:bg-navy-900/5'
            }`}
          >
            <ShieldCheck className={`size-4 ${isSuper ? 'text-emerald-400' : 'text-navy-500'}`} />
            <span>Super Admin</span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold text-emerald-300">
              Master
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={!isSuper}
            onClick={() => {
              setActiveTab('admin');
              setSearchParams({ type: 'admin' });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              !isSuper
                ? 'bg-navy-900 text-white shadow-md'
                : 'text-navy-700 hover:text-navy-950 hover:bg-navy-900/5'
            }`}
          >
            <ShieldAlert className={`size-4 ${!isSuper ? 'text-brand-300' : 'text-navy-500'}`} />
            <span>Staff Admin</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-navy-900/[0.08] bg-surface/80 p-3 text-center">
        <p className="text-xs font-semibold text-navy-900">
          {isSuper ? (
            <span className="text-emerald-800">
              👑 <strong>Super Admin Console:</strong> Complete authority over users, KYC, commissions, platform settings & audit logs.
            </span>
          ) : (
            <span className="text-navy-800">
              🛡️ <strong>Operations Admin:</strong> Moderation of products, categories, reviews, and support tickets.
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <AuthShell
      above={roleSwitcher}
      title={isSuper ? 'Super Admin Portal' : 'Admin Staff Portal'}
      subtitle={
        isSuper
          ? 'Enter your Super Admin credentials to access the enterprise governance console.'
          : 'For TradeSphere platform administrators and operational staff.'
      }
    >
      <LoginForm mode="admin" adminType={activeTab} />
      <div className="mt-4 text-center">
        <Link to="/login" className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-950 hover:underline">
          <ArrowLeft className="size-3" />
          <span>Back to Buyer & Supplier sign in</span>
        </Link>
      </div>
    </AuthShell>
  );
}

