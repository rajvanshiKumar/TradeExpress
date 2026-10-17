import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Tabs, { TabPanel } from '../../components/common/Tabs';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';

const SORTS = {
  name: { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
  newest: { label: 'Newest first', compare: (a, b) => new Date(b.joinedAt) - new Date(a.joinedAt) },
  oldest: { label: 'Oldest first', compare: (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt) },
  activity: { label: 'Most active', compare: (a, b) => b.activity - a.activity },
};

export default function AdminUsers() {
  const { accounts, updateAccount } = useAuth();
  const { orders } = useOrders();
  const { products } = useProducts();
  const { showToast } = useNotifications();
  const [tab, setTab] = useState('buyer');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [confirming, setConfirming] = useState(null);
  useDocumentTitle('Admin: users');

  const counts = { buyer: accounts.filter((account) => account.role === 'buyer').length, supplier: accounts.filter((account) => account.role === 'supplier').length };
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter((account) => account.role === tab)
      .map((account) => ({ ...account, activity: tab === 'buyer' ? orders.filter((order) => order.buyerId === account.id).length : products.filter((product) => product.companyId === account.companyId).length }))
      .filter((account) => (!q || `${account.name} ${account.email} ${account.company} ${account.country}`.toLowerCase().includes(q)) && (!status || account.status === status))
      .sort(SORTS[sort].compare);
  }, [accounts, orders, products, tab, search, status, sort]);

  const setAccountStatus = (account, next) => {
    updateAccount(account.id, { status: next });
    showToast(next === 'Suspended' ? `${account.name} can no longer sign in.` : `${account.name} can sign in again.`, 'info');
    setConfirming(null);
  };

  return (
    <div>
      <SectionHeading title="Users" description="Buyer and supplier accounts. Passwords are never shown or stored in readable form." />
      <Tabs tabs={[{ id: 'buyer', label: 'Buyers', count: counts.buyer }, { id: 'supplier', label: 'Suppliers', count: counts.supplier }]} active={tab} onChange={setTab} idPrefix="users" />

      <TabPanel id={tab} idPrefix="users" className="pt-5">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
          <div className="relative">
            <label htmlFor="au-search" className="sr-only">Search users</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input id="au-search" type="search" className="ts-input pl-9" placeholder="Search by name, email, company or country" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select aria-label="Filter by status" className="ts-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <select aria-label="Sort users" className="ts-input" value={sort} onChange={(event) => setSort(event.target.value)}>
            {Object.entries(SORTS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </div>

        <div className="ts-card overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={search || status ? Search : Users} title="No matching users" text="Try a different search or status." action={search || status ? <Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button> : null} />
          ) : (
            <div className="overflow-x-auto">
              <table className="ts-table">
                <caption className="sr-only">{tab === 'buyer' ? 'Buyer accounts' : 'Supplier accounts'}</caption>
                <thead><tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Country</th><th scope="col">Joined</th><th scope="col">{tab === 'buyer' ? 'Orders' : 'Products'}</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map((account) => (
                    <tr key={account.id}>
                      <td><span className="block min-w-40 font-semibold text-ink">{account.name}</span><span className="text-xs text-muted">{account.email}</span></td>
                      <td className="min-w-40">{account.company}</td>
                      <td className="whitespace-nowrap">{account.country}</td>
                      <td className="whitespace-nowrap text-muted">{formatDate(account.joinedAt)}</td>
                      <td>{account.activity}</td>
                      <td><StatusBadge status={account.status ?? 'Active'} /></td>
                      <td className="text-right">
                        {account.status === 'Suspended'
                          ? <Button variant="outline" size="sm" onClick={() => setAccountStatus(account, 'Active')} aria-label={`Reactivate ${account.name}`}>Reactivate</Button>
                          : <Button variant="dangerOutline" size="sm" onClick={() => setConfirming(account)} aria-label={`Suspend ${account.name}`}>Suspend</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm text-muted" aria-live="polite">{rows.length} of {counts[tab]} {tab === 'buyer' ? 'buyers' : 'suppliers'}</p>
      </TabPanel>

      <ConfirmDialog
        open={Boolean(confirming)} onCancel={() => setConfirming(null)} onConfirm={() => setAccountStatus(confirming, 'Suspended')} title="Suspend this account?" confirmLabel="Suspend account"
        text={confirming ? `${confirming.name} will not be able to sign in until the account is reactivated.` : ''}
      />
    </div>
  );
}
