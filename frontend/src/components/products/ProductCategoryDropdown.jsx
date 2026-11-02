import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  Boxes,
  Car,
  Check,
  ChevronDown,
  Compass,
  Gamepad2,
  HardHat,
  Home,
  Laptop,
  Package,
  Search,
  Shirt,
  Sparkles,
  Wheat,
  Wrench,
  X,
} from 'lucide-react';

const CATEGORY_ICONS = {
  electronics: Laptop,
  'fashion-apparel': Shirt,
  'home-kitchen': Home,
  machinery: Wrench,
  'beauty-personal-care': Sparkles,
  packaging: Package,
  furniture: Armchair,
  automotive: Car,
  'sports-outdoors': Compass,
  'toys-games': Gamepad2,
  agriculture: Wheat,
  'industrial-supplies': HardHat,
};

export default function ProductCategoryDropdown({
  categories = [],
  products = [],
  selectedCategory = '',
  selectedSubcategory = '',
  onSelectCategory,
  onSelectSubcategory,
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const catRef = useRef(null);
  const subRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handlePointer = (e) => {
      if (catRef.current && !catRef.current.contains(e.target)) {
        setCatOpen(false);
      }
      if (subRef.current && !subRef.current.contains(e.target)) {
        setSubOpen(false);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setCatOpen(false);
        setSubOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Focus search input when category dropdown opens
  useEffect(() => {
    if (catOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [catOpen]);

  // Count products per category
  const productCountByCategory = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => {
      if (p.status === 'Active') {
        map[p.category] = (map[p.category] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);
  const subcategories = activeCategoryObj?.subcategories || [];

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(term) ||
        (cat.description && cat.description.toLowerCase().includes(term)) ||
        (cat.subcategories && cat.subcategories.some((s) => s.toLowerCase().includes(term)))
    );
  }, [categories, searchTerm]);

  const ActiveIcon = selectedCategory && CATEGORY_ICONS[selectedCategory]
    ? CATEGORY_ICONS[selectedCategory]
    : Boxes;

  // Curated 4 popular shortcuts to show beside the dropdown
  const popularSlugs = ['electronics', 'fashion-apparel', 'machinery', 'home-kitchen'];
  const popularCategories = categories.filter((c) => popularSlugs.includes(c.slug));

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      {/* ============================================================ */}
      {/* 1. Main Category Dropdown Selector                           */}
      {/* ============================================================ */}
      <div className="relative" ref={catRef}>
        <button
          type="button"
          onClick={() => {
            setCatOpen((v) => !v);
            setSubOpen(false);
          }}
          aria-haspopup="listbox"
          aria-expanded={catOpen}
          className={`group inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 border ${
            selectedCategory
              ? 'bg-emerald-50 text-emerald-950 border-emerald-400 shadow-xs ring-2 ring-emerald-500/10'
              : 'bg-white text-slate-800 border-slate-200/90 hover:border-emerald-500/60 hover:bg-slate-50 shadow-2xs'
          }`}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-lg text-xs transition-colors shrink-0 ${
              selectedCategory
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white'
            }`}
          >
            <ActiveIcon className="size-3.5" />
          </span>

          <span className="truncate max-w-[140px] sm:max-w-[200px]">
            {activeCategoryObj ? activeCategoryObj.name : 'All Categories'}
          </span>

          {selectedCategory ? (
            <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[11px] font-extrabold text-emerald-900 shrink-0">
              {productCountByCategory[selectedCategory] || 0}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 shrink-0">
              {categories.length}
            </span>
          )}

          <ChevronDown
            className={`size-3.5 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 shrink-0 ${
              catOpen ? 'rotate-180 text-emerald-700' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {/* Dropdown Panel */}
        {catOpen && (
          <div
            role="listbox"
            className="ts-dropdown-anim-left absolute left-0 top-[calc(100%+0.5rem)] z-40 w-72 sm:w-84 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-[0_20px_50px_-10px_rgba(11,39,22,0.24),0_0_0_1px_rgba(0,0,0,0.06)]"
          >
            {/* Top Accent Strip */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-600/70 to-transparent"
              aria-hidden="true"
            />

            {/* Quick Search Header */}
            <div className="border-b border-slate-100 bg-slate-50/80 p-2.5">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Options List */}
            <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5 ts-slim-scrollbar">
              {/* Option: All Categories */}
              <button
                type="button"
                role="option"
                aria-selected={!selectedCategory}
                onClick={() => {
                  onSelectCategory('');
                  setCatOpen(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                  !selectedCategory
                    ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex size-7 items-center justify-center rounded-lg text-xs shrink-0 ${
                      !selectedCategory
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                    }`}
                  >
                    <Boxes className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate">All Categories</span>
                    <p className="text-[10px] font-normal text-slate-400 truncate">
                      Entire wholesale catalogue ({products.length} products)
                    </p>
                  </div>
                </div>
                {!selectedCategory && (
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>

              {/* Filtered Individual Categories */}
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategory === cat.slug;
                const IconComponent = CATEGORY_ICONS[cat.slug] || Boxes;
                const count = productCountByCategory[cat.slug] || 0;

                return (
                  <button
                    key={cat.id || cat.slug}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectCategory(cat.slug);
                      setCatOpen(false);
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
                        <IconComponent className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate">{cat.name}</span>
                        {cat.subcategories?.length ? (
                          <p className="text-[10px] font-normal text-slate-400 truncate">
                            {cat.subcategories.slice(0, 3).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? 'bg-emerald-200/80 text-emerald-900'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        {count}
                      </span>
                      {isSelected && (
                        <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredCategories.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No categories match “{searchTerm}”
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. Subcategory Dropdown (if active category has subcategories) */}
      {/* ============================================================ */}
      {subcategories.length > 0 && (
        <div className="relative" ref={subRef}>
          <button
            type="button"
            onClick={() => {
              setSubOpen((v) => !v);
              setCatOpen(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={subOpen}
            className={`group inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all border ${
              selectedSubcategory
                ? 'bg-brand-50 text-navy-900 border-brand-300 ring-2 ring-brand-500/10'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <span className="text-slate-400 font-normal">Subcategory:</span>
            <span className="font-bold text-slate-900 truncate max-w-[120px] sm:max-w-[160px]">
              {selectedSubcategory || 'All'}
            </span>
            <ChevronDown
              className={`size-3 text-slate-400 transition-transform duration-200 ${
                subOpen ? 'rotate-180 text-emerald-700' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {subOpen && (
            <div
              role="listbox"
              className="ts-dropdown-anim-left absolute left-0 top-[calc(100%+0.5rem)] z-40 w-56 sm:w-64 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-xl p-1.5 space-y-0.5"
            >
              <button
                type="button"
                role="option"
                aria-selected={!selectedSubcategory}
                onClick={() => {
                  onSelectSubcategory('');
                  setSubOpen(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                  !selectedSubcategory
                    ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>All {activeCategoryObj?.name || 'Subcategories'}</span>
                {!selectedSubcategory && (
                  <Check className="size-3.5 text-emerald-700" strokeWidth={3} />
                )}
              </button>

              {subcategories.map((sub) => {
                const isSelected = selectedSubcategory === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectSubcategory(sub);
                      setSubOpen(false);
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{sub}</span>
                    {isSelected && (
                      <Check className="size-3.5 text-emerald-700" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. Quick Popular Category Chips (Wrapped cleanly, NO scrollbar) */}
      {/* ============================================================ */}
      <div className="hidden sm:flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelectCategory('')}
          className={`inline-flex min-h-[2.25rem] items-center rounded-xl px-3 py-1 text-xs font-semibold transition-all duration-150 border ${
            !selectedCategory
              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          All
        </button>

        {popularCategories.map((cat) => {
          const isActive = selectedCategory === cat.slug;
          return (
            <button
              key={cat.id || cat.slug}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={`inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold transition-all duration-150 border ${
                isActive
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs font-bold'
                  : 'bg-white text-slate-700 border-slate-200/90 hover:border-emerald-400 hover:bg-emerald-50/50'
              }`}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Clear category quick button if a category is filtered */}
      {selectedCategory && (
        <button
          type="button"
          onClick={() => onSelectCategory('')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors ml-auto sm:ml-0"
          title="Clear category filter"
        >
          <X className="size-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}
