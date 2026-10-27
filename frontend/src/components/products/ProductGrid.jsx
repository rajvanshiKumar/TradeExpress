import { SearchX } from 'lucide-react';
import ProductCard from './ProductCard';
import EmptyState from '../common/EmptyState';
import { ProductGridSkeleton } from '../common/Skeleton';

const GRID = 'grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 md:grid-cols-3 xl:grid-cols-4';

/** Renders products as a grid or list, with loading and empty states built in. */
export default function ProductGrid({ products, layout = 'grid', loading = false, columns = GRID, skeletonCount = 8, emptyTitle = 'No products found', emptyText = 'Try a different search or remove some filters.', emptyAction }) {
  if (loading && !products?.length) return <ProductGridSkeleton count={skeletonCount} className={columns} />;
  if (!products.length) return <div className="ts-card"><EmptyState icon={SearchX} title={emptyTitle} text={emptyText} action={emptyAction} /></div>;
  if (layout === 'list') return <div className="space-y-4">{products.map((product) => <ProductCard key={product.id} product={product} layout="list" />)}</div>;
  return <div className={columns}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
