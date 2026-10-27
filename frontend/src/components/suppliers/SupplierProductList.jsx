import { useMemo, useState } from 'react';
import ProductGrid from '../products/ProductGrid';
import ProductSort from '../products/ProductSort';
import { filterProducts } from '../../services/productService';
import useProducts from '../../hooks/useProducts';

/** A supplier's active products with a category filter and sorting. */
export default function SupplierProductList({ company }) {
  const { products, companies, categories, loading } = useProducts();
  const [sort, setSort] = useState('relevance');
  const [category, setCategory] = useState('');

  const all = useMemo(() => filterProducts(products, companies, { companyId: company.id, sort }), [products, companies, company.id, sort]);
  const usedCategories = categories.filter((item) => all.some((product) => product.category === item.slug));
  const visible = category ? all.filter((product) => product.category === category) : all;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="supplier-product-category" className="sr-only">Filter by category</label>
          <select id="supplier-product-category" value={category} onChange={(event) => setCategory(event.target.value)} className="ts-input !min-h-10 w-auto !py-1.5 text-sm">
            <option value="">All categories ({all.length})</option>
            {usedCategories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
          <p className="text-sm text-muted" aria-live="polite">{visible.length} {visible.length === 1 ? 'product' : 'products'}</p>
        </div>
        <ProductSort sort={sort} onSortChange={setSort} id="supplier-product-sort" />
      </div>
      <ProductGrid products={visible} loading={loading} columns="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4" emptyTitle="No products listed yet" emptyText="This supplier has not listed any active products." />
    </div>
  );
}
