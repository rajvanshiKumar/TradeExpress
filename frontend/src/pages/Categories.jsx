import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Image from '../components/common/Image';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import useProducts from '../hooks/useProducts';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Categories() {
  const { categories, products, loading, error, reload } = useProducts();
  useDocumentTitle('Categories');
  const count = (slug) => products.filter((product) => product.category === slug && product.status === 'Active').length;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Categories' }]} title="All Categories" description="Browse wholesale products by category and subcategory." />
      <div className="ts-container py-8">
        {error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading categories">
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-44 w-full rounded-2xl" />)}
          </div>
        ) : !categories.length ? <div className="ts-card"><EmptyState title="No categories yet" text="Categories added in the admin dashboard will appear here." /></div> : (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id} className="ts-card flex overflow-hidden">
                <Link to={`/categories/${category.slug}`} tabIndex={-1} aria-hidden="true" className="hidden w-36 shrink-0 bg-surface xs:block">
                  <Image photo={category.photo} illustration={category.illustration} width={300} height={380} alt="" className="size-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col p-5">
                  <h2 className="text-lg font-bold"><Link to={`/categories/${category.slug}`} className="hover:text-brand-600">{category.name}</Link></h2>
                  <p className="mt-0.5 text-xs font-semibold text-muted">{count(category.slug)} products</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{category.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {category.subcategories.map((sub) => (
                      <li key={sub}><Link to={`/categories/${category.slug}?sub=${encodeURIComponent(sub)}`} className="inline-block rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-navy-50 hover:text-brand-600">{sub}</Link></li>
                    ))}
                  </ul>
                  <Link to={`/categories/${category.slug}`} className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Browse category <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
