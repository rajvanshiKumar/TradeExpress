import { formatNumber } from './formatCurrency';

/** "1 piece", "250 pieces" */
export function quantityLabel(quantity, unit = 'unit') {
  return `${formatNumber(quantity)} ${Number(quantity) === 1 ? unit : `${unit}s`}`;
}
