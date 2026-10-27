import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowUpRight, Check, FileText, Heart, Layers, Plus, Scale, ShieldCheck, ShoppingCart, Users, Zap } from 'lucide-react';
import Image from '../common/Image';
import Rating from '../common/Rating';
import VerificationBadge from '../common/VerificationBadge';
import BuyNowButton from './BuyNowButton';
import useCart from '../../hooks/useCart';
import { defaultVariant } from '../../hooks/useBuyNow';
import useProducts from '../../hooks/useProducts';
import useWishlist from '../../hooks/useWishlist';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import { getPriceRange } from '../../utils/calculateTotals';
import { formatNumber } from '../../utils/formatCurrency';
import { quantityLabel } from '../../utils/units';

export function PriceRange({ product, className = '', size = 'md' }) {
  const { money } = useCurrency();
  const { min, max } = getPriceRange(product);
  return (
    <p className={className}>
      <span className={`font-display font-extrabold tracking-[-0.02em] text-navy-900 ${size === 'lg' ? 'text-2xl' : 'text-[1.15rem]'}`}>{min === max ? money(min) : `${money(min)} – ${money(max)}`}</span>
      <span className="text-[0.8125rem] text-muted"> / {product.unit}</span>
    </p>
  );
}

export function WishlistButton({ product, className = '' }) {
  const { isSaved, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = user ? isSaved(product.id) : false;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toggleWishlist(product);
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    toggleWishlist(product);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}
      title={user ? (saved ? 'Remove from saved products' : 'Save product to wishlist') : 'Log in to save to wishlist'}
      className={`inline-flex size-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-navy-900/5 transition-all hover:scale-105 hover:ring-brand-500 ${saved ? 'text-accent-600' : 'text-navy-900'} ${className}`}
    >
      <Heart className={`size-[1.05rem] ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}

/** One status chip at most, so cards stay calm: ready-to-ship, then wholesale deal, then new. */
function StatusChip({ product }) {
  const chip = product.readyToShip
    ? { icon: Zap, label: 'Ready to ship', className: 'bg-navy-900 text-white' }
    : product.deal ? { icon: Layers, label: 'Volume pricing', className: 'bg-accent-500 text-white' }
      : product.isNew ? { icon: null, label: 'New', className: 'bg-white text-navy-900 ring-1 ring-navy-900/10' } : null;
  if (!chip) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide shadow-sm ${chip.className}`}>
      {chip.icon ? <chip.icon className="size-3" aria-hidden="true" /> : null}{chip.label}
    </span>
  );
}

