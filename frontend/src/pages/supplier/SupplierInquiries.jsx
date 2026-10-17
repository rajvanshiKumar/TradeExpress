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
  const [values, setValues] = useState({ unitPrice: inquiry.quote ? String(inquiry.quote.unitPrice) : inquiry.targetPrice ? String(inquiry.targetPrice) : '', leadTimeDays: inquiry.quote ? String(inquiry.quote.leadTimeDays) : '20', note: inquiry.quote?.note ?? '' });
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
    return onSubmit({ unitPrice: Number(values.unitPrice), leadTimeDays: Number(values.leadTimeDays), note: values.note.trim() });
  };
  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <p className="rounded-lg bg-surface px-4 py-3 text-sm sm:col-span-2">
        <span className="font-semibold">{inquiry.buyerName}</span> asked for {quantityLabel(inquiry.quantity, inquiry.unit)} of <span className="font-semibold">{inquiry.productName}</span>
        {inquiry.targetPrice ? <> at a target of {formatCurrency(inquiry.targetPrice)} per {inquiry.unit}</> : null}.
      </p>
      <Input id="quote-unitPrice" label={`Unit price (₹ per ${inquiry.unit})`} required type="number" min="0" step="0.01" inputMode="decimal" value={values.unitPrice} onChange={set('unitPrice')} error={errors.unitPrice} />
      <Input id="quote-leadTimeDays" label="Lead time (days)" required type="number" min="1" inputMode="numeric" value={values.leadTimeDays} onChange={set('leadTimeDays')} error={errors.leadTimeDays} />
      <Textarea id="quote-note" label="Note to the buyer" rows={3} value={values.note} onChange={set('note')} error={errors.note} hint="Optional" wrapperClassName="sm:col-span-2" />
      <p className="text-xs text-muted sm:col-span-2">The quote is added to the buyer's request. Email notifications are not connected yet.</p>
      <div className="flex justify-end gap-3 sm:col-span-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon={Send}>{inquiry.quote ? 'Update quote' : 'Send quote'}</Button>
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
    quoted: mine.filter((inquiry) => ['Quoted', 'Negotiating'].includes(inquiry.status)),
    closed: mine.filter((inquiry) => inquiry.status === 'Closed'),
  };
  const tabs = [{ id: 'open', label: 'Needs a quote', count: groups.open.length }, { id: 'quoted', label: 'Quoted', count: groups.quoted.length }, { id: 'closed', label: 'Closed', count: groups.closed.length }];

  const sendQuote = (quote) => {
    respondToInquiry(quoting.id, quote);
    showToast(`Quote saved on ${quoting.id}.`);
    setQuoting(null);
  };

  return (
    <div>
      <SectionHeading title="Inquiries" description="Quote requests for your products. Reply with a quote to move a request to “Quoted”." actions={<Button variant="outline" size="sm" icon={MessageSquare} onClick={() => navigate('/messages')}>Open messages</Button>} />
      {error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : loading ? <div className="ts-card"><TableSkeleton /></div> : mine.length === 0 ? (
        <div className="ts-card"><EmptyState icon={FileText} title="No inquiries yet" text="When a buyer requests a quote for one of your products, it appears here." /></div>
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} idPrefix="si" />
          <TabPanel id={tab} idPrefix="si" className="pt-5">
            {groups[tab].length === 0 ? <div className="ts-card"><EmptyState icon={FileText} title="Nothing in this view" text="No inquiries have this status right now." /></div> : (
              <ul className="space-y-4">
                {groups[tab].map((inquiry) => (
                  <li key={inquiry.id} className="ts-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted">{inquiry.id} · {formatDate(inquiry.createdAt)}</p>
                        <h2 className="mt-0.5 text-base font-bold">{inquiry.productName}</h2>
                        <p className="text-[0.8125rem] text-muted">From {inquiry.buyerName} · {inquiry.buyerEmail}</p>
                      </div>
                      <StatusBadge status={inquiry.status} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
                      <div><dt className="text-xs text-muted">Quantity</dt><dd className="font-semibold">{quantityLabel(inquiry.quantity, inquiry.unit)}</dd></div>
                      <div><dt className="text-xs text-muted">Target price</dt><dd className="font-semibold">{inquiry.targetPrice ? money(inquiry.targetPrice) : 'Not specified'}</dd></div>
                      <div><dt className="text-xs text-muted">Destination</dt><dd className="font-semibold">{inquiry.destinationCountry}</dd></div>
                      <div><dt className="text-xs text-muted">Delivery</dt><dd className="font-semibold">{inquiry.deliveryTime}</dd></div>
                    </dl>
                    <p className="mt-3 text-sm text-ink"><span className="text-muted">Specifications: </span>{inquiry.specifications}</p>
                    {inquiry.message ? <p className="mt-1 text-sm text-ink"><span className="text-muted">Message: </span>{inquiry.message}</p> : null}
                    {inquiry.quote ? <p className="mt-3 rounded-lg bg-success-50 px-4 py-2.5 text-sm text-green-800">Your quote: <span className="font-bold">{money(inquiry.quote.unitPrice)}</span> per {inquiry.unit}, {inquiry.quote.leadTimeDays} days lead time.</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {inquiry.status !== 'Closed' ? <Button size="sm" icon={Send} onClick={() => setQuoting(inquiry)}>{inquiry.quote ? 'Update quote' : 'Send quote'}</Button> : null}
                      {inquiry.status === 'Submitted' ? <Button size="sm" variant="outline" onClick={() => { setInquiryStatus(inquiry.id, 'Viewed'); showToast('Marked as viewed.', 'info'); }}>Mark as viewed</Button> : null}
                      {inquiry.status === 'Quoted' ? <Button size="sm" variant="outline" onClick={() => { setInquiryStatus(inquiry.id, 'Negotiating'); showToast('Marked as negotiating.', 'info'); }}>Mark as negotiating</Button> : null}
                      {inquiry.status !== 'Closed'
                        ? <Button size="sm" variant="ghost" onClick={() => { setInquiryStatus(inquiry.id, 'Closed'); showToast('Inquiry closed.', 'info'); }}>Close</Button>
                        : <Button size="sm" variant="outline" onClick={() => { setInquiryStatus(inquiry.id, inquiry.quote ? 'Quoted' : 'Viewed'); showToast('Inquiry reopened.', 'info'); }}>Reopen</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        </>
      )}

      <Modal open={Boolean(quoting)} onClose={() => setQuoting(null)} title={quoting?.quote ? 'Update quote' : 'Send a quote'} description={quoting?.id}>
        {quoting ? <QuoteForm key={quoting.id} inquiry={quoting} onSubmit={sendQuote} onCancel={() => setQuoting(null)} /> : null}
      </Modal>
    </div>
  );
}

export default function SupplierInquiries() {
  useDocumentTitle('Supplier inquiries');
  return <SupplierGuard>{(company) => <Inquiries company={company} />}</SupplierGuard>;
}
