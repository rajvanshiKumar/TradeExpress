import { CircleCheck, CircleSlash, CircleX, LoaderCircle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import useCurrency from '../../hooks/useCurrency';

/**
 * Online payment status dialog. No payment details are entered here.
 * state: 'pending' | 'failed' | 'cancelled' | 'success' | 'placing'
 */
export default function PaymentDialog({ open, state, method, amount, message, onCancel, onRetry, onPayLater, onChangeMethod, onClose }) {
  const { money } = useCurrency();
  const busy = state === 'pending' || state === 'placing';

  let body;
  if (state === 'pending') {
    body = (
      <div className="text-center" role="status">
        <LoaderCircle className="mx-auto size-11 animate-spin text-navy-700" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-bold">Payment pending</h3>
        <p className="mt-1 text-sm text-muted">Contacting the payment provider for {money(amount)}…</p>
        <Button variant="outline" full className="mt-5" onClick={onCancel}>Cancel payment</Button>
      </div>
    );
  } else if (state === 'placing') {
    body = (
      <div className="text-center" role="status">
        <LoaderCircle className="mx-auto size-11 animate-spin text-navy-700" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-bold">Placing your order…</h3>
      </div>
    );
  } else if (state === 'success') {
    body = (
      <div className="text-center" role="status">
        <CircleCheck className="mx-auto size-11 text-success" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-bold">Payment confirmed</h3>
        <p className="mt-1 text-sm text-muted">The payment provider confirmed your payment.</p>
      </div>
    );
  } else if (state === 'cancelled') {
    body = (
      <div className="text-center" role="alert">
        <CircleSlash className="mx-auto size-11 text-warning" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-bold">Payment cancelled</h3>
        <p className="mt-1 text-sm text-muted">No order was placed and nothing was charged.</p>
        <div className="mt-5 grid gap-2">
          <Button onClick={onRetry} data-autofocus>Try again</Button>
          <Button variant="outline" onClick={onChangeMethod}>Choose another payment method</Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="text-center" role="alert">
        <CircleX className="mx-auto size-11 text-danger" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-bold">Payment could not be completed</h3>
        <p className="mt-1 text-sm text-muted">{message || 'The payment did not go through. No money has been taken.'}</p>
        <div className="mt-5 grid gap-2">
          <Button onClick={onRetry} data-autofocus>Retry payment</Button>
          <Button variant="navy" onClick={onPayLater}>Place order with payment pending</Button>
          <Button variant="outline" onClick={onChangeMethod}>Choose another payment method</Button>
        </div>
        <p className="mt-3 text-xs text-muted">With payment pending, the order is recorded and the supplier arranges payment with you directly.</p>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={busy ? onCancel : onClose} title={`Pay with ${method?.label ?? ''}`} description={`Amount ${money(amount)}`} size="sm">
      {body}
    </Modal>
  );
}
