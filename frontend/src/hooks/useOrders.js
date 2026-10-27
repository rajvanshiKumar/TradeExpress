import { useContext } from 'react';
import { OrderContext } from '../contexts/OrderContext';

export default function useOrders() {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used inside <OrderProvider>.');
  return context;
}
