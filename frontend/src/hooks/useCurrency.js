import formatCurrency from '../utils/formatCurrency';
import { CURRENCY } from '../utils/constants';

const money = (amount) => formatCurrency(amount);

/** Formats rupee amounts. All TradeSphere prices are in INR. */
export default function useCurrency() {
  return { currency: CURRENCY.code, money };
}
