import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Button, { IconButton } from '../components/common/Button';
import Image from '../components/common/Image';
import QuantityInput from '../components/common/QuantityInput';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { TableSkeleton } from '../components/common/Skeleton';
import OrderSummary from '../components/forms/OrderSummary';
import useCart from '../hooks/useCart';
import useProducts from '../hooks/useProducts';
import useCurrency from '../hooks/useCurrency';
import useDisclosure from '../hooks/useDisclosure';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getActiveTier } from '../utils/calculateTotals';
import { quantityLabel } from '../utils/units';

export default function Cart() {
  const { lines, totals, updateQuantity, removeFromCart, clearCart } = useCart();
  const { loading, getCompany } = useProducts();
  const { money } = useCurrency();
  const clearDialog = useDisclosure();
  useDocumentTitle('Cart');

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Cart' }]} title="Your Cart" description={lines.length ? `${lines.length} ${lines.length === 1 ? 'product' : 'products'}, ${totals.units.toLocaleString('en-IN')} units in total.` : undefined} />
      <div className="ts-container py-6 sm:py-8">
        {loading ? <div className="ts-card"><TableSkeleton rows={4} /></div> : lines.length === 0 ? (
          <div className="ts-card">
            <EmptyState icon={ShoppingCart} title="Your cart is empty" text="Add wholesale products from the catalogue, or use Buy Now on any listing." action={<><Button to="/products">Explore Products</Button><Button to="/products?ready=1" variant="outline">Ready to ship</Button></>} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-label="Cart items">
              <ul className="space-y-4">
                {lines.map(({ product, quantity, variant, unitPrice, lineTotal }) => {
                  const company = getCompany(product.companyId);
                  const tier = getActiveTier(product, quantity);
                  const nextTier = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty).find((item) => item.minQty > quantity);
                  return (
                    <li key={product.id} className="ts-card flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                      <Link to={`/products/${product.slug}`} className="shrink-0 self-start" tabIndex={-1} aria-hidden="true">
                        <Image photo={product.photo} illustration={product.illustration} width={240} height={240} alt="" className="size-24 rounded-xl bg-surface object-cover sm:size-28" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="font-sans text-[0.9375rem] font-semibold leading-snug text-ink"><Link to={`/products/${product.slug}`} className="hover:text-brand-600">{product.name}</Link></h2>
                            {company ? <p className="mt-0.5 text-[0.8125rem] text-muted">Supplier: <Link to={`/suppliers/${company.slug}`} className="font-medium text-navy-800 hover:text-brand-600">{company.name}</Link></p> : null}
                            {variant ? <p className="text-[0.8125rem] text-muted">{Object.entries(variant).map(([name, value]) => `${name}: ${value}`).join(' · ')}</p> : null}
                          </div>
                          <IconButton icon={Trash2} label={`Remove ${product.name} from cart`} size="sm" tone="danger" onClick={() => removeFromCart(product.id)} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <QuantityInput value={quantity} min={product.moq} max={Math.max(product.stock, product.moq)} step={product.moq >= 100 ? 50 : product.moq >= 10 ? 5 : 1} onChange={(value) => updateQuantity(product.id, value)} label={`Quantity of ${product.name}`} size="sm" />
                            <p className="mt-1.5 text-xs text-muted">MOQ {quantityLabel(product.moq, product.unit)} · {money(unitPrice)} / {product.unit}{tier ? ` at ${tier.minQty.toLocaleString('en-IN')}+` : ''}</p>
                            {nextTier ? <p className="text-xs font-medium text-brand-700">Order {nextTier.minQty.toLocaleString('en-IN')}+ to pay {money(nextTier.price)} / {product.unit}</p> : null}
                          </div>
                          <p className="font-display text-lg font-extrabold text-navy-900">{money(lineTotal)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap justify-between gap-3">
                <Button to="/products" variant="ghost" size="sm">← Continue browsing</Button>
                <Button variant="dangerOutline" size="sm" icon={Trash2} onClick={clearDialog.onOpen}>Clear cart</Button>
              </div>
            </section>

            <aside className="h-fit lg:sticky lg:top-36">
              <OrderSummary totals={totals} title="Order summary">
                <Button to="/checkout" size="lg" full iconRight={ArrowRight} className="mt-5">Proceed to checkout</Button>
                <p className="mt-3 text-center text-xs text-muted">Prices in INR. Shipping and taxes are estimates.</p>
              </OrderSummary>
            </aside>
          </div>
        )}
      </div>
      <ConfirmDialog open={clearDialog.open} onCancel={clearDialog.onClose} onConfirm={() => { clearCart(); clearDialog.onClose(); }} title="Clear your cart?" text="All products will be removed from the cart." confirmLabel="Clear cart" />
    </>
  );
}
