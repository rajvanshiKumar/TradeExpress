import { CreditCard } from 'lucide-react';

/** Maps Razorpay network names ("MasterCard", "American Express") and codes ("MC", "AMEX") to one key. */
export function networkKey(network) {
  const value = String(network || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (value === 'VISA') return 'visa';
  if (value === 'MC' || value.startsWith('MASTERCARD')) return 'mastercard';
  if (value.startsWith('RUPAY')) return 'rupay';
  if (value === 'MAES' || value.startsWith('MAESTRO')) return 'maestro';
  if (value === 'AMEX' || value.startsWith('AMERICANEXPRESS')) return 'amex';
  if (value === 'DICL' || value.startsWith('DINERS')) return 'diners';
  if (value === 'JCB') return 'jcb';
  if (value === 'DISC' || value.startsWith('DISCOVER')) return 'discover';
  return 'other';
}

export const NETWORK_LABELS = {
  visa: 'Visa', mastercard: 'Mastercard', rupay: 'RuPay', maestro: 'Maestro', amex: 'American Express',
  diners: 'Diners Club', jcb: 'JCB', discover: 'Discover', other: 'Card',
};

function Circles({ left, right }) {
  return (
    <svg viewBox="0 0 38 24" className="h-[70%] w-auto" aria-hidden="true">
      <circle cx="14" cy="12" r="9" fill={left} />
      <circle cx="24" cy="12" r="9" fill={right} fillOpacity="0.9" />
    </svg>
  );
}

const MARKS = {
  visa: <span className="text-[0.95em] font-black italic tracking-tight text-[#1a1f71]">VISA</span>,
  mastercard: <Circles left="#eb001b" right="#f79e1b" />,
  maestro: <Circles left="#0099df" right="#e2001a" />,
  rupay: <span className="text-[0.8em] font-black italic"><span className="text-[#097a44]">Ru</span><span className="text-[#f47920]">Pay</span></span>,
  amex: <span className="rounded-sm bg-[#2e77bb] px-1 text-[0.7em] font-black tracking-tight text-white">AMEX</span>,
  diners: <span className="text-[0.65em] font-black text-[#004a97]">DINERS</span>,
  jcb: <span className="text-[0.8em] font-black italic"><span className="text-[#0b4ea2]">J</span><span className="text-[#e60012]">C</span><span className="text-[#00923f]">B</span></span>,
  discover: <span className="flex items-center text-[0.6em] font-black tracking-tight text-[#231f20]">DISC<span className="mx-px inline-block size-[0.8em] rounded-full bg-[#f58220]" />VER</span>,
};

/** Small card-network badge. `muted` greys it out (network not supported by the gateway). */
export default function CardNetworkLogo({ network, size = 'md', muted = false, className = '' }) {
  const key = networkKey(network);
  const dims = size === 'lg' ? 'h-9 w-14 text-base' : size === 'sm' ? 'h-6 w-10 text-[11px]' : 'h-8 w-12 text-sm';
  return (
    <span
      role="img"
      aria-label={NETWORK_LABELS[key] === 'Card' && network ? String(network) : NETWORK_LABELS[key]}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white leading-none ${dims} ${muted ? 'opacity-40 grayscale' : ''} ${className}`}
    >
      {MARKS[key] ?? <CreditCard className="size-[60%] text-slate-500" aria-hidden="true" />}
    </span>
  );
}
