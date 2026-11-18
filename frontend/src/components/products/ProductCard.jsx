import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Crown,
  Heart,
  ImageOff,
  Layers,
  Plus,
  ShoppingCart,
  Star,
  Tag,
  Zap,
} from 'lucide-react';
import Button from '../common/Button';
import BuyNowButton from './BuyNowButton';
import useCart from '../../hooks/useCart';
import { defaultVariant } from '../../hooks/useBuyNow';
import useWishlist from '../../hooks/useWishlist';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useCurrency from '../../hooks/useCurrency';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber } from '../../utils/formatCurrency';
import { photoUrl } from '../../utils/images';
import { quantityLabel } from '../../utils/units';
import {
  availabilityOf,
  hasGenuineVolumePricing,
  priceRange,
  productPhoto,
  productUnit,
  validMoq,
  validPrice,
  validTiersOf,
} from '../../utils/productDisplay';

/**
 * The product's price in the buyer's display currency ("≈" when converted; checkout and orders keep the real
 * currency), or "Price on request" when the listing has no valid price. Zero is never shown as a price.
 */
export function PriceRange({ product, className = '', size = 'md' }) {
  const { displayMoney } = useCurrency();
  const { t } = useTranslation();
  const range = priceRange(product);
  const unit = productUnit(product);
  const textSize = size === 'lg' ? 'text-2xl' : 'text-[1.125rem]';
  if (!range) {
    return (
      <p className={className}>
        <span className={`font-display font-bold tracking-[-0.01em] text-navy-900 ${size === 'lg' ? 'text-xl' : 'text-[1.05rem]'}`}>
          {t('product.priceOnRequest', {}, 'Price on request')}
        </span>
      </p>
    );
  }
  const money = (value) => displayMoney(value, product?.currency || 'INR');
  return (
    <p className={className}>
      <span className={`font-display font-extrabold tracking-[-0.02em] text-navy-950 ${textSize}`}>
        {range.min === range.max ? money(range.min) : `${money(range.min)} – ${money(range.max).replace(/^≈ /, '')}`}
      </span>
      {unit ? <span className="text-[0.8125rem] font-normal text-muted"> / {unit}</span> : null}
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
      className={`inline-flex size-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-navy-900/5 transition-all hover:scale-105 hover:ring-emerald-500 ${saved ? 'text-rose-600' : 'text-navy-900'} ${className}`}
    >
      <Heart className={`size-[1.05rem] ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}

/** Status chip on top-left of image: Volume pricing in emerald when applicable, ready-to-ship, or new. */
function StatusChip({ product, hasVolumePricing, availability }) {
  const { t } = useTranslation();
  if (hasVolumePricing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-white shadow-sm">
        <Layers className="size-3" aria-hidden="true" />
        {t('product.volumePricing', {}, 'Volume Pricing')}
      </span>
    );
  }
  if (availability === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide text-white shadow-sm">
        <Zap className="size-3" aria-hidden="true" />
        {t('common.readyToShip', {}, 'Ready to ship')}
      </span>
    );
  }
  if (product?.isNew) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide text-navy-900 ring-1 ring-navy-900/10 shadow-sm">
        {t('product.new', {}, 'New')}
      </span>
    );
  }
  return null;
}

/**
 * Product photo in fixed-height frame. Without a photo, a neutral placeholder is shown.
 */
function ProductImage({ product, isList }) {
  const photo = productPhoto(product);
  const src = photo ? photoUrl(photo, 560, 560) : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const frame = isList ? 'h-48 sm:h-full sm:min-h-48' : 'h-48 sm:h-52';

  if (!src || failed) {
    return (
      <div className={`flex w-full flex-col items-center justify-center gap-2 text-navy-700/60 ${frame}`}>
        <ImageOff className="size-8" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs font-medium">No image available</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={560}
      height={560}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${frame}`}
    />
  );
}

/**
 * Premium quantity-based pricing dropdown with floating popover overlay.
 * Collapsed by default; reveals backend-driven tiers with lowest price highlighted.
 */
