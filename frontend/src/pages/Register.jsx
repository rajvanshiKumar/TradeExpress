import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import BuyerRegisterForm from '../components/forms/BuyerRegisterForm';
import SupplierRegisterForm from '../components/forms/SupplierRegisterForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';
import { Building2, ShoppingBag } from 'lucide-react';

export default function Register({ defaultRole }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState(
    defaultRole || (searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer')
  );

  useDocumentTitle(
    role === 'supplier'
      ? 'Supplier Registration — TradeExpress'
      : 'Create Your Buyer Account — TradeExpress'
  );
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

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
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
              !isSupplier
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            Join as Buyer
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('supplier')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
              isSupplier
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Become a Supplier
          </button>
        </div>
      }
      title={isSupplier ? 'Create Your Supplier Account' : 'Create Your Buyer Account'}
      subtitle={
        isSupplier
          ? 'Join TradeExpress to showcase your business and connect with B2B buyers.'
          : 'Join TradeExpress to discover suppliers, compare products and purchase confidently from businesses worldwide.'
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
