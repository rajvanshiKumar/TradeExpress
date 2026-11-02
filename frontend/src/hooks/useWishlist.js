import { useContext } from 'react';
import { WishlistContext } from '../contexts/WishlistContext';

export default function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used inside <WishlistProvider>.');
  return context;
}
