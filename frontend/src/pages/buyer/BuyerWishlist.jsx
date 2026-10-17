import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Heart, Trash2 } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Tabs, { TabPanel } from '../../components/common/Tabs';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ProductGrid from '../../components/products/ProductGrid';
import SupplierGrid from '../../components/suppliers/SupplierGrid';
import useWishlist from '../../hooks/useWishlist';
import useProducts from '../../hooks/useProducts';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/** Saved products and saved suppliers. Used in the buyer dashboard and as the public /wishlist page. */
export default function BuyerWishlist({ standalone = false }) {
  const { items, clearWishlist, suppliers, clearSuppliers } = useWishlist();
  const { loading } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'suppliers' ? 'suppliers' : 'products';
  const [confirming, setConfirming] = useState(false);
  useDocumentTitle('Saved items');

  const setTab = (next) => setSearchParams(next === 'suppliers' ? { tab: 'suppliers' } : {});
  const hasItems = tab === 'products' ? items.length : suppliers.length;

  const content = (
    <>
      <SectionHeading
        title="Saved items" description="Products and suppliers you saved in this browser, ready to compare."
        actions={hasItems ? <Button variant="dangerOutline" size="sm" icon={Trash2} onClick={() => setConfirming(true)}>Clear {tab}</Button> : null}
      />
      <Tabs tabs={[{ id: 'products', label: 'Products', count: items.length }, { id: 'suppliers', label: 'Suppliers', count: suppliers.length }]} active={tab} onChange={setTab} idPrefix="saved" className="mb-6" />
      <TabPanel id={tab} idPrefix="saved">
        {tab === 'products' ? (
          <ProductGrid
            products={items} loading={loading} skeletonCount={4} columns={standalone ? undefined : 'grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 xl:grid-cols-3'}
            emptyTitle="No saved products yet" emptyText="Tap the heart on any product to save it here." emptyAction={<Button to="/products" variant="navy" icon={Heart}>Find products to save</Button>}
          />
        ) : suppliers.length ? (
          <SupplierGrid companies={suppliers} loading={loading} />
        ) : (
          <div className="ts-card"><EmptyState icon={Bookmark} title="No saved suppliers yet" text="Use the bookmark on any supplier card or company profile to save it here." action={<Button to="/suppliers" variant="navy">Find suppliers</Button>} /></div>
        )}
      </TabPanel>
      <ConfirmDialog
        open={confirming} onCancel={() => setConfirming(false)} confirmLabel="Remove all"
        title={tab === 'products' ? 'Remove all saved products?' : 'Remove all saved suppliers?'} text="This only clears the list in this browser."
        onConfirm={() => { if (tab === 'products') clearWishlist(); else clearSuppliers(); setConfirming(false); }}
      />
    </>
  );
  return standalone ? <div className="ts-container py-10">{content}</div> : content;
}
