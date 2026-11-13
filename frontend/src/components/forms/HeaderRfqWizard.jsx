import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  MapPin,
  Package,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Truck,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import Input, { Textarea } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import { TableSkeleton } from '../common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useInquiries from '../../hooks/useInquiries';
import useNotifications from '../../hooks/useNotifications';
import { COUNTRIES } from '../../utils/constants';
import { quantityLabel } from '../../utils/units';
import { apiGet, apiPost, isApiConfigured } from '../../services/apiClient';

const DRAFT_STORAGE_KEY = 'tradeexpress_rfq_draft';

const STEPS = [
  { id: 1, label: 'Enter RFQ Details', description: 'Company & requested products' },
  { id: 2, label: 'Supplier Selection', description: 'Specific, multiple, or auto-match' },
  { id: 3, label: 'RFQ Requirements', description: 'Quantities, specs & delivery' },
  { id: 4, label: 'Review & Submit', description: 'Verify & dispatch requests' },
];

const COMMON_UNITS = [
  'Pieces',
  'Boxes',
  'Cartons',
  'Sets',
  'Units',
  'Meters',
  'Kilograms',
  'Liters',
  'Pairs',
];

const DELIVERY_TIMELINES = [
  'Within 15 days',
  'Within 30 days',
  'Within 45 days',
  'Within 60 days',
  'Flexible / Open to Offers',
];

const PAYMENT_PREFERENCES = [
  '100% Escrow Protection (Recommended)',
  '30% Advance, 70% on Inspection',
  'Letter of Credit (LC)',
  'Net 30 Days',
  'Open Account / Direct Wire',
];

const QUALITY_OPTIONS = [
  'Standard Commercial Grade',
  'Premium Grade A',
  'ISO 9001 Certified',
  'CE / RoHS Certified',
  'BIS / ISI Certified',
  'Export Quality',
];

const PACKAGING_OPTIONS = [
  'Standard Manufacturer Packaging',
  'Individual Retail Box',
  'Bulk Master Carton',
  'Export Palletized & Shrink-Wrapped',
  'Custom OEM Branded Packaging',
];

const REGISTERED_TEST_SUPPLIERS = [
  {
    id: 'TS-CO-001',
    companyName: 'Shenzhen NovaTech Electronics',
    contactPerson: 'Lin Wei',
    industry: 'Consumer Electronics & Audio',
    location: 'Shenzhen, China',
    isVerified: true,
  },
  {
    id: 'TS-CO-003',
    companyName: 'Jaipur Craft & Home Exports',
    contactPerson: 'Meera Rathore',
    industry: 'Home Decor & Handicrafts',
    location: 'Jaipur, India',
    isVerified: true,
  },
  {
    id: 'TS-CO-004',
    companyName: 'Mumbai Industrial Solutions',
    contactPerson: 'Arjun Desai',
    industry: 'Industrial Machinery & Tools',
    location: 'Mumbai, India',
    isVerified: true,
  },
];

