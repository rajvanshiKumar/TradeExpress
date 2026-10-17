import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Eye, EyeOff, Search, Star, Trash2 } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Image from '../../components/common/Image';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  name: { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
  'price-desc': { label: 'Price: high to low', compare: (a, b) => b.price - a.price },
  'price-asc': { label: 'Price: low to high', compare: (a, b) => a.price - b.price },
  stock: { label: 'Stock: low to high', compare: (a, b) => a.stock - b.stock },
};
const PER_PAGE = 10;

export default function AdminProducts() {
  const { products, categories, companies, loading, error, reload, getCompany, updateProduct, deleteProduct } = useProducts();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  useDocumentTitle('Admin: products');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((product) => (!q || `${product.name} ${product.id} ${product.sku}`.toLowerCase().includes(q)) && (!category || product.category === category) && (!companyId || product.companyId === companyId) && (!status || product.status === status))
      .sort(SORTS[sort].compare);
  }, [products, search, category, companyId, status, sort]);

  const pageCount = Math.max(Math.ceil(visible.length / PER_PAGE), 1);
  const current = Math.min(page, pageCount);
  const rows = visible.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const change = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const hasFilters = Boolean(search || category || companyId || status);
  const clear = () => { setSearch(''); setCategory(''); setCompanyId(''); setStatus(''); setPage(1); };

  return (
    <div>
      <SectionHeading title="Products" description={`${products.length} listings across ${companies.length} companies. Moderation actions are saved in this browser.`} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <label htmlFor="ap-search" className="sr-only">Search products</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="ap-search" type="search" className="ts-input pl-9" placeholder="Search by name, ID or SKU" value={search} onChange={change(setSearch)} />
        </div>
        <select aria-label="Filter by category" className="ts-input" value={category} onChange={change(setCategory)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by company" className="ts-input" value={companyId} onChange={change(setCompanyId)}>
          <option value="">All companies</option>
          {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by status" className="ts-input" value={status} onChange={change(setStatus)}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Hidden">Hidden</option>
        </select>
        <select aria-label="Sort products" className="ts-input" value={sort} onChange={change(setSort)}>
          {Object.entries(SORTS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton rows={8} /> : rows.length === 0 ? (
          <EmptyState icon={hasFilters ? Search : Boxes} title={hasFilters ? 'No matching products' : 'No products'} text={hasFilters ? 'Try different filters.' : 'Products added by suppliers will appear here.'} action={hasFilters ? <Button variant="outline" onClick={clear}>Clear filters</Button> : null} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">All product listings</caption>
              <thead><tr><th scope="col">Product</th><th scope="col">Company</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((product) => {
                  const company = getCompany(product.companyId);
                  const active = product.status === 'Active';
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="flex min-w-60 items-center gap-3">
                          <Image photo={product.photo} illustration={product.illustration} width={96} height={96} alt="" className="size-11 shrink-0 rounded-lg bg-surface object-cover" />
                          <div className="min-w-0">
                            {active ? <Link to={`/products/${product.slug}`} className="line-clamp-1 font-semibold text-ink hover:text-brand-600">{product.name}</Link> : <span className="line-clamp-1 font-semibold text-ink">{product.name}</span>}
                            <p className="text-xs text-muted">{product.id} · {categories.find((item) => item.slug === product.category)?.name ?? product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-40">{company ? <Link to={`/suppliers/${company.slug}`} className="hover:text-brand-600">{company.name}</Link> : <span className="text-muted">Unknown</span>}</td>
                      <td className="whitespace-nowrap font-semibold">{money(product.price)}</td>
                      <td className="whitespace-nowrap">{product.stock.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={active ? 'success' : 'neutral'}>{product.status}</Badge>
                          {product.featured ? <Badge tone="brand">Featured</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton icon={Star} size="sm" tone="muted" aria-pressed={product.featured} className={product.featured ? '!text-brand-500' : ''} label={product.featured ? `Remove ${product.name} from featured` : `Feature ${product.name}`} onClick={() => { updateProduct(product.id, { featured: !product.featured }); showToast(product.featured ? 'Removed from featured.' : 'Marked as featured.', 'info'); }} />
                          <IconButton icon={active ? EyeOff : Eye} size="sm" tone="muted" label={active ? `Hide ${product.name}` : `Show ${product.name}`} onClick={() => { updateProduct(product.id, { status: active ? 'Hidden' : 'Active' }); showToast(active ? 'Listing hidden from the catalogue.' : 'Listing is visible again.', 'info'); }} />
                          <IconButton icon={Trash2} size="sm" tone="danger" label={`Delete ${product.name}`} onClick={() => setDeleting(product)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">{visible.length} {visible.length === 1 ? 'product' : 'products'}</p>
        <Pagination page={current} pageCount={pageCount} onChange={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(deleting)} onCancel={() => setDeleting(null)} title="Delete this listing?" confirmLabel="Delete listing" text={deleting ? `“${deleting.name}” will be removed from the catalogue.` : ''}
        onConfirm={() => { deleteProduct(deleting.id); showToast('Listing deleted.', 'info'); setDeleting(null); }}
      />
    </div>
  );
}
