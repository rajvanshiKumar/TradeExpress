import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Button from '../../components/common/Button';
import Image from '../../components/common/Image';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import useCart from '../../hooks/useCart';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useContactSupplier from '../../hooks/useContactSupplier';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { apiGet } from '../../services/apiClient';

const POPULAR_SEARCH_SUGGESTIONS = [
  'Cotton Shirt',
  'Trail Running Shoes',
  'Cordless Impact Drill',
  'Vitamin C Brightening Serum',
  'Kraft Paper Shopping Bags',
  'Three-Seat Fabric Sofa',
];

export default function ProductComparison() {
  const { productId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { money } = useCurrency();
  const { addToCart, removeFromCart, inCart } = useCart();
  const { showToast } = useNotifications();
  const { products, getCompany, getProduct } = useProducts();
  const contact = useContactSupplier();

  useDocumentTitle('Compare Products | TradeExpress B2B');

  // Search State
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuerySubmitted, setSearchQuerySubmitted] = useState('');

  // Compared Products matching search
  const [comparedProducts, setComparedProducts] = useState([]);
  const [highlightDifferences, setHighlightDifferences] = useState(false);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);

  // Execute Search for products across all suppliers
  const executeSearch = async (rawQuery) => {
    const query = (rawQuery !== undefined ? rawQuery : searchInput).trim();
    if (!query) {
      showToast('Please enter a product name, keyword, or material to search.', 'info');
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setSearchQuerySubmitted(query);

    try {
      // 1. Fetch matching products from backend API
      let remoteMatches = [];
      try {
        const searchRes = await apiGet(`products?search=${encodeURIComponent(query)}&limit=30`);
        if (searchRes && searchRes.success && Array.isArray(searchRes.data)) {
          remoteMatches = searchRes.data;
        }
      } catch (err) {
        // Backend search fallback handled by local catalogue below
      }

      // 2. Also search active catalog / seed items in memory
      const qLower = query.toLowerCase();
      const allCatalogue = products || [];
      const localMatches = allCatalogue.filter((p) => {
        if (!p || !p.name) return false;
        const nameMatch = p.name.toLowerCase().includes(qLower);
        const catMatch = (p.categoryName || p.categorySlug || '').toLowerCase().includes(qLower);
        const summaryMatch = (p.summary || '').toLowerCase().includes(qLower);
        const matMatch = (p.material || '').toLowerCase().includes(qLower);
        return nameMatch || catMatch || summaryMatch || matMatch;
      });

      // Merge and deduplicate by product id
      const seenIds = new Set();
      const combined = [];
      for (const item of [...remoteMatches, ...localMatches]) {
        if (item && item.id && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          const company = item.companyId ? getCompany(item.companyId) : null;
          combined.push({
            ...item,
            supplier: item.supplier || (company ? {
              id: company.id,
              company: company.name,
              name: company.name,
              isVerified: Boolean(company.verification?.status === 'reviewed'),
              location: company.city ? `${company.city}, ${company.country}` : company.country || 'India',
              country: company.country || 'India',
              flag: company.flag || '🇮🇳',
              rating: company.rating || 4.8,
              reviewCount: company.reviewCount || 24,
            } : null),
          });
        }
      }

      setComparedProducts(combined);
      setMobileActiveIndex(0);
    } catch (err) {
      console.error('Search error:', err);
      showToast('Search encountered an error. Please try again.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleProductSearch = (e) => {
    if (e) e.preventDefault();
    executeSearch();
  };

  // If a specific productId was passed in route params (e.g. from ProductDetails "Compare Similar Products"),
  // automatically search for that product to show competing offers across suppliers
  useEffect(() => {
    if (productId) {
      const target = getProduct(productId);
      if (target) {
        setSearchInput(target.name);
        executeSearch(target.name);
      } else {
        apiGet(`products/${productId}`)
          .then((res) => {
            if (res && res.data?.name) {
              setSearchInput(res.data.name);
              executeSearch(res.data.name);
            }
          })
          .catch(() => {});
      }
    }
  }, [productId]);

  // Remove a product from current comparison list
  const removeProduct = (idToRemove) => {
    setComparedProducts((prev) => prev.filter((p) => p.id !== idToRemove));
  };

  // Count distinct suppliers among results
  const uniqueSuppliersCount = useMemo(() => {
    const set = new Set();
    comparedProducts.forEach((p) => {
      const name = p.supplier?.company || p.supplier?.name;
      if (name) set.add(name);
    });
    return set.size;
  }, [comparedProducts]);

  // Difference highlighter map
  const diffMap = useMemo(() => {
    if (comparedProducts.length < 2) return {};
    const hasDiff = (key) => {
      const first = comparedProducts[0]?.[key];
      return comparedProducts.some((p) => p?.[key] !== first);
    };
    return {
      price: hasDiff('price'),
      moq: hasDiff('moq'),
      material: hasDiff('material'),
      stock: hasDiff('stock'),
      delivery: hasDiff('estimatedDelivery') || hasDiff('leadTimeDays'),
      origin: comparedProducts.some((p) => p.supplier?.country !== comparedProducts[0]?.supplier?.country),
    };
  }, [comparedProducts]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Breadcrumbs & Page Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Products', href: '/products' },
            { label: 'Product Comparison' },
          ]}
        />
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/20">
            <Scale className="size-4" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            Compare Products
          </h1>
        </div>
        <p className="text-sm text-navy-600 mt-1 max-w-3xl">
          Search any product across registered TradeExpress suppliers to inspect wholesale specifications, pricing, and competing listings side-by-side.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH BAR SECTION (Search Any Product to Compare)                        */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 rounded-3xl p-5 sm:p-7 shadow-xl border border-navy-800 text-white">
        <div className="max-w-3xl">
          <h2 className="text-base sm:text-lg font-bold text-white mb-1.5 flex items-center gap-2">
            <Search className="size-5 text-brand-400" />
            <span>Search Any Product to Compare</span>
          </h2>
          <p className="text-xs sm:text-sm text-navy-200 mb-4">
            Type any product name, model, material, or keyword to find and compare competing listings from several suppliers.
          </p>

          <form onSubmit={handleProductSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-navy-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search product (e.g., Trail Running Shoes, Cotton Shirt, Cordless Drill)..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-navy-950 placeholder:text-navy-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-400 border border-white/20 shadow-inner"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700 p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="brand"
              disabled={searching}
              icon={Search}
              className="py-3 px-6 text-sm font-bold shadow-md shrink-0 justify-center"
            >
              {searching ? 'Searching...' : 'Search Product'}
            </Button>
          </form>

          {/* Quick suggestions pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-navy-300 font-medium">Quick suggestions:</span>
            {POPULAR_SEARCH_SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setSearchInput(item);
                  executeSearch(item);
                }}
                className="text-[11px] bg-white/10 hover:bg-white/20 text-navy-100 px-2.5 py-1 rounded-full font-medium transition-colors"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPARISON RESULTS SECTION                                               */}
      {/* ========================================================================= */}

      {/* Case 1: Initial state before any search is performed */}
      {!hasSearched && (
        <div className="rounded-3xl border border-navy-900/[0.08] bg-white p-8 sm:p-14 text-center shadow-xs">
          <div className="mx-auto size-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 ring-1 ring-brand-500/20">
            <Scale className="size-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-navy-950 mb-1.5">
            Search Any Product to Compare
          </h3>
          <p className="text-sm text-navy-600 max-w-lg mx-auto mb-6">
            Insert any product name or keyword in the search bar above to compare competing wholesale listings from multiple verified suppliers side-by-side.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-2 max-w-xl mx-auto">
            <span className="text-xs text-navy-500 font-semibold mr-1">Popular searches:</span>
            {['Cotton Shirt', 'Trail Running Shoes', 'Cordless Drill', 'Vitamin C Serum', 'Paper Bags'].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setSearchInput(term);
                  executeSearch(term);
                }}
                className="text-xs bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 px-3 py-1.5 rounded-full font-medium transition-colors border border-slate-200"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Case 2: Searched, but 0 products match */}
      {hasSearched && !searching && comparedProducts.length === 0 && (
        <div className="rounded-3xl border border-navy-900/[0.08] bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto size-14 rounded-2xl bg-navy-50 text-navy-400 flex items-center justify-center mb-4">
            <Search className="size-7" />
          </div>
          <h3 className="text-lg font-bold text-navy-950 mb-1.5">
            No Products Found
          </h3>
          <p className="text-sm text-navy-600 max-w-md mx-auto mb-6">
            No products matched <span className="font-semibold text-navy-900">"{searchQuerySubmitted}"</span>. Try searching with different keywords like "Shoes", "Shirt", or "Drill".
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchInput('');
              setHasSearched(false);
              setComparedProducts([]);
            }}
          >
            Clear Search
          </Button>
        </div>
      )}

      {/* Case 3: Matching products found across suppliers */}
      {hasSearched && comparedProducts.length > 0 && (
        <section aria-labelledby="comparison-results-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-900/[0.08] pb-4">
            <div>
              <h2 id="comparison-results-heading" className="text-xl sm:text-2xl font-extrabold text-navy-950 flex flex-wrap items-center gap-2">
                <span>Comparison Results for</span>
                <span className="text-brand-600 font-black">"{searchQuerySubmitted}"</span>
              </h2>
              <p className="text-xs sm:text-sm text-navy-600 mt-1">
                Comparing <span className="font-bold text-navy-900">{comparedProducts.length}</span> matching product{comparedProducts.length > 1 ? 's' : ''} from <span className="font-bold text-navy-900">{uniqueSuppliersCount}</span> supplier{uniqueSuppliersCount > 1 ? 's' : ''}.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setHighlightDifferences(!highlightDifferences)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  highlightDifferences
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-white border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
                title="Highlight fields where values differ between products"
              >
                <Sparkles className={`size-3.5 ${highlightDifferences ? 'text-amber-600' : 'text-navy-400'}`} />
                <span>Highlight Differences</span>
              </button>
            </div>
          </div>

          {/* Desktop Side-by-Side Comparison Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-navy-900/[0.1] bg-white shadow-sm">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-navy-900/[0.08] bg-navy-50/40">
                  <th className="w-56 p-5 text-xs font-bold uppercase tracking-wider text-navy-500 bg-navy-50/80 align-top">
                    Feature & Attributes
                  </th>

                  {comparedProducts.map((product) => {
                    const sup = product.supplier;
                    const alreadyInCart = inCart(product.id);
                    return (
                      <th
                        key={product.id}
                        className="p-5 align-top relative border-r border-navy-100 last:border-r-0 min-w-[240px]"
                      >
                        {comparedProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            className="absolute top-4 right-4 p-1 rounded-md text-navy-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                            title="Remove from comparison"
                          >
                            <X className="size-4" />
                          </button>
                        )}

                        <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
                          {sup ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-navy-950 text-white shadow-2xs truncate max-w-[200px]">
                              <span>{sup.flag || '🇮🇳'}</span>
                              <span className="truncate">{sup.company || sup.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-navy-100 text-navy-800">
                              Wholesale Listing
                            </span>
                          )}
                        </div>

                        <Link
                          to={`/products/${product.slug || product.id}`}
                          className="group block relative aspect-square w-full max-w-[180px] mx-auto rounded-xl overflow-hidden bg-navy-50 border border-navy-100 mb-3"
                        >
                          <Image
                            photo={product.photo || product.rawPhoto}
                            illustration={product.illustration}
                            category={product.categorySlug}
                            width={560}
                            height={560}
                            alt={product.name}
                            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        </Link>

                        <Link
                          to={`/products/${product.slug || product.id}`}
                          className="block text-sm font-bold text-navy-950 hover:text-brand-600 transition-colors line-clamp-2 mb-2 leading-snug"
                        >
                          {product.name}
                        </Link>

                        <div className="mb-3">
                          <span className="text-xl font-extrabold text-navy-950">
                            {money(product.price)}
                          </span>
                          <span className="text-xs text-navy-500 font-medium ml-1">
                            / {product.unit || 'piece'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="brand"
                            icon={Eye}
                            to={`/products/${product.slug || product.id}`}
                            className="w-full text-xs font-bold justify-center"
                          >
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            icon={alreadyInCart ? CheckCircle2 : ShoppingCart}
                            disabled={product.stock <= 0}
                            onClick={() => {
                              if (alreadyInCart) {
                                removeFromCart(product.id);
                              } else {
                                addToCart(product, product.moq || 1, null);
                              }
                            }}
                            className={`w-full text-xs font-semibold justify-center transition-all ${
                              alreadyInCart
                                ? '!bg-emerald-100/95 !text-emerald-900 !border-2 !border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 hover:!bg-emerald-200/90'
                                : '!bg-emerald-50 !text-emerald-800 !border !border-emerald-300/90 shadow-xs hover:!bg-emerald-100 hover:!border-emerald-400'
                            }`}
                          >
                            {alreadyInCart ? 'In Cart (Click to Remove)' : 'Add to Cart (+)'}
                          </Button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-navy-900/[0.07] text-xs">
                {/* Wholesale Price Row */}
                <tr className={highlightDifferences && diffMap.price ? 'bg-amber-50/40' : ''}>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    <div className="flex items-center gap-1.5">
                      <span>Wholesale Pricing</span>
                      {highlightDifferences && diffMap.price && (
                        <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                      )}
                    </div>
                  </td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className="p-4 text-navy-800 align-top">
                      <div className="font-extrabold text-sm text-navy-950 mb-1">
                        {money(p.price)} <span className="text-xs font-normal text-navy-500">per {p.unit || 'piece'}</span>
                      </div>
                      {p.priceTiers && p.priceTiers.length > 0 ? (
                        <div className="mt-1 space-y-0.5 text-[11px] text-navy-600 bg-navy-50 p-2 rounded-lg">
                          <p className="font-semibold text-navy-800 mb-0.5">Tiered Pricing:</p>
                          {p.priceTiers.map((t, i) => (
                            <div key={i} className="flex justify-between">
                              <span>{t.minQty || t.minQuantity}{t.maxQty ? `–${t.maxQty}` : '+'} units:</span>
                              <span className="font-bold text-navy-900">{money(t.unitPrice || t.price)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-navy-400 text-[11px]">Standard rate</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Minimum Order Quantity (MOQ) */}
                <tr className={highlightDifferences && diffMap.moq ? 'bg-amber-50/40' : ''}>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    <div className="flex items-center gap-1.5">
                      <span>Minimum Order (MOQ)</span>
                      {highlightDifferences && diffMap.moq && (
                        <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                      )}
                    </div>
                  </td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className="p-4 align-top font-semibold text-navy-950">
                      {p.moq ? `${p.moq} ${p.unit || 'pieces'}` : '1 piece'}
                    </td>
                  ))}
                </tr>

                {/* Supplier Company & Origin */}
                <tr className={highlightDifferences && diffMap.origin ? 'bg-amber-50/40' : ''}>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    <div className="flex items-center gap-1.5">
                      <span>Supplier & Origin</span>
                      {highlightDifferences && diffMap.origin && (
                        <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                      )}
                    </div>
                  </td>
                  {comparedProducts.map((p) => {
                    const sup = p.supplier;
                    return (
                      <td key={p.id} className="p-4 align-top">
                        {sup ? (
                          <div>
                            <Link
                              to={sup.id ? `/suppliers/${sup.id}` : `/suppliers`}
                              className="font-bold text-navy-950 hover:text-brand-600 transition-colors flex items-center gap-1"
                              title="Inspect TradeExpress supplier profile"
                            >
                              <Building2 className="size-3.5 text-navy-500 shrink-0" />
                              <span className="truncate">{sup.company || sup.name}</span>
                            </Link>
                            <span className="text-[11px] text-navy-500 block mt-0.5">
                              Origin: {sup.location || sup.country || 'India'} {sup.flag || '🇮🇳'}
                            </span>
                            {sup.isVerified && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <BadgeCheck className="size-3 text-emerald-600" /> Verified Supplier
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-navy-400 italic">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Stock & Availability */}
                <tr className={highlightDifferences && diffMap.stock ? 'bg-amber-50/40' : ''}>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    <div className="flex items-center gap-1.5">
                      <span>Stock & Availability</span>
                      {highlightDifferences && diffMap.stock && (
                        <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                      )}
                    </div>
                  </td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className="p-4 align-top">
                      {p.inStock !== false && p.stock > 0 ? (
                        <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span>{p.stock} units in stock</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                          <span>Wholesale / Made to Order</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Material / Composition */}
                <tr className={highlightDifferences && diffMap.material ? 'bg-amber-50/40' : ''}>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    <div className="flex items-center gap-1.5">
                      <span>Material / Specs</span>
                      {highlightDifferences && diffMap.material && (
                        <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                      )}
                    </div>
                  </td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className="p-4 align-top">
                      {p.material ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-navy-100 text-navy-800 font-medium">
                          {p.material}
                        </span>
                      ) : (
                        <span className="text-navy-500">{p.summary || 'Standard specifications'}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Estimated Lead Time */}
                <tr className={highlightDifferences && diffMap.delivery ? 'bg-amber-50/40' : ''}>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    <div className="flex items-center gap-1.5">
                      <span>Estimated Lead Time</span>
                      {highlightDifferences && diffMap.delivery && (
                        <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                      )}
                    </div>
                  </td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className="p-4 align-top text-navy-800">
                      <div className="flex items-center gap-1.5">
                        <Truck className="size-3.5 text-navy-500 shrink-0" />
                        <span>{p.estimatedDelivery || `${p.leadTimeDays || 7} business days`}</span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Request RFQ or Inquiry */}
                <tr>
                  <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                    Supplier Inquiry
                  </td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className="p-4 align-top">
                      <Button
                        size="sm"
                        variant="ghost"
                        to={`/rfq?product=${p.id}`}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 w-full justify-center"
                      >
                        Request Quote / RFQ
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile View: Product Tabs + Card View */}
          <div className="block md:hidden">
            <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-none">
              {comparedProducts.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMobileActiveIndex(idx)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    mobileActiveIndex === idx
                      ? 'bg-navy-950 text-white border-navy-950 shadow-sm'
                      : 'bg-white text-navy-700 border-navy-200 hover:bg-navy-50'
                  }`}
                >
                  Product {idx + 1}
                </button>
              ))}
            </div>

            {comparedProducts[mobileActiveIndex] && (
              <MobileProductCard
                product={comparedProducts[mobileActiveIndex]}
                onRemove={() => removeProduct(comparedProducts[mobileActiveIndex].id)}
                canRemove={comparedProducts.length > 1}
                money={money}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                inCart={inCart}
                contact={contact}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Mobile-friendly Detailed Product Card for smartphone screens
 */
function MobileProductCard({ product, onRemove, canRemove, money, addToCart, removeFromCart, inCart, contact }) {
  const isVerified = Boolean(product.supplier?.isVerified || product.supplier?.kycStatus === 'VERIFIED');
  const alreadyInCart = inCart(product.id);

  return (
    <div className="rounded-2xl border border-navy-900/[0.1] bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {product.supplier && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-navy-950 text-white mb-2">
              <span>{product.supplier.flag || '🇮🇳'}</span>
              <span>{product.supplier.company || product.supplier.name}</span>
            </span>
          )}
          <h2 className="text-base font-bold text-navy-950 leading-snug">
            {product.name}
          </h2>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded-md text-navy-400 hover:text-danger-600 hover:bg-danger-50"
            title="Remove from comparison"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="aspect-video w-full rounded-xl overflow-hidden bg-navy-50 border border-navy-100">
        <Image
          photo={product.photo || product.rawPhoto}
          illustration={product.illustration}
          category={product.categorySlug}
          width={800}
          height={450}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex items-baseline justify-between bg-navy-50/70 p-3 rounded-xl border border-navy-900/[0.04]">
        <div>
          <span className="text-xs text-navy-500 block">Wholesale Price</span>
          <span className="text-lg font-extrabold text-navy-950">{money(product.price)}</span>
          <span className="text-xs text-navy-500 ml-1">/ {product.unit || 'piece'}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-navy-500 block">Minimum Order</span>
          <span className="text-sm font-bold text-navy-900">{product.moq} {product.unit || 'pieces'}</span>
        </div>
      </div>

      <div className="divide-y divide-navy-100 text-xs">
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Material</span>
          <span className="font-semibold text-navy-900">{product.material || product.summary || '—'}</span>
        </div>
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Availability</span>
          <span className={`font-semibold ${product.stock > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Wholesale / Made to Order'}
          </span>
        </div>
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Lead Time</span>
          <span className="font-semibold text-navy-900">{product.estimatedDelivery || `${product.leadTimeDays || 7} business days`}</span>
        </div>
        <div className="py-2 flex justify-between items-center">
          <span className="text-navy-500">Supplier</span>
          <div className="text-right">
            <Link
              to={product.supplier?.id ? `/suppliers/${product.supplier.id}` : `/suppliers`}
              className="font-bold text-navy-950 hover:text-brand-600 block"
            >
              {product.supplier?.company || product.supplier?.name || '—'}
            </Link>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                <BadgeCheck className="size-3 text-emerald-600" /> Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button
          size="sm"
          variant="brand"
          to={`/products/${product.slug || product.id}`}
          className="w-full text-xs font-bold justify-center"
        >
          View Details
        </Button>
        <Button
          size="sm"
          variant="outline"
          icon={alreadyInCart ? CheckCircle2 : ShoppingCart}
          onClick={() => {
            if (alreadyInCart) {
              removeFromCart(product.id);
            } else {
              addToCart(product, product.moq || 1, null);
            }
          }}
          className={`w-full text-xs font-semibold justify-center transition-all ${
            alreadyInCart
              ? '!bg-emerald-100/95 !text-emerald-900 !border-2 !border-emerald-500'
              : '!bg-emerald-50 !text-emerald-800 !border !border-emerald-300/90'
          }`}
        >
          {alreadyInCart ? 'In Cart (Remove)' : 'Add to Cart (+)'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          to={`/rfq?product=${product.id}`}
          className="w-full text-xs font-semibold justify-center col-span-2"
        >
          Request RFQ
        </Button>
      </div>
    </div>
  );
}
