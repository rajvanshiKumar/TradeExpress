import { createContext, useCallback, useContext, useMemo } from 'react';
import useCollection from '../hooks/useCollection';
import orderService from '../services/orderService';
import { NotificationContext } from './NotificationContext';
import { ProductContext } from './ProductContext';

// Orders. Placing one stores the order in this browser; payment status is tracked separately.
export const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const { items: orders, setItems, loading, error, reload } = useCollection(orderService.listOrders, orderService.saveOrders);
  const { addNotification } = useContext(NotificationContext);
  const { products, updateProduct } = useContext(ProductContext);

  const placeOrder = useCallback(async (payload) => {
    const order = await orderService.createOrder(payload);
    setItems((previous) => [order, ...previous]);

    // Reduce stock and let each supplier know.
    const companyIds = new Set();
    order.items.forEach((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (product) updateProduct(product.id, { stock: Math.max(product.stock - item.quantity, 0), orderCount: (product.orderCount ?? 0) + 1 });
      companyIds.add(item.companyId);
    });
    companyIds.forEach((companyId) => addNotification({ audience: `company:${companyId}`, type: 'orders', title: 'New order', body: `${order.buyerName} placed order ${order.id}.`, link: '/supplier/orders' }));
    addNotification({ audience: order.buyerId, type: 'orders', title: 'Order placed', body: `Order ${order.id} has been placed.`, link: '/buyer/orders' });
    return order;
  }, [setItems, products, updateProduct, addNotification]);

  const updateOrderStatus = useCallback((id, status) => {
    const order = orders.find((item) => item.id === id);
    if (!order || order.status === status) return;
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, status } : item)));
    addNotification({ audience: order.buyerId, type: 'orders', title: `Order ${status.toLowerCase()}`, body: `Order ${order.id} is now marked as ${status}.`, link: '/buyer/orders' });
  }, [orders, setItems, addNotification]);

  const getOrder = useCallback((id) => orders.find((item) => item.id === id) ?? null, [orders]);

  const value = useMemo(() => ({ orders, loading, error, reload, placeOrder, updateOrderStatus, getOrder }),
    [orders, loading, error, reload, placeOrder, updateOrderStatus, getOrder]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
