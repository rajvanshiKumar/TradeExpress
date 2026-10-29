import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Eye, EyeOff, Search, Star, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Image from '../../components/common/Image';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { Textarea } from '../../components/common/Input';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import CustomSelect from '../../components/common/CustomSelect';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { apiPost } from '../../services/apiClient';

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
  const [moderationFilter, setModerationFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  // Moderation reject dialog
  const [rejectingProduct, setRejectingProduct] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [moderating, setModerating] = useState(false);

  useDocumentTitle('Admin: products');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((product) => {
        if (q && !`${product.name} ${product.id} ${product.sku}`.toLowerCase().includes(q)) return false;
        if (category && product.category !== category) return false;
        if (companyId && product.companyId !== companyId) return false;
        if (status && product.status !== status) return false;
        if (moderationFilter) {
          const modStatus = product.moderationStatus || 'APPROVED';
          if (modStatus !== moderationFilter) return false;
        }
        return true;
      })
      .sort(SORTS[sort].compare);
  }, [products, search, category, companyId, status, moderationFilter, sort]);

  const pageCount = Math.max(Math.ceil(visible.length / PER_PAGE), 1);
  const current = Math.min(page, pageCount);
  const rows = visible.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const change = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const hasFilters = Boolean(search || category || companyId || status || moderationFilter);
  const clear = () => { setSearch(''); setCategory(''); setCompanyId(''); setStatus(''); setModerationFilter(''); setPage(1); };

  const handleApprove = async (product) => {
    try {
      await apiPost(`admin/products/moderation/${product.id}`, { decision: 'approve' });
    } catch {
      // Local fallback
    }
    updateProduct(product.id, { moderationStatus: 'APPROVED', status: 'Active' });
    showToast(`Product "${product.name}" approved and live in catalogue!`);
  };

  const handleRejectSubmit = async () => {
    if (!rejectingProduct) return;
    setModerating(true);
    try {
      await apiPost(`admin/products/moderation/${rejectingProduct.id}`, {
        decision: 'reject',
        rejectionReason: rejectionReason.trim(),
      });
    } catch {
      // Local fallback
    }
    updateProduct(rejectingProduct.id, {
      moderationStatus: 'REJECTED',
      status: 'Hidden',
      rejectionReason: rejectionReason.trim(),
    });
    showToast(`Product "${rejectingProduct.name}" rejected.`);
    setModerating(false);
    setRejectingProduct(null);
    setRejectionReason('');
  };

  return (
    <div>
      <SectionHeading title="Products" description={`${products.length} listings across ${companies.length} companies. Product moderation and catalog management.`} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <label htmlFor="ap-search" className="sr-only">Search products</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="ap-search" type="search" className="ts-input pl-9" placeholder="Search by name, ID or SKU" value={search} onChange={change(setSearch)} />
        </div>
        <CustomSelect
          aria-label="Filter by category"
          value={category}
          onChange={change(setCategory)}
          options={[{ value: '', label: 'All categories' }, ...categories.map((item) => ({ value: item.slug, label: item.name }))]}
        />
        <CustomSelect
          aria-label="Filter by company"
          value={companyId}
          onChange={change(setCompanyId)}
          options={[{ value: '', label: 'All companies' }, ...companies.map((item) => ({ value: item.id, label: item.name }))]}
        />
        <CustomSelect
          aria-label="Filter by status"
          value={status}
          onChange={change(setStatus)}
          options={[
            { value: '', label: 'All visibility' },
            { value: 'Active', label: 'Active' },
            { value: 'Hidden', label: 'Hidden' }
          ]}
        />
        <CustomSelect
          aria-label="Filter by moderation"
          value={moderationFilter}
          onChange={change(setModerationFilter)}
          options={[
            { value: '', label: 'All moderation' },
            { value: 'PENDING', label: 'Pending Moderation' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' }
          ]}
        />
        <CustomSelect
          aria-label="Sort products"
          value={sort}
          onChange={change(setSort)}
          options={Object.entries(SORTS).map(([value, item]) => ({ value, label: item.label }))}
        />
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton rows={8} /> : rows.length === 0 ? (
          <EmptyState icon={hasFilters ? Search : Boxes} title={hasFilters ? 'No matching products' : 'No products'} text={hasFilters ? 'Try different filters.' : 'Products added by suppliers will appear here.'} action={hasFilters ? <Button variant="outline" onClick={clear}>Clear filters</Button> : null} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">All product listings</caption>
              <thead><tr><th scope="col">Product</th><th scope="col">Company</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Status & Moderation</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((product) => {
                  const company = getCompany(product.companyId);
                  const active = product.status === 'Active';
                  const isPendingMod = product.moderationStatus === 'PENDING';
                  const isRejectedMod = product.moderationStatus === 'REJECTED';

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
                        <div className="flex flex-wrap gap-1 items-center">
                          <Badge tone={active ? 'success' : 'neutral'}>{product.status}</Badge>
                          {isPendingMod ? (
                            <Badge tone="warning">Pending Review</Badge>
                          ) : isRejectedMod ? (
                            <Badge tone="danger">Declined</Badge>
                          ) : (
                            <Badge tone="verified">Approved</Badge>
                          )}
                          {product.featured ? <Badge tone="brand">Featured</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <div className="flex justify-end items-center gap-1">
                          {isPendingMod ? (
                            <>
                              <button
                                type="button"
                                title="Approve listing"
                                onClick={() => handleApprove(product)}
                                className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                <Check className="size-4" />
                              </button>
                              <button
                                type="button"
                                title="Reject listing"
                                onClick={() => setRejectingProduct(product)}
                                className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              >
                                <X className="size-4" />
                              </button>
                            </>
                          ) : null}
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

      {/* Reject Product Modal */}
      {rejectingProduct && (
        <Modal
          open={Boolean(rejectingProduct)}
          onClose={() => { setRejectingProduct(null); setRejectionReason(''); }}
          size="sm"
          title="Reject Product Listing?"
          description={rejectingProduct.name}
          footer={
            <>
              <Button variant="outline" onClick={() => setRejectingProduct(null)} disabled={moderating}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRejectSubmit} disabled={moderating || !rejectionReason.trim()}>
                {moderating ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          }
        >
          <p className="mb-3 text-xs text-muted">
            The supplier will be notified with your rejection feedback and the product will remain hidden from the public marketplace.
          </p>
          <Textarea
            id="product-rejection-reason"
            label="Rejection Reason"
            required
            rows={3}
            placeholder="e.g. Prohibited item, inadequate product specifications, or trademark violation"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </Modal>
      )}
    </div>
  );
}

