import { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  FolderTree,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminCategories() {
  const { showToast } = useNotifications();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    photo: '',
    subcategories: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await superAdminApi.getCategories();
      if (Array.isArray(data)) {
        setCategories(data);
      } else if (data?.data && Array.isArray(data.data)) {
        setCategories(data.data);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.warn('SuperAdminCategories fetch error, trying fallback:', err);
      try {
        const apiBase = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
        const fallbackRes = await fetch(`${apiBase}/categories`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const list = fallbackData?.data || fallbackData || [];
          if (Array.isArray(list) && list.length > 0) {
            setCategories(list);
            return;
          }
        }
      } catch {
        // Fallback error ignored
      }
      showToast(err.message || 'Failed to fetch categories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', slug: '', description: '', photo: '', subcategories: '' });
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingId(cat.id);
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories.join(', ') : '';
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      photo: cat.photo || '',
      subcategories: subs,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Category name is required.', 'error');
      return;
    }

    const subcategoriesArray = formData.subcategories
      ? formData.subcategories.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const payload = {
      name: formData.name,
      slug: formData.slug || undefined,
      description: formData.description,
      photo: formData.photo,
      subcategories: subcategoriesArray,
    };

    try {
      setSubmitting(true);
      if (editingId) {
        await superAdminApi.updateCategory(editingId, payload);
        showToast('Category updated successfully.', 'success');
      } else {
        await superAdminApi.createCategory(payload);
        showToast('New category created.', 'success');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      showToast(err.message || 'Failed to save category.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (cat) => {
    if (cat._count?.products > 0) {
      showToast(`Cannot delete category with ${cat._count.products} existing products. Reassign them first.`, 'error');
      return;
    }
    setDeleteTarget(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await superAdminApi.deleteCategory(deleteTarget.id);
      showToast('Category deleted.', 'success');
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      showToast(err.message || 'Failed to delete category.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Marketplace Category Taxonomy</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize catalog hierarchies, subcategory tags, and merchandising taxonomy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="size-4" />
            <span>Add Category</span>
          </button>

          <button
            type="button"
            onClick={fetchCategories}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            title="Refresh Categories"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((c) => {
          const subcats = Array.isArray(c.subcategories) ? c.subcategories : [];

          return (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    {c.photo ? (
                      <img src={c.photo} alt={c.name} className="size-11 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="size-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <FolderTree className="size-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
                      <p className="text-[11px] font-mono text-slate-400">/{c.slug}</p>
                    </div>
                  </div>

                  <span className="bg-slate-100 text-slate-800 text-[11px] font-black px-2.5 py-1 rounded-full shrink-0">
                    {c._count?.products || 0} items
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-3 line-clamp-2">
                  {c.description || 'No description provided.'}
                </p>

                {/* Subcategories tags */}
                {subcats.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subcategories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {subcats.map((sub, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                        >
                          <Tag className="size-2.5 text-emerald-600" />
                          <span>{sub}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(c)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="size-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(c)}
                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                  title="Delete Category"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal - Asks "Do you want to delete?" */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Do you want to delete?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm permanent removal from catalog taxonomy.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p>
                Are you sure you want to delete category <strong className="text-slate-900">"{deleteTarget.name}"</strong>?
              </p>
              <p className="text-slate-500 text-[11px]">
                Slug: <span className="font-mono text-emerald-800">/{deleteTarget.slug}</span>
              </p>
              <p className="text-rose-600 font-medium text-[11px]">
                This action is irreversible and will permanently delete this category taxonomy.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                {deleting ? 'Deleting...' : 'Do you want to delete? Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Industrial Machinery"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Slug (URL identifier)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="auto-generated from name if left blank"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={formData.photo}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Subcategories (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.subcategories}
                  onChange={(e) => setFormData({ ...formData, subcategories: e.target.value })}
                  placeholder="Lathes, CNC Mills, Hydraulic Presses, Compressors"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Merchandising details..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold transition-colors"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
