import { useState } from 'react';
import { Eye, Package, Search } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import OrderDetails from '../../components/forms/OrderDetails';
import SupplierGuard from './SupplierGuard';
import useOrders from '../../hooks/useOrders';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { ORDER_STATUSES } from '../../utils/constants';
import { companyOrderValue } from '../../utils/analytics';
import { formatDate } from '../../utils/formatDate';

function Orders({ company }) {
  const { orders, loading, error, reload, updateOrderStatus } = useOrders();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  const mine = orders.filter((order) => order.items.some((item) => item.companyId === company.id));
  const visible = mine.filter((order) => {
    if (status && order.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || `${order.id} ${order.buyerName} ${order.buyerCompany}`.toLowerCase().includes(q);
  });
  const selected = mine.find((order) => order.id === openId) ?? null;

  const changeStatus = (order, next) => {
    updateOrderStatus(order.id, next);
    showToast(`Order ${order.id} marked as ${next}.`);
  };

  return (
    <div>
      <SectionHeading title="Orders" description="Orders that include your products. Updating a status notifies the buyer." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="so-search" className="sr-only">Search orders</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="so-search" type="search" className="ts-input pl-9" placeholder="Search by order ID or buyer" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <label htmlFor="so-status" className="sr-only">Filter by status</label>
        <select id="so-status" className="ts-input sm:w-52" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton /> : mine.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" text="When a buyer orders your products, the order appears here." />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="No matching orders" text="Try a different search or status." action={<Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">Orders containing your products</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Buyer</th><th scope="col">Date</th><th scope="col">Your items</th><th scope="col">Status</th><th scope="col">Update status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-900">{order.id}</td>
                    <td><span className="block min-w-32 font-medium text-ink">{order.buyerName}</span><span className="text-xs text-muted">{order.buyerCompany}</span></td>
                    <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                    <td className="whitespace-nowrap font-semibold">{money(companyOrderValue(order, company.id))}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <select value={order.status} onChange={(event) => changeStatus(order, event.target.value)} aria-label={`Status of order ${order.id}`} className="ts-input !min-h-9 w-40 !py-1 text-sm">
                        {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </td>
                    <td><Button variant="outline" size="sm" icon={Eye} onClick={() => setOpenId(order.id)} aria-label={`View order ${order.id}`}>View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={Boolean(selected)} onClose={() => setOpenId(null)} title="Order details" size="lg">
        {selected ? <OrderDetails order={selected} companyId={company.id} /> : null}
      </Modal>
    </div>
  );
}

export default function SupplierOrders() {
  useDocumentTitle('Supplier orders');
  return <SupplierGuard>{(company) => <Orders company={company} />}</SupplierGuard>;
}
