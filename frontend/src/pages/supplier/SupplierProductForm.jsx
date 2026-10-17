import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageX, Save } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Input, { Checkbox, Textarea } from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Image from '../../components/common/Image';
import EmptyState from '../../components/common/EmptyState';
import PriceTiers from '../../components/products/PriceTiers';
import SupplierGuard from './SupplierGuard';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { buildPriceTiers } from '../../data/products';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';

const UNITS = ['piece', 'set', 'pair', 'unit', 'box', 'roll', 'kg'];

const schema = {
  name: [rules.required('Product name'), rules.minLength('Product name', 4), rules.maxLength('Product name', 90)],
  category: [rules.required('Category')],
  summary: [rules.required('Short summary'), rules.minLength('Short summary', 15), rules.maxLength('Short summary', 160)],
  description: [rules.maxLength('Description', 2000)],
  price: [rules.required('Base price'), rules.number('Base price', { min: 0.01 })],
  moq: [rules.required('Minimum order'), rules.number('Minimum order', { min: 1, integer: true })],
  stock: [rules.required('Stock'), rules.number('Stock', { min: 0, integer: true })],
  leadTimeDays: [rules.required('Lead time'), rules.number('Lead time', { min: 1, max: 365, integer: true })],
};

const specsToText = (specs = {}) => Object.entries(specs).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
const textToSpecs = (text) => Object.fromEntries(text.split('\n').map((line) => line.split(/:(.*)/s).map((part) => part?.trim())).filter(([label, value]) => label && value));

