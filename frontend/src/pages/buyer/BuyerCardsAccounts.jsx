import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CircleAlert, CreditCard, Info, Landmark, Lock, Plus, RefreshCw, ShieldCheck, Smartphone, Star, Trash2, Wallet,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ErrorState from '../../components/common/ErrorState';
import { Checkbox } from '../../components/common/Input';
import CardNetworkLogo, { NETWORK_LABELS, networkKey } from '../../components/payments/CardNetworkLogo';
import paymentMethodService from '../../services/paymentMethodService';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';

const expiryLabel = (method) => (method.expiryMonth && method.expiryYear
  ? `${String(method.expiryMonth).padStart(2, '0')}/${String(method.expiryYear).slice(-2)}`
  : '—');

const CHARGE_MESSAGES = {
  refunded: 'The ₹1 verification charge has been refunded.',
  released_by_gateway: 'The ₹1 verification was only authorised and is released automatically by Razorpay.',
  refund_failed: 'We could not refund the ₹1 verification automatically. Please contact support if it is not reversed within a few days.',
};

function SectionCard({ id, icon: Icon, title, description, children, aside }) {
  return (
    <section aria-labelledby={`${id}-title`} className="ts-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 id={`${id}-title`} className="text-base font-bold text-navy-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Unavailable({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{children}
    </p>
  );
}

function SavedCard({ method, busy, anyBusy, onDefault, onDetails, onRemove }) {
  const unusable = method.status !== 'ACTIVE' || method.isExpired;
  return (
    <li className={`flex flex-col rounded-2xl border p-4 ${method.isDefault ? 'border-emerald-600 ring-1 ring-emerald-600/40' : 'border-slate-200'} ${unusable ? 'bg-slate-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <CardNetworkLogo network={method.network} size="lg" muted={unusable} />
        <div className="flex flex-wrap justify-end gap-1.5">
          {method.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <Star className="size-3.5 fill-current text-[#c8a96a]" aria-hidden="true" />Default
            </span>
          ) : null}
          {method.status !== 'ACTIVE' ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Inactive</span> : null}
          {method.status === 'ACTIVE' && method.isExpired ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Expired</span> : null}
        </div>
      </div>
      <p className="mt-4 font-mono text-base font-semibold tracking-widest text-navy-900" aria-label={`Card ending in ${method.last4}`}>
        •••• •••• •••• {method.last4 || '••••'}
      </p>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span className="truncate">{method.cardholderName || NETWORK_LABELS[networkKey(method.network)]}</span>
        <span>Expires {expiryLabel(method)}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" variant="ghost" onClick={() => onDetails(method)} disabled={busy}>Details</Button>
        {!method.isDefault && !unusable ? (
          <Button size="sm" variant="ghost" loading={busy} disabled={anyBusy} onClick={() => onDefault(method)}>Set as default</Button>
        ) : null}
        <Button size="sm" variant="dangerOutline" icon={Trash2} disabled={anyBusy} onClick={() => onRemove(method)} className="ml-auto" aria-label={`Remove card ending in ${method.last4}`}>Remove</Button>
      </div>
    </li>
  );
}

export default function BuyerCardsAccounts() {
  const { showToast } = useNotifications();
  useDocumentTitle('Cards & accounts');

  const [methods, setMethods] = useState([]);
  const [gatewayInfo, setGatewayInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [details, setDetails] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [showAllBanks, setShowAllBanks] = useState(false);
  const methodsRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [saved, gatewayData] = await Promise.all([paymentMethodService.list(), paymentMethodService.gatewayMethods()]);
      setMethods(saved);
      setGatewayInfo(gatewayData);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshMethods = async () => setMethods(await paymentMethodService.list());
  const scrollToMethods = () => methodsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const cardsEnabled = Boolean(gatewayInfo?.available && gatewayInfo.cards?.enabled);
  const supportedNetworks = (gatewayInfo?.cards?.networks || []).filter((n) => n.enabled).map((n) => n.name);

  const openAddCard = () => {
    setConsent(false);
    setAddError('');
    setAddOpen(true);
  };

  const startAddCard = async () => {
    if (adding) return;
    setAdding(true);
    setAddError('');
    const result = await paymentMethodService.addCard();
    setAdding(false);
    if (result.status === 'saved') {
      setAddOpen(false);
      await refreshMethods().catch(() => {});
      showToast(`Card ending in ${result.method.last4} saved. ${CHARGE_MESSAGES[result.verificationCharge] ?? ''}`.trim());
    } else if (result.status === 'failed') {
      setAddError(result.message);
    }
  };

  const makeDefault = async (method) => {
    if (busyId) return;
    setBusyId(method.id);
    setActionError('');
    try {
      await paymentMethodService.setDefault(method.id);
      await refreshMethods();
      showToast('Default card updated.');
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing || busyId) return;
    setBusyId(removing.id);
    setActionError('');
    try {
      await paymentMethodService.remove(removing.id);
      setRemoving(null);
      await refreshMethods();
      showToast('Card removed from TradeExpress and Razorpay.', 'info');
    } catch (error) {
      setRemoving(null);
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const checkStatus = async () => {
    if (!details || verifying) return;
    setVerifying(true);
    setActionError('');
    try {
      const updated = await paymentMethodService.verify(details.id);
      setDetails(updated);
      await refreshMethods();
      showToast(updated.status === 'ACTIVE' ? 'Card is active with the payment gateway.' : 'This card is no longer saved at the payment gateway.', updated.status === 'ACTIVE' ? 'success' : 'info');
    } catch (error) {
      setActionError(error.message);
      setDetails(null);
    } finally {
      setVerifying(false);
    }
  };

  const banks = gatewayInfo?.netbanking?.banks || [];
  const visibleBanks = showAllBanks ? banks : banks.slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Cards &amp; accounts</h1>
        <button type="button" onClick={scrollToMethods} className="rounded-md text-sm font-semibold text-emerald-800 hover:text-emerald-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">
          View all payment methods
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b3d2a] via-[#0f5132] to-[#14724a] p-6 text-white sm:p-8" aria-labelledby="pay-your-way-title">
        <div className="absolute -right-10 -top-10 size-44 rounded-full bg-[#c8a96a]/20" aria-hidden="true" />
        <div className="absolute -bottom-16 right-24 size-40 rounded-full bg-[#c8a96a]/10" aria-hidden="true" />
        <div className="relative max-w-xl">
          <h2 id="pay-your-way-title" className="text-xl font-extrabold sm:text-2xl">Pay your way on TradeExpress</h2>
          <p className="mt-2 text-sm text-emerald-50/90">Choose from secure payment methods supported by TradeExpress payment partners.</p>
          <button type="button" onClick={scrollToMethods} className="mt-5 inline-flex min-h-10 items-center rounded-full bg-[#c8a96a] px-5 text-sm font-semibold text-[#1f2a1f] transition-colors hover:bg-[#d8bd84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            Browse payment methods
          </button>
        </div>
      </section>

      {actionError ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{actionError}
        </p>
      ) : null}

      <div ref={methodsRef} id="payment-methods" className="scroll-mt-24 space-y-6">
        {loading ? (
          <div className="ts-card space-y-3 p-6" aria-busy="true" aria-label="Loading payment methods">
            <div className="h-5 w-40 animate-pulse rounded bg-navy-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-navy-50" />
            <div className="h-5 w-56 animate-pulse rounded bg-navy-50" />
          </div>
        ) : loadError ? (
          <div className="ts-card"><ErrorState title="We couldn't load your payment methods" text={loadError} onRetry={load} /></div>
        ) : (
          <>
            {!gatewayInfo?.available ? (
              <Unavailable>The payment gateway is not available right now ({gatewayInfo?.reason || 'not configured'}). Saved cards are listed below, but new cards cannot be added until it is back.</Unavailable>
            ) : gatewayInfo.mode !== 'live' ? (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Payments run in Razorpay test mode. Use Razorpay test cards only; no real money is charged.
              </p>
            ) : null}

            <SectionCard
              id="cards" icon={CreditCard} title="Cards"
              description="Save a debit or credit card for faster checkout. Cards are stored as secure tokens by Razorpay."
              aside={<Button size="sm" variant="navy" icon={Plus} onClick={openAddCard} disabled={!cardsEnabled}>Add card</Button>}
            >
              <div className="flex flex-wrap items-center gap-2" aria-label="Card networks">
                {(gatewayInfo?.cards?.networks || []).map((network) => (
                  <span key={network.code} className="flex items-center gap-1.5" title={network.enabled ? `${network.name} accepted` : `${network.name} is not supported yet`}>
                    <CardNetworkLogo network={network.code} muted={!network.enabled} />
                    {!network.enabled ? <span className="sr-only">{network.name} not supported</span> : null}
                  </span>
                ))}
              </div>
              {gatewayInfo?.available ? (
                <p className="mt-2 text-xs text-muted">
                  {supportedNetworks.length ? `Accepted: ${supportedNetworks.join(', ')}.` : 'No card networks are enabled.'} Greyed-out networks aren't supported by our payment partner yet.
                </p>
              ) : null}

              {methods.length === 0 ? (
                <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
                  <CreditCard className="size-10 text-[#c8a96a]" aria-hidden="true" />
                  <p className="mt-3 font-semibold text-navy-900">No cards saved yet.</p>
                  <p className="mt-1 max-w-sm text-sm text-muted">Add a card to pay faster at checkout. You&apos;ll only need to enter the CVV next time.</p>
                  <Button variant="navy" icon={Plus} className="mt-5" onClick={openAddCard} disabled={!cardsEnabled}>Add card</Button>
                </div>
              ) : (
                <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {methods.map((method) => (
                    <SavedCard
                      key={method.id} method={method} busy={busyId === method.id} anyBusy={Boolean(busyId)}
                      onDefault={makeDefault} onDetails={(m) => { setActionError(''); setDetails(m); }} onRemove={setRemoving}
                    />
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard id="upi" icon={Smartphone} title="UPI" description="Pay from any UPI app by approving the request on your phone.">
              {gatewayInfo?.upi?.enabled ? (
                <p className="text-sm text-ink">Choose <strong>UPI</strong> at checkout and enter your UPI ID or scan the QR code. Your UPI ID is verified by Razorpay during payment; TradeExpress never asks for or stores your UPI PIN.</p>
              ) : (
                <Unavailable>UPI isn&apos;t enabled on TradeExpress&apos;s payment gateway yet. Please use a card or net banking for now.</Unavailable>
              )}
            </SectionCard>

            <SectionCard
              id="netbanking" icon={Landmark} title="Net banking"
              description="Pay directly from your bank account. You sign in on your bank's own secure page; we never see your banking password."
            >
              {gatewayInfo?.netbanking?.enabled ? (
                <>
                  <p className="mb-3 text-sm text-ink">Available at checkout for {banks.length} banks:</p>
                  <ul className="flex flex-wrap gap-2">
                    {visibleBanks.map((bank) => <li key={bank.code} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">{bank.name}</li>)}
                  </ul>
                  {banks.length > 12 ? (
                    <button type="button" onClick={() => setShowAllBanks((value) => !value)} className="mt-3 text-sm font-semibold text-emerald-800 hover:underline" aria-expanded={showAllBanks}>
                      {showAllBanks ? 'Show fewer banks' : `Show all ${banks.length} banks`}
                    </button>
                  ) : null}
                </>
              ) : (
                <Unavailable>Net banking isn&apos;t available on our payment gateway right now.</Unavailable>
              )}
            </SectionCard>

            <SectionCard id="wallets" icon={Wallet} title="Digital wallets" description="Pay with a wallet balance at checkout.">
              {gatewayInfo?.wallets?.length ? (
                <>
                  <ul className="flex flex-wrap gap-2">
                    {gatewayInfo.wallets.map((wallet) => <li key={wallet.code} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">{wallet.name}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-muted">Wallets not listed here aren&apos;t supported by our payment partner yet.</p>
                </>
              ) : (
                <Unavailable>No digital wallets are enabled on our payment gateway yet.</Unavailable>
              )}
            </SectionCard>
          </>
        )}
      </div>

      <Modal open={addOpen} onClose={() => { if (!adding) setAddOpen(false); }} title="Add card" size="md">
        <div className="space-y-4 text-sm text-ink">
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 font-medium text-emerald-900">
            <Lock className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />Your card details are entered in Razorpay&apos;s secure window
          </p>
          <ul className="space-y-2 text-[0.8125rem] text-slate-700">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />You&apos;ll enter the cardholder name, card number, expiry and CVV in Razorpay Checkout. Razorpay detects the card network and checks the details.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />To save the card, RBI rules require a verified payment: we place a <strong>₹1 verification</strong> that you authenticate with your bank (OTP / 3-D Secure). It is refunded or released automatically.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />Make sure the option to <strong>save your card</strong> is ticked in the payment window.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />The card is stored as a token by Razorpay. TradeExpress keeps only the network, last 4 digits and expiry, never the card number or CVV.</li>
          </ul>
          {gatewayInfo?.mode !== 'live' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Test mode: use a Razorpay test card (for example a Visa or Mastercard test number from Razorpay&apos;s documentation). No real money is charged.</p>
          ) : null}
          <Checkbox
            id="card-save-consent" checked={consent} onChange={setConsent}
            label="I agree to save this card securely with Razorpay for future TradeExpress payments."
          />
          {addError ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 font-medium text-red-800">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{addError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
            <Button variant="navy" icon={Lock} onClick={startAddCard} loading={adding} disabled={!consent || !cardsEnabled}>
              {adding ? 'Waiting for Razorpay…' : 'Continue to secure card entry'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(details)} onClose={() => { if (!verifying) setDetails(null); }} title="Card details" size="sm">
        {details ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CardNetworkLogo network={details.network} size="lg" />
              <p className="font-mono text-base font-semibold tracking-widest text-navy-900">•••• {details.last4}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Network</dt><dd>{NETWORK_LABELS[networkKey(details.network)] === 'Card' ? details.network || '—' : NETWORK_LABELS[networkKey(details.network)]}</dd>
              <dt className="text-muted">Type</dt><dd className="capitalize">{details.cardType || '—'}</dd>
              <dt className="text-muted">Issuer</dt><dd>{details.issuer || '—'}</dd>
              <dt className="text-muted">Cardholder</dt><dd>{details.cardholderName || '—'}</dd>
              <dt className="text-muted">Expires</dt><dd>{expiryLabel(details)}{details.isExpired ? ' (expired)' : ''}</dd>
              <dt className="text-muted">Status</dt><dd>{details.status === 'ACTIVE' ? 'Active' : 'Inactive at payment gateway'}</dd>
              <dt className="text-muted">Saved via</dt><dd>Razorpay tokenisation</dd>
              <dt className="text-muted">Added</dt><dd>{formatDate(details.createdAt)}</dd>
              <dt className="text-muted">Last verified</dt><dd>{details.verifiedAt ? formatDate(details.verifiedAt) : '—'}</dd>
            </dl>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setDetails(null)} disabled={verifying}>Close</Button>
              <Button variant="navy" icon={RefreshCw} loading={verifying} onClick={checkStatus}>Check status</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)} loading={Boolean(removing) && busyId === removing?.id}
        onCancel={() => setRemoving(null)} onConfirm={confirmRemove}
        title="Remove this card?" confirmLabel="Remove card"
        text={removing ? `The card ending in ${removing.last4} will be deleted from TradeExpress and from Razorpay's saved cards.${removing.isDefault && methods.length > 1 ? ' Your most recent other active card will become the default.' : ''}` : ''}
      />
    </div>
  );
}
