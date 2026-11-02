import { Link, useParams } from 'react-router-dom';
import { FolderX } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import CatalogView from '../components/products/CatalogView';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import { PageSkeleton } from '../components/common/Skeleton';
import useProducts from '../hooks/useProducts';
import useCatalogFilters from '../hooks/useCatalogFilters';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function CategoryDetails() {
  const { slug } = useParams();
  const { getCategory, loading } = useProducts();
  const { filters, update } = useCatalogFilters();
  const category = getCategory(slug);
  useDocumentTitle(category?.name ?? 'Category');

  if (loading) return <PageSkeleton />;
  if (!category) {
    return (
      <div className="ts-container py-12">
        <div className="ts-card"><EmptyState icon={FolderX} headingLevel={1} title="Category not found" text="This category does not exist or has been removed." action={<Button to="/categories" variant="navy">View all categories</Button>} /></div>
      </div>
    );
  }

  const chip = (active) => `inline-flex rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${active ? 'border-navy-900 bg-navy-900 text-white' : 'bg-white text-navy-900 hover:border-navy-700'}`;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Categories', to: '/categories' }, { label: category.name }]} title={category.name} description={category.description}>
        {category.subcategories.length ? (
          <ul className="ts-no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Subcategories">
            <li className="shrink-0"><button type="button" onClick={() => update({ subcategory: '' })} aria-pressed={!filters.subcategory} className={chip(!filters.subcategory)}>All</button></li>
            {category.subcategories.map((sub) => (
              <li key={sub} className="shrink-0"><button type="button" onClick={() => update({ subcategory: sub })} aria-pressed={filters.subcategory === sub} className={chip(filters.subcategory === sub)}>{sub}</button></li>
            ))}
          </ul>
        ) : null}
      </PageHeader>
      <div className="ts-container py-6 sm:py-8">
        <CatalogView lockedCategory={category.slug} />
        <p className="mt-8 text-center text-sm text-muted">Looking for something else? <Link to="/rfq" className="font-semibold text-brand-600 hover:text-brand-700">Request a quote</Link> and describe what you need.</p>
      </div>
    </>
  );
}
