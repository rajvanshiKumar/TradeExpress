import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import useProducts from '../../hooks/useProducts';

const SCOPES = [
  { value: 'products', label: 'Products' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'companies', label: 'Companies' },
];

/**
 * Marketplace search.
 * variant "header": choose what to search (products, suppliers or company names).
 * variant "hero": search products inside an optional category.
 */
export default function SearchForm({ variant = 'header', idPrefix = 'search', onSubmitted, autoFocus = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories } = useProducts();
  const isHero = variant === 'hero';
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('products');
  const [category, setCategory] = useState('');

  // Keep the header field in sync with the page being viewed.
  useEffect(() => {
    if (isHero) return;
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/products') {
      setScope('products');
      setQuery(params.get('q') ?? '');
    } else if (location.pathname === '/suppliers') {
      setScope(params.get('scope') === 'company' ? 'companies' : 'suppliers');
      setQuery(params.get('q') ?? '');
    }
  }, [isHero, location.pathname, location.search]);

  const submit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const text = query.trim();
    if (text) params.set('q', text);
    let path = '/products';
    if (isHero) {
      if (category) params.set('category', category);
    } else if (scope !== 'products') {
      path = '/suppliers';
      if (scope === 'companies') params.set('scope', 'company');
    }
    const search = params.toString();
    navigate(`${path}${search ? `?${search}` : ''}`);
    onSubmitted?.();
  };

  const placeholder = isHero || scope === 'products' ? 'Search products, e.g. wireless earbuds' : scope === 'suppliers' ? 'Search suppliers by product or industry' : 'Search by company name or city';

  return (
    <form role="search" onSubmit={submit} className={`flex w-full items-stretch overflow-hidden rounded-full bg-white p-1 transition-shadow ${isHero ? 'shadow-pop ring-1 ring-white/40' : 'ring-1 ring-navy-900/15 focus-within:ring-2 focus-within:ring-brand-500'}`}>
      <label htmlFor={`${idPrefix}-scope`} className="sr-only">{isHero ? 'Category' : 'Search in'}</label>
      {isHero ? (
        <select id={`${idPrefix}-scope`} value={category} onChange={(event) => setCategory(event.target.value)} className="hidden max-w-44 shrink-0 rounded-l-full border-r border-navy-900/10 bg-transparent pl-4 pr-2 text-sm font-semibold text-navy-900 focus:outline-none focus-visible:bg-navy-50 sm:block">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
      ) : (
        <select id={`${idPrefix}-scope`} value={scope} onChange={(event) => setScope(event.target.value)} className="max-w-28 shrink-0 rounded-l-full border-r border-navy-900/10 bg-transparent pl-3 pr-1 text-[0.8125rem] font-semibold text-navy-900 focus:outline-none focus-visible:bg-navy-50 sm:max-w-none sm:pl-4 sm:pr-2 sm:text-sm">
          {SCOPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      )}
      <label htmlFor={`${idPrefix}-query`} className="sr-only">Search</label>
      <input
        id={`${idPrefix}-query`} type="search" autoFocus={autoFocus} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} autoComplete="off"
        className={`min-w-0 flex-1 bg-transparent px-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none sm:px-4 ${isHero ? 'h-12 sm:text-base' : 'h-10'}`}
      />
      <button type="submit" className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition-colors ${isHero ? 'bg-brand-500 px-4 text-navy-900 hover:bg-brand-400 sm:px-7' : 'bg-navy-900 px-3.5 text-white hover:bg-navy-800 sm:px-5'}`}>
        <Search className="size-[1.125rem]" aria-hidden="true" />
        <span className={isHero ? 'hidden sm:inline' : 'hidden lg:inline'}>Search</span>
        <span className="sr-only sm:hidden">Search</span>
      </button>
    </form>
  );
}
