import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageX, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Input, { Checkbox, Textarea } from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Image from '../../components/common/Image';
import EmptyState from '../../components/common/EmptyState';
import PriceTiers from '../../components/products/PriceTiers';
import ProductMediaUploader from '../../components/products/ProductMediaUploader';
import SupplierGuard from './SupplierGuard';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { buildPriceTiers } from '../../data/products';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';
import { apiPost, apiPut } from '../../services/apiClient';
import { photoUrl } from '../../utils/images';

const UNITS = ['piece', 'set', 'pair', 'unit', 'box', 'roll', 'kg', 'meter', 'litre'];
const GST_RATES = [
  { value: '0', label: '0% (Exempt)' },
  { value: '5', label: '5% (Concessional)' },
  { value: '12', label: '12% (Standard Low)' },
  { value: '18', label: '18% (Standard Default)' },
  { value: '28', label: '28% (Luxury / High)' },
];

const schema = {
  name: [rules.required('Product name'), rules.minLength('Product name', 4), rules.maxLength('Product name', 90)],
  category: [rules.required('Category')],
  summary: [rules.required('Short summary'), rules.minLength('Short summary', 15), rules.maxLength('Short summary', 160)],
  description: [rules.maxLength('Description', 2000)],
  price: [rules.required('Base price'), rules.number('Base price', { min: 0.01 })],
  moq: [rules.required('Minimum order'), rules.number('Minimum order', { min: 1, integer: true })],
  stock: [rules.required('Stock'), rules.number('Stock', { min: 0, integer: true })],
  leadTimeDays: [rules.required('Lead time'), rules.number('Lead time', { min: 1, max: 365, integer: true })],
  hsnCode: [rules.required('HSN Code'), rules.minLength('HSN Code', 4), rules.maxLength('HSN Code', 8)],
};

const specsToText = (specs = {}) => Object.entries(specs).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
const textToSpecs = (text) => Object.fromEntries(text.split('\n').map((line) => line.split(/:(.*)/s).map((part) => part?.trim())).filter(([label, value]) => label && value));

