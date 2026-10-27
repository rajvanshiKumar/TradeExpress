import { Check } from 'lucide-react';
import useCurrency from '../../hooks/useCurrency';
import { getActiveTier } from '../../utils/calculateTotals';
import { formatNumber } from '../../utils/formatCurrency';

/** Quantity price tiers. Highlights the tier that applies to `quantity` and allows clicking to jump directly to that tier's quantity. */
export default function PriceTiers({ product, quantity, onSelectTier, compact = false }) {
  const { money } = useCurrency();
  const tiers = [...(product?.priceTiers ?? [])].sort((a, b) => a.minQty - b.minQty);
  const active = quantity ? getActiveTier(product, quantity) : null;
  if (!tiers.length) return null;

  const isInteractive = typeof onSelectTier === 'function';

  return (
    <div className="space-y-1.5">
      <ul
        className={`grid grid-cols-1 gap-2.5 ${compact ? 'grid-cols-3' : 'grid-cols-1 xs:grid-cols-3'}`}
        aria-label="Price by quantity tiers"
      >
        {tiers.map((tier, index) => {
          const next = tiers[index + 1];
          const isActive = active && active.minQty === tier.minQty;
          const range = next
            ? `${formatNumber(tier.minQty)} – ${formatNumber(next.minQty - 1)}`
            : `${formatNumber(tier.minQty)}+`;

          const Component = isInteractive ? 'button' : 'li';
          const interactiveProps = isInteractive
            ? {
                type: 'button',
                onClick: () => onSelectTier(tier.minQty),
                title: `Click to select ${range} ${product?.unit || 'piece'}s at ${money(tier.price)} each`,
                'aria-pressed': isActive,
              }
            : {};

          return (
            <Component
              key={tier.minQty}
              {...interactiveProps}
              aria-current={isActive ? 'true' : undefined}
              className={`group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 ${
                isInteractive ? 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]' : ''
              } ${
                isActive
                  ? 'border-brand-500 bg-brand-50/90 shadow-sm ring-2 ring-brand-500/25'
                  : 'border-slate-200/90 bg-white hover:border-brand-400 hover:bg-slate-50/80 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold ${isActive ? 'text-brand-900 font-bold' : 'text-slate-600'}`}>
                  {range} {compact ? '' : `${product?.unit || 'piece'}s`}
                </span>
                {isActive ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[0.625rem] font-bold text-white shadow-xs">
                    <Check className="size-2.5 stroke-[3.5]" aria-hidden="true" />
                    Active
                  </span>
                ) : isInteractive ? (
                  <span className="text-[0.6875rem] font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Select
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-1">
                <p className={`font-display font-black tracking-tight text-navy-900 ${compact ? 'text-base' : 'text-xl'}`}>
                  {money(tier.price)}
                </p>
                <span className="text-[0.6875rem] text-slate-500 font-medium">
                  / {product?.unit || 'pc'}
                </span>
              </div>
            </Component>
          );
        })}
      </ul>
      {isInteractive && (
        <p className="text-[0.6875rem] text-slate-400 italic">
          💡 Click any tier above to instantly jump quantity and apply wholesale volume pricing.
        </p>
      )}
    </div>
  );
}
