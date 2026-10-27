import { createContext, useCallback, useContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { ProductContext } from './ProductContext';
import { NotificationContext } from './NotificationContext';
import useAuth from '../hooks/useAuth';

export const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useContext(NotificationContext);
  const [ids, setIds] = useLocalStorage(STORAGE_KEYS.wishlist, []);
  const [supplierIds, setSupplierIds] = useLocalStorage(STORAGE_KEYS.savedSuppliers, []);
  const { products, companies } = useContext(ProductContext);

  // Gated IDs: When user is not authenticated, wishlist is strictly empty
  const activeIds = useMemo(() => (user ? ids : []), [user, ids]);
  const activeSupplierIds = useMemo(() => (user ? supplierIds : []), [user, supplierIds]);

  const isSaved = useCallback((productId) => {
    if (!user) return false;
    return activeIds.includes(productId);
  }, [user, activeIds]);

  const toggleWishlist = useCallback((product) => {
    if (!user) {
      showToast('Please log in or sign up to add items to your wishlist.', 'warning');
      return false;
    }
    const saved = ids.includes(product.id);
    setIds((previous) => (saved ? previous.filter((id) => id !== product.id) : [product.id, ...previous.filter((id) => id !== product.id)]));
    showToast(saved ? 'Removed from saved products.' : 'Saved to your wishlist.', saved ? 'info' : 'success');
    return !saved;
  }, [user, ids, setIds, showToast]);

  const clearWishlist = useCallback(() => {
    if (!user) return;
    setIds([]);
  }, [user, setIds]);

  const isSupplierSaved = useCallback((companyId) => {
    if (!user) return false;
    return activeSupplierIds.includes(companyId);
  }, [user, activeSupplierIds]);

  const toggleSupplier = useCallback((company) => {
    if (!user) {
      showToast('Please log in or sign up to save suppliers to your wishlist.', 'warning');
      return false;
    }
    const saved = supplierIds.includes(company.id);
    setSupplierIds((previous) => (saved ? previous.filter((id) => id !== company.id) : [company.id, ...previous.filter((id) => id !== company.id)]));
    showToast(saved ? `${company.name} removed from saved suppliers.` : `${company.name} saved to your suppliers.`, saved ? 'info' : 'success');
    return !saved;
  }, [user, supplierIds, setSupplierIds, showToast]);

  const clearSuppliers = useCallback(() => {
    if (!user) return;
    setSupplierIds([]);
  }, [user, setSupplierIds]);

  // Products that were deleted from the catalogue simply drop out of the list.
  const items = useMemo(() => activeIds.map((id) => products.find((product) => product.id === id)).filter(Boolean), [activeIds, products]);
  const suppliers = useMemo(() => activeSupplierIds.map((id) => companies.find((company) => company.id === id)).filter(Boolean), [activeSupplierIds, companies]);

  const value = useMemo(() => ({
    ids: activeIds, items, count: items.length + suppliers.length, productCount: items.length, isSaved, toggleWishlist, clearWishlist,
    suppliers, isSupplierSaved, toggleSupplier, clearSuppliers,
  }), [activeIds, items, suppliers, isSaved, toggleWishlist, clearWishlist, isSupplierSaved, toggleSupplier, clearSuppliers]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

