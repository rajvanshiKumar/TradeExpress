import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useCollection from '../hooks/useCollection';
import orderService from '../services/orderService';
import { AuthContext } from './AuthContext';
import { NotificationContext } from './NotificationContext';
import { ProductContext } from './ProductContext';

// Orders. Placing one stores the order in this browser; payment status is tracked separately.
export const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const { items: orders, setItems, loading, error, reload } = useCollection(orderService.listOrders, orderService.saveOrders);
  const { addNotification } = useContext(NotificationContext);
  const { products, updateProduct } = useContext(ProductContext);
  const { user } = useContext(AuthContext);

  const seenStorageKey = user?.id ? `tradesphere:v3:seen-orders:${user.id}` : 'tradesphere:v3:seen-orders:default';

  const [seenOrderIds, setSeenOrderIds] = useState(() => {
    try {
      const raw = localStorage.getItem(seenStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Re-sync seenOrderIds when the authenticated user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(seenStorageKey);
      setSeenOrderIds(raw ? JSON.parse(raw) : []);
    } catch {
      setSeenOrderIds([]);
    }
  }, [seenStorageKey]);

  // Persist seenOrderIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(seenStorageKey, JSON.stringify(seenOrderIds));
    } catch {
      // Ignore storage write issues
    }
  }, [seenOrderIds, seenStorageKey]);

  // Unseen orders count for the authenticated buyer (excluding historic seed/sample orders)
  const unseenOrdersCount = useMemo(() => {
    if (!user?.id) return 0;
    const myOrders = (orders || []).filter((o) => o.buyerId === user.id);
    return myOrders.filter((o) => {
      if (o.isSample) return false;
      const orderId = o.id;
      const orderNum = o.orderNumber;
      return !seenOrderIds.includes(orderId) && (!orderNum || !seenOrderIds.includes(orderNum));
    }).length;
  }, [orders, user?.id, seenOrderIds]);

  const markOrderSeen = useCallback((id) => {
    if (!id) return;
    setSeenOrderIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const markAllOrdersSeen = useCallback(() => {
    if (!user?.id) return;
    const myOrderIds = (orders || [])
      .filter((o) => o.buyerId === user.id)
      .flatMap((o) => [o.id, o.orderNumber])
      .filter(Boolean);

    setSeenOrderIds((prev) => Array.from(new Set([...prev, ...myOrderIds])));
  }, [orders, user?.id]);

  const isOrderSeen = useCallback((order) => {
    if (!order) return true;
    if (typeof order === 'string') return seenOrderIds.includes(order);
    if (order.isSample) return true;
    return seenOrderIds.includes(order.id) || (order.orderNumber && seenOrderIds.includes(order.orderNumber));
  }, [seenOrderIds]);

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

  const value = useMemo(() => ({
    orders,
    loading,
    error,
    reload,
    placeOrder,
    updateOrderStatus,
    getOrder,
    unseenOrdersCount,
    markOrderSeen,
    markAllOrdersSeen,
    isOrderSeen,
  }), [orders, loading, error, reload, placeOrder, updateOrderStatus, getOrder, unseenOrdersCount, markOrderSeen, markAllOrdersSeen, isOrderSeen]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
