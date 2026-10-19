import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, Send } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input, { Textarea } from '../../components/common/Input';
import Tabs, { TabPanel } from '../../components/common/Tabs';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import SupplierGuard from './SupplierGuard';
import useInquiries from '../../hooks/useInquiries';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import formatCurrency from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { quantityLabel } from '../../utils/units';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';

const quoteSchema = {
  unitPrice: [rules.required('Unit price'), rules.number('Unit price', { min: 0.01 })],
  leadTimeDays: [rules.required('Lead time'), rules.number('Lead time', { min: 1, max: 365, integer: true })],
  note: [rules.maxLength('Note', 500)],
};

function QuoteForm({ inquiry, onSubmit, onCancel }) {
  const versions = inquiry.quote?.versions || [];
  const currentRound = versions.length > 0 ? versions.length : inquiry.quote ? 1 : 0;
  const nextRound = currentRound === 0 ? 1 : Math.min(3, currentRound + 1);
  const maxReached = currentRound >= 3;

  const [values, setValues] = useState({
    unitPrice: inquiry.quote ? String(inquiry.quote.unitPrice) : inquiry.targetPrice ? String(inquiry.targetPrice) : '',
    leadTimeDays: inquiry.quote ? String(inquiry.quote.leadTimeDays) : '14',
    freightCharge: inquiry.quote?.freightCharge ? String(inquiry.quote.freightCharge) : '0',
    note: inquiry.quote?.note ?? '',
  });
  const [errors, setErrors] = useState({});

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const submit = (event) => {
    event.preventDefault();
    const found = validate(quoteSchema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'quote-');
    return onSubmit({
      unitPrice: Number(values.unitPrice),
      leadTimeDays: Number(values.leadTimeDays),
      freightCharge: Number(values.freightCharge || 0),
      note: values.note.trim(),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg bg-surface p-4 text-sm sm:col-span-2">
        <div className="flex items-center justify-between">
          <p className="font-medium text-navy-900">
            <span className="font-semibold">{inquiry.buyerName}</span> requested {quantityLabel(inquiry.quantity, inquiry.unit)} of <span className="font-semibold">{inquiry.productName}</span>
          </p>
          <span className="rounded bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-800">
            Round {nextRound} of 3
          </span>
        </div>
        {inquiry.targetPrice ? (
          <p className="mt-1 text-xs text-muted">Buyer Target Price: {formatCurrency(inquiry.targetPrice)} per {inquiry.unit}</p>
        ) : null}
      </div>

      <Input
        id="quote-unitPrice"
        label={`Unit price (₹ per ${inquiry.unit})`}
        required
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={values.unitPrice}
        onChange={set('unitPrice')}
        error={errors.unitPrice}
      />
      <Input
        id="quote-leadTimeDays"
        label="Lead time (days)"
        required
        type="number"
        min="1"
        inputMode="numeric"
        value={values.leadTimeDays}
        onChange={set('leadTimeDays')}
        error={errors.leadTimeDays}
      />
      <Input
        id="quote-freightCharge"
        label="Estimated Freight / Shipping (₹)"
        type="number"
        min="0"
        inputMode="numeric"
        value={values.freightCharge}
        onChange={set('freightCharge')}
        hint="Optional"
      />
      <Textarea
        id="quote-note"
        label="Note or commercial terms to the buyer"
        rows={3}
        value={values.note}
        onChange={set('note')}
        error={errors.note}
        hint="Optional (e.g. EXW dispatch, valid for 15 days)"
        wrapperClassName="sm:col-span-2"
      />

      {maxReached && (
        <div className="rounded bg-amber-50 p-2.5 text-xs text-amber-800 sm:col-span-2">
          Note: Round 3 negotiation limit is active. This will be your final offer.
        </div>
      )}

      <div className="flex justify-end gap-3 sm:col-span-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon={Send}>
          {inquiry.quote ? `Send Round ${nextRound} Quote` : 'Send Initial Quote'}
        </Button>
      </div>
    </form>
  );
}

function Inquiries({ company }) {
  const { inquiries, loading, error, reload, respondToInquiry, setInquiryStatus } = useInquiries();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [tab, setTab] = useState('open');
  const [quoting, setQuoting] = useState(null);

  const mine = inquiries.filter((inquiry) => inquiry.companyId === company.id);
  const groups = {
    open: mine.filter((inquiry) => ['Submitted', 'Viewed'].includes(inquiry.status)),
    quoted: mine.filter((inquiry) => ['Quoted', 'Negotiating', 'Accepted'].includes(inquiry.status)),
    closed: mine.filter((inquiry) => ['Closed', 'Declined'].includes(inquiry.status)),
  };
  const tabs = [
    { id: 'open', label: 'Needs a quote', count: groups.open.length },
    { id: 'quoted', label: 'Quoted & Negotiating', count: groups.quoted.length },
    { id: 'closed', label: 'Closed', count: groups.closed.length },
  ];

  const sendQuote = (quote) => {
    respondToInquiry(quoting.id, quote);
    showToast(`Quote saved on ${quoting.id}.`);
    setQuoting(null);
  };

  return (
    <div>
      <SectionHeading
        title="Inquiries"
        description="Quote requests for your products. Reply with a quote or negotiate up to 3 rounds."
        actions={<Button variant="outline" size="sm" icon={MessageSquare} onClick={() => navigate('/messages')}>Open messages</Button>}
      />
      {error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : loading ? <div className="ts-card"><TableSkeleton /></div> : mine.length === 0 ? (
        <div className="ts-card"><EmptyState icon={FileText} title="No inquiries yet" text="When a buyer requests a quote for one of your products, it appears here." /></div>
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} idPrefix="si" />
          <TabPanel id={tab} idPrefix="si" className="pt-5">
            {groups[tab].length === 0 ? <div className="ts-card"><EmptyState icon={FileText} title="Nothing in this view" text="No inquiries have this status right now." /></div> : (
              <ul className="space-y-4">
                {groups[tab].map((inquiry) => {
                  const versions = inquiry.quote?.versions || [];
                  const roundNum = versions.length > 0 ? versions.length : inquiry.quote ? 1 : 0;
                  const isAccepted = inquiry.status === 'Accepted';

                  return (
                    <li key={inquiry.id} className="ts-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-muted">{inquiry.id} · {formatDate(inquiry.createdAt)}</p>
                          <h2 className="mt-0.5 text-base font-bold">{inquiry.productName}</h2>
                          <p className="text-[0.8125rem] text-muted">From {inquiry.buyerName} · {inquiry.buyerEmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inquiry.quote && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                              Round {roundNum} of 3
                            </span>
                          )}
                          <StatusBadge status={inquiry.status} />
                        </div>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
                        <div><dt className="text-xs text-muted">Quantity</dt><dd className="font-semibold">{quantityLabel(inquiry.quantity, inquiry.unit)}</dd></div>
                        <div><dt className="text-xs text-muted">Target price</dt><dd className="font-semibold">{inquiry.targetPrice ? money(inquiry.targetPrice) : 'Not specified'}</dd></div>
                        <div><dt className="text-xs text-muted">Destination</dt><dd className="font-semibold">{inquiry.destinationCountry}</dd></div>
                        <div><dt className="text-xs text-muted">Delivery</dt><dd className="font-semibold">{inquiry.deliveryTime}</dd></div>
                      </dl>

                      <p className="mt-3 text-sm text-ink"><span className="text-muted">Specifications: </span>{inquiry.specifications}</p>
                      {inquiry.message ? <p className="mt-1 text-sm text-ink"><span className="text-muted">Message: </span>{inquiry.message}</p> : null}

                      {/* Active Quote Details */}
                      {inquiry.quote ? (
                        <div className={`mt-3 rounded-lg p-3 text-sm ${
                          isAccepted ? 'border border-emerald-300 bg-emerald-50 text-emerald-900' : 'bg-success-50 text-green-900'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">
                              {isAccepted ? 'Quote Accepted by Buyer!' : `Active Quote (Round ${roundNum} of 3):`}
                            </span>
                            <span className="text-xs font-medium">
                              Proposed by <strong className="uppercase">{inquiry.quote.lastProposedBy || 'Supplier'}</strong>
                            </span>
                          </div>
                          <p className="mt-1">
                            <span className="font-extrabold text-navy-900">{money(inquiry.quote.unitPrice)}</span> per {inquiry.unit} · {inquiry.quote.leadTimeDays} days lead time
                            {inquiry.quote.freightCharge ? ` · Freight ₹${inquiry.quote.freightCharge}` : ''}
                          </p>
                          {inquiry.quote.note && <p className="mt-1 text-xs italic text-slate-700">Note: {inquiry.quote.note}</p>}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {inquiry.status !== 'Closed' && inquiry.status !== 'Accepted' && (
                          <Button size="sm" icon={Send} onClick={() => setQuoting(inquiry)}>
                            {inquiry.quote ? `Update / Counter (Round ${Math.min(3, roundNum + 1)})` : 'Send Quote'}
                          </Button>
                        )}
                        {inquiry.status === 'Submitted' ? <Button size="sm" variant="outline" onClick={() => { setInquiryStatus(inquiry.id, 'Viewed'); showToast('Marked as viewed.', 'info'); }}>Mark as viewed</Button> : null}
                        {inquiry.status === 'Quoted' ? <Button size="sm" variant="outline" onClick={() => { setInquiryStatus(inquiry.id, 'Negotiating'); showToast('Marked as negotiating.', 'info'); }}>Mark as negotiating</Button> : null}
                        {inquiry.status !== 'Closed'
                          ? <Button size="sm" variant="ghost" onClick={() => { setInquiryStatus(inquiry.id, 'Closed'); showToast('Inquiry closed.', 'info'); }}>Close</Button>
                          : <Button size="sm" variant="outline" onClick={() => { setInquiryStatus(inquiry.id, inquiry.quote ? 'Quoted' : 'Viewed'); showToast('Inquiry reopened.', 'info'); }}>Reopen</Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabPanel>
        </>
      )}

      <Modal open={Boolean(quoting)} onClose={() => setQuoting(null)} title={quoting?.quote ? 'Negotiate / Update Quote' : 'Send Quote'} description={quoting?.id}>
        {quoting ? <QuoteForm key={quoting.id} inquiry={quoting} onSubmit={sendQuote} onCancel={() => setQuoting(null)} /> : null}
      </Modal>
    </div>
  );
}

export default function SupplierInquiries() {
  useDocumentTitle('Supplier inquiries');
  return <SupplierGuard>{(company) => <Inquiries company={company} />}</SupplierGuard>;
}
