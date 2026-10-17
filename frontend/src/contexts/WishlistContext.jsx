import { createContext, useCallback, useContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { ProductContext } from './ProductContext';
import { NotificationContext } from './NotificationContext';

export const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { showToast } = useContext(NotificationContext);
  const [ids, setIds] = useLocalStorage(STORAGE_KEYS.wishlist, []);
  const [supplierIds, setSupplierIds] = useLocalStorage(STORAGE_KEYS.savedSuppliers, []);
  const { products, companies } = useContext(ProductContext);

  const isSaved = useCallback((productId) => ids.includes(productId), [ids]);

  const toggleWishlist = useCallback((product) => {
    const saved = ids.includes(product.id);
    setIds((previous) => (saved ? previous.filter((id) => id !== product.id) : [product.id, ...previous.filter((id) => id !== product.id)]));
    showToast(saved ? 'Removed from saved products.' : 'Saved to your wishlist.', saved ? 'info' : 'success');
  }, [ids, setIds, showToast]);

  const clearWishlist = useCallback(() => setIds([]), [setIds]);

  const isSupplierSaved = useCallback((companyId) => supplierIds.includes(companyId), [supplierIds]);
  const toggleSupplier = useCallback((company) => {
    const saved = supplierIds.includes(company.id);
    setSupplierIds((previous) => (saved ? previous.filter((id) => id !== company.id) : [company.id, ...previous.filter((id) => id !== company.id)]));
    showToast(saved ? `${company.name} removed from saved suppliers.` : `${company.name} saved to your suppliers.`, saved ? 'info' : 'success');
  }, [supplierIds, setSupplierIds, showToast]);
  const clearSuppliers = useCallback(() => setSupplierIds([]), [setSupplierIds]);

  // Products that were deleted from the catalogue simply drop out of the list.
  const items = useMemo(() => ids.map((id) => products.find((product) => product.id === id)).filter(Boolean), [ids, products]);
  const suppliers = useMemo(() => supplierIds.map((id) => companies.find((company) => company.id === id)).filter(Boolean), [supplierIds, companies]);

  const value = useMemo(() => ({
    ids, items, count: items.length + suppliers.length, productCount: items.length, isSaved, toggleWishlist, clearWishlist,
    suppliers, isSupplierSaved, toggleSupplier, clearSuppliers,
  }), [ids, items, suppliers, isSaved, toggleWishlist, clearWishlist, isSupplierSaved, toggleSupplier, clearSuppliers]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
