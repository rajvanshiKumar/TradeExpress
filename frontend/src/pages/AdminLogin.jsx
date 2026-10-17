import { Navigate } from 'react-router-dom';
import AuthShell from './AuthShell';
import LoginForm from '../components/forms/LoginForm';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ROLE_HOME } from '../utils/constants';

/** Separate sign-in page for the single Admin account. There is no public Admin registration. */
export default function AdminLogin() {
  const { user } = useAuth();
  useDocumentTitle('Admin sign in');
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return (
    <AuthShell title="Admin sign in" subtitle="For the TradeSphere administrator only. Buyers and suppliers sign in on the main sign-in page.">
      <LoginForm mode="admin" />
    </AuthShell>
  );
}
