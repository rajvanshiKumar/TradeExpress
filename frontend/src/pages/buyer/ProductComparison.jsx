import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Layers,
  MessageSquare,
  Package,
  PackageCheck,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Button from '../../components/common/Button';
import Image from '../../components/common/Image';
import Rating from '../../components/common/Rating';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import useCart from '../../hooks/useCart';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useContactSupplier from '../../hooks/useContactSupplier';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { apiGet } from '../../services/apiClient';

const POPULAR_SEARCH_SUGGESTIONS = [
  { label: 'Cotton T-Shirt (10 Sellers)', query: 'Cotton T-Shirt' },
  { label: 'Wireless Earbuds', query: 'Wireless Earbuds' },
  { label: 'Trail Running Shoes', query: 'Trail Running Shoes' },
  { label: 'Soy Wax Candle', query: 'Soy Wax Candle' },
  { label: 'Cordless Impact Drill', query: 'Cordless Impact Drill' },
  { label: 'Kraft Paper Bags', query: 'Kraft Paper Shopping Bags' },
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

  useDocumentTitle('Product Comparison | TradeExpress B2B');

  // Search State
  const initialQuery = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuerySubmitted, setSearchQuerySubmitted] = useState('');

  // Compared Products matching search
  const [comparedProducts, setComparedProducts] = useState([]);
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance' | 'price-asc' | 'price-desc' | 'moq-asc' | 'delivery-asc' | 'rating-desc'
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterSampleOnly, setFilterSampleOnly] = useState(false);
  const [filterReadyToShip, setFilterReadyToShip] = useState(false);
  const [cartQuantities, setCartQuantities] = useState({});

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
      // 1. Fetch matching products from backend API (real-time live database)
      let remoteMatches = [];
      try {
        const searchRes = await apiGet(`products?search=${encodeURIComponent(query)}&limit=50`);
        if (searchRes && searchRes.success && Array.isArray(searchRes.data)) {
          remoteMatches = searchRes.data;
        }
      } catch (err) {
        // Fallback to local memory catalogue
      }

      // 2. Search active catalogue / seed items in memory
      const qLower = query.toLowerCase();
      const allCatalogue = products || [];
      const localMatches = allCatalogue.filter((p) => {
        if (!p || !p.name) return false;
        const nameMatch = p.name.toLowerCase().includes(qLower);
        const catMatch = (p.categoryName || p.categorySlug || p.category || '').toLowerCase().includes(qLower);
        const subMatch = (p.subcategory || '').toLowerCase().includes(qLower);
        const summaryMatch = (p.summary || '').toLowerCase().includes(qLower);
        const descMatch = (p.description || '').toLowerCase().includes(qLower);
        const matMatch = (p.material || '').toLowerCase().includes(qLower);
        return nameMatch || catMatch || subMatch || summaryMatch || descMatch || matMatch;
      });

      // 3. Merge and enforce STRICT DEDUPLICATION BY COMPANY / SELLER:
      // "Don't repeat same product company product at the time of comparing."
      const seenCompanyKeys = new Set();
      const combined = [];

      for (const item of [...remoteMatches, ...localMatches]) {
        if (!item || !item.id) continue;
        const company = item.companyId ? getCompany(item.companyId) : null;
        const supplierObj = item.supplier || (company ? {
          id: company.id,
          company: company.name,
          name: company.name,
          slug: company.slug,
          isVerified: Boolean(company.verification?.status === 'reviewed' || company.isSample),
          location: company.city ? `${company.city}, ${company.country}` : company.country || 'India',
          city: company.city || 'Mumbai',
          country: company.country || 'India',
          flag: company.flag || '🇮🇳',
          rating: company.rating || 4.7,
          reviewCount: company.reviewCount || 24,
          responseTime: company.responseTime || 'Within 12 hours',
          businessType: company.businessType || 'Manufacturer',
          established: company.established || 2012,
        } : null);

        // Strict company key: ID, company name, or supplier ID
        const companyKey = company?.id || supplierObj?.id || supplierObj?.company || supplierObj?.name || item.companyId || item.supplierId;
        
        if (companyKey && !seenCompanyKeys.has(companyKey)) {
          seenCompanyKeys.add(companyKey);
          combined.push({
            ...item,
            supplier: supplierObj,
            price: Number(item.price),
            moq: Number(item.moq || 1),
            stock: Number(item.stock || 100),
            leadTimeDays: Number(item.leadTimeDays || 14),
          });
        }
      }

      setComparedProducts(combined);
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

  // Initial load: If productId or search query provided, search for it;
  // Otherwise default to the flagship 10-seller "Cotton T-Shirt" comparison showcase!
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
          .catch(() => {
            executeSearch('Cotton T-Shirt');
          });
      }
    } else if (initialQuery) {
      executeSearch(initialQuery);
    } else {
      // Default to 10-seller Cotton T-Shirt so the page is immediately rich and never empty
      setSearchInput('Cotton T-Shirt');
      executeSearch('Cotton T-Shirt');
    }
  }, [productId]);

  // Remove a product from current comparison list
  const removeProduct = (idToRemove) => {
    setComparedProducts((prev) => prev.filter((p) => p.id !== idToRemove));
    showToast('Product removed from comparison.', 'info');
  };

  // Handle quantity input for a product card
  const handleQtyChange = (productId, qty, minOrder) => {
    const val = Math.max(minOrder || 1, parseInt(qty, 10) || minOrder || 1);
    setCartQuantities((prev) => ({ ...prev, [productId]: val }));
  };

  // Filter and Sort Compared Products
  const processedProducts = useMemo(() => {
    let list = [...comparedProducts];

    // Filters
    if (filterVerifiedOnly) {
      list = list.filter((p) => p.supplier?.isVerified);
    }
    if (filterSampleOnly) {
      list = list.filter((p) => p.sampleAvailable !== false);
    }
    if (filterReadyToShip) {
      list = list.filter((p) => p.readyToShip);
    }

    // Sorters
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'moq-asc') {
      list.sort((a, b) => a.moq - b.moq);
    } else if (sortBy === 'delivery-asc') {
      list.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    } else if (sortBy === 'rating-desc') {
      list.sort((a, b) => (b.supplier?.rating || b.rating || 0) - (a.supplier?.rating || a.rating || 0));
    }

    return list;
  }, [comparedProducts, sortBy, filterVerifiedOnly, filterSampleOnly, filterReadyToShip]);

  // Count distinct suppliers among results
  const uniqueSuppliersCount = useMemo(() => {
    const set = new Set();
    processedProducts.forEach((p) => {
      const name = p.supplier?.company || p.supplier?.name;
      if (name) set.add(name);
    });
    return set.size;
  }, [processedProducts]);

  // Benchmark Highlights: Lowest Price, Lowest MOQ, Fastest Lead Time, Top Rated
  const benchmarks = useMemo(() => {
    if (!processedProducts.length) return null;
    let lowestPriceProd = processedProducts[0];
    let lowestMoqProd = processedProducts[0];
    let fastestDeliveryProd = processedProducts[0];
    let topRatedProd = processedProducts[0];

    for (const p of processedProducts) {
      if (p.price < lowestPriceProd.price) lowestPriceProd = p;
      if (p.moq < lowestMoqProd.moq) lowestMoqProd = p;
      if (p.leadTimeDays < fastestDeliveryProd.leadTimeDays) fastestDeliveryProd = p;
      const curRating = p.supplier?.rating || p.rating || 0;
      const topRating = topRatedProd.supplier?.rating || topRatedProd.rating || 0;
      if (curRating > topRating) topRatedProd = p;
    }

    return {
      lowestPrice: lowestPriceProd,
      lowestMoq: lowestMoqProd,
      fastestDelivery: fastestDeliveryProd,
      topRated: topRatedProd,
    };
  }, [processedProducts]);

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
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/20">
            <Scale className="size-5" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            Wholesale Product & Seller Comparison
          </h1>
        </div>
        <p className="text-sm text-navy-600 mt-1 max-w-3xl">
          Compare wholesale pricing, minimum order quantities (MOQ), production lead times, and verified supplier credentials across competing sellers — formatted card-by-card for easy inspection.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH BAR SECTION (Search Any Product to Compare Across Sellers)         */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-navy-950 via-[#0a2315] to-navy-950 rounded-3xl p-5 sm:p-7 shadow-xl border border-navy-800 text-white">
        <div className="max-w-4xl">
          <h2 className="text-base sm:text-lg font-bold text-white mb-1.5 flex items-center gap-2">
            <Search className="size-5 text-brand-400" />
            <span>Search & Compare Competing Products Across Sellers</span>
          </h2>
          <p className="text-xs sm:text-sm text-navy-200 mb-4">
            Type any product keyword (e.g. Cotton T-Shirt, Earbuds, Shoes, Packaging) to instantly compare competing listings from distinct verified suppliers.
          </p>

          <form onSubmit={handleProductSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-navy-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search product (e.g., Cotton T-Shirt, Wireless Earbuds, Shoes)..."
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-white text-navy-950 placeholder:text-navy-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-400 border border-white/20 shadow-inner"
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
              {searching ? 'Comparing...' : 'Compare Sellers'}
            </Button>
          </form>

          {/* Quick suggestions pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-navy-300 font-medium">Quick comparison presets:</span>
            {POPULAR_SEARCH_SUGGESTIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setSearchInput(item.query);
                  executeSearch(item.query);
                }}
                className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-all border ${
                  searchQuerySubmitted.toLowerCase() === item.query.toLowerCase()
                    ? 'bg-brand-500 text-white border-brand-400 shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-navy-100 border-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPARISON RESULTS SECTION                                               */}
      {/* ========================================================================= */}

      {/* Case 1: Searched, but 0 products match */}
      {hasSearched && !searching && processedProducts.length === 0 && (
        <div className="rounded-3xl border border-navy-900/[0.08] bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto size-14 rounded-2xl bg-navy-50 text-navy-400 flex items-center justify-center mb-4">
            <Search className="size-7" />
          </div>
          <h3 className="text-lg font-bold text-navy-950 mb-1.5">
            No Matching Products Found
          </h3>
          <p className="text-sm text-navy-600 max-w-md mx-auto mb-6">
            No products matched <span className="font-semibold text-navy-900">"{searchQuerySubmitted}"</span>. Try searching with different keywords like "Cotton", "Earbuds", or "Shoes".
          </p>
          <Button
            variant="brand"
            onClick={() => {
              setSearchInput('Cotton T-Shirt');
              executeSearch('Cotton T-Shirt');
            }}
          >
            Show Cotton T-Shirt (10 Sellers)
          </Button>
        </div>
      )}

      {/* Case 2: Matching products found across suppliers */}
      {processedProducts.length > 0 && (
        <section aria-labelledby="comparison-results-heading" className="space-y-6">
          
          {/* Top Benchmark Summary Matrix Bar */}
          {benchmarks && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Lowest Price */}
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
                  <Tag className="size-3.5 text-emerald-600" />
                  <span>Lowest Wholesale Price</span>
                </div>
                <div className="text-2xl font-black text-emerald-950">
                  {money(benchmarks.lowestPrice.price)}
                  <span className="text-xs font-normal text-muted ml-1">/{benchmarks.lowestPrice.unit || 'piece'}</span>
                </div>
                <p className="text-xs text-navy-700 truncate mt-1">
                  By <span className="font-bold">{benchmarks.lowestPrice.supplier?.company || benchmarks.lowestPrice.supplier?.name}</span> ({benchmarks.lowestPrice.supplier?.flag || '🇮🇳'})
                </p>
              </div>

              {/* Lowest MOQ */}
              <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-blue-800 text-xs font-bold uppercase tracking-wider mb-1">
                  <Package className="size-3.5 text-blue-600" />
                  <span>Lowest Minimum Order</span>
                </div>
                <div className="text-2xl font-black text-blue-950">
                  {benchmarks.lowestMoq.moq.toLocaleString()}
                  <span className="text-xs font-normal text-muted ml-1">{benchmarks.lowestMoq.unit || 'units'} MOQ</span>
                </div>
                <p className="text-xs text-navy-700 truncate mt-1">
                  By <span className="font-bold">{benchmarks.lowestMoq.supplier?.company || benchmarks.lowestMoq.supplier?.name}</span> ({benchmarks.lowestMoq.supplier?.flag || '🇮🇳'})
                </p>
              </div>

              {/* Fastest Delivery */}
              <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider mb-1">
                  <Truck className="size-3.5 text-amber-600" />
                  <span>Fastest Dispatch</span>
                </div>
                <div className="text-2xl font-black text-amber-950">
                  {benchmarks.fastestDelivery.leadTimeDays} Days
                  <span className="text-xs font-normal text-muted ml-1">lead time</span>
                </div>
                <p className="text-xs text-navy-700 truncate mt-1">
                  By <span className="font-bold">{benchmarks.fastestDelivery.supplier?.company || benchmarks.fastestDelivery.supplier?.name}</span> ({benchmarks.fastestDelivery.supplier?.flag || '🇮🇳'})
                </p>
              </div>

              {/* Highest Rated */}
              <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-50/80 to-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-purple-800 text-xs font-bold uppercase tracking-wider mb-1">
                  <Award className="size-3.5 text-purple-600" />
                  <span>Top-Rated Supplier</span>
                </div>
                <div className="text-2xl font-black text-purple-950 flex items-center gap-1.5">
                  <span>{(benchmarks.topRated.supplier?.rating || benchmarks.topRated.rating || 4.8).toFixed(1)}</span>
                  <span className="text-amber-500 text-base">★</span>
                  <span className="text-xs font-normal text-muted">/ 5.0</span>
                </div>
                <p className="text-xs text-navy-700 truncate mt-1">
                  By <span className="font-bold">{benchmarks.topRated.supplier?.company || benchmarks.topRated.supplier?.name}</span> ({benchmarks.topRated.supplier?.flag || '🇮🇳'})
                </p>
              </div>
            </div>
          )}

          {/* Controls Bar: Sort, Filter, and Counter */}
          <div className="rounded-2xl border border-navy-900/[0.08] bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 id="comparison-results-heading" className="text-base sm:text-lg font-extrabold text-navy-950 flex flex-wrap items-center gap-2">
                <span>Comparing</span>
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-black text-sm border border-brand-200">
                  {processedProducts.length} Distinct Sellers
                </span>
                <span className="text-navy-600 font-normal text-sm">for</span>
                <span className="text-brand-600 font-bold">"{searchQuerySubmitted}"</span>
              </h2>
              <p className="text-xs text-navy-500 mt-0.5">
                Every card represents a unique registered supplier. No duplicate companies are shown.
              </p>
            </div>

            {/* Filter and Sort Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-navy-600">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-800 shadow-2xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="relevance">Best Match</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="moq-asc">MOQ: Low to High</option>
                  <option value="delivery-asc">Delivery: Fastest First</option>
                  <option value="rating-desc">Supplier Rating</option>
                </select>
              </div>

              {/* Verified Filter Pill */}
              <button
                type="button"
                onClick={() => setFilterVerifiedOnly(!filterVerifiedOnly)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filterVerifiedOnly
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 ring-1 ring-emerald-500/30'
                    : 'bg-white border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
              >
                <ShieldCheck className={`size-3.5 ${filterVerifiedOnly ? 'text-emerald-600' : 'text-navy-400'}`} />
                <span>Verified Only</span>
              </button>

              {/* Sample Filter Pill */}
              <button
                type="button"
                onClick={() => setFilterSampleOnly(!filterSampleOnly)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filterSampleOnly
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-900 ring-1 ring-brand-500/30'
                    : 'bg-white border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
              >
                <PackageCheck className={`size-3.5 ${filterSampleOnly ? 'text-brand-600' : 'text-navy-400'}`} />
                <span>Sample Available</span>
              </button>

              {/* Ready to Ship Pill */}
              <button
                type="button"
                onClick={() => setFilterReadyToShip(!filterReadyToShip)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filterReadyToShip
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-900 ring-1 ring-blue-500/30'
                    : 'bg-white border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
              >
                <Truck className={`size-3.5 ${filterReadyToShip ? 'text-blue-600' : 'text-navy-400'}`} />
                <span>Ready to Ship</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DIV-BY-DIV COMPARISON CARDS (Stacked Div Format — Not Table Columns)       */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            {processedProducts.map((product, index) => {
              const sup = product.supplier;
              const alreadyInCart = inCart(product.id);
              const isLowestPrice = benchmarks && benchmarks.lowestPrice.id === product.id;
              const isLowestMoq = benchmarks && benchmarks.lowestMoq.id === product.id;
              const isFastestDelivery = benchmarks && benchmarks.fastestDelivery.id === product.id;
              const isTopRated = benchmarks && benchmarks.topRated.id === product.id;
              const orderQty = cartQuantities[product.id] || product.moq || 1;

              return (
                <div
                  key={product.id}
                  className={`group relative rounded-2xl border bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 ${
                    isLowestPrice
                      ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : 'border-navy-900/[0.08] hover:border-brand-500/30'
                  }`}
                >
                  {/* Top Bar: Seller Rank Badge & Remove Button */}
                  <div className="flex items-center justify-between gap-3 border-b border-navy-900/[0.06] pb-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-navy-900 text-white text-xs font-black">
                        #{index + 1}
                      </span>
                      {isLowestPrice && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Tag className="size-3" />
                          Lowest Unit Price
                        </span>
                      )}
                      {isLowestMoq && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          <Package className="size-3" />
                          Lowest MOQ
                        </span>
                      )}
                      {isFastestDelivery && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Truck className="size-3" />
                          Fastest Delivery
                        </span>
                      )}
                      {isTopRated && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                          <Award className="size-3" />
                          Top Rated Seller
                        </span>
                      )}
                    </div>

                    {processedProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(product.id)}
                        className="text-xs font-medium text-navy-400 hover:text-danger flex items-center gap-1 px-2 py-1 rounded-md hover:bg-navy-50 transition-colors"
                        title="Remove this seller from comparison"
                      >
                        <X className="size-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Main Div Layout: 3 Columns on Large Screens */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left: Product Thumbnail & Status */}
                    <div className="lg:col-span-3 flex flex-row lg:flex-col gap-4">
                      <Link
                        to={`/products/${product.slug || product.id}`}
                        className="relative block aspect-square w-28 sm:w-36 lg:w-full shrink-0 rounded-xl overflow-hidden bg-navy-50 border border-navy-100 group/img"
                      >
                        <Image
                          photo={product.photo || product.rawPhoto}
                          illustration={product.illustration}
                          category={product.categorySlug || product.category}
                          width={480}
                          height={480}
                          alt={product.name}
                          className="h-full w-full object-cover object-center group-hover/img:scale-105 transition-transform duration-300"
                        />
                        {product.readyToShip && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-xs">
                            Ready to Ship
                          </span>
                        )}
                      </Link>

                      <div className="flex-1 lg:flex-initial space-y-1.5">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                          {product.subcategory || product.categorySlug || 'Wholesale'}
                        </span>
                        <Link
                          to={`/products/${product.slug || product.id}`}
                          className="font-bold text-sm sm:text-base text-navy-950 hover:text-brand-600 transition-colors line-clamp-2 leading-snug"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-muted line-clamp-2">
                          {product.summary}
                        </p>
                      </div>
                    </div>

                    {/* Center: Seller Profile & Specifications Strip */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Supplier Card Div */}
                      <div className="rounded-xl border border-navy-900/[0.07] bg-navy-50/40 p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Link
                            to={sup?.slug ? `/suppliers/${sup.slug}` : `/suppliers/${sup?.id || ''}`}
                            className="font-bold text-sm text-navy-950 hover:text-brand-600 transition-colors flex items-center gap-1.5 truncate"
                          >
                            <span className="text-base">{sup?.flag || '🇮🇳'}</span>
                            <span className="truncate">{sup?.company || sup?.name || 'Verified Supplier'}</span>
                          </Link>

                          {sup?.isVerified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck className="size-3" />
                              Verified
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-600">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-navy-900">{sup?.location || 'India'}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-amber-500 font-bold">★ {(sup?.rating || product.rating || 4.7).toFixed(1)}</span>
                            <span className="text-muted">({sup?.reviewCount || product.reviewCount || 30} reviews)</span>
                          </span>
                          <span className="text-muted">
                            Response: <span className="font-medium text-navy-800">{sup?.responseTime || 'Within 12 hours'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Key Attributes Div (MOQ, Dispatch, Material, Sample) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
                          <span className="text-muted block text-[11px]">Minimum Order</span>
                          <span className={`font-bold text-sm ${isLowestMoq ? 'text-blue-700' : 'text-navy-950'}`}>
                            {product.moq.toLocaleString()} {product.unit || 'pieces'}
                          </span>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
                          <span className="text-muted block text-[11px]">Production Lead Time</span>
                          <span className={`font-bold text-sm ${isFastestDelivery ? 'text-amber-700' : 'text-navy-950'}`}>
                            {product.leadTimeDays} Business Days
                          </span>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
                          <span className="text-muted block text-[11px]">Stock in Warehouse</span>
                          <span className="font-bold text-sm text-navy-950">
                            {product.stock.toLocaleString()} {product.unit || 'units'}
                          </span>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
                          <span className="text-muted block text-[11px]">Sample Policy</span>
                          <span className="font-bold text-navy-900">
                            {product.sampleAvailable !== false ? `Available (${money(product.samplePrice || product.price)})` : 'Custom Sample Only'}
                          </span>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60 col-span-2">
                          <span className="text-muted block text-[11px]">Buyer Escrow Guarantee</span>
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <BadgeCheck className="size-3.5" />
                            100% Payment Escrow Protection
                          </span>
                        </div>
                      </div>

                      {/* Product Specifications Preview */}
                      {product.specifications && Object.keys(product.specifications).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {Object.entries(product.specifications).slice(0, 4).map(([key, val]) => (
                            <span key={key} className="inline-flex items-center rounded-md bg-navy-50 px-2 py-0.5 text-navy-700 font-medium border border-navy-100">
                              <span className="text-muted mr-1">{key}:</span> {Array.isArray(val) ? val.join(', ') : String(val)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Pricing Tiers & Action Buttons Div */}
                    <div className="lg:col-span-4 rounded-xl border border-navy-900/[0.08] bg-navy-50/30 p-4 space-y-4">
                      {/* Price Display */}
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Wholesale Unit Price</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-2xl sm:text-3xl font-black ${isLowestPrice ? 'text-emerald-700' : 'text-navy-950'}`}>
                            {money(product.price)}
                          </span>
                          <span className="text-xs text-muted font-medium">/ {product.unit || 'piece'}</span>
                        </div>

                        {/* Volume Price Tiers */}
                        {product.priceTiers && product.priceTiers.length > 0 && (
                          <div className="mt-2.5 rounded-lg bg-white p-2.5 border border-navy-100 space-y-1 text-xs">
                            <span className="text-[11px] font-bold text-navy-900 block border-b pb-1">
                              Volume Discount Tiers:
                            </span>
                            {product.priceTiers.map((tier, idx) => (
                              <div key={idx} className="flex justify-between text-navy-700">
                                <span>{tier.minQty.toLocaleString()}+ {product.unit}s:</span>
                                <span className="font-bold text-navy-900">{money(tier.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Order Quantity & Actions */}
                      <div className="space-y-2 pt-2 border-t border-navy-900/[0.06]">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-navy-700 shrink-0">Quantity:</label>
                          <input
                            type="number"
                            min={product.moq || 1}
                            step={1}
                            value={orderQty}
                            onChange={(e) => handleQtyChange(product.id, e.target.value, product.moq)}
                            className="w-24 rounded-lg border border-navy-200 px-2 py-1 text-xs font-bold text-navy-950 text-center"
                          />
                          <span className="text-xs text-muted">Total: {money(product.price * orderQty)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="brand"
                            icon={alreadyInCart ? CheckCircle2 : ShoppingCart}
                            onClick={() => {
                              if (alreadyInCart) {
                                removeFromCart(product.id);
                                showToast(`Removed ${product.name} from cart.`, 'info');
                              } else {
                                addToCart(product, orderQty, null);
                                showToast(`Added ${orderQty} units of ${product.name} to cart.`, 'success');
                              }
                            }}
                            className={`text-xs font-bold justify-center ${
                              alreadyInCart ? '!bg-emerald-600 hover:!bg-emerald-700 !text-white' : ''
                            }`}
                          >
                            {alreadyInCart ? 'In Cart' : 'Add to Cart'}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            icon={FileText}
                            to={`/rfq?product=${product.id}&supplier=${sup?.id || ''}`}
                            className="text-xs font-semibold justify-center"
                          >
                            Request Quote
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={MessageSquare}
                            onClick={() => sup && contact(sup, product)}
                            className="flex-1 text-xs font-medium justify-center"
                          >
                            Contact Seller
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            icon={ExternalLink}
                            to={`/products/${product.slug || product.id}`}
                            className="text-xs font-medium justify-center px-3"
                            title="View Full Product Page"
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        </section>
      )}

      {/* Bottom Info Banner */}
      <div className="rounded-2xl border border-navy-900/[0.08] bg-gradient-to-r from-navy-50 to-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-navy-950">TradeExpress B2B Fair Comparison Guarantee</h4>
            <p className="text-xs text-navy-600">
              All supplier rates, minimum quantities, and specifications are displayed transparently directly from registered merchants.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          to="/rfq"
          icon={FileText}
          className="shrink-0 text-xs font-bold"
        >
          Post a Customized RFQ
        </Button>
      </div>

    </div>
  );
}