/** Stock line shown under the rating. Uses the listing's real stock figure. */
function Availability({ product }) {
  const outOfStock = product.stock <= 0;
  const low = !outOfStock && product.stock < product.moq * 3;
  const tone = outOfStock ? 'bg-danger' : low ? 'bg-accent-500' : 'bg-success';
  const label = outOfStock ? 'Out of stock' : low ? 'Limited stock' : 'In stock';
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <span className={`size-1.5 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
      <span className={`font-semibold ${outOfStock ? 'text-danger' : 'text-ink'}`}>{label}</span>
      <span aria-hidden="true">·</span>
      <span className="truncate">MOQ {quantityLabel(product.moq, product.unit)}</span>
    </p>
  );
}

/** Product tile used across the catalogue. `layout` is "grid" or "list". */
export default function ProductCard({ product, layout = 'grid' }) {
  const { getCompany } = useProducts();
  const { addToCart, removeFromCart, inCart } = useCart();
  const { money } = useCurrency();
  const company = getCompany(product.companyId);
  const href = `/products/${product.slug}`;
  const isList = layout === 'list';
  const outOfStock = product.stock <= 0;
  const alreadyInCart = inCart(product.id);
  const bestTier = [...(product.priceTiers ?? [])].sort((a, b) => b.minQty - a.minQty)[0];

  const supplierName = product.supplier?.company || product.supplier?.name || company?.name;
  const supplierSlug = company?.slug || (supplierName ? supplierName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
  const isVerified = Boolean(product.supplier?.isVerified || company?.verification?.status === 'reviewed');
  const supplierCount = product.supplierCount || (product.supplier ? 1 : 0);

  return (
    <article className={`group relative flex overflow-hidden rounded-[1.75rem] bg-white p-2 shadow-card ring-1 ring-navy-900/[0.05] transition-all duration-300 hover:-translate-y-1 hover:shadow-lift ${isList ? 'flex-col sm:flex-row' : 'flex-col'}`}>
      <div className={`ts-photo-stage relative shrink-0 overflow-hidden rounded-[1.35rem] ${isList ? 'sm:w-64' : ''}`}>
        <Link to={href} tabIndex={-1} aria-hidden="true" className="block">
          <Image
            photo={product.photo} illustration={product.illustration} width={560} height={560} alt=""
            className={`w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] ${isList ? 'aspect-[4/3] sm:aspect-auto sm:h-full' : 'aspect-square'}`}
          />
        </Link>
        <div className="absolute left-3 top-3"><StatusChip product={product} /></div>
        <WishlistButton product={product} className="absolute right-3 top-3" />
        {company || product.supplier ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.6875rem] font-semibold text-navy-900 shadow-sm backdrop-blur">
            <span aria-hidden="true">{company?.flag || '🇮🇳'}</span><span className="sr-only">Origin: </span>{product.supplier?.country || company?.country || 'India'}
          </span>
        ) : null}
        {outOfStock ? <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-navy-950/80 py-1.5 text-center text-xs font-semibold text-white">Out of stock</span> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-2.5 pb-2.5 pt-3.5 sm:px-3.5">
        <div className="flex items-center justify-between gap-1.5">
          {supplierName ? (
            <p className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted truncate">
              <Link to={`/suppliers/${supplierSlug}`} className="truncate hover:text-brand-600">{supplierName}</Link>
              {isVerified && (
                <span title="TradeExpress Verified Supplier" className="inline-flex items-center text-emerald-600">
                  <ShieldCheck className="size-3.5" />
                </span>
              )}
            </p>
          ) : <span />}

          {supplierCount > 1 && (
            <Link
              to={`${href}#suppliers-listing`}
              className="inline-flex items-center gap-1 shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[0.6875rem] font-bold text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200/60"
              title={`Compare ${supplierCount} TradeExpress suppliers offering this product`}
            >
              <Scale className="size-3 text-brand-600" />
              {supplierCount} Suppliers
            </Link>
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.7em] font-display text-[1rem] font-bold leading-snug tracking-[-0.01em] text-navy-900">
          <Link to={href} className="transition-colors hover:text-brand-600">{product.name}</Link>
        </h3>
        {isList ? <p className="mt-1.5 line-clamp-2 text-sm text-muted">{product.summary}</p> : null}

        <Rating value={product.rating} count={product.reviewCount} className="mb-1.5 mt-2" />
        <Availability product={product} />

        {product.specifications && Object.keys(product.specifications).length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted">
            {Object.entries(product.specifications).slice(0, 2).map(([key, val]) => (
              <span key={key} className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                {key}: {Array.isArray(val) ? val.join(', ') : String(val)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <PriceRange product={product} />
            {bestTier && bestTier.minQty > product.moq ? <p className="text-xs text-muted">{money(bestTier.price)} at {formatNumber(bestTier.minQty)}+</p> : null}
          </div>
          <button
            type="button"
            disabled={outOfStock}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (alreadyInCart) {
                removeFromCart(product.id);
              } else {
                addToCart(product, product.moq, defaultVariant(product));
              }
            }}
            aria-pressed={alreadyInCart}
            aria-label={alreadyInCart ? `Remove ${product.name} from cart` : `Add ${product.name} to cart`}
            title={alreadyInCart ? 'In cart · Click to remove' : 'Add to cart'}
            className={`relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
              alreadyInCart
                ? 'bg-emerald-100/95 text-emerald-800 border-2 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 hover:bg-emerald-200/80'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-xs hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-800'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <ShoppingCart className={`size-5 transition-colors ${alreadyInCart ? 'text-emerald-800' : 'text-emerald-700'}`} aria-hidden="true" />
              {alreadyInCart ? (
                <span
                  className="absolute -top-2 -right-2.5 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm ring-1.5 ring-white font-bold"
                  title="In cart · Click to remove"
                >
                  <Check className="size-2.5 stroke-[3.5] text-white" aria-hidden="true" />
                </span>
              ) : (
                <span
                  className="absolute -top-2 -right-2.5 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white font-black shadow-xs ring-1 ring-white"
                  title="Add to cart"
                >
                  <Plus className="size-2.5 stroke-[3.5] text-white" aria-hidden="true" />
                </span>
              )}
            </div>
          </button>
        </div>

        <div className={`mt-auto pt-4 ${isList ? 'sm:max-w-md' : ''}`}>
          <BuyNowButton product={product} className="w-full !px-3" />
          <div className="mt-3 flex items-center justify-center border-t border-navy-900/[0.06] pt-3 text-[0.8125rem] font-semibold">
            <Link to={href} className="inline-flex items-center justify-center gap-1.5 text-navy-900 hover:text-brand-600 transition-colors">
              View product details <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
