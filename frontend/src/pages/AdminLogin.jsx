import { Navigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import AuthShell from './AuthShell';
import LoginForm from '../components/forms/LoginForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

/** Sign-in page for Super Admin account */
export default function AdminLogin() {
  const { user } = useAuth();

  useDocumentTitle('Super Admin Sign In');

  if (user) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;

  const topBadge = (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-300 shadow-md ring-1 ring-emerald-500/40">
          <ShieldCheck className="size-4 text-emerald-400" />
          <span>Super Admin</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold text-emerald-300">
            Master
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-navy-900/[0.08] bg-surface/80 p-3 text-center">
        <p className="text-xs font-semibold text-emerald-800">
          👑 <strong>Super Admin Console:</strong> Complete authority over users, KYC, commissions, platform settings & audit logs.
        </p>
      </div>
    </div>
  );

  return (
    <AuthShell
      above={topBadge}
      title="Super Admin Portal"
      subtitle="Enter your Super Admin credentials to access the enterprise governance console."
    >
      <LoginForm mode="admin" adminType="super_admin" />
      <div className="mt-4 text-center">
        <Link to="/login" className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-950 hover:underline">
          <ArrowLeft className="size-3" />
          <span>Back to Buyer & Supplier sign in</span>
        </Link>
      </div>
    </AuthShell>
  );
}

