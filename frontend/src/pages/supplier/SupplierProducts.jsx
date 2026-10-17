import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Image from '../../components/common/Image';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import SupplierGuard from './SupplierGuard';
import { LOW_STOCK_FACTOR } from '../../utils/constants';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';

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

function ProductTable({ products }) {
  const { updateProduct, deleteProduct, getCategory } = useProducts();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState(null);

  const visible = products.filter((product) => {
    const q = search.trim().toLowerCase();
    if (q && !`${product.name} ${product.sku} ${product.id}`.toLowerCase().includes(q)) return false;
    if (filter === 'active') return product.status === 'Active';
    if (filter === 'hidden') return product.status !== 'Active';
    if (filter === 'low') return product.stock < product.moq * LOW_STOCK_FACTOR;
    return true;
  });

  const toggleStatus = (product) => {
    const next = product.status === 'Active' ? 'Hidden' : 'Active';
    updateProduct(product.id, { status: next });
    showToast(next === 'Active' ? `${product.name} is visible in the catalogue.` : `${product.name} is hidden from the catalogue.`, 'info');
  };

  return (
    <div>
      <SectionHeading title="Products & inventory" description="Changes are saved in this browser and show in the catalogue immediately." actions={<Button to="/supplier/products/new" size="sm" icon={Plus}>Add product</Button>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="sp-search" className="sr-only">Search your products</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="sp-search" type="search" className="ts-input pl-9" placeholder="Search by name, SKU or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <label htmlFor="sp-filter" className="sr-only">Filter products</label>
        <select id="sp-filter" className="ts-input sm:w-52" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All products ({products.length})</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
          <option value="low">Low stock</option>
        </select>
      </div>

      <div className="ts-card overflow-hidden">
        {products.length === 0 ? (
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
                            <p className="text-xs text-muted">{product.sku} · {getCategory(product.category)?.name ?? product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap font-semibold">{money(product.price)}</td>
                      <td className="whitespace-nowrap">{product.moq.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <StockInput key={`${product.id}-${product.stock}`} product={product} onSave={(stock) => { updateProduct(product.id, { stock }); showToast(`Stock updated for ${product.name}.`); }} />
                          {low ? <Badge tone={product.stock <= 0 ? 'danger' : 'warning'}>{product.stock <= 0 ? 'Out' : 'Low'}</Badge> : null}
                        </div>
                      </td>
                      <td><Badge tone={product.status === 'Active' ? 'success' : 'neutral'}>{product.status}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton icon={product.status === 'Active' ? EyeOff : Eye} size="sm" tone="muted" label={product.status === 'Active' ? `Hide ${product.name} from the catalogue` : `Show ${product.name} in the catalogue`} onClick={() => toggleStatus(product)} />
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
        text={deleting ? `“${deleting.name}” will be removed from the catalogue, carts and wishlists in this browser. This cannot be undone (except by resetting the sample data).` : ''}
        onConfirm={() => { deleteProduct(deleting.id); showToast(`${deleting.name} deleted.`, 'info'); setDeleting(null); }}
      />
    </div>
  );
}

export default function SupplierProducts() {
  useDocumentTitle('Products & inventory');
  return <SupplierGuard>{(company, products) => <ProductTable products={products} />}</SupplierGuard>;
}