function Form({ company, product }) {
  const { categories, addProduct, updateProduct } = useProducts();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const isEdit = Boolean(product);

  const [values, setValues] = useState(() => ({
    name: product?.name ?? '', category: product?.category ?? '', subcategory: product?.subcategory ?? '', summary: product?.summary ?? '',
    description: product?.description ?? '', price: product ? String(product.price) : '', unit: product?.unit ?? 'piece', moq: product ? String(product.moq) : '',
    stock: product ? String(product.stock) : '', leadTimeDays: product ? String(product.leadTimeDays) : '15', colours: (product?.variants?.Colour ?? []).join(', '),
    specifications: specsToText(product?.specifications), sampleAvailable: product?.sampleAvailable ?? true, readyToShip: product?.readyToShip ?? false,
    deal: product?.deal ?? false, status: product?.status ?? 'Active',
  }));
  const [errors, setErrors] = useState({});

  const category = categories.find((item) => item.slug === values.category);
  const previewTiers = useMemo(() => (Number(values.price) > 0 && Number(values.moq) >= 1 ? buildPriceTiers(Number(values.price), Math.round(Number(values.moq))) : []), [values.price, values.moq]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value, ...(field === 'category' ? { subcategory: '' } : {}) }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const setFlag = (field) => (checked) => setValues((previous) => ({ ...previous, [field]: checked }));

  const submit = (event) => {
    event.preventDefault();
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'product-');

    const colours = values.colours.split(',').map((item) => item.trim()).filter(Boolean);
    const leadTimeDays = Number(values.leadTimeDays);
    const moq = Number(values.moq);
    const data = {
      name: values.name.trim(), category: values.category, subcategory: values.subcategory || category?.subcategories[0] || 'General', summary: values.summary.trim(),
      description: values.description.trim() || values.summary.trim(), price: Number(values.price), unit: values.unit, moq, stock: Number(values.stock), leadTimeDays,
      variants: colours.length ? { Colour: colours } : {}, specifications: textToSpecs(values.specifications), sampleAvailable: values.sampleAvailable,
      readyToShip: values.readyToShip, deal: values.deal, status: values.status,
      shippingEstimate: values.readyToShip ? 'Ships in 3–5 days from stock' : `Ships ${leadTimeDays}–${leadTimeDays + 7} days after order confirmation`,
    };

    if (isEdit) {
      // Keep the photo, but follow the category if the listing only has an illustration.
      updateProduct(product.id, { ...data, illustration: product.photo || product.illustration?.startsWith('product-') ? product.illustration : category?.illustration ?? product.illustration });
      showToast('Product updated. The catalogue shows the new details.');
    } else {
      addProduct({
        ...data, companyId: company.id, illustration: category?.illustration ?? 'product-generic',
        packaging: { unitPack: `One ${values.unit} per polybag or box`, cartonQty: moq >= 100 ? 50 : 10, cartonSize: '55 × 40 × 35 cm', note: 'Custom packaging available on request.' },
      });
      showToast('Product added. It is now live in the catalogue.');
    }
    return navigate('/supplier/products');
  };

  return (
    <div>
      <Button to="/supplier/products" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3 mb-2">Back to products</Button>
      <SectionHeading title={isEdit ? 'Edit product' : 'Add product'} description={isEdit ? `${product.id} · ${product.sku}` : `New listing for ${company.name}`} />

      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Basic details</legend>
            <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-2">
              <Input id="product-name" label="Product name" required value={values.name} onChange={set('name')} error={errors.name} wrapperClassName="sm:col-span-2" />
              <Select id="product-category" label="Category" required placeholder="Choose a category" options={categories.map((item) => ({ value: item.slug, label: item.name }))} value={values.category} onChange={set('category')} error={errors.category} />
              <Select id="product-subcategory" label="Subcategory" placeholder={category ? 'Choose a subcategory' : 'Choose a category first'} options={category?.subcategories ?? []} value={values.subcategory} onChange={set('subcategory')} disabled={!category?.subcategories.length} />
              <Input id="product-summary" label="Short summary" required value={values.summary} onChange={set('summary')} error={errors.summary} hint={`${values.summary.length}/160 characters. Shown on product cards.`} wrapperClassName="sm:col-span-2" />
              <Textarea id="product-description" label="Description" rows={5} value={values.description} onChange={set('description')} error={errors.description} hint="Optional. Uses the summary if left empty." wrapperClassName="sm:col-span-2" />
            </div>
          </fieldset>

          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Pricing and inventory</legend>
            <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input id="product-price" label="Base price (₹ per unit)" required type="number" min="0" step="0.01" inputMode="decimal" value={values.price} onChange={set('price')} error={errors.price} hint="Price at the minimum order." />
              <Select id="product-unit" label="Unit" options={UNITS} value={values.unit} onChange={set('unit')} />
              <Input id="product-moq" label="Minimum order (MOQ)" required type="number" min="1" inputMode="numeric" value={values.moq} onChange={set('moq')} error={errors.moq} />
              <Input id="product-stock" label="Stock" required type="number" min="0" inputMode="numeric" value={values.stock} onChange={set('stock')} error={errors.stock} />
              <Input id="product-leadTimeDays" label="Lead time (days)" required type="number" min="1" inputMode="numeric" value={values.leadTimeDays} onChange={set('leadTimeDays')} error={errors.leadTimeDays} />
              <Select id="product-status" label="Visibility" options={[{ value: 'Active', label: 'Active: shown in catalogue' }, { value: 'Hidden', label: 'Hidden: not shown' }]} value={values.status} onChange={set('status')} />
            </div>
            {previewTiers.length ? (
              <div className="mt-5">
                <p className="ts-label">Quantity price tiers (generated automatically)</p>
                <PriceTiers product={{ priceTiers: previewTiers, unit: values.unit }} />
                <p className="mt-1.5 text-xs text-muted">8% off at 5 × MOQ and 15% off at 20 × MOQ.</p>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Options and specifications</legend>
            <div className="grid clear-both gap-4">
              <Input id="product-colours" label="Colour options" value={values.colours} onChange={set('colours')} hint="Optional. Separate with commas, e.g. Black, Ivory, Navy." />
              <Textarea id="product-specifications" label="Specifications" rows={4} value={values.specifications} onChange={set('specifications')} hint="One per line as “Label: value”, e.g. Material: Stainless steel." />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Checkbox id="product-sampleAvailable" label="Sample available" checked={values.sampleAvailable} onChange={setFlag('sampleAvailable')} />
                <Checkbox id="product-readyToShip" label="Ready to ship" checked={values.readyToShip} onChange={setFlag('readyToShip')} />
                <Checkbox id="product-deal" label="Wholesale deal" checked={values.deal} onChange={setFlag('deal')} />
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="space-y-4">
          <div className="ts-card p-5 xl:sticky xl:top-40">
            <p className="ts-label">Listing image</p>
            <Image photo={product?.photo ?? null} illustration={product?.photo || product?.illustration?.startsWith('product-') ? product.illustration : category?.illustration ?? 'product-generic'} width={400} height={400} alt="Listing image preview" className="aspect-square w-full rounded-xl bg-surface object-cover" />
            <p className="mt-2 text-xs text-muted">{product?.photo ? 'This sample listing keeps its photograph.' : 'New listings use an illustration that matches the category. Image upload needs a server and is not available yet.'}</p>
            <div className="mt-5 grid gap-2">
              <Button type="submit" icon={Save} full>{isEdit ? 'Save changes' : 'Publish product'}</Button>
              <Button to="/supplier/products" variant="outline" full>Cancel</Button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

export default function SupplierProductForm() {
  const { id } = useParams();
  const { getProduct } = useProducts();
  useDocumentTitle(id ? 'Edit product' : 'Add product');

  return (
    <SupplierGuard>
      {(company) => {
        const product = id ? getProduct(id) : null;
        if (id && (!product || product.companyId !== company.id)) {
          return <div className="ts-card"><EmptyState icon={PackageX} headingLevel={1} title="Product not found" text="This product does not exist or belongs to another supplier." action={<Button to="/supplier/products" variant="navy">Back to products</Button>} /></div>;
        }
        return <Form key={product?.id ?? 'new'} company={company} product={product} />;
      }}
    </SupplierGuard>
  );
}
