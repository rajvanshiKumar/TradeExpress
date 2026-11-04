import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

/**
 * Why a verification code could not be sent, shown right under the email / mobile field. (The code-entry boxes only
 * appear after a successful send, so errors from the send itself must be shown here or the button seems dead.)
 */
export default function OtpSendError({ message, role = 'buyer' }) {
  if (!message) return null;
  const alreadyRegistered = /already (exists|registered)|already has an account/i.test(message);
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-700">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {message}
        {alreadyRegistered ? (
          <>
            {' '}
            <Link to={`/login?role=${role}`} className="font-bold text-emerald-800 underline">Sign in instead</Link>
          </>
        ) : null}
      </span>
    </p>
  );
}
