import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/Badge';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import { formatDate } from '../../utils/formatDate';
import { quantityLabel } from '../../utils/units';

/** Buyer-facing list of quote requests with their status and any quote received. */
export default function InquiryList({ inquiries }) {
  const { getProduct, getCompany } = useProducts();
  const { money } = useCurrency();

  return (
    <ul className="space-y-4">
      {inquiries.map((inquiry) => {
        const product = inquiry.productId ? getProduct(inquiry.productId) : null;
        const company = inquiry.companyId ? getCompany(inquiry.companyId) : null;
        return (
          <li key={inquiry.id} className="ts-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted">{inquiry.id} · {formatDate(inquiry.createdAt)}</p>
                <h3 className="mt-0.5 text-base font-bold">
                  {product ? <Link to={`/products/${product.slug}`} className="hover:text-brand-600">{inquiry.productName}</Link> : inquiry.productName}
                </h3>
                <p className="text-[0.8125rem] text-muted">
                  {company ? <>Supplier: <Link to={`/suppliers/${company.slug}`} className="font-medium text-navy-800 hover:text-brand-600">{company.name}</Link></> : 'Open request: no specific supplier'}
                </p>
              </div>
              <StatusBadge status={inquiry.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
              <div><dt className="text-xs text-muted">Quantity</dt><dd className="font-semibold">{quantityLabel(inquiry.quantity, inquiry.unit)}</dd></div>
              <div><dt className="text-xs text-muted">Target price</dt><dd className="font-semibold">{inquiry.targetPrice !== null && inquiry.targetPrice !== undefined ? money(inquiry.targetPrice) : 'Not specified'}</dd></div>
              <div><dt className="text-xs text-muted">Destination</dt><dd className="font-semibold">{inquiry.destinationCountry}</dd></div>
              <div><dt className="text-xs text-muted">Delivery</dt><dd className="font-semibold">{inquiry.deliveryTime}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-ink"><span className="text-muted">Specifications: </span>{inquiry.specifications}</p>
            {inquiry.quote ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-success-50 p-4 text-sm">
                <p className="font-bold text-green-800">Quote received · {formatDate(inquiry.quote.at)}</p>
                <p className="mt-1 text-ink"><span className="font-semibold">{money(inquiry.quote.unitPrice)}</span> per {inquiry.unit} · lead time {inquiry.quote.leadTimeDays} days</p>
                {inquiry.quote.note ? <p className="mt-1 text-ink">{inquiry.quote.note}</p> : null}
              </div>
            ) : <p className="mt-3 text-[0.8125rem] text-muted">No quote yet. The supplier's quote will appear here.</p>}
          </li>
        );
      })}
    </ul>
  );
}
