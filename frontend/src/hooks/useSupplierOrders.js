import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from './useAuth';
import { authorizedRequest } from '../services/authorizedApi';
import { isApiConfigured } from '../services/apiClient';
import { toSupplierOrder } from '../utils/supplierOrders';

export { SUPPLIER_ORDER_FILTERS, SUPPLIER_ORDER_STATUS, toSupplierOrder } from '../utils/supplierOrders';

/*
 * The signed-in supplier's purchase orders from the database (GET /api/supplier/orders): the same orders the
 * dashboard counts. Each order keeps its own line snapshot (name, quantity, price), so deleting a product never
 * hides an order. Answers for a previous account are ignored; every request ends in data or an error.
 */

export default function useSupplierOrders(companyId) {
  const { user } = useAuth();
  const owner = user?.role === 'supplier' && isApiConfigured ? user.id : null;
  const [state, setState] = useState({ owner: null, orders: [], loading: Boolean(owner), error: '' });
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!owner) { setState({ owner: null, orders: [], loading: false, error: '' }); return; }
    const id = ++request.current;
    setState((prev) => ({ ...prev, owner, loading: true, error: '' }));
    try {
      const list = await authorizedRequest('GET', 'supplier/orders');
      if (id !== request.current) return; // a newer request (or account switch) replaced this one
      setState({ owner, orders: (Array.isArray(list) ? list : []).map((o) => toSupplierOrder(o, companyId)), loading: false, error: '' });
    } catch (err) {
      if (id !== request.current) return;
      setState({ owner, orders: [], loading: false, error: err?.message || 'Your orders could not be loaded.' });
    }
  }, [owner, companyId]);

  useEffect(() => {
    load();
    return () => { request.current += 1; }; // ignore answers after unmount / account switch
  }, [load]);

  const mine = state.owner === owner;
  return { orders: mine ? state.orders : [], loading: Boolean(owner) && (!mine || state.loading), error: mine ? state.error : '', reload: load };
}
