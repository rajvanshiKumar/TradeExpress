import { useState } from 'react';
import useMyProducts, { deleteMyProduct, refreshMyProducts, updateMyProduct } from '../../hooks/useMyProducts';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import { Link } from 'react-router-dom';
import { Boxes, Eye, EyeOff, Pencil, Plus, Search, Trash2, UploadCloud, Download, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Image from '../../components/common/Image';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import CustomSelect from '../../components/common/CustomSelect';
import SupplierGuard from './SupplierGuard';
import { LOW_STOCK_FACTOR } from '../../utils/constants';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { apiPost } from '../../services/apiClient';
import { apiUrl } from '../../config/api.js';

/** Stock cell that saves when the field loses focus or Enter is pressed. */
function StockInput({ product, onSave }) {
  const [value, setValue] = useState(String(product.stock));
  const commit = () => {
    const number = Math.max(Math.round(Number(value)) || 0, 0);
    setValue(String(number));
    if (number !== product.stock) onSave(number);
  };
  return (
    <input
      type="number" min="0" inputMode="numeric" value={value} aria-label={`Stock for ${product.name}`} onChange={(event) => setValue(event.target.value)} onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="ts-input !min-h-9 w-28 !py-1 text-sm"
    />
  );
}

/** The supplier's products from the database: the same list the dashboard counts. */
function ProductTable({ company }) {
  const { products, loading, error, reload } = useMyProducts();
  const { getCategory } = useProducts();
  const [savingId, setSavingId] = useState(null);
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState(null);

  // Bulk Upload State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      showToast('Please choose an Excel (.xlsx) or CSV file first.', 'error');
      return;
    }
    setUploadingBulk(true);
    setBulkResult(null);

    try {
      const formData = new FormData();
      formData.append('file', bulkFile);
      if (company?.id) formData.append('companyId', company.id);

      const res = await apiPost('supplier/products/bulk/upload', formData);
      const data = res?.data || res;
      setBulkResult(data);

      if (data?.createdProducts?.length) refreshMyProducts();
      showToast(`Bulk upload complete: ${data.createdCount} products imported.`);
    } catch (err) {
      showToast(err.message || 'Failed to process bulk upload.', 'error');
    } finally {
      setUploadingBulk(false);
    }
  };


  const visible = products.filter((product) => {
    const q = search.trim().toLowerCase();
    if (q && !`${product.name} ${product.sku} ${product.id}`.toLowerCase().includes(q)) return false;
    if (filter === 'active') return product.status === 'Active';
    if (filter === 'hidden') return product.status !== 'Active';
    if (filter === 'low') return product.stock < product.moq * LOW_STOCK_FACTOR;
    return true;
  });

  const save = async (product, changes, done) => {
    if (savingId) return;
    setSavingId(product.id);
    try {
      await updateMyProduct(product.id, changes);
      refreshMyProducts();
      showToast(done, 'info');
    } catch (err) {
      showToast(err?.message || `${product.name} could not be updated.`, 'error');
    } finally {
      setSavingId(null);
    }
  };
  const toggleStatus = (product) => {
    const next = product.status === 'Active' ? 'Hidden' : 'Active';
    save(product, { status: next }, next === 'Active' ? `${product.name} is visible in the catalogue.` : `${product.name} is hidden from the catalogue.`);
  };
  const confirmDelete = async () => {
    const product = deleting;
    if (!product || savingId) return;
    setSavingId(product.id);
    try {
      await deleteMyProduct(product.id);
      refreshMyProducts();
      showToast(`${product.name} deleted.`, 'info');
      setDeleting(null);
    } catch (err) {
      showToast(err?.message || `${product.name} could not be deleted.`, 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Products & inventory"
        description="Your listings on TradeExpress. Changes are saved to your account straight away."
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setBulkModalOpen(true)} size="sm" variant="outline" icon={UploadCloud}>
              Bulk upload
            </Button>
            <Button to="/supplier/products/new" size="sm" icon={Plus}>
              Add product
            </Button>
          </div>
        }
      />

      {/* Bulk Upload Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-navy-900/[0.08] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-navy-900/[0.06] pb-4">
              <div>
                <h3 className="text-lg font-bold text-ink">Bulk Product Upload</h3>
                <p className="text-xs text-muted">Upload an Excel (.xlsx, .xls) or CSV sheet to add multiple wholesale products at once.</p>
              </div>
              <button
                type="button"
                onClick={() => { setBulkModalOpen(false); setBulkResult(null); setBulkFile(null); }}
                className="rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-ivory/80 p-3.5 border border-navy-900/[0.06]">
                <div>
                  <p className="text-xs font-semibold text-ink">Step 1: Download Standard Template</p>
                  <p className="text-[11px] text-muted">Includes pre-filled sample rows with HSN, GST rate, unit, MOQ and price tiers.</p>
                </div>
                <a
                  href={apiUrl('/supplier/products/bulk/template')}
                  download="tradeexpress_products_template.xlsx"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 shadow-sm border border-navy-900/[0.1] hover:bg-slate-50"
                >
                  <Download className="size-3.5" />
                  Download .xlsx
                </a>
              </div>

              <form onSubmit={handleBulkUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Step 2: Choose your filled spreadsheet
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
                  />
                  {bulkFile && (
                    <p className="mt-1 text-xs text-brand-600 font-medium">Selected: {bulkFile.name}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setBulkModalOpen(false); setBulkResult(null); setBulkFile(null); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" icon={UploadCloud} disabled={!bulkFile || uploadingBulk}>
                    {uploadingBulk ? 'Validating & Importing...' : 'Upload & Import'}
                  </Button>
                </div>
              </form>

              {bulkResult && (
                <div className="mt-4 space-y-3 rounded-xl border border-navy-900/[0.08] p-4 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-ink">
                        Imported {bulkResult.createdCount} of {bulkResult.totalRows} row(s) successfully!
                      </p>
                    </div>
                  </div>

                  {bulkResult.errors?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>Row-level validation issues ({bulkResult.errors.length}):</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-rose-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-rose-50 text-rose-800 border-b border-rose-200">
                            <tr>
                              <th className="px-3 py-1.5 font-semibold">Row #</th>
                              <th className="px-3 py-1.5 font-semibold">Error Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-100">
                            {bulkResult.errors.map((err, i) => (
                              <tr key={i} className="hover:bg-rose-50/40">
                                <td className="whitespace-nowrap px-3 py-1.5 font-bold text-rose-900">
                                  Row {err.row}
                                </td>
                                <td className="px-3 py-1.5 text-rose-700">{err.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="sp-search" className="sr-only">Search your products</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="sp-search" type="search" className="ts-input pl-9" placeholder="Search by name, SKU or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="sm:w-56 shrink-0">
          <CustomSelect
            id="sp-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            options={[
              { value: '', label: `All products (${products.length})` },
              { value: 'active', label: 'Active listings' },
              { value: 'hidden', label: 'Hidden listings' },
              { value: 'low', label: 'Low stock alerts' },
            ]}
            placeholder={`All products (${products.length})`}
            searchable={false}
          />
        </div>
      </div>

      <div className="ts-card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState text={error} onRetry={reload} />
        ) : products.length === 0 ? (
          <EmptyState icon={Boxes} title="No products yet" text="Add your first listing. It will appear in the catalogue straight away." action={<Button to="/supplier/products/new" icon={Plus}>Add product</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="No matching products" text="Try a different search or filter." action={<Button variant="outline" onClick={() => { setSearch(''); setFilter(''); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">Your product listings</caption>
              <thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">MOQ</th><th scope="col">Stock</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visible.map((product) => {
                  const low = product.stock < product.moq * LOW_STOCK_FACTOR;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="flex min-w-56 items-center gap-3">
                          <Image photo={product.photo} illustration={product.illustration} width={96} height={96} alt="" className="size-11 shrink-0 rounded-lg bg-surface object-cover" />
                          <div className="min-w-0">
                            <Link to={`/supplier/products/${product.id}/edit`} className="line-clamp-1 font-semibold text-ink hover:text-brand-600">{product.name}</Link>
                            <p className="text-xs text-muted">{product.sku} · {getCategory(product.category)?.name ?? product.categoryName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap font-semibold">{money(product.price)}</td>
                      <td className="whitespace-nowrap">{product.moq.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <StockInput key={`${product.id}-${product.stock}`} product={product} onSave={(stock) => save(product, { stock }, `Stock updated for ${product.name}.`)} />
                          {low ? <Badge tone={product.stock <= 0 ? 'danger' : 'warning'}>{product.stock <= 0 ? 'Out' : 'Low'}</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={product.status === 'Active' ? 'success' : 'neutral'}>{product.status}</Badge>
                          {product.moderationStatus === 'PENDING' ? <Badge tone="warning">Pending review</Badge> : product.moderationStatus === 'REJECTED' ? <Badge tone="danger">Rejected</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton icon={product.status === 'Active' ? EyeOff : Eye} size="sm" tone="muted" label={product.status === 'Active' ? `Hide ${product.name} from the catalogue` : `Show ${product.name} in the catalogue`} disabled={savingId === product.id} onClick={() => toggleStatus(product)} />
                          <Link to={`/supplier/products/${product.id}/edit`} aria-label={`Edit ${product.name}`} title="Edit" className="inline-flex size-9 items-center justify-center rounded-[0.625rem] text-muted hover:bg-navy-50 hover:text-navy-900"><Pencil className="size-5" aria-hidden="true" /></Link>
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

      <ConfirmDialog
        open={Boolean(deleting)} onCancel={() => setDeleting(null)} title="Delete this product?" confirmLabel="Delete product"
        text={deleting ? `“${deleting.name}” will be removed from your catalogue and from buyers. Past orders that include it are kept.` : ''}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default function SupplierProducts() {
  useDocumentTitle('Products & inventory');
  return <SupplierGuard>{(company) => <ProductTable company={company} />}</SupplierGuard>;
}

