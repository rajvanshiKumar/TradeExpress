import { Navigate } from 'react-router-dom';
import AuthShell from './AuthShell';
import RegisterForm from '../components/forms/RegisterForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

export default function Register() {
  const { user } = useAuth();
  useDocumentTitle('Join Free');
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return (
    <AuthShell wide title="Join TradeSphere free" subtitle="Register as a Buyer or a Supplier. Admin accounts cannot be created here.">
      <RegisterForm />
    </AuthShell>
  );
}
