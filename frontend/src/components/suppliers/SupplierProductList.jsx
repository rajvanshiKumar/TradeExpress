import { useMemo, useState } from 'react';
import ProductGrid from '../products/ProductGrid';
import ProductSort from '../products/ProductSort';
import CustomSelect from '../common/CustomSelect';
import { filterProducts } from '../../services/productService';
import useProducts from '../../hooks/useProducts';

/** A supplier's active products with a category filter and sorting. */
export default function SupplierProductList({ company }) {
  const { products, companies, categories, loading } = useProducts();
  const [sort, setSort] = useState('relevance');
  const [category, setCategory] = useState('');

  const all = useMemo(
    () => filterProducts(products, companies, { companyId: company.id, sort }),
    [products, companies, company.id, sort]
  );
  const usedCategories = categories.filter((item) => all.some((product) => product.category === item.slug));
  const visible = category ? all.filter((product) => product.category === category) : all;

  const categoryOptions = [
    { value: '', label: `All categories (${all.length})` },
    ...usedCategories.map((item) => ({ value: item.slug, label: item.name })),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="supplier-product-category" className="sr-only">
            Filter by category
          </label>
          <div className="min-w-[12rem]">
            <CustomSelect
              id="supplier-product-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={categoryOptions}
              compact
              searchable={categoryOptions.length > 6}
            />
          </div>
          <p className="text-xs font-semibold text-slate-500" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'product' : 'products'}
          </p>
        </div>
        <ProductSort sort={sort} onSortChange={setSort} id="supplier-product-sort" />
      </div>
      <ProductGrid
        products={visible}
        loading={loading}
        columns="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
        emptyTitle="No products listed yet"
        emptyText="This supplier has not listed any active products."
      />
    </div>
  );
}