function Form({ company, product }) {
  const { categories, addProduct, updateProduct } = useProducts();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const isEdit = Boolean(product);

  const initialImages = Array.isArray(product?.images)
    ? product.images.map((item) => (typeof item === 'string' ? item : item.url)).filter(Boolean)
    : product?.photo ? [product.photo] : [];

  const [values, setValues] = useState(() => ({
    name: product?.name ?? '', category: product?.category ?? '', subcategory: product?.subcategory ?? '', summary: product?.summary ?? '',
    description: product?.description ?? '', price: product ? String(product.price) : '', unit: product?.unit ?? 'piece', moq: product ? String(product.moq) : '',
    stock: product ? String(product.stock) : '', leadTimeDays: product ? String(product.leadTimeDays) : '15', colours: (product?.variants?.Colour ?? []).join(', '),
    specifications: specsToText(product?.specifications), sampleAvailable: product?.sampleAvailable ?? true, samplePrice: product?.samplePrice ? String(product.samplePrice) : '',
    readyToShip: product?.readyToShip ?? false, deal: product?.deal ?? false, status: product?.status ?? 'Active',
    hsnCode: product?.hsnCode ?? '84713010', gstRate: product?.gstRate ? String(product.gstRate) : '18', weightKg: product?.weightKg ? String(product.weightKg) : '1.0',
    photo: product?.photo ?? (initialImages[0] || null),
    images: initialImages,
    videoUrl: product?.videoUrl || product?.video || null,
  }));
  const [customTiersEnabled, setCustomTiersEnabled] = useState(Boolean(product?.priceTiers && product.priceTiers.length));
  const [customTier1, setCustomTier1] = useState(product?.priceTiers?.[1]?.price ? String(product.priceTiers[1].price) : '');
  const [customTier2, setCustomTier2] = useState(product?.priceTiers?.[2]?.price ? String(product.priceTiers[2].price) : '');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const category = categories.find((item) => item.slug === values.category);

  const previewTiers = useMemo(() => {
    const basePrice = Number(values.price);
    const moq = Math.round(Number(values.moq));
    if (basePrice <= 0 || moq < 1) return [];

    if (customTiersEnabled && customTier1 && customTier2) {
      return [
        { minQty: moq, maxQty: moq * 5 - 1, price: basePrice },
        { minQty: moq * 5, maxQty: moq * 20 - 1, price: Number(customTier1) },
        { minQty: moq * 20, maxQty: null, price: Number(customTier2) },
      ];
    }
    return buildPriceTiers(basePrice, moq);
  }, [values.price, values.moq, customTiersEnabled, customTier1, customTier2]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value, ...(field === 'category' ? { subcategory: '' } : {}) }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const setFlag = (field) => (checked) => setValues((previous) => ({ ...previous, [field]: checked }));

  const handleImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP).', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiPost('upload', formData);
      const fileUrl = res?.data?.url || res?.data?.fileUrl || res?.url || res?.fileUrl;
      if (fileUrl) {
        setValues((prev) => ({ ...prev, photo: fileUrl }));
        showToast('Product photo uploaded successfully!');
      } else {
        throw new Error('Upload returned no URL');
      }
    } catch {
      // Local persistent base64 fallback so it displays and saves even if upload server is offline
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        setValues((prev) => ({ ...prev, photo: dataUrl }));
        showToast('Photo selected and saved locally.');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'product-');

    const colours = values.colours.split(',').map((item) => item.trim()).filter(Boolean);
    const leadTimeDays = Number(values.leadTimeDays);
    const moq = Number(values.moq);
    const basePrice = Number(values.price);
    const samplePrice = values.samplePrice ? Number(values.samplePrice) : basePrice;

    const primaryPhoto = values.images?.[0] || values.photo || null;
    const data = {
      name: values.name.trim(),
      category: values.category,
      categorySlug: values.category,
      subcategory: values.subcategory || category?.subcategories[0] || 'General',
      summary: values.summary.trim(),
      description: values.description.trim() || values.summary.trim(),
      price: basePrice,
      unit: values.unit,
      moq,
      stock: Number(values.stock),
      leadTimeDays,
      variants: colours.length ? { Colour: colours } : {},
      specifications: textToSpecs(values.specifications),
      sampleAvailable: values.sampleAvailable,
      samplePrice,
      readyToShip: values.readyToShip,
      deal: values.deal,
      status: values.status,
      hsnCode: values.hsnCode.trim(),
      gstRate: Number(values.gstRate),
      weightKg: Number(values.weightKg || 1),
      photo: primaryPhoto,
      images: values.images,
      videoUrl: values.videoUrl,
      priceTiers: previewTiers,
      shippingEstimate: values.readyToShip ? 'Ships in 3–5 days from stock' : `Ships ${leadTimeDays}–${leadTimeDays + 7} days after order confirmation`,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        // Sync to backend MySQL
        try {
          await apiPut(`supplier/products/${product.id}`, data);
        } catch {
          // Fallback smoothly
        }
        updateProduct(product.id, {
          ...data,
          illustration: primaryPhoto || (product.illustration?.startsWith('product-') ? product.illustration : category?.illustration ?? product.illustration),
        });
        showToast('Product updated. The catalogue shows the new details.');
      } else {
        // Create on backend MySQL
        let createdBackendProduct = null;
        try {
          const res = await apiPost('supplier/products', { ...data, companyId: company.id });
          createdBackendProduct = res?.data || res?.product || null;
        } catch (err) {
          if (err?.status === 400 || err?.status === 422) {
            showToast(err.message || 'Validation error while creating product.', 'error');
            setSubmitting(false);
            return;
          }
          console.warn('Backend product creation warning:', err);
        }
        addProduct({
          ...data,
          id: createdBackendProduct?.id || undefined,
          sku: createdBackendProduct?.sku || undefined,
          companyId: company.id,
          illustration: primaryPhoto || (category?.illustration ?? 'product-generic'),
          packaging: { unitPack: `One ${values.unit} per polybag or box`, cartonQty: moq >= 100 ? 50 : 10, cartonSize: '55 × 40 × 35 cm', note: 'Custom packaging available on request.' },
        });
        showToast('Product added. It is now live in the catalogue.');
      }
      navigate('/supplier/products');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Button to="/supplier/products" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3 mb-2">Back to products</Button>
      <SectionHeading title={isEdit ? 'Edit product' : 'Add product'} description={isEdit ? `${product.id} · ${product.sku}` : `New listing for ${company.name}`} />

      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
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

            {/* Custom Tier Pricing Option */}
            <div className="mt-5 border-t border-navy-900/[0.06] pt-4">
              <div className="flex items-center justify-between">
                <p className="ts-label !mb-0">Quantity price tiers</p>
                <button
                  type="button"
                  onClick={() => setCustomTiersEnabled(!customTiersEnabled)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  {customTiersEnabled ? 'Switch to auto tiers (8% & 15% off)' : 'Customize tier prices manually'}
                </button>
              </div>

              {customTiersEnabled ? (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 bg-ivory/60 p-4 rounded-xl border border-navy-900/[0.06]">
                  <Input
                    id="product-tier1"
                    label={`Tier 2 Price (₹ at ${Number(values.moq || 1) * 5} units)`}
                    type="number"
                    placeholder="e.g. 920"
                    value={customTier1}
                    onChange={(e) => setCustomTier1(e.target.value)}
                    hint="Default is ~8% discount."
                  />
                  <Input
                    id="product-tier2"
                    label={`Tier 3 Price (₹ at ${Number(values.moq || 1) * 20} units)`}
                    type="number"
                    placeholder="e.g. 850"
                    value={customTier2}
                    onChange={(e) => setCustomTier2(e.target.value)}
                    hint="Default is ~15% discount."
                  />
                </div>
              ) : null}

              {previewTiers.length ? (
                <div className="mt-3">
                  <PriceTiers product={{ priceTiers: previewTiers, unit: values.unit }} />
                </div>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">GST, Taxation & Logistics</legend>
            <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-3">
              <Input
                id="product-hsn"
                label="HSN Code (GST Classification)"
                required
                placeholder="e.g. 84713010"
                value={values.hsnCode}
                onChange={set('hsnCode')}
                error={errors.hsnCode}
                hint="4 to 8 digit Harmonized System code."
              />
              <Select
                id="product-gst"
                label="Applicable GST Rate (%)"
                required
                options={GST_RATES}
                value={values.gstRate}
                onChange={set('gstRate')}
              />
              <Input
                id="product-weight"
                label="Weight per unit (kg)"
                type="number"
                step="0.01"
                min="0.01"
                value={values.weightKg}
                onChange={set('weightKg')}
                hint="Used for freight calculation."
              />
            </div>
          </fieldset>

          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Options, Sample & Specifications</legend>
            <div className="grid clear-both gap-4">
              <Input id="product-colours" label="Colour options" value={values.colours} onChange={set('colours')} hint="Optional. Separate with commas, e.g. Black, Ivory, Navy." />
              <Textarea id="product-specifications" label="Specifications" rows={4} value={values.specifications} onChange={set('specifications')} hint="One per line as “Label: value”, e.g. Material: Stainless steel." />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-center">
                <Checkbox id="product-sampleAvailable" label="Sample available" checked={values.sampleAvailable} onChange={setFlag('sampleAvailable')} />
                <Checkbox id="product-readyToShip" label="Ready to ship" checked={values.readyToShip} onChange={setFlag('readyToShip')} />
                <Checkbox id="product-deal" label="Wholesale deal" checked={values.deal} onChange={setFlag('deal')} />
              </div>
              {values.sampleAvailable && (
                <div className="max-w-xs">
                  <Input
                    id="product-samplePrice"
                    label="Sample Unit Price (₹)"
                    type="number"
                    placeholder="Defaults to base price"
                    value={values.samplePrice}
                    onChange={set('samplePrice')}
                    hint="Charge for sample orders (leave blank for base price)."
                  />
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">
              Product Visuals & Promotional Media (Up to 8 Images + 1 Video)
            </legend>
            <div className="clear-both">
              <ProductMediaUploader
                images={values.images}
                setImages={(updater) =>
                  setValues((prev) => {
                    const next = typeof updater === 'function' ? updater(prev.images) : updater;
                    return { ...prev, images: next, photo: next[0] || null };
                  })
                }
                videoUrl={values.videoUrl}
                setVideoUrl={(newVideo) =>
                  setValues((prev) => ({ ...prev, videoUrl: newVideo }))
                }
                disabled={submitting}
              />
            </div>
          </fieldset>
        </div>

        <aside className="space-y-4">
          <div className="ts-card p-5 xl:sticky xl:top-40">
            <p className="ts-label">Listing Preview & Media</p>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
              {values.images?.[0] || values.photo ? (
                <img
                  src={photoUrl(values.images?.[0] || values.photo)}
                  alt="Listing cover preview"
                  className="size-full object-cover"
                />
              ) : (
                <Image
                  photo={null}
                  illustration={category?.illustration ?? 'product-generic'}
                  width={400}
                  height={400}
                  alt="Listing placeholder"
                  className="size-full object-cover"
                />
              )}
              <span className="absolute bottom-2 left-2 rounded-md bg-navy-950/80 px-2 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur-xs">
                Cover Image
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Photos Attached:</span>
                <span className="text-emerald-700 font-bold">{values.images?.length || 0} / 8</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Video Showcase:</span>
                <span className={values.videoUrl ? 'text-emerald-700 font-bold' : 'text-slate-400 font-normal'}>
                  {values.videoUrl ? 'Attached (1/1)' : 'None'}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <Button type="submit" icon={Save} full disabled={submitting}>
                {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Publish product'}
              </Button>
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
