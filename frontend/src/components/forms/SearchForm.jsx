import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes,
  Briefcase,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Layers,
  Package,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import useProducts from '../../hooks/useProducts';
import VisualSearchModal from '../common/VisualSearchModal';
import { useTranslation } from '../../i18n/LanguageContext';

const SCOPES = [
  { value: 'products', label: 'Products', icon: Package, desc: 'Find wholesale products' },
  { value: 'suppliers', label: 'Suppliers', icon: Building2, desc: 'Verified manufacturers' },
  { value: 'companies', label: 'Companies', icon: Briefcase, desc: 'Registered businesses' },
];

/**
 * Professional marketplace search bar with custom icon-enabled dropdown menu.
 * variant "header": choose what to search (products, suppliers or company names).
 * variant "hero": search products inside an optional category with custom symbol dropdown.
 */
export default function SearchForm({
  variant = 'header',
  idPrefix = 'search',
  onSubmitted,
  autoFocus = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, products } = useProducts();
  const { t } = useTranslation();
  const isHero = variant === 'hero';

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('products');
  const [category, setCategory] = useState('');
  const [visualSearchOpen, setVisualSearchOpen] = useState(false);

  // Custom Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Click outside and Esc key listener for custom dropdown
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const onPointer = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  // Focus filter input when category dropdown opens
  useEffect(() => {
    if (dropdownOpen && isHero) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setCategoryFilter('');
    }
  }, [dropdownOpen, isHero]);

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

  const placeholder =
    isHero || scope === 'products'
      ? t('header.searchPlaceholder', {}, 'Search wholesale products, e.g. wireless earbuds, cotton fabrics...')
      : scope === 'suppliers'
        ? t('header.searchPlaceholder', {}, 'Search suppliers by product, industry or capability...')
        : t('header.searchPlaceholder', {}, 'Search by verified company name or city...');

  const currentScope = SCOPES.find((s) => s.value === scope) || SCOPES[0];
  const ScopeIcon = currentScope.icon;

  const currentCategory = (categories || []).find((c) => c.slug === category);

  const filteredCategories = (categories || []).filter((cat) =>
    cat.name.toLowerCase().includes(categoryFilter.toLowerCase())
  );

  const getProductCount = (slug) =>
    (products || []).filter(
      (p) => p.category === slug && p.status === 'Active'
    ).length;

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`relative flex w-full items-stretch rounded-full bg-white p-1 transition-all ${
        isHero
          ? 'shadow-[0_12px_36px_-8px_rgba(11,39,22,0.18)] ring-1 ring-emerald-900/10 focus-within:ring-2 focus-within:ring-emerald-600'
          : 'ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-emerald-600 shadow-2xs'
      }`}
    >
      {/* ============================================================ */}
      {/* Custom Professional Dropdown with Symbols                    */}
      {/* ============================================================ */}
      <div className="relative shrink-0 flex items-stretch z-30" ref={dropdownRef}>
        <button
          type="button"
          id={`${idPrefix}-dropdown-trigger`}
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label={isHero ? 'Select Category' : 'Select Search Scope'}
          className={`group flex items-center gap-1.5 sm:gap-2 rounded-l-full border-r border-slate-200/80 bg-slate-50/80 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-800 transition-all hover:bg-slate-100 focus:outline-none ${
            isHero ? 'min-w-[130px] sm:min-w-[160px]' : 'min-w-[110px] sm:min-w-[130px]'
          }`}
        >
          {isHero ? (
            <>
              <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                {currentCategory ? <Layers className="size-3.5" /> : <Boxes className="size-3.5" />}
              </span>
              <span className="truncate max-w-[90px] sm:max-w-[120px] text-left">
                {currentCategory ? currentCategory.name : 'All Categories'}
              </span>
            </>
          ) : (
            <>
              <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                <ScopeIcon className="size-3.5" />
              </span>
              <span className="truncate">{currentScope.label}</span>
            </>
          )}

          <ChevronDown
            className={`size-3 text-slate-400 transition-transform duration-200 ml-auto shrink-0 group-hover:text-slate-700 ${
              dropdownOpen ? 'rotate-180 text-emerald-700' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {/* ============================================================ */}
        {/* Custom Dropdown Menu Panel with Symbols                      */}
        {/* ============================================================ */}
        {dropdownOpen && (
          <div
            role="listbox"
            className="ts-dropdown-anim-left absolute left-0 top-[calc(100%+0.5rem)] z-[100] w-72 sm:w-80 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-[0_22px_54px_-12px_rgba(11,39,22,0.22),0_0_0_1px_rgba(0,0,0,0.05)]"
          >
            {/* Top Emerald Glow Accent */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-600/60 to-transparent"
              aria-hidden="true"
            />

            {/* HERO VARIANT: Category Dropdown */}
            {isHero ? (
              <div>
                {/* Header & Quick Filter Input */}
                <div className="border-b border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-2">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <Boxes className="size-3.5 text-emerald-700" />
                      <span>Browse by Category</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(categories || []).length} available
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 size-3.5 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      placeholder="Filter categories..."
                      className="w-full rounded-lg bg-white border border-slate-200 py-1.5 pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {categoryFilter && (
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('')}
                        className="absolute right-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Categories List with Symbols */}
                <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 ts-no-scrollbar">
                  {/* All Categories Option */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={category === ''}
                    onClick={() => {
                      setCategory('');
                      setDropdownOpen(false);
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                      category === ''
                        ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex size-7 items-center justify-center rounded-lg text-xs shrink-0 ${
                          category === ''
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                        }`}
                      >
                        <Boxes className="size-3.5" />
                      </span>
                      <div>
                        <span>All Categories</span>
                        <p className="text-[10px] font-normal text-slate-400">
                          Search entire wholesale marketplace
                        </p>
                      </div>
                    </div>
                    {category === '' && (
                      <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>

                  {/* Filtered Individual Categories */}
                  {filteredCategories.map((cat) => {
                    const isSelected = category === cat.slug;
                    const liveCount = getProductCount(cat.slug);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setCategory(cat.slug);
                          setDropdownOpen(false);
                        }}
                        className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex size-7 items-center justify-center rounded-lg text-xs shrink-0 ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                            }`}
                          >
                            <Layers className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{cat.name}</p>
                            {liveCount > 0 && (
                              <p className="text-[10px] font-normal text-slate-400">
                                {liveCount} products
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* HEADER VARIANT: Scope Dropdown (Products, Suppliers, Companies) */
              <div className="p-1.5 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Search Target
                </div>
                {SCOPES.map((item) => {
                  const ItemIcon = item.icon;
                  const isSelected = scope === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setScope(item.value);
                        setDropdownOpen(false);
                      }}
                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex size-7 items-center justify-center rounded-lg text-xs shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                          }`}
                        >
                          <ItemIcon className="size-3.5" />
                        </span>
                        <div>
                          <p>{item.label}</p>
                          <p className="text-[10px] font-normal text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Query Search Input Field */}
      <label htmlFor={`${idPrefix}-query`} className="sr-only">
        Search query
      </label>
      <input
        id={`${idPrefix}-query`}
        type="search"
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`min-w-0 flex-1 bg-transparent px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none sm:px-4 font-medium ${
          isHero ? 'h-11 sm:h-12 text-sm sm:text-base' : 'h-9 sm:h-10'
        }`}
      />

      {/* Visual Image/Camera Search Trigger */}
      <button
        type="button"
        onClick={() => setVisualSearchOpen(true)}
        title="Search by image or camera"
        aria-label="Search by image or camera"
        className="inline-flex size-8 sm:size-9 shrink-0 self-center items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 mr-1 sm:mr-1.5"
      >
        <Camera className="size-4 sm:size-4.5" />
      </button>

      {/* Submit Search Button */}
      <button
        type="submit"
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 sm:gap-2 rounded-full font-bold transition-all active:scale-95 ${
          isHero
            ? 'bg-emerald-700 px-4 text-white hover:bg-emerald-800 sm:px-6 shadow-2xs hover:shadow-xs'
            : 'bg-slate-900 px-3.5 text-white hover:bg-emerald-700 sm:px-5 shadow-2xs'
        }`}
      >
        <Search className="size-4" aria-hidden="true" />
        <span className={isHero ? 'inline' : 'hidden lg:inline'}>{t('common.search', {}, 'Search')}</span>
      </button>

      {/* Visual Search Modal */}
      <VisualSearchModal
        isOpen={visualSearchOpen}
        onClose={() => setVisualSearchOpen(false)}
      />
    </form>
  );
}
