import { useState, useEffect } from 'react';
import {
  Package,
  Search,
  CheckCircle,
  XCircle,
  Star,
  TrendingUp,
  RefreshCw,
  Eye,
  AlertTriangle,
  IndianRupee,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminProducts() {
  const { showToast } = useNotifications();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [moderationStatus, setModerationStatus] = useState('ALL');
  const [categorySlug, setCategorySlug] = useState('ALL');

  // Moderation action modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('APPROVED');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getProducts({
        page,
        limit: pagination.limit,
        moderationStatus,
        categorySlug,
        search,
      });
      setProducts(res.products);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to load products from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await superAdminApi.getCategories();
      setCategories(data);
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    fetchProducts(1);
  }, [moderationStatus, categorySlug]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts(1);
  };

  const toggleFlag = async (product, flag) => {
    try {
      const updatedVal = !product[flag];
      await superAdminApi.moderateProduct(product.id, { [flag]: updatedVal });
      showToast(`Product ${flag} set to ${updatedVal ? 'ENABLED' : 'DISABLED'}.`, 'success');
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, [flag]: updatedVal } : p))
      );
    } catch (err) {
      showToast(err.message || `Failed to update ${flag}.`, 'error');
    }
  };

  const openModerationModal = (product, status) => {
    setSelectedProduct(product);
    setTargetStatus(status);
    setRejectionReason('');
    setModalOpen(true);
  };

  const handleModerationSubmit = async () => {
    if (targetStatus === 'REJECTED' && !rejectionReason.trim()) {
      showToast('Please provide a reason for rejecting this product.', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await superAdminApi.moderateProduct(selectedProduct.id, {
        moderationStatus: targetStatus,
        rejectionReason: targetStatus === 'REJECTED' ? rejectionReason : null,
      });
      showToast(`Product moderation updated to ${targetStatus}.`, 'success');
      setModalOpen(false);
      fetchProducts(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to moderate product.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Catalog Moderation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vet supplier listings, toggle homepage spotlights, and enforce marketplace quality standards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchProducts(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Catalog"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, SKU, or category..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Status:</span>
            <select
              value={moderationStatus}
              onChange={(e) => setModerationStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Moderation</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Category:</span>
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[160px]"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {products.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            No products match the selected criteria.
          </div>
        ) : (
          products.map((p) => {
            const isApproved = p.moderationStatus === 'APPROVED';
            const isPending = p.moderationStatus === 'PENDING';
            const isRejected = p.moderationStatus === 'REJECTED';

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-emerald-500/40 transition-all group"
              >
                <div>
                  {/* Image & Moderation Badge */}
                  <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                    {p.photo ? (
                      <img
                        src={p.photo}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="size-12" />
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs ${
                          isApproved
                            ? 'bg-emerald-600/90 text-white'
                            : isPending
                            ? 'bg-amber-600/90 text-white animate-pulse'
                            : 'bg-rose-600/90 text-white'
                        }`}
                      >
                        {p.moderationStatus}
                      </span>
                    </div>

                    {/* Spotlight badges */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleFlag(p, 'featured')}
                        className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                          p.featured ? 'bg-amber-400 text-slate-950 shadow-sm' : 'bg-slate-900/60 text-white hover:bg-slate-900'
                        }`}
                        title="Toggle Featured Spot"
                      >
                        <Star className="size-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFlag(p, 'trending')}
                        className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                          p.trending ? 'bg-emerald-400 text-slate-950 shadow-sm' : 'bg-slate-900/60 text-white hover:bg-slate-900'
                        }`}
                        title="Toggle Trending Spot"
                      >
                        <TrendingUp className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider truncate">
                      {p.category?.name || p.categorySlug}
                    </p>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">SKU: {p.sku}</p>

                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-base font-black text-slate-900">
                          ₹{Number(p.price || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">/ {p.unit}</span>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">MOQ: {p.moq}</span> | Stock: {p.stock}
                      </div>
                    </div>

                    {p.rejectionReason && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-800 mt-2">
                        <span className="font-bold">Rejection reason:</span> {p.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-slate-100 mt-3 pt-3">
                  {!isApproved ? (
                    <button
                      type="button"
                      onClick={() => openModerationModal(p, 'APPROVED')}
                      className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                    >
                      Approve Listing
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openModerationModal(p, 'REJECTED')}
                      className="flex-1 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                    >
                      Reject / Suspend
                    </button>
                  )}

                  <a
                    href={`/products/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                    title="Preview on Storefront"
                  >
                    <Eye className="size-4" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 shadow-xs">
        <p>
          Showing <span className="font-bold text-slate-900">{products.length}</span> of{' '}
          <span className="font-bold text-slate-900">{pagination.total}</span> products
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => fetchProducts(pagination.page - 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
          >
            Previous
          </button>
          <span className="font-bold text-slate-700">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchProducts(pagination.page + 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
          >
            Next
          </button>
        </div>
      </div>

      {/* Moderation Reason Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-xl ${targetStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {targetStatus === 'APPROVED' ? <CheckCircle className="size-5" /> : <AlertTriangle className="size-5" />}
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {targetStatus === 'APPROVED' ? 'Approve Product Listing' : 'Reject Product Listing'}
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[220px]">{selectedProduct.name}</p>
              </div>
            </div>

            {targetStatus === 'REJECTED' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Specify policy violation (e.g. counterfeit, misleading pricing, poor imagery)..."
                  rows="3"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleModerationSubmit}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors ${
                  targetStatus === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting ? 'Updating...' : `Confirm ${targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
