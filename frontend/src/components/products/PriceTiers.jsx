import useCurrency from '../../hooks/useCurrency';
import { getActiveTier } from '../../utils/calculateTotals';
import { formatNumber } from '../../utils/formatCurrency';

/** Quantity price tiers. Highlights the tier that applies to `quantity` when one is given. */
export default function PriceTiers({ product, quantity, compact = false }) {
  const { money } = useCurrency();
  const tiers = [...(product.priceTiers ?? [])].sort((a, b) => a.minQty - b.minQty);
  const active = quantity ? getActiveTier(product, quantity) : null;
  if (!tiers.length) return null;

  return (
    <ul className={`grid grid-cols-1 gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 xs:grid-cols-3'}`} aria-label="Price by quantity">
      {tiers.map((tier, index) => {
        const next = tiers[index + 1];
        const isActive = active && active.minQty === tier.minQty;
        const range = next ? `${formatNumber(tier.minQty)} – ${formatNumber(next.minQty - 1)}` : `${formatNumber(tier.minQty)}+`;
        return (
          <li key={tier.minQty} aria-current={isActive ? 'true' : undefined} className={`rounded-xl border px-3 py-2.5 ${isActive ? 'border-brand-500 bg-brand-50' : 'bg-white'}`}>
            <p className="text-xs text-muted">{range} {compact ? '' : `${product.unit}s`}</p>
            <p className={`font-display font-extrabold text-navy-900 ${compact ? 'text-base' : 'text-xl'}`}>{money(tier.price)}</p>
          </li>
        );
      })}
    </ul>
  );
}