export default function HeaderRfqWizard({ initialProduct = null, onDone = null }) {
  const { user, preferences } = useAuth();
  const { companies } = useProducts();
  const { money } = useCurrency();
  const { submitInquiry } = useInquiries();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);

  // Registered Suppliers list for testing inside Company Name
  const allRegisteredSuppliers = useMemo(() => {
    if (companies && companies.length > 0) {
      return companies.map((c) => ({
        id: c.id,
        companyName: c.name,
        contactPerson: c.contactPerson || c.name,
        industry: c.industry || 'Wholesale Supplier',
        location: `${c.city || 'Mumbai'}, ${c.country || 'India'}`,
        isVerified: Boolean(c.isVerified ?? true),
      }));
    }
    return [
      ...REGISTERED_TEST_SUPPLIERS,
      {
        id: 'TS-CO-002',
        companyName: 'Pearl River Garments Co.',
        contactPerson: 'Chen Yu',
        industry: 'Fashion & Apparel',
        location: 'Guangzhou, China',
        isVerified: true,
      },
      {
        id: 'TS-CO-005',
        companyName: 'Seoul BeautySource Trading',
        contactPerson: 'Kim Ji-ho',
        industry: 'Beauty & Personal Care',
        location: 'Seoul, South Korea',
        isVerified: true,
      },
    ];
  }, [companies]);

  const prominentTestSuppliers = useMemo(() => {
    return allRegisteredSuppliers.slice(0, 3);
  }, [allRegisteredSuppliers]);

  // --- Step 1 State: Enter RFQ Details ---
  const [companyName, setCompanyName] = useState(
    user?.company || user?.companyName || ''
  );
  const [products, setProducts] = useState(
    initialProduct?.name
      ? [{ id: 1, name: initialProduct.name }]
      : [{ id: 1, name: '' }]
  );

  // --- Step 2 State: Supplier Selection ---
  const [supplierMode, setSupplierMode] = useState('multiple'); // 'specific' | 'multiple' | 'automatch'
  const [supplierSearch, setSupplierSearch] = useState('');
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // --- Step 3 State: RFQ Requirements ---
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  }, []);

  // Per-product purchasing requirements indexed by product ID
  const [productRequirements, setProductRequirements] = useState({});

  // Common RFQ Delivery & Requirements
  const [deliveryInfo, setDeliveryInfo] = useState({
    deliveryLocation: '',
    deliveryAddress: '',
    destinationCountry: preferences?.country || 'India',
    deliveryPincode: '',
    deliveryTime: 'Within 30 days',
    expectedDeliveryDate: defaultDate,
    paymentPreference: '100% Escrow Protection (Recommended)',
    additionalMessage: '',
    attachmentUrl: '',
    buyerName: user?.name || '',
    buyerEmail: user?.email || '',
  });

  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAgreement, setConfirmedAgreement] = useState(false);
  const [submittedRfq, setSubmittedRfq] = useState(null);

  // 1. Restore draft from sessionStorage if available (supports scenario 11: page refresh)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName && !user?.company) setCompanyName(parsed.companyName);
        if (Array.isArray(parsed.products) && parsed.products.length > 0 && !initialProduct) {
          setProducts(parsed.products);
        }
        if (parsed.supplierMode) setSupplierMode(parsed.supplierMode);
        if (Array.isArray(parsed.selectedSupplierIds) && parsed.selectedSupplierIds.length > 0) {
          setSelectedSupplierIds(parsed.selectedSupplierIds);
        }
        if (parsed.productRequirements && Object.keys(parsed.productRequirements).length > 0) {
          setProductRequirements(parsed.productRequirements);
        }
        if (parsed.deliveryInfo) {
          setDeliveryInfo((prev) => ({
            ...prev,
            ...parsed.deliveryInfo,
            buyerName: user?.name || parsed.deliveryInfo.buyerName || prev.buyerName,
            buyerEmail: user?.email || parsed.deliveryInfo.buyerEmail || prev.buyerEmail,
          }));
        }
      }
    } catch (err) {
      console.warn('Could not restore RFQ draft:', err);
    }
  }, [user, initialProduct]);

  // Sync logged in user details if not yet populated
  useEffect(() => {
    if (user) {
      if (!companyName && (user.company || user.companyName)) {
        setCompanyName(user.company || user.companyName);
      }
      setDeliveryInfo((prev) => ({
        ...prev,
        buyerName: prev.buyerName || user.name || '',
        buyerEmail: prev.buyerEmail || user.email || '',
      }));
    }
  }, [user, companyName]);

  // Persist draft to sessionStorage on state updates
  useEffect(() => {
    if (submittedRfq) return;
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          companyName,
          products,
          supplierMode,
          selectedSupplierIds,
          productRequirements,
          deliveryInfo,
        })
      );
    } catch {
      // Storage quota or privacy restriction
    }
  }, [companyName, products, supplierMode, selectedSupplierIds, productRequirements, deliveryInfo, submittedRfq]);

  // --- Step 1 Handlers ---
  const handleAddProduct = () => {
    const nextId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
    setProducts((prev) => [...prev, { id: nextId, name: '' }]);
  };

  const handleRemoveProduct = (idToRemove) => {
    if (products.length <= 1) return; // Keep at least one
    setProducts((prev) => prev.filter((p) => p.id !== idToRemove));
    setProductRequirements((prev) => {
      const copy = { ...prev };
      delete copy[idToRemove];
      return copy;
    });
  };

  const handleProductNameChange = (id, newName) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
    if (errors[`product_${id}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`product_${id}`];
        return next;
      });
    }
  };

  // --- Step 2: Supplier Loading & Auto-Match ---
  const loadSuppliers = useCallback(
    async (queryText = '', mode = supplierMode) => {
      setLoadingSuppliers(true);
      try {
        let loaded = [];
        if (isApiConfigured) {
          const queryParams = new URLSearchParams();
          if (queryText.trim()) queryParams.set('search', queryText.trim());

          const productNamesList = products.map((p) => p.name.trim()).filter(Boolean);
          if (productNamesList.length > 0) {
            queryParams.set('productNames', JSON.stringify(productNamesList));
          }

          const res = await apiGet(`rfq/matching-suppliers?${queryParams.toString()}`);
          if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
            loaded = res.data;
          }
        }

        // Exclude the buyer's own ID so they cannot select themselves as supplier
        if (user?.id) {
          loaded = loaded.filter((s) => s.id !== user.id && s.supplierId !== user.id);
        }

        // Fallback to local companies if backend is unreachable / empty
        if (loaded.length === 0 && companies && companies.length > 0) {
          loaded = companies
            .filter((c) => !user?.id || c.id !== user.id)
            .map((c) => ({
              id: c.id,
              supplierId: c.id,
              companyName: c.name,
              name: c.contactPerson || c.name,
              email: c.email,
              phone: c.phone,
              isVerified: Boolean(c.isVerified),
              location: `${c.city || 'Mumbai'}, ${c.country || 'India'}`,
              city: c.city || 'Mumbai',
              country: c.country || 'India',
              rating: c.rating || 0,
              reviewCount: c.reviewCount || 0,
              moq: 100,
              price: null,
            }));
        }

        setAvailableSuppliers(loaded);

        // Pre-select suppliers based on mode
        if (mode === 'automatch') {
          const matched = loaded.filter((s) => s.isProductMatch || s.isVerified);
          const chosen = (matched.length > 0 ? matched : loaded).slice(0, 3).map((s) => s.id);
          setSelectedSupplierIds(chosen);
        } else if (mode === 'specific') {
          if (selectedSupplierIds.length > 1) {
            setSelectedSupplierIds(selectedSupplierIds.slice(0, 1));
          } else if (selectedSupplierIds.length === 0 && loaded.length > 0) {
            setSelectedSupplierIds([loaded[0].id]);
          }
        } else if (mode === 'multiple' && selectedSupplierIds.length === 0 && loaded.length > 0) {
          setSelectedSupplierIds([loaded[0].id]);
        }
      } catch (err) {
        console.warn('Failed to load matching suppliers:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    },
    [products, user?.id, companies, supplierMode, selectedSupplierIds]
  );

  // Trigger supplier load when entering Step 2
  useEffect(() => {
    if (currentStep === 2) {
      loadSuppliers(supplierSearch, supplierMode);
    }
  }, [currentStep, supplierMode]);

  const handleSupplierModeChange = (mode) => {
    setSupplierMode(mode);
    if (mode === 'automatch') {
      const matched = availableSuppliers.filter((s) => s.isProductMatch || s.isVerified);
      const chosen = (matched.length > 0 ? matched : availableSuppliers).slice(0, 3).map((s) => s.id);
      setSelectedSupplierIds(chosen);
      showToast(
        `Auto-matched ${chosen.length} verified supplier(s) based on your requested products.`,
        'info'
      );
    } else if (mode === 'specific') {
      if (selectedSupplierIds.length > 1) {
        setSelectedSupplierIds(selectedSupplierIds.slice(0, 1));
      } else if (selectedSupplierIds.length === 0 && availableSuppliers.length > 0) {
        setSelectedSupplierIds([availableSuppliers[0].id]);
      }
    }
  };

  const toggleSupplier = (supplierId) => {
    if (supplierMode === 'specific') {
      setSelectedSupplierIds([supplierId]);
    } else {
      setSelectedSupplierIds((prev) =>
        prev.includes(supplierId)
          ? prev.filter((id) => id !== supplierId)
          : [...prev, supplierId]
      );
    }
    if (errors.suppliers) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.suppliers;
        return next;
      });
    }
  };

  const selectAllSuppliers = () => {
    setSelectedSupplierIds(availableSuppliers.map((s) => s.id));
  };

  const clearSupplierSelection = () => {
    setSelectedSupplierIds([]);
  };

  // --- Step 3 Handlers ---
  const updateProductReq = (prodId, field, value) => {
    setProductRequirements((prev) => ({
      ...prev,
      [prodId]: {
        ...(prev[prodId] || {
          quantity: '100',
          unit: 'Pieces',
          targetPrice: '',
          specifications: '',
          preferredBrand: '',
          qualityRequirements: '',
          packagingRequirements: '',
        }),
        [field]: value,
      },
    }));
    const errKey = `p_${prodId}_${field}`;
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiPost('upload', formData);
      const url = res?.data?.url || res?.data?.file?.path || res?.url;
      if (url) {
        setDeliveryInfo((p) => ({ ...p, attachmentUrl: url }));
        showToast('Attachment uploaded successfully!', 'success');
      } else {
        setDeliveryInfo((p) => ({ ...p, attachmentUrl: file.name }));
        showToast('File selected: ' + file.name, 'info');
      }
    } catch {
      setDeliveryInfo((p) => ({ ...p, attachmentUrl: file.name }));
      showToast('File noted: ' + file.name, 'info');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // --- Validation ---
  const validateStep = (stepNumber) => {
    const errs = {};

    if (stepNumber === 1) {
      if (!companyName.trim()) {
        errs.companyName = 'Company name is required.';
      }
      let hasValidProduct = false;
      products.forEach((p) => {
        if (!p.name.trim()) {
          errs[`product_${p.id}`] = 'Please enter a product name.';
        } else {
          hasValidProduct = true;
        }
      });
      if (products.length === 0 || !hasValidProduct) {
        errs.generalProduct = 'Please specify at least one product you need.';
      }
    } else if (stepNumber === 2) {
      if (selectedSupplierIds.length === 0) {
        errs.suppliers = 'Please select at least one supplier to send this RFQ to.';
      }
    } else if (stepNumber === 3) {
      // Validate every product's individual requirements
      products.forEach((p) => {
        const req = productRequirements[p.id] || {};
        const qNum = Number(req.quantity);
        if (!req.quantity || isNaN(qNum) || qNum < 1) {
          errs[`p_${p.id}_quantity`] = `Valid quantity required for ${p.name || 'product'}.`;
        }
        if (!req.unit || !req.unit.trim()) {
          errs[`p_${p.id}_unit`] = `Unit required for ${p.name || 'product'}.`;
        }
        if (!req.specifications || req.specifications.trim().length < 5) {
          errs[`p_${p.id}_specifications`] = `Specifications required for ${p.name || 'product'} (min 5 chars).`;
        }
      });

      // Validate delivery and buyer fields
      if (!deliveryInfo.deliveryLocation.trim()) {
        errs.deliveryLocation = 'Delivery location (City / State) is required.';
      }
      if (!deliveryInfo.buyerName.trim()) {
        errs.buyerName = 'Your name is required.';
      }
      if (!deliveryInfo.buyerEmail.trim() || !/\S+@\S+\.\S+/.test(deliveryInfo.buyerEmail)) {
        errs.buyerEmail = 'Valid email address is required.';
      }
      if (
        deliveryInfo.destinationCountry === 'India' &&
        deliveryInfo.deliveryPincode &&
        !/^\d{6}$/.test(deliveryInfo.deliveryPincode.trim())
      ) {
        errs.deliveryPincode = 'Valid 6-digit Indian PIN code required.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(4, prev + 1));
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // --- Step 4 Final Submission ---
  const handleFinalSubmit = async () => {
    if (submitting) return;

    if (!confirmedAgreement) {
      showToast('Please check the confirmation box to submit your RFQ.', 'warning');
      return;
    }

    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep(2)) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep(3)) {
      setCurrentStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const compiledProducts = products.map((prod) => {
        const req = productRequirements[prod.id] || {};
        return {
          productId: null,
          name: prod.name.trim(),
          productName: prod.name.trim(),
          quantity: Number(req.quantity) || 100,
          unit: req.unit || 'Pieces',
          targetPrice: req.targetPrice ? Number(req.targetPrice) : null,
          specifications: req.specifications?.trim() || 'Standard wholesale inquiry.',
          preferredBrand: req.preferredBrand?.trim() || null,
          qualityRequirements: req.qualityRequirements || null,
          packagingRequirements: req.packagingRequirements || null,
        };
      });

      const targetSuppliers = availableSuppliers
        .filter((s) => selectedSupplierIds.includes(s.id))
        .map((s) => ({
          id: s.id,
          name: s.companyName || s.name,
          company: s.companyName || s.name,
          isVerified: Boolean(s.isVerified),
          location: s.location || `${s.city || 'Mumbai'}, ${s.country || 'India'}`,
        }));

      const totalQty = compiledProducts.reduce((sum, p) => sum + p.quantity, 0);
      const combinedTitle =
        compiledProducts.length === 1
          ? `RFQ for ${compiledProducts[0].name}`
          : `RFQ for ${compiledProducts.map((p) => p.name).join(', ')}`;

      const record = await submitInquiry(
        {
          title: combinedTitle,
          companyName: companyName.trim(),
          buyerCompany: companyName.trim(),
          quantity: totalQty,
          unit: compiledProducts[0]?.unit || 'Pieces',
          targetPrice: compiledProducts[0]?.targetPrice || null,
          specifications: compiledProducts
            .map((p, idx) => `Product ${idx + 1} (${p.name}): ${p.specifications}`)
            .join('\n'),
          destinationCountry: deliveryInfo.destinationCountry || 'India',
          deliveryLocation: deliveryInfo.deliveryLocation.trim(),
          deliveryAddress: deliveryInfo.deliveryAddress.trim(),
          deliveryPincode: deliveryInfo.deliveryPincode.trim(),
          deliveryTime: deliveryInfo.deliveryTime || 'Within 30 days',
          expectedDeliveryDate: deliveryInfo.expectedDeliveryDate,
          paymentPreference: deliveryInfo.paymentPreference,
          message: deliveryInfo.additionalMessage.trim(),
          attachmentUrl: deliveryInfo.attachmentUrl || null,
          buyerName: deliveryInfo.buyerName.trim(),
          buyerEmail: deliveryInfo.buyerEmail.trim(),
          requiredByDate: deliveryInfo.expectedDeliveryDate,
          products: compiledProducts,
        },
        {
          companyName: companyName.trim(),
          buyerCompany: companyName.trim(),
          targetSupplierIds: selectedSupplierIds,
          targetSuppliers,
          supplierSelectionMethod: supplierMode,
          deliveryLocation: deliveryInfo.deliveryLocation.trim(),
          deliveryAddress: deliveryInfo.deliveryAddress.trim(),
          deliveryPincode: deliveryInfo.deliveryPincode.trim(),
          expectedDeliveryDate: deliveryInfo.expectedDeliveryDate,
          paymentPreference: deliveryInfo.paymentPreference,
          products: compiledProducts,
          source: 'header_rfq',
          buyer: user,
        }
      );

      // Clear draft upon successful submission
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      setSubmittedRfq(record);
      showToast(
        `RFQ ${record.rfqNumber || record.id} dispatched successfully to ${selectedSupplierIds.length} supplier(s)!`,
        'success'
      );
      onDone?.(record);
    } catch (err) {
      showToast(err?.message || 'Failed to submit RFQ. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Success Screen ---
  if (submittedRfq) {
    const targeted = availableSuppliers.filter((s) => selectedSupplierIds.includes(s.id));
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 text-center shadow-xs">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-navy-900">
          RFQ Dispatched to Selected Suppliers!
        </h3>
        <p className="mt-1 text-sm text-muted">
          Your unique RFQ reference number is{' '}
          <span className="font-mono font-bold text-navy-900">
            {submittedRfq.rfqNumber || submittedRfq.id}
          </span>
        </p>

        <div className="mx-auto mt-6 max-w-xl rounded-xl bg-slate-50 p-5 text-left text-sm space-y-3 border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-muted">Company:</span>
            <span className="font-semibold text-navy-900">{companyName}</span>
          </div>

          <div className="border-b border-slate-200 pb-2">
            <span className="text-muted block mb-1">
              Requested Products ({products.length}):
            </span>
            <ul className="space-y-1">
              {products.map((p, idx) => {
                const req = productRequirements[p.id] || {};
                return (
                  <li key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-navy-900">
                      {idx + 1}. {p.name}
                    </span>
                    <span className="text-slate-600">
                      {quantityLabel(req.quantity || 100, req.unit || 'Pieces')}
                      {req.targetPrice ? ` @ ₹${req.targetPrice}/${req.unit || 'Piece'}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-b border-slate-200 pb-2">
            <span className="text-muted block mb-1.5">
              Assigned Suppliers ({targeted.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {targeted.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-semibold text-navy-900 ring-1 ring-slate-200"
                >
                  <Building2 className="size-3 text-brand-600" />
                  {s.companyName || s.name}
                  {s.isVerified && (
                    <ShieldCheck className="size-3 text-emerald-600" />
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-muted">Delivery Destination:</span>
            <span className="font-semibold text-navy-900">
              {deliveryInfo.deliveryLocation}
              {deliveryInfo.deliveryPincode ? ` (${deliveryInfo.deliveryPincode})` : ''}
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted max-w-md mx-auto">
          Each selected supplier will independently submit their quotation. You can compare quotations side-by-side and negotiate up to 3 rounds in your Buyer Dashboard.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" to="/buyer/quotes">
            View in Buyer Dashboard
          </Button>
          <Button variant="outline" to="/products">
            Browse Marketplace
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSubmittedRfq(null);
              setCurrentStep(1);
              setConfirmedAgreement(false);
              setProducts([{ id: 1, name: '' }]);
              setSelectedSupplierIds([]);
              setProductRequirements({});
            }}
          >
            Create Another RFQ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Step Stepper Header */}
      <nav aria-label="RFQ Progress" className="overflow-x-auto pb-2">
        <ol className="flex min-w-[620px] items-center justify-between gap-2 border-b border-slate-200 pb-4">
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <li
                key={step.id}
                className={`flex items-center gap-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                  isCurrent
                    ? 'text-brand-600'
                    : isCompleted
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="size-4" /> : step.id}
                </span>
                <div className="leading-tight">
                  <p className="font-bold">{step.label}</p>
                  <p className="hidden sm:block text-[0.6875rem] font-normal text-muted">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ================= STEP 1: ENTER RFQ DETAILS ================= */}
      {currentStep === 1 && (
        <section aria-labelledby="step1-heading" className="space-y-6">
          <div>
            <h3 id="step1-heading" className="text-lg font-bold text-navy-900">
              Step 1: Enter RFQ Details
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              Enter your company name and list all the products you need quotations for.
            </p>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            {/* Field 1: Company Name (Side-by-side with Registered Suppliers for testing) */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-navy-900">
                  Company Name *
                </label>
                <p className="text-xs text-muted">
                  Type your company name manually, or pick any registered supplier below for quick testing. Both methods work together.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
                {/* Left Column: Manual Input Field */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="rfq-company-name" className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-brand-600" />
                      <span>Input Field (Type Manually)</span>
                    </label>
                    {companyName && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      id="rfq-company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (errors.companyName) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.companyName;
                            return next;
                          });
                        }
                      }}
                      placeholder="Enter company name (e.g. ABC Trading Pvt. Ltd.)"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 focus:outline-hidden"
                    />
                  </div>

                  {errors.companyName && (
                    <p className="text-xs font-semibold text-red-600">{errors.companyName}</p>
                  )}

                  <p className="text-[11px] text-muted">
                    You can type any custom company name here or click one of the registered suppliers on the right.
                  </p>
                </div>

                {/* Right Column: Registered Suppliers in Customized Format (2-3 for testing) */}
                <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-brand-600" />
                      <span className="text-xs font-bold text-navy-900">
                        Registered Suppliers (Click to Fill)
                      </span>
                    </div>
                    <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                      Test Data
                    </span>
                  </div>

                  {/* 2-3 Prominent Registered Suppliers in customized cards */}
                  <div className="space-y-2">
                    {prominentTestSuppliers.map((sup) => {
                      const isSelected = companyName === sup.companyName;
                      return (
                        <button
                          key={sup.id}
                          type="button"
                          onClick={() => {
                            setCompanyName(sup.companyName);
                            if (errors.companyName) {
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.companyName;
                                return next;
                              });
                            }
                          }}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-all ${
                            isSelected
                              ? 'border-brand-600 bg-white shadow-xs ring-2 ring-brand-500'
                              : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                isSelected
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-slate-100 text-navy-800 border border-slate-200'
                              }`}
                            >
                              <Building2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-navy-900 text-xs truncate">
                                  {sup.companyName}
                                </p>
                                {sup.isVerified && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1 rounded">
                                    <ShieldCheck className="size-3 text-emerald-600" /> Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted truncate">
                                {sup.industry} · {sup.location}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                              isSelected
                                ? 'bg-brand-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-brand-100 hover:text-brand-800'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dropdown for any additional registered suppliers */}
                  {allRegisteredSuppliers.length > 3 && (
                    <div className="pt-1">
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Or choose other registered suppliers:
                      </label>
                      <select
                        value={prominentTestSuppliers.some((s) => s.companyName === companyName) ? '' : companyName}
                        onChange={(e) => {
                          if (e.target.value) {
                            setCompanyName(e.target.value);
                            if (errors.companyName) {
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.companyName;
                                return next;
                              });
                            }
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
                      >
                        <option value="">More registered suppliers ({allRegisteredSuppliers.length - 3})...</option>
                        {allRegisteredSuppliers.slice(3).map((sup) => (
                          <option key={sup.id} value={sup.companyName}>
                            {sup.companyName} ({sup.location})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Field 2: Products You Need */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-bold text-navy-900">
                    Products You Need *
                  </label>
                  <p className="text-xs text-muted">
                    List one or multiple products you wish to procure in this quotation request.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddProduct}
                >
                  Add Another Product
                </Button>
              </div>

              {errors.generalProduct && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {errors.generalProduct}
                </div>
              )}

              <div className="space-y-3">
                {products.map((prod, index) => {
                  const errorMsg = errors[`product_${prod.id}`];
                  return (
                    <div
                      key={prod.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 transition-all focus-within:border-brand-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-brand-500"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-navy-800 ring-1 ring-slate-200">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={prod.name}
                          onChange={(e) => handleProductNameChange(prod.id, e.target.value)}
                          placeholder="Enter product name (e.g. Wireless Headphones, Bluetooth Speakers...)"
                          className="w-full bg-transparent px-2 py-1 text-sm font-medium text-navy-900 placeholder:text-slate-400 focus:outline-hidden"
                        />
                        {errorMsg && (
                          <p className="px-2 pt-1 text-xs font-semibold text-red-600">
                            {errorMsg}
                          </p>
                        )}
                      </div>
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(prod.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove product"
                          aria-label={`Remove product ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <Plus className="size-3.5" />
                  Add Another Product
                </button>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted text-[11px] font-semibold">Test Products:</span>
                  {['Wireless Headphones', 'Bluetooth Speakers', 'Smart Fitness Watch'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setProducts((prev) => {
                          if (prev.length === 1 && !prev[0].name.trim()) {
                            return [{ id: prev[0].id, name: sample }];
                          }
                          if (prev.some((p) => p.name.toLowerCase() === sample.toLowerCase())) return prev;
                          const nextId = Math.max(...prev.map((p) => p.id)) + 1;
                          return [...prev, { id: nextId, name: sample }];
                        });
                      }}
                      className="rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 px-2 py-0.5 text-slate-700 text-[11px] font-medium transition-colors"
                    >
                      + {sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-end pt-3">
            <Button variant="primary" icon={ArrowRight} onClick={goNext}>
              Next: Supplier Selection
            </Button>
          </div>
        </section>
      )}

      {/* ================= STEP 2: SUPPLIER SELECTION ================= */}
      {currentStep === 2 && (
        <section aria-labelledby="step2-heading" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="step2-heading" className="text-lg font-bold text-navy-900">
                Step 2: Choose Relevant Suppliers
              </h3>
              <p className="text-xs sm:text-sm text-muted">
                Select specific suppliers, choose multiple partners, or auto-match verified manufacturers.
              </p>
            </div>

            {/* Selection Mode Switcher */}
            <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleSupplierModeChange('specific')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  supplierMode === 'specific'
                    ? 'bg-white text-navy-900 shadow-xs'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                1. Specific Supplier
              </button>
              <button
                type="button"
                onClick={() => handleSupplierModeChange('multiple')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  supplierMode === 'multiple'
                    ? 'bg-white text-navy-900 shadow-xs'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                2. Multiple Suppliers
              </button>
              <button
                type="button"
                onClick={() => handleSupplierModeChange('automatch')}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all ${
                  supplierMode === 'automatch'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-navy-900'
                }`}
              >
                <Sparkles className="size-3" />
                3. Auto-Match
              </button>
            </div>
          </div>

          {errors.suppliers && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              {errors.suppliers}
            </div>
          )}

          {/* Supplier Search Bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
            <input
              type="text"
              value={supplierSearch}
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                loadSuppliers(e.target.value, supplierMode);
              }}
              placeholder="Search registered suppliers by company name, city, or specialty..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 focus:border-brand-600 focus:outline-hidden"
            />
          </div>

          {/* Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs">
            <span className="font-semibold text-navy-900">
              {selectedSupplierIds.length} of {availableSuppliers.length} supplier(s) selected
            </span>
            {supplierMode !== 'specific' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSuppliers}
                  className="font-semibold text-brand-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={clearSupplierSelection}
                  className="font-semibold text-slate-600 hover:underline"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {/* Suppliers Grid */}
          {loadingSuppliers ? (
            <TableSkeleton rows={4} />
          ) : availableSuppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <Users className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-navy-900">No matching suppliers found</p>
              <p className="text-xs text-muted">
                Try adjusting your search query or clear the filter to view all verified suppliers.
              </p>
              {supplierSearch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSupplierSearch('');
                    loadSuppliers('', supplierMode);
                  }}
                  className="mt-3"
                >
                  Show All Suppliers
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {availableSuppliers.map((supplier) => {
                const isSelected = selectedSupplierIds.includes(supplier.id);

                return (
                  <div
                    key={supplier.id}
                    onClick={() => toggleSupplier(supplier.id)}
                    className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/40 shadow-xs ring-1 ring-brand-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type={supplierMode === 'specific' ? 'radio' : 'checkbox'}
                      name="selectedSupplier"
                      checked={isSelected}
                      onChange={() => toggleSupplier(supplier.id)}
                      className="mt-1 size-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="truncate text-sm font-bold text-navy-900">
                          {supplier.companyName || supplier.name}
                        </h4>
                        {supplier.isVerified && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-emerald-800">
                            <ShieldCheck className="size-3" /> Verified
                          </span>
                        )}
                        {supplier.isProductMatch && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-brand-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-brand-800">
                            <Sparkles className="size-3" /> Catalog Match
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 text-slate-400" />
                          {supplier.location || `${supplier.city || 'Mumbai'}, ${supplier.country || 'India'}`}
                        </span>
                        {Number(supplier.rating) > 0 && Number(supplier.reviewCount) > 0 ? (
                          <span className="flex items-center gap-1 font-semibold text-amber-600">
                            <Star className="size-3 fill-amber-500 text-amber-500" />
                            {Number(supplier.rating).toFixed(1)} ({Number(supplier.reviewCount)})
                          </span>
                        ) : null}
                      </div>

                      {supplier.productName && (
                        <p className="mt-2 text-xs font-semibold text-navy-800 truncate">
                          Matched Listing: {supplier.productName}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted">
            TradeExpress Rule: Each selected supplier receives an independent RFQ assignment. No RFQs are sent to suppliers without your explicit selection and confirmation.
          </p>

          {/* Navigation */}
          <div className="flex justify-between pt-3">
            <Button variant="outline" icon={ArrowLeft} onClick={goBack}>
              Back
            </Button>
            <Button
              variant="primary"
              icon={ArrowRight}
              onClick={goNext}
              disabled={selectedSupplierIds.length === 0}
            >
              Next: RFQ Requirements
            </Button>
          </div>
        </section>
      )}

      {/* ================= STEP 3: RFQ REQUIREMENTS ================= */}
      {currentStep === 3 && (
        <section aria-labelledby="step3-heading" className="space-y-6">
          <div>
            <h3 id="step3-heading" className="text-lg font-bold text-navy-900">
              Step 3: Define Purchasing Requirements
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              Specify quantities, technical specifications, and quality requirements for each requested product.
            </p>
          </div>

          {/* Render a distinct requirements card for EVERY product from Step 1 */}
          <div className="space-y-6">
            {products.map((prod, index) => {
              const req = productRequirements[prod.id] || {
                quantity: '100',
                unit: 'Pieces',
                targetPrice: '',
                specifications: '',
                preferredBrand: '',
                qualityRequirements: '',
                packagingRequirements: '',
              };

              const qtyErr = errors[`p_${prod.id}_quantity`];
              const unitErr = errors[`p_${prod.id}_unit`];
              const specsErr = errors[`p_${prod.id}_specifications`];

              return (
                <div
                  key={prod.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <h4 className="text-base font-bold text-navy-900">
                        Product: {prod.name || `Product ${index + 1}`}
                      </h4>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      INR (₹)
                    </span>
                  </div>

                  {/* Quantity, Unit, Target Price */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Input
                      id={`req-qty-${prod.id}`}
                      label="Required Quantity"
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 500"
                      value={req.quantity}
                      onChange={(e) => updateProductReq(prod.id, 'quantity', e.target.value)}
                      error={qtyErr}
                    />

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-navy-800">
                        Unit of Measurement *
                      </label>
                      <select
                        value={req.unit}
                        onChange={(e) => updateProductReq(prod.id, 'unit', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-brand-600 focus:outline-hidden"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      {unitErr && (
                        <p className="mt-1 text-xs font-semibold text-red-600">{unitErr}</p>
                      )}
                    </div>

                    <Input
                      id={`req-price-${prod.id}`}
                      label={`Target Unit Price (₹ / ${req.unit || 'unit'}) - Optional`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 450"
                      value={req.targetPrice}
                      onChange={(e) => updateProductReq(prod.id, 'targetPrice', e.target.value)}
                    />
                  </div>

                  {/* Specifications */}
                  <Textarea
                    id={`req-specs-${prod.id}`}
                    label="Product Specifications & Technical Parameters"
                    rows={3}
                    required
                    placeholder="Specify dimensions, material grade, color, performance standards, power rating, certifications..."
                    value={req.specifications}
                    onChange={(e) => updateProductReq(prod.id, 'specifications', e.target.value)}
                    error={specsErr}
                  />

                  {/* Preferred Brand, Quality, Packaging */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-1">
                    <Input
                      id={`req-brand-${prod.id}`}
                      label="Preferred Brand (Optional)"
                      placeholder="e.g. OEM / Original / Any"
                      value={req.preferredBrand}
                      onChange={(e) => updateProductReq(prod.id, 'preferredBrand', e.target.value)}
                    />

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-navy-800">
                        Quality Requirements (Optional)
                      </label>
                      <select
                        value={req.qualityRequirements}
                        onChange={(e) => updateProductReq(prod.id, 'qualityRequirements', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
                      >
                        <option value="">Select or Standard</option>
                        {QUALITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-navy-800">
                        Packaging Requirements (Optional)
                      </label>
                      <select
                        value={req.packagingRequirements}
                        onChange={(e) => updateProductReq(prod.id, 'packagingRequirements', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
                      >
                        <option value="">Select or Standard</option>
                        {PACKAGING_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Common Delivery and Buyer Information */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 space-y-4">
            <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Common Delivery & Logistics Requirements
            </h4>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                id="del-location"
                label="Delivery Location (City / State)"
                required
                placeholder="e.g. Mumbai, Maharashtra"
                value={deliveryInfo.deliveryLocation}
                onChange={(e) => {
                  setDeliveryInfo((p) => ({ ...p, deliveryLocation: e.target.value }));
                  if (errors.deliveryLocation) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.deliveryLocation;
                      return next;
                    });
                  }
                }}
                error={errors.deliveryLocation}
              />

              <Input
                id="del-address"
                label="Delivery Address / Facility"
                placeholder="e.g. Warehouse 4B, MIDC Industrial Area"
                value={deliveryInfo.deliveryAddress}
                onChange={(e) => setDeliveryInfo((p) => ({ ...p, deliveryAddress: e.target.value }))}
              />

              <Input
                id="del-pincode"
                label="PIN / Postal Code"
                placeholder="e.g. 400093"
                value={deliveryInfo.deliveryPincode}
                maxLength={10}
                onChange={(e) => {
                  setDeliveryInfo((p) => ({ ...p, deliveryPincode: e.target.value }));
                  if (errors.deliveryPincode) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.deliveryPincode;
                      return next;
                    });
                  }
                }}
                error={errors.deliveryPincode}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                id="del-date"
                label="Expected Delivery Date"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={deliveryInfo.expectedDeliveryDate}
                onChange={(e) => setDeliveryInfo((p) => ({ ...p, expectedDeliveryDate: e.target.value }))}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-navy-800">
                  Delivery Timeline
                </label>
                <select
                  value={deliveryInfo.deliveryTime}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, deliveryTime: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
                >
                  {DELIVERY_TIMELINES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-navy-800">
                  Payment Preference
                </label>
                <select
                  value={deliveryInfo.paymentPreference}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, paymentPreference: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
                >
                  {PAYMENT_PREFERENCES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Additional Message and File Upload */}
            <Textarea
              id="del-msg"
              label="Additional Requirements / Buyer Message (Optional)"
              rows={2}
              placeholder="Provide any additional shipping instructions, sample requests, or terms..."
              value={deliveryInfo.additionalMessage}
              onChange={(e) => setDeliveryInfo((p) => ({ ...p, additionalMessage: e.target.value }))}
            />

            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-800">
                Supporting Drawings / Specification Attachment (Optional)
              </label>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-navy-800 hover:bg-slate-100">
                  <UploadCloud className="size-4 text-brand-600" />
                  <span>{uploadingAttachment ? 'Uploading...' : 'Upload File'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingAttachment}
                  />
                </label>
                <input
                  type="text"
                  placeholder="or paste drawing / document URL"
                  value={deliveryInfo.attachmentUrl}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, attachmentUrl: e.target.value }))}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 focus:border-brand-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Buyer Contact Details */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200">
              <Input
                id="req-buyer-name"
                label="Contact Person Name"
                required
                value={deliveryInfo.buyerName}
                onChange={(e) => {
                  setDeliveryInfo((p) => ({ ...p, buyerName: e.target.value }));
                  if (errors.buyerName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.buyerName;
                      return next;
                    });
                  }
                }}
                error={errors.buyerName}
              />
              <Input
                id="req-buyer-email"
                label="Business Email"
                type="email"
                required
                value={deliveryInfo.buyerEmail}
                onChange={(e) => {
                  setDeliveryInfo((p) => ({ ...p, buyerEmail: e.target.value }));
                  if (errors.buyerEmail) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.buyerEmail;
                      return next;
                    });
                  }
                }}
                error={errors.buyerEmail}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-3">
            <Button variant="outline" icon={ArrowLeft} onClick={goBack}>
              Back
            </Button>
            <Button variant="primary" icon={ArrowRight} onClick={goNext}>
              Next: Review & Submit
            </Button>
          </div>
        </section>
      )}

      {/* ================= STEP 4: REVIEW & SUBMIT ================= */}
      {currentStep === 4 && (
        <section aria-labelledby="step4-heading" className="space-y-6">
          <div>
            <h3 id="step4-heading" className="text-lg font-bold text-navy-900">
              Step 4: Review and Submit RFQ
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              Verify company details, requested products, selected suppliers, and delivery logistics before dispatch.
            </p>
          </div>

          <div className="space-y-5">
            {/* Section 1: Company Information */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-brand-600" />
                  <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                    Section 1: Company Information
                  </h4>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  icon={Edit2}
                  onClick={() => setCurrentStep(1)}
                >
                  Edit
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div>
                  <span className="text-muted block">Company Name:</span>
                  <span className="font-bold text-navy-900 text-sm">{companyName}</span>
                </div>
                <div>
                  <span className="text-muted block">Contact Person:</span>
                  <span className="font-semibold text-navy-900">{deliveryInfo.buyerName}</span>
                </div>
                <div>
                  <span className="text-muted block">Business Email:</span>
                  <span className="font-semibold text-navy-900">{deliveryInfo.buyerEmail}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Requested Products */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-brand-600" />
                  <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                    Section 2: Requested Products ({products.length})
                  </h4>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  icon={Edit2}
                  onClick={() => setCurrentStep(3)}
                >
                  Edit
                </Button>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {products.map((prod, idx) => {
                  const req = productRequirements[prod.id] || {};
                  return (
                    <div key={prod.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-navy-900 text-sm">
                          {idx + 1}. {prod.name}
                        </span>
                        <span className="rounded bg-brand-50 px-2 py-0.5 font-bold text-brand-700">
                          {quantityLabel(req.quantity || 100, req.unit || 'Pieces')}
                          {req.targetPrice ? ` · Target: ₹${req.targetPrice}/${req.unit || 'Piece'}` : ''}
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line">
                        <strong className="text-navy-900">Specs:</strong> {req.specifications || 'Standard wholesale inquiry.'}
                      </p>
                      {(req.preferredBrand || req.qualityRequirements || req.packagingRequirements) && (
                        <div className="flex flex-wrap gap-2 pt-1 text-[0.6875rem] text-slate-600">
                          {req.preferredBrand && (
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Brand: <strong>{req.preferredBrand}</strong>
                            </span>
                          )}
                          {req.qualityRequirements && (
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Quality: <strong>{req.qualityRequirements}</strong>
                            </span>
                          )}
                          {req.packagingRequirements && (
                            <span className="rounded bg-slate-100 px-2 py-0.5">
                              Packaging: <strong>{req.packagingRequirements}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Selected Suppliers */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-brand-600" />
                  <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                    Section 3: Selected Suppliers ({selectedSupplierIds.length})
                  </h4>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  icon={Edit2}
                  onClick={() => setCurrentStep(2)}
                >
                  Edit
                </Button>
              </div>

              <div className="mt-3">
                <p className="text-xs text-muted mb-2">
                  Selection Method:{' '}
                  <span className="font-semibold text-navy-900 uppercase">
                    {supplierMode === 'automatch'
                      ? 'Auto-Matched Suppliers'
                      : supplierMode === 'specific'
                      ? 'Specific Supplier'
                      : 'Multiple Selected Suppliers'}
                  </span>
                </p>

                <div className="flex flex-wrap gap-2">
                  {availableSuppliers
                    .filter((s) => selectedSupplierIds.includes(s.id))
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                      >
                        <Building2 className="size-3.5 text-brand-600 shrink-0" />
                        <span className="font-semibold text-navy-900">{s.companyName || s.name}</span>
                        {s.isVerified && (
                          <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span className="text-muted">({s.location || s.city || 'India'})</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Section 4: Delivery & Additional Requirements */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-brand-600" />
                  <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                    Section 4: Delivery & Additional Requirements
                  </h4>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  icon={Edit2}
                  onClick={() => setCurrentStep(3)}
                >
                  Edit
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-muted block">Delivery Destination:</span>
                  <span className="font-medium text-navy-900">
                    {deliveryInfo.deliveryLocation}{' '}
                    {deliveryInfo.deliveryPincode ? `(${deliveryInfo.deliveryPincode})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Delivery Address:</span>
                  <span className="font-medium text-navy-900">
                    {deliveryInfo.deliveryAddress || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Expected Delivery Date:</span>
                  <span className="font-medium text-navy-900">
                    {deliveryInfo.expectedDeliveryDate || 'Flexible'} ({deliveryInfo.deliveryTime})
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Payment Preference:</span>
                  <span className="font-medium text-navy-900">{deliveryInfo.paymentPreference}</span>
                </div>
                {deliveryInfo.additionalMessage && (
                  <div className="sm:col-span-2">
                    <span className="text-muted block">Additional Message:</span>
                    <span className="font-medium text-navy-900">{deliveryInfo.additionalMessage}</span>
                  </div>
                )}
                {deliveryInfo.attachmentUrl && (
                  <div className="sm:col-span-2">
                    <span className="text-muted block">Attachment:</span>
                    <span className="font-mono text-brand-700">{deliveryInfo.attachmentUrl}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4 cursor-pointer hover:bg-brand-50/70 transition-colors">
              <input
                type="checkbox"
                checked={confirmedAgreement}
                onChange={(e) => setConfirmedAgreement(e.target.checked)}
                className="mt-1 size-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-semibold text-navy-900 select-none">
                I confirm that all RFQ information is correct and agree to submit this quotation request.
              </span>
            </label>
          </div>

          {/* Navigation & Submit Action */}
          <div className="flex items-center justify-between pt-3">
            <Button
              variant="outline"
              icon={ArrowLeft}
              onClick={goBack}
              disabled={submitting}
            >
              Back to Edit
            </Button>
            <Button
              variant="primary"
              icon={Send}
              onClick={handleFinalSubmit}
              disabled={!confirmedAgreement || submitting}
              className="min-w-[200px]"
            >
              {submitting ? 'Submitting RFQ...' : 'Submit RFQ'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
