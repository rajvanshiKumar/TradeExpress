import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, Heart, Layers, Plus, Zap } from 'lucide-react';
import Image from '../common/Image';
import Rating from '../common/Rating';
import VerificationBadge from '../common/VerificationBadge';
import BuyNowButton from './BuyNowButton';
import useCart from '../../hooks/useCart';
import { defaultVariant } from '../../hooks/useBuyNow';
import useProducts from '../../hooks/useProducts';
import useWishlist from '../../hooks/useWishlist';
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
  const saved = isSaved(product.id);
  return (
    <button
      type="button" onClick={() => toggleWishlist(product)} aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}
      title={saved ? 'Remove from saved products' : 'Save product'}
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
  const { addToCart } = useCart();
  const { money } = useCurrency();
  const company = getCompany(product.companyId);
  const href = `/products/${product.slug}`;
  const isList = layout === 'list';
  const outOfStock = product.stock <= 0;
  const bestTier = [...(product.priceTiers ?? [])].sort((a, b) => b.minQty - a.minQty)[0];

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
        {company ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.6875rem] font-semibold text-navy-900 shadow-sm backdrop-blur">
            <span aria-hidden="true">{company.flag}</span><span className="sr-only">Origin: </span>{company.country}
          </span>
        ) : null}
        {outOfStock ? <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-navy-950/80 py-1.5 text-center text-xs font-semibold text-white">Out of stock</span> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-2.5 pb-2.5 pt-3.5 sm:px-3.5">
        {company ? (
          <p className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
            <Link to={`/suppliers/${company.slug}`} className="truncate hover:text-brand-600">{company.name}</Link>
            <VerificationBadge company={company} iconOnly />
          </p>
        ) : null}
        <h3 className="mt-1.5 line-clamp-2 min-h-[2.7em] font-display text-[1rem] font-bold leading-snug tracking-[-0.01em] text-navy-900">
          <Link to={href} className="transition-colors hover:text-brand-600">{product.name}</Link>
        </h3>
        {isList ? <p className="mt-1.5 line-clamp-2 text-sm text-muted">{product.summary}</p> : null}

        <Rating value={product.rating} count={product.reviewCount} className="mb-1.5 mt-2" />
        <Availability product={product} />

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <PriceRange product={product} />
            {bestTier && bestTier.minQty > product.moq ? <p className="text-xs text-muted">{money(bestTier.price)} at {formatNumber(bestTier.minQty)}+</p> : null}
          </div>
          <button
            type="button" disabled={outOfStock} onClick={() => addToCart(product, product.moq, defaultVariant(product))}
            aria-label={`Add ${product.name} to cart`} title="Add to cart"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white shadow-[var(--shadow-gold)] transition-all hover:-translate-y-0.5 hover:bg-navy-800 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className={`mt-auto pt-4 ${isList ? 'sm:max-w-md' : ''}`}>
          <BuyNowButton product={product} className="w-full !px-3" />
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-navy-900/[0.06] pt-3 text-[0.8125rem] font-semibold">
            <Link to={href} className="inline-flex items-center gap-1 text-navy-900 hover:text-brand-600">View product <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
            <Link to={`/rfq?product=${product.id}`} aria-label={`Request a quote for ${product.name}`} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"><FileText className="size-3.5" aria-hidden="true" />Request quote</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
