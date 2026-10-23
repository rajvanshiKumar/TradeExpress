import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import RegisterForm from '../components/forms/RegisterForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

export default function Register() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(
    searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer'
  );
  useDocumentTitle('Join Free');
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return (
    <AuthShell
      wide
      role={role}
      title="Join TradeExpress free"
      subtitle="Register as a Buyer or a Supplier. Admin accounts cannot be created here."
    >
      <RegisterForm role={role} onRoleChange={setRole} />
    </AuthShell>
  );
}
