import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailQuestion } from 'lucide-react';
import AuthShell from './AuthShell';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { isEmail, normalizeEmail } from '../utils/validators';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState('');
  useDocumentTitle('Forgot password');

  const submit = (event) => {
    event.preventDefault();
    const value = normalizeEmail(email);
    if (!value) return setError('Email is required.');
    if (!isEmail(value)) return setError('Enter a valid email address, for example name@company.com.');
    setError('');
    return setSubmitted(value);
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter the email you use for TradeSphere.">
      {submitted ? (
        <div className="rounded-2xl border border-amber-200 bg-warning-50 p-6 text-center" role="status">
          <MailQuestion className="mx-auto size-10 text-warning" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">Email reset is not available yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink">Password reset links need an email service, which this site does not have yet, so no email was sent to <span className="font-semibold">{submitted}</span>.</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.8125rem] text-muted">Please contact the TradeSphere team for help, or create a new account.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button to="/info/contact" variant="navy">Contact us</Button>
            <Button to="/login" variant="outline">Back to sign in</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input id="forgot-email" label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} error={error} />
          <Button type="submit" full size="lg">Continue</Button>
          <p className="text-center text-sm text-muted">Remembered it? <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
