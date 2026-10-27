import { Zap } from 'lucide-react';
import Button from '../common/Button';
import useBuyNow from '../../hooks/useBuyNow';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Orange "Buy Now" button. Goes straight to checkout with this one product and leaves
 * the cart untouched. Pass `quantity` / `variant` to use the buyer's own selection.
 */
export default function BuyNowButton({ product, quantity, variant, size = 'sm', className = '', full = false }) {
  const buyNow = useBuyNow();
  const { t } = useTranslation();

  if (!product) {
    return (
      <Button variant="primary" size={size} icon={Zap} full={full} className={className} disabled>
        {t('common.buyNow', {}, 'Buy Now')}
      </Button>
    );
  }

  const outOfStock = (product.stock ?? 0) <= 0;
  return (
    <Button
      variant="primary"
      size={size}
      icon={Zap}
      full={full}
      className={className}
      disabled={outOfStock}
      onClick={(e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        buyNow(product, { quantity, variant });
      }}
      aria-label={`Buy ${product.name} now`}
    >
      {outOfStock ? t('common.outOfStock', {}, 'Out of stock') : t('common.buyNow', {}, 'Buy Now')}
    </Button>
  );
}
