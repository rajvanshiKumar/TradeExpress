import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Button, { IconButton } from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Image from '../../components/common/Image';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import useCart from '../../hooks/useCart';
import useNotifications from '../../hooks/useNotifications';
import useContactSupplier from '../../hooks/useContactSupplier';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { apiGet } from '../../services/apiClient';
import { photoUrl } from '../../utils/images';

const MAX_COMPARE = 4;

const POPULAR_SEARCH_SUGGESTIONS = [
  'Trail Running Shoes',
  'Woven Cotton Shirt',
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
  const { addToCart, inCart } = useCart();
  const { showToast } = useNotifications();
  const contact = useContactSupplier();

  useDocumentTitle('Compare Products | TradeExpress B2B');

  // Search Bar State
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMatchCandidates, setSearchMatchCandidates] = useState([]);
  const [searchFeedback, setSearchFeedback] = useState(null);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Data from backend
  const [referenceProduct, setReferenceProduct] = useState(null);
  const [similarPool, setSimilarPool] = useState([]);
  const [comparedProducts, setComparedProducts] = useState([]);
  const [availableFilters, setAvailableFilters] = useState({ categories: [], materials: [] });

  // Filter & Sort State for Related Products
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedMaterial, setSelectedMaterial] = useState(searchParams.get('material') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verified') === 'true');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('inStock') === 'true');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');

  // UI State
  const [highlightDifferences, setHighlightDifferences] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchResults, setCatalogSearchResults] = useState([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);

  // Fetch comparison data for a given product or default list
  const fetchComparisonData = async (targetId = productId) => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const queryParts = [];
      if (targetId) queryParts.push(`productId=${encodeURIComponent(targetId)}`);
      if (selectedCategory) queryParts.push(`category=${encodeURIComponent(selectedCategory)}`);
      if (selectedMaterial) queryParts.push(`material=${encodeURIComponent(selectedMaterial)}`);
      if (verifiedOnly) queryParts.push(`verifiedOnly=true`);
      if (inStockOnly) queryParts.push(`inStockOnly=true`);
      if (sortBy) queryParts.push(`sort=${encodeURIComponent(sortBy)}`);
      queryParts.push(`limit=16`);

      const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
      const response = await apiGet(`products/compare${queryString}`);

      if (response && response.success) {
        const data = response.data;
        const ref = data.referenceProduct || null;
        const pool = data.similarProducts || [];

        // If no product ID was provided, but backend returned similar products, treat first as reference
        let activeRef = ref;
        let activePool = pool;
        if (!activeRef && pool.length > 0) {
          activeRef = pool[0];
          activePool = pool.slice(1);
        }

        setReferenceProduct(activeRef);
        setSimilarPool(activePool);
        setAvailableFilters(data.availableFilters || { categories: [], materials: [] });

        if (activeRef) {
          setSearchInput(activeRef.name);
        }

        // Build active comparison list: Reference product in slot 0, then up to (MAX_COMPARE - 1) similar products
        const initialCompared = [];
        if (activeRef) {
          initialCompared.push(activeRef);
          activePool.slice(0, MAX_COMPARE - 1).forEach((item) => {
            if (item.id !== activeRef.id) initialCompared.push(item);
          });
        } else {
          initialCompared.push(...activePool.slice(0, MAX_COMPARE));
        }

        setComparedProducts(initialCompared);
      } else {
        setError(response?.message || 'Failed to load product comparison.');
      }
    } catch (err) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.message || 'Unable to connect to the comparison service.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisonData(productId);
  }, [productId, selectedCategory, selectedMaterial, verifiedOnly, inStockOnly, sortBy]);

  // Handle Search Bar Submit
  const handleProductSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = searchInput.trim();
    if (!query) {
      showToast('Please enter a product name, SKU, or keyword to search.', 'info');
      return;
    }

    setSearching(true);
    setSearchFeedback(null);
    setSearchMatchCandidates([]);

    try {
      const searchRes = await apiGet(`products?search=${encodeURIComponent(query)}&limit=10`);
      if (searchRes && searchRes.success && searchRes.data?.length > 0) {
        const matches = searchRes.data;
        setSearchMatchCandidates(matches);

        // Pick top match
        const topMatch = matches[0];
        setSearchFeedback(`Found ${matches.length} matching product${matches.length > 1 ? 's' : ''}. Displaying "${topMatch.name}".`);

        // Navigate to /compare-products/:productId so URL reflects the chosen product
        navigate(`/compare-products/${topMatch.id}`, { replace: true });
      } else {
        setSearchFeedback(`No products found matching "${query}". Try another search term.`);
        showToast(`No products found matching "${query}".`, 'warning');
      }
    } catch (err) {
      setSearchFeedback('Search failed: ' + (err.message || 'Please try again.'));
      showToast('Search failed: ' + err.message, 'error');
    } finally {
      setSearching(false);
    }
  };

  // Direct select from multiple search candidates
  const selectCandidateProduct = (cand) => {
    setSearchInput(cand.name);
    setSearchFeedback(`Displaying details for "${cand.name}".`);
    navigate(`/compare-products/${cand.id}`, { replace: true });
  };

  // Remove a product from comparison table
  const removeProduct = (idToRemove) => {
    if (comparedProducts.length <= 1) {
      showToast('At least one product must remain in the comparison.', 'warning');
      return;
    }
    setComparedProducts((prev) => prev.filter((p) => p.id !== idToRemove));
    showToast('Product removed from comparison.', 'info');
  };

  // Add a product from similar pool to comparison
  const addProductToComparison = (productToAdd) => {
    if (comparedProducts.some((p) => p.id === productToAdd.id)) {
      showToast('This product is already in the comparison table.', 'info');
      return;
    }
    if (comparedProducts.length >= MAX_COMPARE) {
      showToast(`Comparison is limited to ${MAX_COMPARE} products side by side. Remove one to add this.`, 'warning');
      return;
    }
    setComparedProducts((prev) => [...prev, productToAdd]);
    showToast(`Added "${productToAdd.name}" to comparison.`, 'success');
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedMaterial('');
    setVerifiedOnly(false);
    setInStockOnly(false);
    setSortBy('relevance');
    setSearchParams({});
  };

  // Calculate if an attribute value differs across compared products
  const hasDifference = (getValue) => {
    if (comparedProducts.length < 2) return false;
    const firstVal = getValue(comparedProducts[0]);
    return comparedProducts.some((p) => getValue(p) !== firstVal);
  };

  // Check differences for key attributes
  const diffMap = useMemo(() => {
    return {
      price: hasDifference((p) => p.price),
      moq: hasDifference((p) => p.moq),
      material: hasDifference((p) => p.material || ''),
      sizes: hasDifference((p) => p.sizes || ''),
      stock: hasDifference((p) => (p.inStock ? 'in' : 'out')),
      delivery: hasDifference((p) => p.estimatedDelivery || ''),
      supplierVerified: hasDifference((p) => Boolean(p.supplier?.isVerified)),
      supplierLocation: hasDifference((p) => p.supplier?.city || ''),
    };
  }, [comparedProducts]);

  // Loading skeleton state
  if (loading && !referenceProduct && !comparedProducts.length) {
    return (
      <div className="ts-container py-8 sm:py-10">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: 'Products', to: '/products' },
            { label: 'Compare Products' },
          ]}
        />
        <div className="space-y-6 animate-pulse">
          <div className="h-14 w-full bg-navy-100 rounded-2xl" />
          <div className="h-72 w-full bg-navy-100 rounded-2xl" />
          <div className="h-10 w-48 bg-navy-100 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 rounded-2xl border border-navy-100 bg-white p-4 space-y-4">
                <div className="h-40 rounded-xl bg-navy-100" />
                <div className="h-5 w-3/4 bg-navy-100 rounded" />
                <div className="h-4 w-1/2 bg-navy-50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not Found State (invalid product ID)
  if (notFound) {
    return (
      <div className="ts-container py-12 sm:py-16">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: 'Products', to: '/products' },
            { label: 'Compare Products' },
          ]}
        />
        <div className="max-w-xl mx-auto text-center rounded-2xl border border-navy-900/[0.08] bg-white p-8 shadow-sm">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <AlertCircle className="size-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 mb-2">Product Not Found or Inactive</h1>
          <p className="text-sm text-navy-600 mb-6">
            The requested product <code className="px-1.5 py-0.5 rounded bg-navy-100 text-navy-900 font-mono text-xs">{productId}</code> could not be found or is currently not active in TradeExpress.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="brand" to="/products">Browse All Products</Button>
            <Button variant="outline" to="/compare-products">Compare Products</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ts-container py-6 sm:py-10">
      {/* Breadcrumbs */}
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Products', to: '/products' },
          ...(referenceProduct
            ? [
                { label: referenceProduct.name, to: `/products/${referenceProduct.slug || referenceProduct.id}` },
                { label: 'Compare & Sourcing' },
              ]
            : [{ label: 'Compare Products' }]),
        ]}
      />

      {/* Page Title & Intro */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-700">
            <Scale className="size-4.5" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
            TradeExpress Product Comparison
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          Product Search & Sourcing Comparison
        </h1>
        <p className="text-sm text-navy-600 mt-1 max-w-3xl">
          Search any product across registered TradeExpress suppliers to inspect all technical specifications, verified credentials, and compare competing similar products side-by-side.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. SEARCH BAR SECTION (Buyer & Supplier Search Bar)                        */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 rounded-2xl p-5 sm:p-7 shadow-lg border border-navy-800 text-white mb-8">
        <div className="max-w-3xl">
          <h2 className="text-base sm:text-lg font-bold text-white mb-1.5 flex items-center gap-2">
            <Search className="size-5 text-brand-400" />
            <span>Search Any Product to Compare</span>
          </h2>
          <p className="text-xs sm:text-sm text-navy-200 mb-4">
            Type any product name, model number, material, or category to fetch its complete details and find related products.
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

          {/* Search Feedback Note */}
          {searchFeedback && (
            <div className="mt-3 text-xs text-brand-300 font-medium flex items-center gap-1.5 bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-500/20">
              <CheckCircle2 className="size-3.5 shrink-0 text-brand-400" />
              <span>{searchFeedback}</span>
            </div>
          )}

          {/* Multiple matches candidates bar */}
          {searchMatchCandidates.length > 1 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <span className="text-xs text-navy-300 font-semibold block mb-2">
                Matching products found ({searchMatchCandidates.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {searchMatchCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => selectCandidateProduct(cand)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      referenceProduct?.id === cand.id
                        ? 'bg-brand-500 text-navy-950 font-bold shadow-xs'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <span className="truncate max-w-[200px]">{cand.name}</span>
                    <span className="text-[10px] opacity-75">({money(cand.price)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick suggestions pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-navy-300 font-medium">Quick suggestions:</span>
            {POPULAR_SEARCH_SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setSearchInput(item);
                  setSearching(true);
                  apiGet(`products?search=${encodeURIComponent(item)}&limit=5`)
                    .then((res) => {
                      if (res && res.success && res.data?.length > 0) {
                        setSearchMatchCandidates(res.data);
                        navigate(`/compare-products/${res.data[0].id}`, { replace: true });
                      } else {
                        showToast(`No product found for "${item}".`, 'warning');
                      }
                    })
                    .finally(() => setSearching(false));
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
      {/* 2. CORRESPONDING SEARCHED PRODUCT SECTION (ALL DETAILS DISPLAYED)          */}
      {/* ========================================================================= */}
      {referenceProduct && (
        <section aria-labelledby="corresponding-product-heading" className="mb-6">
          <div className="bg-white rounded-3xl border border-navy-900/[0.1] shadow-md overflow-hidden">
            {/* Header Ribbon */}
            <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand-500 text-navy-950 font-black text-xs">
                  ★
                </span>
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand-300">
                  Corresponding Searched Product
                </span>
                <span className="text-xs text-navy-300 hidden sm:inline">• All Specifications & Details</span>
              </div>
              <div className="flex items-center gap-2">
                {referenceProduct.categoryName && (
                  <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-navy-200">
                    Category: {referenceProduct.categoryName}
                  </span>
                )}
                {referenceProduct.readyToShip && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Ready to Ship
                  </span>
                )}
              </div>
            </div>

            {/* Product Full Details Grid */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Col 1: Product Main Image & Gallery (4 cols) */}
              <div className="lg:col-span-4 flex flex-col">
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-navy-50 border border-navy-100 shadow-inner group">
                  <Image
                    photo={referenceProduct.photo || referenceProduct.rawPhoto}
                    illustration={referenceProduct.illustration}
                    category={referenceProduct.categorySlug}
                    width={900}
                    height={900}
                    alt={referenceProduct.name}
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />

                  {referenceProduct.stock > 0 && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold bg-navy-950/85 text-white backdrop-blur-xs flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                      <span>{referenceProduct.stock} units in stock</span>
                    </span>
                  )}
                </div>

                {/* Additional thumbnail images if available */}
                {referenceProduct.images?.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {referenceProduct.images.slice(0, 4).map((imgUrl, i) => (
                      <div key={i} className="size-16 rounded-xl overflow-hidden border border-navy-200 bg-navy-50 shrink-0">
                        <Image
                          photo={imgUrl}
                          category={referenceProduct.categorySlug}
                          width={160}
                          height={160}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Col 2: Core Specifications & Details (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-navy-500">
                      SKU: <span className="font-mono text-navy-800">{referenceProduct.sku || 'N/A'}</span>
                    </span>
                    {referenceProduct.subcategory && (
                      <span className="text-xs bg-navy-100 text-navy-700 px-2 py-0.5 rounded-full font-medium">
                        {referenceProduct.subcategory}
                      </span>
                    )}
                  </div>

                  <h2 id="corresponding-product-heading" className="text-xl sm:text-2xl font-extrabold text-navy-950 leading-tight mb-3">
                    {referenceProduct.name}
                  </h2>

                  {/* Pricing & MOQ Highlight Card */}
                  <div className="bg-navy-50/70 rounded-2xl p-4 border border-navy-900/[0.06] mb-4">
                    <div className="flex items-baseline justify-between mb-1">
                      <div>
                        <span className="text-xs text-navy-500 font-semibold block">Wholesale Price</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl sm:text-3xl font-black text-navy-950">
                            {money(referenceProduct.price)}
                          </span>
                          <span className="text-xs text-navy-600 font-semibold">
                            / {referenceProduct.unit || 'piece'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-navy-500 font-semibold block">Minimum Order (MOQ)</span>
                        <span className="text-base sm:text-lg font-bold text-navy-900">
                          {referenceProduct.moq || 1} {referenceProduct.unit || 'units'}
                        </span>
                      </div>
                    </div>

                    {/* Tiered pricing if present */}
                    {referenceProduct.priceTiers && referenceProduct.priceTiers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-navy-200/60 text-xs">
                        <p className="font-bold text-navy-800 mb-1">Volume Pricing Tiers:</p>
                        <div className="grid grid-cols-2 gap-2 text-navy-700">
                          {referenceProduct.priceTiers.map((t, idx) => (
                            <div key={idx} className="flex justify-between bg-white px-2 py-1 rounded-md border border-navy-200/50">
                              <span>{t.minQty || t.minQuantity}{t.maxQty ? `–${t.maxQty}` : '+'} units:</span>
                              <span className="font-bold text-navy-950">{money(t.unitPrice || t.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Key Product Attributes Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                    <div className="bg-white p-3 rounded-xl border border-navy-100">
                      <span className="text-navy-500 block text-[11px] font-semibold">Material / Composition</span>
                      <span className="text-navy-900 font-bold text-xs mt-0.5 block">
                        {referenceProduct.material || '—'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-navy-100">
                      <span className="text-navy-500 block text-[11px] font-semibold">Available Sizes / Dimensions</span>
                      <span className="text-navy-900 font-bold text-xs mt-0.5 block truncate" title={referenceProduct.sizes || ''}>
                        {referenceProduct.sizes || '—'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-navy-100">
                      <span className="text-navy-500 block text-[11px] font-semibold">Estimated Lead Time</span>
                      <span className="text-navy-900 font-bold text-xs mt-0.5 flex items-center gap-1">
                        <Truck className="size-3.5 text-navy-400 shrink-0" />
                        <span>{referenceProduct.estimatedDelivery || `${referenceProduct.leadTimeDays || 7} business days`}</span>
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-navy-100">
                      <span className="text-navy-500 block text-[11px] font-semibold">Sample Policy</span>
                      <span className="text-navy-900 font-bold text-xs mt-0.5 block">
                        {referenceProduct.sampleAvailable
                          ? `Available (${money(referenceProduct.samplePrice || referenceProduct.price)})`
                          : 'Not offered'}
                      </span>
                    </div>
                  </div>

                  {/* Technical Specifications preview */}
                  {referenceProduct.specifications && Object.keys(referenceProduct.specifications).length > 0 && (
                    <div className="text-xs bg-navy-50/40 p-3 rounded-xl border border-navy-100">
                      <p className="font-bold text-navy-900 mb-1.5 flex items-center gap-1.5">
                        <Layers className="size-3.5 text-brand-600" />
                        <span>Technical Specifications:</span>
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {Object.entries(referenceProduct.specifications).map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-navy-100/50 pb-0.5 last:border-b-0">
                            <span className="text-navy-600">{k}:</span>
                            <span className="font-semibold text-navy-950 text-right">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Col 3: Supplier Credential Card & Actions (3 cols) */}
              <div className="lg:col-span-3 flex flex-col justify-between bg-navy-50/50 p-5 rounded-2xl border border-navy-900/[0.06]">
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Building2 className="size-4 text-brand-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-navy-700">
                      Registered Supplier
                    </span>
                  </div>

                  {referenceProduct.supplier ? (
                    <div className="space-y-3 mb-6">
                      <div>
                        <Link
                          to={referenceProduct.supplier.id ? `/suppliers/${referenceProduct.supplier.id}` : `/suppliers`}
                          className="font-bold text-base text-navy-950 hover:text-brand-600 block transition-colors leading-snug"
                        >
                          {referenceProduct.supplier.company || referenceProduct.supplier.name}
                        </Link>
                        <span className="text-[11px] text-navy-500">
                          TradeExpress Verified Seller Profile
                        </span>
                      </div>

                      {/* Verification Badge */}
                      <div>
                        {referenceProduct.supplier.isVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                            <BadgeCheck className="size-4 text-emerald-600" />
                            <span>Verified Supplier</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-navy-100 text-navy-700">
                            <Clock className="size-3.5 text-navy-400" />
                            <span>Verification Pending</span>
                          </span>
                        )}
                      </div>

                      {/* Origin & Location */}
                      {referenceProduct.supplier.location && (
                        <div className="flex items-center gap-1.5 text-xs text-navy-700">
                          <MapPin className="size-3.5 text-navy-400 shrink-0" />
                          <span>{referenceProduct.supplier.location}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-navy-500 mb-6 italic">Supplier details not available</p>
                  )}
                </div>

                {/* Direct B2B Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-navy-200/60">
                  <Button
                    size="md"
                    variant="brand"
                    icon={ExternalLink}
                    to={`/products/${referenceProduct.slug || referenceProduct.id}`}
                    className="w-full text-xs font-bold justify-center shadow-xs"
                  >
                    View Full Product Page
                  </Button>

                  <Button
                    size="md"
                    variant="outline"
                    icon={FileText}
                    to={`/rfq?product=${referenceProduct.id}`}
                    className="w-full text-xs font-semibold justify-center bg-white hover:bg-navy-50"
                  >
                    Request a Quote (RFQ)
                  </Button>

                  <Button
                    size="md"
                    variant="outline"
                    icon={MessageSquare}
                    onClick={() => referenceProduct.supplier && contact(referenceProduct.supplier, referenceProduct)}
                    disabled={!referenceProduct.supplier}
                    className="w-full text-xs font-semibold justify-center bg-white hover:bg-navy-50"
                  >
                    Contact Supplier
                  </Button>

                  <Button
                    size="md"
                    variant="outline"
                    icon={ShoppingCart}
                    disabled={!referenceProduct.inStock}
                    onClick={() => addToCart(referenceProduct, referenceProduct.moq || 1, null)}
                    className={`w-full text-xs font-semibold justify-center transition-all ${
                      inCart(referenceProduct.id)
                        ? '!bg-emerald-100/95 !text-emerald-900 !border-2 !border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 hover:!bg-emerald-200/90'
                        : '!bg-emerald-50 !text-emerald-800 !border !border-emerald-300/90 shadow-xs hover:!bg-emerald-100 hover:!border-emerald-400'
                    }`}
                  >
                    {inCart(referenceProduct.id) ? 'Added to Cart (Add More)' : 'Add to Cart'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. STYLED HR SEPARATOR (Separates Searched Product from Related Products)  */}
      {/* ========================================================================= */}
      <div className="relative my-10 sm:my-14" role="separator" aria-label="Related products separator">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t-2 border-dashed border-navy-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xl ring-4 ring-white border border-brand-500/40">
            <Scale className="size-4 text-brand-400" />
            <span className="tracking-wide">Related Similar Products from TradeExpress Suppliers</span>
            <span className="rounded-full bg-brand-500/20 text-brand-300 px-2.5 py-0.5 text-[11px] font-extrabold border border-brand-400/30">
              {similarPool.length} {similarPool.length === 1 ? 'Product' : 'Products'} Found
            </span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. RELATED PRODUCTS SECTION (Comparison Matrix + Filters + Cards)          */}
      {/* ========================================================================= */}
      <section aria-labelledby="related-products-heading" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-navy-900/[0.08] pb-4">
          <div>
            <h2 id="related-products-heading" className="text-xl sm:text-2xl font-bold text-navy-950">
              Side-by-Side Comparison Matrix
            </h2>
            <p className="text-xs sm:text-sm text-navy-600 mt-1 max-w-2xl">
              Compare {comparedProducts.length} competing listing{comparedProducts.length > 1 ? 's' : ''} across prices, MOQs, materials, delivery times, and verified supplier credentials.
            </p>
          </div>

          {/* Matrix Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Difference Highlighter Toggle */}
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

        {/* Filter and Sort Bar for Related Products */}
        <div className="bg-white rounded-2xl border border-navy-900/[0.08] p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-800 uppercase tracking-wider">
                <Filter className="size-3.5 text-brand-600" />
                <span>Filters:</span>
              </span>

              {/* Category Filter */}
              {availableFilters.categories?.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs font-medium bg-navy-50/70 border border-navy-200 rounded-lg px-2.5 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Categories</option>
                  {availableFilters.categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}

              {/* Material Filter */}
              {availableFilters.materials?.length > 0 && (
                <select
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="text-xs font-medium bg-navy-50/70 border border-navy-200 rounded-lg px-2.5 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Materials</option>
                  {availableFilters.materials.map((mat) => (
                    <option key={mat} value={mat}>
                      {mat}
                    </option>
                  ))}
                </select>
              )}

              {/* Verified Supplier Only Toggle */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-navy-800 bg-navy-50/70 border border-navy-200 rounded-lg px-3 py-1.5 hover:bg-navy-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="size-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  Verified Suppliers Only
                </span>
              </label>

              {/* In Stock Only Toggle */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-navy-800 bg-navy-50/70 border border-navy-200 rounded-lg px-3 py-1.5 hover:bg-navy-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="size-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                />
                <span>In Stock Only</span>
              </label>

              {(selectedCategory || selectedMaterial || verifiedOnly || inStockOnly) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-brand-700 hover:text-brand-800 font-semibold underline decoration-brand-400"
                >
                  Reset filters
                </button>
              )}
            </div>

            {/* Sort Control */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-navy-600">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs font-semibold bg-white border border-navy-200 rounded-lg px-3 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
              >
                <option value="relevance">Similarity Match / Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="moq-asc">MOQ: Low to High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty state if no related products match */}
        {similarPool.length === 0 && comparedProducts.length <= 1 ? (
          <div className="rounded-2xl border border-navy-900/[0.08] bg-white p-10 text-center shadow-xs">
            <EmptyState
              title="No Similar Products Found"
              description="There are currently no other competing products in this category from registered TradeExpress suppliers matching your filters."
              actionLabel="Reset Filters"
              onAction={resetFilters}
            />
          </div>
        ) : (
          <>
            {/* Desktop Side-by-Side Comparison Matrix */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-navy-900/[0.1] bg-white shadow-sm">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-navy-900/[0.08] bg-navy-50/40">
                    <th className="w-56 p-5 text-xs font-bold uppercase tracking-wider text-navy-500 bg-navy-50/80 align-top">
                      Feature & Attributes
                    </th>

                    {comparedProducts.map((product) => {
                      const isRef = referenceProduct?.id === product.id;
                      return (
                        <th
                          key={product.id}
                          className={`p-5 align-top relative ${
                            isRef ? 'bg-brand-500/[0.04] border-x-2 border-brand-500/30' : 'border-r border-navy-100 last:border-r-0'
                          }`}
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
                            {isRef ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-navy-950 text-white shadow-2xs">
                                <span className="text-brand-400">★</span> Searched Reference
                              </span>
                            ) : product.similarityScore ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-800 border border-brand-200">
                                <Sparkles className="size-3 text-brand-600" />
                                {product.similarityScore}% Match
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-navy-100 text-navy-800">
                                Related Product
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
                              / {product.unit || 'unit'}
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
                              icon={ShoppingCart}
                              disabled={!product.inStock}
                              onClick={() => addToCart(product, product.moq || 1, null)}
                              className={`w-full text-xs font-semibold justify-center transition-all ${
                                inCart(product.id)
                                  ? '!bg-emerald-100/95 !text-emerald-900 !border-2 !border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 hover:!bg-emerald-200/90'
                                  : '!bg-emerald-50 !text-emerald-800 !border !border-emerald-300/90 shadow-xs hover:!bg-emerald-100 hover:!border-emerald-400'
                              }`}
                            >
                              {inCart(product.id) ? 'Added (Add More)' : 'Add to Cart'}
                            </Button>
                          </div>
                        </th>
                      );
                    })}

                    {comparedProducts.length < MAX_COMPARE && (
                      <th className="p-5 align-middle border-dashed border-2 border-navy-200 bg-navy-50/20 text-center rounded-xl m-2">
                        <div className="flex flex-col items-center justify-center py-10 px-4">
                          <div className="size-12 rounded-full bg-navy-100 flex items-center justify-center text-navy-500 mb-3">
                            <Plus className="size-6" />
                          </div>
                          <p className="text-xs font-bold text-navy-800 mb-1">Add Another Product</p>
                          <p className="text-[11px] text-navy-500 mb-4 max-w-[150px]">
                            Compare up to {MAX_COMPARE} items side-by-side
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const nextCandidate = similarPool.find(
                                (s) => !comparedProducts.some((c) => c.id === s.id)
                              );
                              if (nextCandidate) {
                                addProductToComparison(nextCandidate);
                              } else {
                                showToast('All found similar products are already in the comparison table.', 'info');
                              }
                            }}
                            className="text-xs font-semibold"
                          >
                            Add Next Match
                          </Button>
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-navy-900/[0.07] text-xs">
                  {/* Price Row */}
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
                          {money(p.price)} <span className="text-xs font-normal text-navy-500">per {p.unit}</span>
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
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* MOQ Row */}
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
                        {p.moq ? `${p.moq} ${p.unit || 'units'}` : '1 unit'}
                      </td>
                    ))}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Material Row */}
                  <tr className={highlightDifferences && diffMap.material ? 'bg-amber-50/40' : ''}>
                    <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                      <div className="flex items-center gap-1.5">
                        <span>Material / Composition</span>
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
                          <span className="text-navy-400 italic">—</span>
                        )}
                      </td>
                    ))}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Available Sizes */}
                  <tr className={highlightDifferences && diffMap.sizes ? 'bg-amber-50/40' : ''}>
                    <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                      <div className="flex items-center gap-1.5">
                        <span>Available Sizes / Options</span>
                        {highlightDifferences && diffMap.sizes && (
                          <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                        )}
                      </div>
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 align-top text-navy-800 font-medium">
                        {p.sizes ? (
                          <span className="inline-flex flex-wrap gap-1">
                            {p.sizes.split(',').map((s, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded border border-navy-200 bg-white text-[11px]">
                                {s.trim()}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-navy-400 italic">—</span>
                        )}
                      </td>
                    ))}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
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
                        {p.inStock ? (
                          <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                            <span>{p.stock > 0 ? `${p.stock} in stock` : 'In Stock'}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-danger-700 font-bold">
                            <XCircle className="size-3.5 text-danger-600" />
                            <span>Made to Order</span>
                          </span>
                        )}
                      </td>
                    ))}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Delivery / Lead Time */}
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
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Supplier Company */}
                  <tr>
                    <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                      Supplier Company
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
                                TradeExpress Registered
                              </span>
                            </div>
                          ) : (
                            <span className="text-navy-400 italic">—</span>
                          )}
                        </td>
                      );
                    })}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Supplier Verification Status */}
                  <tr className={highlightDifferences && diffMap.supplierVerified ? 'bg-amber-50/40' : ''}>
                    <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                      <div className="flex items-center gap-1.5">
                        <span>Verification Status</span>
                        {highlightDifferences && diffMap.supplierVerified && (
                          <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                        )}
                      </div>
                    </td>
                    {comparedProducts.map((p) => {
                      const sup = p.supplier;
                      const isVerified = Boolean(sup?.isVerified || sup?.kycStatus === 'VERIFIED');
                      return (
                        <td key={p.id} className="p-4 align-top">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <BadgeCheck className="size-3.5 text-emerald-600" />
                              <span>Verified Supplier</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-navy-100 text-navy-700">
                              <Clock className="size-3 text-navy-400" />
                              <span>Not Verified</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Origin & Location */}
                  <tr className={highlightDifferences && diffMap.supplierLocation ? 'bg-amber-50/40' : ''}>
                    <td className="p-4 font-bold text-navy-900 bg-navy-50/50">
                      <div className="flex items-center gap-1.5">
                        <span>Origin & Location</span>
                        {highlightDifferences && diffMap.supplierLocation && (
                          <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-bold">Diff</span>
                        )}
                      </div>
                    </td>
                    {comparedProducts.map((p) => {
                      const loc = p.supplier?.location;
                      return (
                        <td key={p.id} className="p-4 align-top text-navy-800">
                          {loc ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="size-3.5 text-navy-500 shrink-0" />
                              <span>{loc}</span>
                            </div>
                          ) : (
                            <span className="text-navy-400 italic">—</span>
                          )}
                        </td>
                      );
                    })}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-4 bg-navy-50/10" />}
                  </tr>

                  {/* Actions Row */}
                  <tr className="bg-navy-50/40 border-t-2 border-navy-900/[0.08]">
                    <td className="p-5 font-bold text-navy-900 bg-navy-50/80 align-middle">
                      Actions
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-5 align-top">
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="brand"
                            icon={FileText}
                            to={`/rfq?product=${p.id}`}
                            className="w-full text-xs font-bold justify-center"
                          >
                            Request a Quote
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            icon={MessageSquare}
                            onClick={() => p.supplier && contact(p.supplier, p)}
                            disabled={!p.supplier}
                            className="w-full text-xs font-semibold justify-center"
                          >
                            Contact Supplier
                          </Button>
                        </div>
                      </td>
                    ))}
                    {comparedProducts.length < MAX_COMPARE && <td className="p-5 bg-navy-50/10" />}
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
                    {referenceProduct?.id === p.id && <span className="text-brand-400 mr-1.5 font-extrabold">★</span>}
                    Product {idx + 1}
                    {p.similarityScore ? ` (${p.similarityScore}%)` : ''}
                  </button>
                ))}
              </div>

              {comparedProducts[mobileActiveIndex] && (
                <MobileProductCard
                  product={comparedProducts[mobileActiveIndex]}
                  isReference={referenceProduct?.id === comparedProducts[mobileActiveIndex].id}
                  onRemove={() => removeProduct(comparedProducts[mobileActiveIndex].id)}
                  canRemove={comparedProducts.length > 1}
                  money={money}
                  addToCart={addToCart}
                  inCart={inCart}
                  contact={contact}
                />
              )}
            </div>

            {/* Alternative Similar Products Grid */}
            {similarPool.length > 0 && (
              <div className="mt-10 pt-6 border-t border-navy-900/[0.08]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-navy-950">
                      Explore More Competing Suppliers & Listings
                    </h3>
                    <p className="text-xs text-navy-600">
                      Click "Add to Compare" to evaluate alongside your selected products.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" to="/products" className="text-xs">
                    View Catalog <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {similarPool
                    .filter((item) => !comparedProducts.some((c) => c.id === item.id))
                    .slice(0, 8)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="group flex flex-col rounded-xl border border-navy-900/[0.08] bg-white p-3.5 shadow-2xs hover:shadow-md transition-shadow"
                      >
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-navy-50 mb-3">
                          <Image
                            photo={item.photo || item.rawPhoto}
                            illustration={item.illustration}
                            category={item.categorySlug}
                            width={400}
                            height={400}
                            alt={item.name}
                            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform"
                          />
                          {item.similarityScore && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-navy-950/80 text-white backdrop-blur-xs">
                              {item.similarityScore}% match
                            </span>
                          )}
                        </div>

                        <Link
                          to={`/products/${item.slug || item.id}`}
                          className="font-bold text-xs text-navy-950 hover:text-brand-600 line-clamp-1 mb-1"
                        >
                          {item.name}
                        </Link>

                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="font-extrabold text-sm text-navy-950">{money(item.price)}</span>
                          <span className="text-[11px] text-navy-500">/ {item.unit}</span>
                        </div>

                        <div className="text-[11px] text-navy-600 space-y-0.5 mb-3 flex-1">
                          <p>MOQ: <span className="font-semibold text-navy-900">{item.moq} {item.unit}</span></p>
                          <p className="truncate">
                            Supplier: <span className="font-semibold text-navy-900">{item.supplier?.company || item.supplier?.name}</span>
                          </p>
                          {item.supplier?.isVerified && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                              <BadgeCheck className="size-3 text-emerald-600" /> Verified Supplier
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          icon={Plus}
                          onClick={() => addProductToComparison(item)}
                          className="w-full text-xs font-semibold justify-center hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50"
                        >
                          Add to Compare
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Mobile-friendly Detailed Product Card for smartphone screens
 */
function MobileProductCard({ product, isReference, onRemove, canRemove, money, addToCart, inCart, contact }) {
  const isVerified = Boolean(product.supplier?.isVerified || product.supplier?.kycStatus === 'VERIFIED');

  return (
    <div className="rounded-2xl border border-navy-900/[0.1] bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {isReference && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-navy-950 text-white mb-2">
              <span className="text-brand-400">★</span> Searched Reference
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
          <span className="text-xs text-navy-500 ml-1">/ {product.unit}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-navy-500 block">Minimum Order</span>
          <span className="text-sm font-bold text-navy-900">{product.moq} {product.unit}</span>
        </div>
      </div>

      <div className="divide-y divide-navy-100 text-xs">
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Material</span>
          <span className="font-semibold text-navy-900">{product.material || '—'}</span>
        </div>
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Sizes / Capacity</span>
          <span className="font-semibold text-navy-900">{product.sizes || '—'}</span>
        </div>
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Availability</span>
          <span className={`font-semibold ${product.inStock ? 'text-emerald-700' : 'text-danger-700'}`}>
            {product.inStock ? 'In Stock' : 'Made to Order'}
          </span>
        </div>
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Lead Time</span>
          <span className="font-semibold text-navy-900">{product.estimatedDelivery || `${product.leadTimeDays || 7} days`}</span>
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
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                <BadgeCheck className="size-3 text-emerald-600" /> Verified
              </span>
            ) : (
              <span className="text-[10px] text-navy-400">Not verified</span>
            )}
          </div>
        </div>
        <div className="py-2 flex justify-between">
          <span className="text-navy-500">Origin</span>
          <span className="font-semibold text-navy-900">{product.supplier?.location || '—'}</span>
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
          to={`/rfq?product=${product.id}`}
          className="w-full text-xs font-semibold justify-center"
        >
          Request RFQ
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => product.supplier && contact(product.supplier, product)}
          className="w-full text-xs font-semibold justify-center col-span-2"
        >
          Contact Supplier
        </Button>
      </div>
    </div>
  );
}
