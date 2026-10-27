import { useContext } from 'react';
import { ProductContext } from '../contexts/ProductContext';

export default function useProducts() {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used inside <ProductProvider>.');
  return context;
}
