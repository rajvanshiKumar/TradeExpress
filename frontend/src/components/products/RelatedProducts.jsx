import { useMemo } from 'react';
import ProductCard from './ProductCard';
import useProducts from '../../hooks/useProducts';

/** Other active products from the same category (then the same supplier) as `product`. */
export default function RelatedProducts({ product, limit = 4, title = 'Related products' }) {
  const { products } = useProducts();
  const related = useMemo(() => {
    const others = products.filter((item) => item.id !== product.id && item.status === 'Active');
    const sameCategory = others.filter((item) => item.category === product.category);
    const otherSuppliers = sameCategory.filter((item) => item.companyId !== product.companyId);
    const fallback = others.filter((item) => item.companyId !== product.companyId && item.category !== product.category);
    return [...otherSuppliers, ...fallback].slice(0, limit);
  }, [products, product, limit]);

  if (!related.length) return null;
  return (
    <section aria-labelledby="related-products-title">
      <h2 id="related-products-title" className="mb-5 text-2xl font-extrabold tracking-[-0.025em]">{title}</h2>
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {related.map((item) => <ProductCard key={item.id} product={item} />)}
      </div>
    </section>
  );
}
