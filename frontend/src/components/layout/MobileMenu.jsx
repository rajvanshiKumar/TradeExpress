import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, LayoutDashboard, LogOut, MessageSquare, Package, Scale } from 'lucide-react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import { PreferenceFields } from './PreferencesMenu';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useMessages from '../../hooks/useMessages';
import useWishlist from '../../hooks/useWishlist';
import { mainNav, quickLinks } from '../../data/navigation';
import { ordersPathFor, ROLE_HOME } from '../../utils/constants';

export default function MobileMenu({ open, onClose }) {
  const { user, logout } = useAuth();
  const { categories } = useProducts();
  const { unreadCount } = useMessages();
  const { count: wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const [showCategories, setShowCategories] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const row = 'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[0.9375rem] font-semibold text-navy-900 hover:bg-navy-50';
  const signOut = () => {
    logout();
    onClose();
    navigate('/');
  };

  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left">
      <div className="border-b bg-surface p-4">
        {user ? (
          <div>
            <p className="font-display font-bold text-navy-900">{user.name}</p>
            <p className="text-xs capitalize text-muted">{user.role} account</p>
            <div className="mt-3 flex gap-2">
              <Button to={ROLE_HOME[user.role]} size="sm" variant="navy" icon={LayoutDashboard} onClick={onClose} className="flex-1">Dashboard</Button>
              <Button size="sm" variant="outline" icon={LogOut} onClick={signOut}>Sign out</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button to="/login" variant="outline" size="sm" onClick={onClose} className="flex-1">Sign In</Button>
            <Button to="/register" variant="navy" size="sm" onClick={onClose} className="flex-1">Get Started</Button>
          </div>
        )}
      </div>

      <nav aria-label="Mobile">
        <ul className="divide-y">
          {mainNav.map((item) => (item.megaMenu ? (
            <li key={item.label}>
              <button type="button" className={row} onClick={() => setShowCategories((value) => !value)} aria-expanded={showCategories} aria-controls="mobile-categories">
                {item.label}
                <ChevronDown className={`size-4 text-muted transition-transform ${showCategories ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {showCategories ? (
                <ul id="mobile-categories" className="bg-surface pb-2">
                  <li><Link to="/categories" onClick={onClose} className="block px-6 py-2.5 text-sm font-semibold text-brand-600">All categories</Link></li>
                  {categories.map((category) => (
                    <li key={category.id}><Link to={`/categories/${category.slug}`} onClick={onClose} className="block px-6 py-2.5 text-sm text-ink hover:text-brand-600">{category.name}</Link></li>
                  ))}
                </ul>
              ) : null}
            </li>
          ) : (
            <li key={item.label}><Link to={item.to} onClick={onClose} className={`${row} ${item.highlight ? 'text-brand-600' : ''}`}>{item.label}</Link></li>
          )))}
          {quickLinks.map((item) => <li key={item.label}><Link to={item.to} onClick={onClose} className={`${row} !font-medium !text-navy-700`}>{item.label}</Link></li>)}
        </ul>

        <ul className="mt-2 divide-y border-t">
          <li>
            <Link to="/compare-quotes" onClick={onClose} className={row}>
              <span className="flex items-center gap-2.5">
                <Scale className="size-4 text-brand-600" aria-hidden="true" />
                Smart Quote Comparison
              </span>
            </Link>
          </li>
          <li><Link to="/messages" onClick={onClose} className={row}><span className="flex items-center gap-2.5"><MessageSquare className="size-4 text-muted" aria-hidden="true" />Messages</span>{unreadCount ? <span className="rounded-full bg-brand-500 px-2 text-xs font-bold text-navy-900">{unreadCount}</span> : null}</Link></li>
          <li><Link to={ordersPathFor(user)} onClick={onClose} className={row}><span className="flex items-center gap-2.5"><Package className="size-4 text-muted" aria-hidden="true" />Orders</span></Link></li>
          <li><Link to="/wishlist" onClick={onClose} className={row}><span className="flex items-center gap-2.5"><Heart className="size-4 text-muted" aria-hidden="true" />Saved products</span>{wishlistCount ? <span className="rounded-full bg-navy-50 px-2 text-xs font-bold text-navy-900">{wishlistCount}</span> : null}</Link></li>
          <li>
            <button type="button" className={row} onClick={() => setShowPrefs((value) => !value)} aria-expanded={showPrefs} aria-controls="mobile-prefs">
              Region, language & currency
              <ChevronDown className={`size-4 text-muted transition-transform ${showPrefs ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {showPrefs ? <div id="mobile-prefs" className="bg-surface p-4"><PreferenceFields idPrefix="mobile-pref" /></div> : null}
          </li>
        </ul>
      </nav>
    </Drawer>
  );
}
