import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import LoginForm from '../components/forms/LoginForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

const ROLES = [
  { id: 'buyer', label: 'Buyer' },
  { id: 'supplier', label: 'Supplier' },
];

export default function Login() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer');
  useDocumentTitle('Sign In');
  // Already signed in: go to the right dashboard instead of showing the form again.
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const switcher = (
    <div className="mb-7">
      <div role="radiogroup" aria-label="Account type" className="inline-flex flex-wrap items-center gap-1 rounded-full bg-ivory p-1 ring-1 ring-navy-900/[0.08]">
        {ROLES.map((item) => (
          <button
            key={item.id} type="button" role="radio" aria-checked={role === item.id} onClick={() => setRole(item.id)}
            className={`rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-all ${role === item.id ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-700 hover:text-navy-900'}`}
          >
            {item.label}
          </button>
        ))}
        <Link to="/admin/login" className="rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-navy-700 hover:text-navy-900">
          Admin
        </Link>
        <Link
          to="/super-admin/login"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/10 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-900 hover:text-white transition-all ring-1 ring-emerald-600/30"
        >
          <span>👑 Super Admin</span>
        </Link>
      </div>
    </div>
  );

  return (
    <AuthShell above={switcher} title={role === 'supplier' ? 'Supplier sign in' : 'Welcome back'} subtitle={location.state?.from ? 'Please sign in to continue.' : role === 'supplier' ? 'Manage your catalogue, quotations and orders.' : 'Sign in to source products and track your quotations.'}>
      <LoginForm key={role} role={role} />
    </AuthShell>
  );
}