function QuantityPricingDropdown({
  product,
  validTiers,
  unit,
  money,
  isOpen,
  setIsOpen,
}) {
  const containerRef = useRef(null);

  // Close when another card opens its pricing dropdown
  useEffect(() => {
    const handleCloseOthers = (e) => {
      if (e.detail !== product?.id) {
        setIsOpen(false);
      }
    };
    window.addEventListener('tradeexpress:close-other-pricing', handleCloseOthers);
    return () => window.removeEventListener('tradeexpress:close-other-pricing', handleCloseOthers);
  }, [product?.id, setIsOpen]);

  // Close on click outside and on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  if (!validTiers || validTiers.length === 0) return null;

  const lowestPrice = Math.min(...validTiers.map((t) => t.price));
  const unitLabel = unit ? `${unit.charAt(0).toUpperCase() + unit.slice(1)}` : 'Piece';

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isOpen;
    setIsOpen(next);
    if (next && product?.id) {
      window.dispatchEvent(
        new CustomEvent('tradeexpress:close-other-pricing', { detail: product.id })
      );
    }
  };

  return (
    <div className="relative mt-2.5 w-full" ref={containerRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-label="Toggle quantity-based pricing table"
        className={`group/qty flex w-full items-center justify-between gap-2 rounded-[14px] border px-3 py-1.5 text-left transition-all duration-200 ${
          isOpen
            ? 'border-emerald-500 bg-emerald-50/90 shadow-xs ring-2 ring-emerald-500/20'
            : 'border-emerald-200/90 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/80 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
            <Tag className="size-3 stroke-[2.5]" aria-hidden="true" />
          </span>
          <span className="truncate text-xs font-semibold text-emerald-950">
            Quantity-Based Pricing
          </span>
        </div>
        <ChevronDown
          className={`size-3.5 shrink-0 text-emerald-700 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-900' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Quantity based pricing tiers"
          className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-emerald-200/90 bg-white p-2.5 shadow-xl transition-all duration-200"
        >
          <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
              <span>Quantity ({unitLabel}s)</span>
              <span>Price / {unitLabel}</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {validTiers.map((tier, idx) => {
                const isBest = tier.price === lowestPrice;
                const nextTier = validTiers[idx + 1];
                const qtyRange = tier.maxQty
                  ? `${formatNumber(tier.minQty)} – ${formatNumber(tier.maxQty)}`
                  : nextTier
                  ? `${formatNumber(tier.minQty)} – ${formatNumber(nextTier.minQty - 1)}`
                  : `${formatNumber(tier.minQty)}+`;

                return (
                  <div
                    key={tier.minQty}
                    className={`flex items-center justify-between px-2.5 py-2 transition-colors ${
                      isBest
                        ? 'bg-emerald-50/90 text-emerald-950 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50/70'
                    }`}
                  >
                    <span className="font-medium">
                      {qtyRange} {unit ? `${unit}s` : ''}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={isBest ? 'font-extrabold text-emerald-800' : 'text-navy-950'}>
                        {money(tier.price)}
                      </span>
                      {isBest && (
                        <span title="Best Price" className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/80 shadow-xs">
                          <Crown className="size-3 fill-emerald-600 text-emerald-700" aria-label="Best price" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Upgraded TradeExpress B2B Marketplace Product Card.
 * Clean, premium, modern design adhering strictly to required order:
 * 1. Product Image
 * 2. Volume Pricing Badge (orange, only when applicable)
 * 3. Wishlist Heart Icon
 * 4. Product Name
 * 5. Product Price Range
 * 6. Best Bulk Price Information
 * 7. Premium Quantity-Based Pricing Dropdown
 * 8. MOQ and Stock Availability
 * 9. Dynamic Buyer Rating (only when genuine ratings exist)
 * 10. Buy Now Button and Add to Cart Icon
 * 11. View Product Link
 * Supplier information is excluded from cards.
 */
export default function ProductCard({ product, layout = 'grid' }) {
  const { addToCart, removeFromCart, inCart } = useCart();
  const { displayMoney } = useCurrency();
  const { t } = useTranslation();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const isItemInCart = typeof inCart === 'function' ? inCart(product?.id) : false;

  if (!product?.id || !product?.name) return null;

  const href = product.slug ? `/products/${product.slug}` : `/products/${product.id}`;
  const isList = layout === 'list';
  const range = priceRange(product);
  const moq = validMoq(product.moq);
  const unit = productUnit(product);
  const availability = availabilityOf(product);
  const outOfStock = availability === 'out';
  const purchasable = Boolean(range) && (availability === 'in' || availability === 'ready');
  const money = (value) => displayMoney(value, product.currency || 'INR');

  // Parse valid quantity price tiers and volume pricing qualification
  const validTiers = validTiersOf(product);
  const hasVolumePricing = hasGenuineVolumePricing(product);
  const bestTier = hasVolumePricing && validTiers.length > 0
    ? [...validTiers].sort((a, b) => a.price - b.price)[0]
    : null;

  // Dynamic Buyer Rating: products with genuine reviews show rating immediately before Buy Now
  const reviewCount = Number(product?.reviewCount);
  const ratingVal = Number(product?.rating);
  const hasGenuineRating = Number.isFinite(reviewCount) && reviewCount > 0 && Number.isFinite(ratingVal) && ratingVal > 0;

  const availabilityLabel = {
    out: product.status && product.status !== 'Active' ? t('product.notAvailable', {}, 'Not available') : t('common.outOfStock', {}, 'Out of stock'),
    in: t('common.inStock', {}, 'In stock'),
    ready: t('common.readyToShip', {}, 'Ready to ship'),
  }[availability];

  const handleCartToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const qtyToAdd = moq ?? 1;

    // The cart badge and the button state confirm the change (no notification for cart clicks)
    if (isItemInCart) removeFromCart(product.id);
    else addToCart(product, qtyToAdd, defaultVariant(product));
  };

  return (
    <article
      className={`group relative flex h-full rounded-[1.75rem] bg-white p-2.5 shadow-card ring-1 ring-navy-900/[0.05] transition-all duration-300 hover:shadow-lift ${
        isPricingOpen ? 'z-30 ring-2 ring-emerald-500/30' : 'z-0 hover:-translate-y-1'
      } ${isList ? 'flex-col sm:flex-row' : 'flex-col'}`}
    >
      {/* 1. Product Image Stage */}
      <div className={`ts-photo-stage relative shrink-0 overflow-hidden rounded-[1.35rem] bg-slate-50 ${isList ? 'sm:w-64' : ''}`}>
        <Link to={href} tabIndex={-1} aria-hidden="true" className="block h-full">
          <ProductImage product={product} isList={isList} />
        </Link>

        {/* 2. Volume Pricing Badge (orange, only when applicable) */}
        <div className="absolute left-3 top-3">
          <StatusChip product={product} hasVolumePricing={hasVolumePricing} availability={availability} />
        </div>

        {/* 3. Wishlist Heart Icon */}
        {!outOfStock ? (
          <WishlistButton product={product} className="absolute right-3 top-3" />
        ) : null}

        {outOfStock ? (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-navy-950/80 py-1.5 text-center text-xs font-semibold text-white">
            {availabilityLabel}
          </span>
        ) : null}
      </div>

      {/* Card Content Body */}
      <div className="flex min-w-0 flex-1 flex-col px-1.5 pb-1 pt-3.5 sm:px-2">
        {/* 4. Product Name */}
        <h3 className="line-clamp-2 font-display text-[0.9375rem] sm:text-[1rem] font-bold leading-snug tracking-[-0.01em] text-navy-950">
          <Link to={href} className="transition-colors hover:text-emerald-700">
            {product.name}
          </Link>
        </h3>
        {isList && product.summary ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{product.summary}</p>
        ) : null}

        {/* 5. Product Price Range & 6. Best Bulk Price Information */}
        <div className="mt-2.5 min-w-0">
          <PriceRange product={product} />
          {hasVolumePricing && bestTier ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <span title="Best Price" className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/80 shrink-0">
                <Crown className="size-2.5 fill-emerald-600 text-emerald-700" aria-label="Best price" />
              </span>
              <span>{money(bestTier.price)} at {formatNumber(bestTier.minQty)}+ {unit ? `${unit}s` : 'pieces'}</span>
            </p>
          ) : null}
        </div>

        {/* 7. Premium Quantity-Based Pricing Dropdown (only when Volume Pricing is applicable) */}
        {hasVolumePricing && validTiers.length > 1 ? (
          <QuantityPricingDropdown
            product={product}
            validTiers={validTiers}
            unit={unit}
            money={money}
            isOpen={isPricingOpen}
            setIsOpen={setIsPricingOpen}
          />
        ) : null}

        {/* 8. MOQ and Stock Availability */}
        <p className={`${hasVolumePricing ? 'mt-2.5' : 'mt-3'} flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted`}>
          {moq ? (
            <span className="font-medium text-ink">MOQ: {quantityLabel(moq, unit || 'unit')}</span>
          ) : (
            <span>{t('product.moqNotSpecified', {}, 'MOQ not specified')}</span>
          )}
          {availability ? (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${outOfStock ? 'bg-danger' : 'bg-emerald-600'}`}
                  aria-hidden="true"
                />
                <span className={`font-semibold ${outOfStock ? 'text-danger' : 'text-slate-700'}`}>
                  {availabilityLabel}
                </span>
              </span>
            </>
          ) : null}
        </p>

        {/* Bottom Action Area */}
        <div className={`mt-auto pt-3 ${isList ? 'sm:max-w-md' : ''}`}>
          {/* 9. Dynamic Buyer Rating (rendered immediately before Buy Now button ONLY when genuine reviews exist) */}
          {hasGenuineRating ? (
            <div className="mb-2 flex items-center gap-1.5 text-xs">
              <div className="inline-flex items-center gap-1 font-bold text-slate-800">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                <span>{ratingVal.toFixed(1)}</span>
              </div>
              <span className="text-muted">({formatNumber(reviewCount)})</span>
            </div>
          ) : null}

          {/* 10. Buy Now Button and Add to Cart Icon */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {purchasable ? (
                <BuyNowButton
                  product={product}
                  className="w-full !rounded-full !bg-emerald-800 hover:!bg-emerald-900 active:!bg-emerald-950 !text-white shadow-sm hover:-translate-y-0.5 active:scale-95"
                />
              ) : (
                <Button variant="outline" size="sm" disabled className="w-full !rounded-full !px-3">
                  {outOfStock ? availabilityLabel : t('product.priceOnRequest', {}, 'Price on request')}
                </Button>
              )}
            </div>
            {purchasable ? (
              <button
                type="button"
                onClick={handleCartToggle}
                aria-label={isItemInCart ? `Remove ${product.name} from cart` : `Add ${product.name} to cart`}
                className={`relative inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-xs ${
                  isItemInCart
                    ? 'border border-emerald-400 bg-emerald-50/40 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-50'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
              >
                <span className="relative flex items-center justify-center">
                  <ShoppingCart className={`size-4.5 transition-colors ${isItemInCart ? 'text-emerald-800' : 'text-slate-700'}`} aria-hidden="true" />
                  {isItemInCart ? (
                    <span
                      className="absolute -right-2 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs ring-1.5 ring-white"
                      aria-hidden="true"
                    >
                      <Check className="size-2.5 stroke-[3.5]" />
                    </span>
                  ) : (
                    <span
                      className="absolute -right-2 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-slate-200 text-slate-700 shadow-xs ring-1.5 ring-white"
                      aria-hidden="true"
                    >
                      <Plus className="size-2 stroke-[3.5]" />
                    </span>
                  )}
                </span>
              </button>
            ) : null}
          </div>

          {/* 11. View Product Link */}
          <div className="mt-3 flex items-center justify-center border-t border-navy-900/[0.06] pt-2.5 text-[0.8125rem] font-semibold">
            <Link
              to={href}
              className="inline-flex items-center gap-1.5 text-navy-900 transition-colors hover:text-emerald-700"
            >
              View Product <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
