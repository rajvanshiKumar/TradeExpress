import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import BuyerRegisterForm from '../components/forms/BuyerRegisterForm';
import SupplierRegisterForm from '../components/forms/SupplierRegisterForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { postAuthPath } from '../utils/postAuthRedirect';
import { Building2, ShoppingBag } from 'lucide-react';

export default function Register({ defaultRole }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState(
    defaultRole || (searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer')
  );

  useDocumentTitle(
    role === 'supplier'
      ? 'Supplier Sign Up — TradeExpress'
      : 'Buyer Sign Up — TradeExpress'
  );
  // Signing up for another role in this window is allowed and leaves the current sign-in untouched
  const explicitRole = defaultRole || searchParams.get('role');
  if (user && (!explicitRole || role === user.role)) return <Navigate to={postAuthPath(user)} replace />;

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setSearchParams({ role: newRole }, { replace: true });
  };

  const isSupplier = role === 'supplier';

  return (
    <AuthShell
      wide
      role={role}
      above={
        <div className="mb-6 flex rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 select-none">
          <button
            type="button"
            onClick={() => handleRoleChange('buyer')}
            className={`flex min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2 py-2 text-xs font-semibold whitespace-nowrap transition ${
              !isSupplier
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Buyer</span>
            <span className="hidden sm:inline">Sign up as Buyer</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('supplier')}
            className={`flex min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2 py-2 text-xs font-semibold whitespace-nowrap transition ${
              isSupplier
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Supplier</span>
            <span className="hidden sm:inline">Sign up as Supplier</span>
          </button>
        </div>
      }
      title={isSupplier ? 'Supplier Sign Up' : 'Buyer Sign Up'}
      subtitle={
        isSupplier
          ? 'Sign up on TradeExpress to showcase your business and connect with B2B buyers.'
          : 'Sign up to source quality products from verified manufacturers.'
      }
    >
      {isSupplier ? (
        <SupplierRegisterForm />
      ) : (
        <BuyerRegisterForm onRoleChange={handleRoleChange} />
      )}
    </AuthShell>
  );
}
