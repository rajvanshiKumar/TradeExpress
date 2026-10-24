import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import RegisterForm from '../components/forms/RegisterForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

export default function Register() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState(
    searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer'
  );
  useDocumentTitle('Join Free');
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setSearchParams({ role: newRole }, { replace: true });
  };

  return (
    <AuthShell
      wide
      role={role}
      title="Join TradeExpress free"
      subtitle={
        role === 'supplier'
          ? 'Register as a Supplier to list products and reach verified global buyers.'
          : 'Register as a Buyer to source products and connect with verified suppliers.'
      }
    >
      <RegisterForm role={role} onRoleChange={handleRoleChange} />
    </AuthShell>
  );
}
