import { Zap } from 'lucide-react';
import Button from '../common/Button';
import useBuyNow from '../../hooks/useBuyNow';

/**
 * Orange "Buy Now" button. Goes straight to checkout with this one product and leaves
 * the cart untouched. Pass `quantity` / `variant` to use the buyer's own selection.
 */
export default function BuyNowButton({ product, quantity, variant, size = 'sm', className = '', full = false }) {
  const buyNow = useBuyNow();
  const outOfStock = product.stock <= 0;
  return (
    <Button
      variant="primary" size={size} icon={Zap} full={full} className={className} disabled={outOfStock}
      onClick={() => buyNow(product, { quantity, variant })} aria-label={`Buy ${product.name} now`}
    >
      {outOfStock ? 'Out of stock' : 'Buy Now'}
    </Button>
  );
}
