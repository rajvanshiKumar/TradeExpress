import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Image from '../../components/common/Image';
import Modal from '../../components/common/Modal';
import Input, { Textarea } from '../../components/common/Input';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';

const schema = {
  name: [rules.required('Category name'), rules.minLength('Category name', 3), rules.maxLength('Category name', 40)],
  description: [rules.required('Description'), rules.maxLength('Description', 200)],
};

function CategoryForm({ category, existingNames, onSubmit, onCancel }) {
  const [values, setValues] = useState({ name: category?.name ?? '', description: category?.description ?? '', subcategories: (category?.subcategories ?? []).join(', ') });
  const [errors, setErrors] = useState({});
  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const submit = (event) => {
    event.preventDefault();
    const found = validate(schema, values);
    if (!found.name && existingNames.includes(values.name.trim().toLowerCase())) found.name = 'A category with this name already exists.';
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'category-');
    return onSubmit({ name: values.name.trim(), description: values.description.trim(), subcategories: [...new Set(values.subcategories.split(',').map((item) => item.trim()).filter(Boolean))] });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Input id="category-name" label="Category name" required value={values.name} onChange={set('name')} error={errors.name} />
      <Textarea id="category-description" label="Description" required rows={3} value={values.description} onChange={set('description')} error={errors.description} />
      <Input id="category-subcategories" label="Subcategories" value={values.subcategories} onChange={set('subcategories')} hint="Separate with commas, e.g. Audio, Wearables." />
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="navy">{category ? 'Save category' : 'Add category'}</Button>
      </div>
    </form>
  );
}

export default function AdminCategories() {
  const { categories, products, loading, error, reload, addCategory, updateCategory, deleteCategory } = useProducts();
  const { showToast } = useNotifications();
  const [editing, setEditing] = useState(null); // null closed, {} new, category = edit
  const [deleting, setDeleting] = useState(null);
  useDocumentTitle('Admin: categories');

  const count = (slug) => products.filter((product) => product.category === slug).length;
  const save = (data) => {
    if (editing?.id) {
      updateCategory(editing.id, data);
      showToast('Category updated.');
    } else {
      addCategory(data);
      showToast('Category added. It now appears in menus and filters.');
    }
    setEditing(null);
  };
  const deletingCount = deleting ? count(deleting.slug) : 0;

  return (
    <div>
      <SectionHeading title="Categories" description="Categories drive the mega menu, homepage grid, filters and product forms." actions={<Button size="sm" icon={Plus} onClick={() => setEditing({})}>Add category</Button>} />

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton rows={8} /> : categories.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No categories" text="Add a category so suppliers can list products in it." action={<Button icon={Plus} onClick={() => setEditing({})}>Add category</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">Product categories</caption>
              <thead><tr><th scope="col">Category</th><th scope="col">Subcategories</th><th scope="col">Products</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="flex min-w-56 items-center gap-3">
                        <Image photo={category.photo} illustration={category.illustration} width={96} height={96} alt="" className="size-11 shrink-0 rounded-lg bg-surface object-cover" />
                        <div className="min-w-0">
                          <Link to={`/categories/${category.slug}`} className="font-semibold text-ink hover:text-brand-600">{category.name}</Link>
                          <p className="line-clamp-1 max-w-xs text-xs text-muted">{category.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="min-w-56 text-[0.8125rem] text-muted">{category.subcategories.length ? category.subcategories.join(', ') : '—'}</td>
                    <td>{count(category.slug)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`}>Edit</Button>
                        <Button variant="dangerOutline" size="sm" icon={Trash2} onClick={() => setDeleting(category)} aria-label={`Delete ${category.name}`}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : 'Add category'}>
        {editing ? <CategoryForm key={editing.id ?? 'new'} category={editing.id ? editing : null} existingNames={categories.filter((item) => item.id !== editing.id).map((item) => item.name.toLowerCase())} onSubmit={save} onCancel={() => setEditing(null)} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)} onCancel={() => setDeleting(null)} title={deletingCount ? 'This category still has products' : 'Delete this category?'}
        confirmLabel={deletingCount ? 'OK' : 'Delete category'} cancelLabel={deletingCount ? 'Close' : 'Cancel'} tone={deletingCount ? 'primary' : 'danger'}
        text={deleting ? (deletingCount ? `“${deleting.name}” contains ${deletingCount} ${deletingCount === 1 ? 'product' : 'products'}. Move or delete them first, then delete the category.` : `“${deleting.name}” will be removed from menus, filters and product forms.`) : ''}
        onConfirm={() => { if (!deletingCount) { deleteCategory(deleting.id); showToast('Category deleted.', 'info'); } setDeleting(null); }}
      />
    </div>
  );
}
