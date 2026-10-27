import PageHeader from '../components/common/PageHeader';
import CatalogView from '../components/products/CatalogView';
import useCatalogFilters from '../hooks/useCatalogFilters';
import useProducts from '../hooks/useProducts';
import useDocumentTitle from '../hooks/useDocumentTitle';

function headingFor(filters, categories) {
  if (filters.q) return { title: `Results for “${filters.q}”`, description: 'Products matching your search across the catalogue.' };
  if (filters.ready) return { title: 'Ready to Ship', description: 'Products held in stock by the supplier and dispatched within days.' };
  if (filters.deal) return { title: 'Wholesale Deals', description: 'Listings with the strongest quantity discounts in the catalogue.' };
  if (filters.isNew) return { title: 'New Arrivals', description: 'The most recently added listings.' };
  const category = categories.find((item) => item.slug === filters.category);
  if (category) return { title: category.name, description: category.description };
  return { title: 'All Products', description: 'Compare wholesale prices, minimum orders and suppliers across every category.' };
}

export default function Products() {
  const { filters } = useCatalogFilters();
  const { categories } = useProducts();
  const { title, description } = headingFor(filters, categories);
  useDocumentTitle(title);

  return (
    <>
      <PageHeader breadcrumbs={title === 'All Products' ? [{ label: 'Products' }] : [{ label: 'Products', to: '/products' }, { label: title }]} title={title} description={description} />
      <div className="ts-container py-6 sm:py-8"><CatalogView /></div>
    </>
  );
}
