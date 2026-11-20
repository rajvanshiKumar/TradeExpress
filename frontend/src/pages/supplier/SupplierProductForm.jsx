import { useEffect, useMemo, useState } from 'react';
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
import AiListingAssistant from '../../components/products/AiListingAssistant';
import DynamicSpecFields from '../../components/products/DynamicSpecFields';
import useCategorySpecSchema from '../../hooks/useCategorySpecSchema';
import { incompatibleValueKeys, pickSchemaValues, validateSpecValues } from '../../utils/specValidation';
import SupplierGuard from './SupplierGuard';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { buildPriceTiers } from '../../data/products';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';
import { apiPost, apiPut } from '../../services/apiClient';
import { getMyProduct, refreshMyProducts } from '../../hooks/useMyProducts';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
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
  const initialHasTiers = Boolean(product?.priceTiers && product.priceTiers.length > 1);
  const [pricingModel, setPricingModel] = useState(initialHasTiers ? 'volume' : 'fixed');
  const [tier2MinQty, setTier2MinQty] = useState(product?.priceTiers?.[1]?.minQty ? String(product.priceTiers[1].minQty) : '');
  const [tier2Price, setTier2Price] = useState(product?.priceTiers?.[1]?.price ? String(product.priceTiers[1].price) : '');
  const [tier3MinQty, setTier3MinQty] = useState(product?.priceTiers?.[2]?.minQty ? String(product.priceTiers[2].minQty) : '');
  const [tier3Price, setTier3Price] = useState(product?.priceTiers?.[2]?.price ? String(product.priceTiers[2].price) : '');

  // Category-specific specifications (dynamic fields), kept by stable attribute key
  const [productType, setProductType] = useState(product?.specData?.productType ?? '');
  const [specValues, setSpecValues] = useState(() => ({ ...(product?.specData?.values || {}) }));
  const [specErrors, setSpecErrors] = useState({});
  const { schema: specSchema, loading: specLoading, error: specLoadError } = useCategorySpecSchema(values.category, values.subcategory, productType);
  const droppedSpecKeys = incompatibleValueKeys(specSchema, specValues);
  const setSpec = (key, value) => {
    setSpecValues((prev) => ({ ...prev, [key]: value }));
    if (specErrors[key]) setSpecErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const category = categories.find((item) => item.slug === values.category);

  const previewTiers = useMemo(() => {
    if (pricingModel !== 'volume') return [];
    const basePrice = Number(values.price);
    const moq = Math.round(Number(values.moq));
    if (basePrice <= 0 || moq < 1) return [];

    // Only tiers the supplier actually entered, each with a higher quantity AND a lower price than the previous
    // tier (no invented discounts; equal prices are not shown as volume pricing)
    const tiers = [{ minQty: moq, price: basePrice }];
    for (const [minQty, price] of [[Number(tier2MinQty), Number(tier2Price)], [Number(tier3MinQty), Number(tier3Price)]]) {
      const last = tiers[tiers.length - 1];
      if (Number.isFinite(minQty) && Number.isFinite(price) && minQty > last.minQty && price > 0 && price < last.price) tiers.push({ minQty, price });
    }
    if (tiers.length < 2) return [];
    return tiers.map((tier, i) => ({ ...tier, maxQty: tiers[i + 1] ? tiers[i + 1].minQty - 1 : null }));
  }, [pricingModel, values.price, values.moq, tier2MinQty, tier2Price, tier3MinQty, tier3Price]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value, ...(field === 'category' ? { subcategory: '' } : {}) }));
    // A product type belongs to its subcategory; entered specification values are kept where they still apply
    if (field === 'category' || field === 'subcategory') setProductType('');
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const setFlag = (field) => (checked) => setValues((previous) => ({ ...previous, [field]: checked }));

  /**
   * Applies the AI listing suggestions: name, summary, description and colours are filled from the AI; new
   * specification lines are added to the ones already typed; the category changes only when the AI's category
   * matched a TradeExpress category. Price, MOQ, stock and tax are never touched.
   */
  const applyAiSuggestions = (suggestion) => {
    const matched = suggestion.category && categories.some((item) => item.slug === suggestion.category);
    setValues((previous) => {
      const existingSpecs = previous.specifications.split('\n').map((line) => line.trim()).filter(Boolean);
      const known = new Set(existingSpecs.map((line) => line.split(':')[0].trim().toLowerCase()));
      const newSpecs = (suggestion.specifications || '').split('\n').filter((line) => line.trim() && !known.has(line.split(':')[0].trim().toLowerCase()));
      return {
        ...previous,
        name: suggestion.name || previous.name,
        summary: suggestion.summary || previous.summary,
        description: suggestion.description || previous.description,
        colours: suggestion.colours || previous.colours,
        specifications: [...existingSpecs, ...newSpecs].join('\n'),
        ...(matched ? { category: suggestion.category, subcategory: suggestion.subcategory || '' } : {}),
      };
    });
    if (matched && suggestion.category !== values.category) setProductType('');
    setErrors((previous) => ({ ...previous, name: '', summary: '', description: '', ...(matched ? { category: '' } : {}) }));
    showToast(matched
      ? 'AI details added. Review them, then add price, MOQ, stock and tax details.'
      : 'AI details added. Please choose the category, then add price, MOQ, stock and tax details.');
  };

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

  /** Shows the server's field errors next to the fields (specValues.<key> -> specification field). */
  const applyServerErrors = (err) => {
    const list = Array.isArray(err?.data?.errors) ? err.data.errors : [];
    const specs = {};
    const fields = {};
    for (const item of list) {
      const field = String(item?.field || '');
      if (field.startsWith('specValues.')) specs[field.slice(11)] = item.message;
      else if (field === 'categorySlug') fields.category = item.message;
      else if (field) fields[field] = item.message;
    }
    if (Object.keys(specs).length) { setSpecErrors(specs); focusFirstError(specs, 'spec-'); }
    if (Object.keys(fields).length) setErrors((prev) => ({ ...prev, ...fields }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'product-');
    if (specLoading) { showToast('Specification fields are still loading. Please try again in a moment.', 'error'); return undefined; }
    const foundSpec = validateSpecValues(specSchema, specValues);
    setSpecErrors(foundSpec);
    if (hasErrors(foundSpec)) return focusFirstError(foundSpec, 'spec-');

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
      ...(specSchema ? { productType: productType || null, specValues: pickSchemaValues(specSchema, specValues) } : {}),
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
          refreshMyProducts();
        } catch (err) {
          applyServerErrors(err);
          showToast(err?.message || 'The product could not be saved. Please try again.', 'error');
          return undefined;
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
          refreshMyProducts();
          createdBackendProduct = res?.data || res?.product || null;
        } catch (err) {
          applyServerErrors(err);
          showToast(err?.message || 'The product could not be created. Please try again.', 'error');
          return undefined;
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
          <AiListingAssistant images={values.images} onApply={applyAiSuggestions} disabled={submitting} />

          <fieldset className="ts-card p-5 sm:p-6">
            <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Basic details</legend>
            <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-2">
              <Input id="product-name" label="Product name" required value={values.name} onChange={set('name')} error={errors.name} wrapperClassName="sm:col-span-2" />
              <Select id="product-category" label="Category" required placeholder="Choose a category" options={categories.map((item) => ({ value: item.slug, label: item.name }))} value={values.category} onChange={set('category')} error={errors.category} />
              <Select id="product-subcategory" label="Subcategory" placeholder={category ? 'Choose a subcategory' : 'Choose a category first'} options={category?.subcategories ?? []} value={values.subcategory} onChange={set('subcategory')} disabled={!category?.subcategories.length} />
              {specSchema?.productTypes?.length ? (
                <Select id="product-productType" label="Product type" placeholder="Choose a product type (optional)" options={specSchema.productTypes} value={productType} onChange={(e) => setProductType(e.target.value)} error={errors.productType} hint="Adds the fields specific to this product type." />
              ) : null}
              <Input id="product-summary" label="Short summary" required value={values.summary} onChange={set('summary')} error={errors.summary} hint={`${values.summary.length}/160 characters. Shown on product cards.`} wrapperClassName="sm:col-span-2" />
              <Textarea id="product-description" label="Description" rows={5} value={values.description} onChange={set('description')} error={errors.description} hint="Optional. Uses the summary if left empty." wrapperClassName="sm:col-span-2" />
            </div>
          </fieldset>

          {values.category ? (
            <fieldset className="ts-card p-5 sm:p-6" aria-busy={specLoading || undefined}>
              <legend className="float-left mb-1 w-full font-display text-base font-bold text-navy-900">Product specifications</legend>
              <p className="clear-both mb-4 text-[0.8125rem] text-muted">
                {specSchema ? `Fields for ${[category?.name, values.subcategory, productType].filter(Boolean).join(' › ')}. Fields marked * are required.` : 'Specification fields appear here once a category is chosen.'}
              </p>
              {specLoading ? <p className="text-sm text-muted" role="status">Loading specification fields…</p> : null}
              {specLoadError ? <p className="text-sm font-medium text-danger" role="alert">{specLoadError}</p> : null}
              {droppedSpecKeys.length ? (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-900" role="status">
                  {droppedSpecKeys.length === 1
                    ? '1 previously entered specification does not apply here and will not be saved. Switch back to keep it.'
                    : `${droppedSpecKeys.length} previously entered specifications do not apply here and will not be saved. Switch back to keep them.`}
                </p>
              ) : null}
              {specSchema && !specLoading ? <DynamicSpecFields schema={specSchema} values={specValues} errors={specErrors} onChange={setSpec} /> : null}
            </fieldset>
          ) : null}

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

            {/* Pricing Structure Option: Fixed vs Volume Pricing */}
            <div className="mt-5 border-t border-navy-900/[0.06] pt-4">
              <p className="ts-label !mb-2">Pricing Structure</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setPricingModel('fixed')}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    pricingModel === 'fixed'
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="font-bold text-sm">Fixed Pricing (Single Price)</span>
                  <span className="text-xs text-muted mt-0.5">Same unit price for all purchase quantities. No volume tiers.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPricingModel('volume');
                  }}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    pricingModel === 'volume'
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="font-bold text-sm">Volume Pricing (Quantity Discounts)</span>
                  <span className="text-xs text-muted mt-0.5">Offer automatic bulk discounts for larger purchase quantities.</span>
                </button>
              </div>

              {pricingModel === 'volume' ? (
                <div className="space-y-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                  <p className="text-xs text-emerald-900 font-medium">
                    Configure quantity tiers below. TradeExpress automatically evaluates your tiers and activates the <strong>Volume Pricing</strong> badge only when genuine discounts are offered.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs font-bold text-slate-500">Tier 1 (Base MOQ)</p>
                      <p className="mt-1 text-sm font-bold text-navy-900">
                        {values.moq || 1}+ {values.unit || 'units'}
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700 font-semibold">
                        ₹{values.price || 0} / {values.unit || 'unit'}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                      <p className="text-xs font-bold text-slate-500">Tier 2 (Mid Volume)</p>
                      <Input
                        id="product-tier2-minQty"
                        label="Min Quantity"
                        type="number"
                        min={Number(values.moq || 1) + 1}
                        placeholder={String(Number(values.moq || 1) * 5)}
                        value={tier2MinQty}
                        onChange={(e) => setTier2MinQty(e.target.value)}
                      />
                      <Input
                        id="product-tier2-price"
                        label={`Price (₹ / ${values.unit || 'unit'})`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 920"
                        value={tier2Price}
                        onChange={(e) => setTier2Price(e.target.value)}
                      />
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                      <p className="text-xs font-bold text-slate-500">Tier 3 (Bulk Volume)</p>
                      <Input
                        id="product-tier3-minQty"
                        label="Min Quantity"
                        type="number"
                        min={Number(values.moq || 1) * 6}
                        placeholder={String(Number(values.moq || 1) * 20)}
                        value={tier3MinQty}
                        onChange={(e) => setTier3MinQty(e.target.value)}
                      />
                      <Input
                        id="product-tier3-price"
                        label={`Price (₹ / ${values.unit || 'unit'})`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 850"
                        value={tier3Price}
                        onChange={(e) => setTier3Price(e.target.value)}
                      />
                    </div>
                  </div>

                  {previewTiers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-slate-700 mb-1.5">Live Buyer Pricing Preview:</p>
                      <PriceTiers product={{ priceTiers: previewTiers, unit: values.unit }} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Fixed pricing is active. Products without quantity tiers display a clean single unit price with standard MOQ and stock.
                </p>
              )}
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
              <Textarea id="product-specifications" label="Additional specifications" rows={4} value={values.specifications} onChange={set('specifications')} hint="Optional extra details not covered above, one per line as “Label: value”." />
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


/**
 * Edit: the product comes from the server (only the owner gets it). Products that exist only in this browser's
 * sample catalogue are still editable as before.
 */
function EditProduct({ id, company }) {
  const { getProduct } = useProducts();
  const local = getProduct(id);
  const localOwned = local && local.companyId === company.id ? local : null;
  const [state, setState] = useState({ product: null, loading: !localOwned, error: '' });

  useEffect(() => {
    if (localOwned) return undefined;
    let cancelled = false;
    setState({ product: null, loading: true, error: '' });
    getMyProduct(id)
      .then((product) => { if (!cancelled) setState({ product, loading: false, error: '' }); })
      .catch((err) => { if (!cancelled) setState({ product: null, loading: false, error: err?.status === 404 || err?.status === 403 ? 'NOT_FOUND' : (err?.message || 'The product could not be loaded.') }); });
    return () => { cancelled = true; };
  }, [id, localOwned]);

  const product = localOwned || state.product;
  if (!localOwned && state.loading) return <div className="ts-card"><TableSkeleton rows={4} /></div>;
  if (!product) {
    return state.error && state.error !== 'NOT_FOUND'
      ? <div className="ts-card"><ErrorState text={state.error} /></div>
      : <div className="ts-card"><EmptyState icon={PackageX} headingLevel={1} title="Product not found" text="This product does not exist or belongs to another supplier." action={<Button to="/supplier/products" variant="navy">Back to products</Button>} /></div>;
  }
  return <Form key={product.id} company={company} product={product} />;
}

export default function SupplierProductForm() {
  const { id } = useParams();
  useDocumentTitle(id ? 'Edit product' : 'Add product');

  return (
    <SupplierGuard>
      {(company) => (id ? <EditProduct id={id} company={company} /> : <Form key="new" company={company} product={null} />)}
    </SupplierGuard>
  );
}
