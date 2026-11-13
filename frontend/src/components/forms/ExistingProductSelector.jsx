import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  HelpCircle,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import useProducts from '../../hooks/useProducts';
import useAuth from '../../hooks/useAuth';
import { readStorage } from '../../utils/storage';
import { STORAGE_KEYS } from '../../utils/constants';
import { apiGet } from '../../services/apiClient';

/**
 * Clean Product Search RFQ (Step 1)
 * Only two input fields:
 * 1. Company Name: Supplier / Manufacturer company name
 * 2. Product Name: Product the buyer wants to discuss / request quote for
 *
 * Uses custom floating dropdowns instead of native <datalist> to prevent
 * browser autofill overlays like "Manage Personal Info" or "saved data".
 */
export default function ExistingProductSelector({ onSelectProduct, onSwitchToGeneral }) {
  const { products, companies, getCompany, loading } = useProducts();
  const { user, accounts } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [productName, setProductName] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [apiSuppliers, setApiSuppliers] = useState([]);

  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showProductMenu, setShowProductMenu] = useState(false);

  const companyMenuRef = useRef(null);
  const productMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (companyMenuRef.current && !companyMenuRef.current.contains(event.target)) {
        setShowCompanyMenu(false);
      }
      if (productMenuRef.current && !productMenuRef.current.contains(event.target)) {
        setShowProductMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch backend registered suppliers from database
  useEffect(() => {
    let isMounted = true;
    apiGet('rfq/matching-suppliers')
      .then((res) => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        if (isMounted && Array.isArray(list)) {
          setApiSuppliers(list);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Aggregate all registered suppliers from all sources:
  // 1. Catalogue companies (seed & persisted in storage)
  // 2. Products in catalogue
  // 3. Backend database suppliers (/api/rfq/matching-suppliers)
  // 4. Registered user accounts in AuthContext & localStorage (accounts key)
  // 5. Active session user profile (if registered supplier)
  const allSuppliers = useMemo(() => {
    const map = new Map();

    const addSup = (rawName, meta = {}) => {
      if (!rawName) return;
      const trimmed = String(rawName).trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, {
          companyName: trimmed,
          id: meta.id || meta.companyId || `sup-${lower.replace(/\s+/g, '-')}`,
          supplierId: meta.supplierId || meta.id || null,
          city: meta.city || '',
          country: meta.country || 'India',
          isVerified: Boolean(meta.isVerified || meta.verified || meta.kycStatus === 'VERIFIED'),
          productCount: meta.productCount || 0,
        });
      } else {
        const existing = map.get(lower);
        if (meta.isVerified || meta.verified || meta.kycStatus === 'VERIFIED') existing.isVerified = true;
        if (meta.city && !existing.city) existing.city = meta.city;
        if (meta.supplierId && !existing.supplierId) existing.supplierId = meta.supplierId;
      }
    };

    // 1. Context companies
    (companies || []).forEach((c) => {
      addSup(c?.name || c?.company, {
        id: c?.id,
        supplierId: c?.supplierId || c?.id,
        city: c?.city,
        country: c?.country,
        isVerified: c?.verified || c?.isVerified,
      });
    });

    // 2. Context products
    (products || []).forEach((p) => {
      addSup(p?.company, {
        id: p?.companyId,
        supplierId: p?.supplierId,
        city: p?.supplier?.city,
        country: p?.supplier?.country,
        isVerified: p?.supplier?.isVerified,
        productCount: 1,
      });
      addSup(p?.supplier?.company, {
        id: p?.supplier?.id,
        supplierId: p?.supplierId,
        city: p?.supplier?.city,
        country: p?.supplier?.country,
        isVerified: p?.supplier?.isVerified,
        productCount: 1,
      });
    });

    // 3. Backend API suppliers from database
    (apiSuppliers || []).forEach((s) => {
      addSup(s?.companyName || s?.company || s?.name, {
        id: s?.id,
        supplierId: s?.supplierId || s?.id,
        city: s?.city,
        country: s?.country,
        isVerified: s?.isVerified || s?.kycStatus === 'VERIFIED',
        productCount: s?.productCount || 0,
      });
    });

    // 4. Accounts in Auth context & localStorage
    const localAccounts = readStorage(STORAGE_KEYS.accounts, []) || [];
    const combinedAccounts = [...(accounts || []), ...localAccounts];
    combinedAccounts.forEach((a) => {
      const comp = a?.company || a?.companyName;
      addSup(comp, {
        id: a?.companyId || a?.id,
        supplierId: a?.id,
        city: a?.city,
        country: a?.country,
        isVerified: Boolean(a?.isVerified || a?.status === 'Active'),
      });
    });

    // 5. Active signed-in user
    if (user?.company || user?.companyName) {
      addSup(user.company || user.companyName, {
        id: user.companyId || user.id,
        supplierId: user.id,
        city: user.city,
        country: user.country,
        isVerified: Boolean(user.isVerified || user.status === 'Active'),
      });
    }

    return Array.from(map.values());
  }, [companies, products, apiSuppliers, accounts, user]);

  // Compute registered company names for custom dropdown
  const registeredCompanyNames = useMemo(() => {
    return allSuppliers.map((s) => s.companyName).filter(Boolean);
  }, [allSuppliers]);

  // Compute product names matching current company or catalog
  const matchingProductNames = useMemo(() => {
    const cName = companyName.trim().toLowerCase();
    let list = (products || []).filter((p) => p && (p.status === 'Active' || !p.status));

    if (cName) {
      list = list.filter((p) => {
        const compObj = getCompany ? getCompany(p.companyId) : null;
        const sName = (
          p.company ||
          p.supplier?.company ||
          p.supplier?.name ||
          compObj?.name ||
          ''
        ).toLowerCase();
        return sName.includes(cName) || cName.includes(sName);
      });
    }

    return Array.from(new Set(list.map((p) => p.name).filter(Boolean)));
  }, [companyName, products, getCompany]);

  // Filtered dropdown lists based on user input
  const filteredCompanyDropdown = useMemo(() => {
    const q = companyName.trim().toLowerCase();
    if (!q) return registeredCompanyNames.slice(0, 8);
    return registeredCompanyNames.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [registeredCompanyNames, companyName]);

  const filteredProductDropdown = useMemo(() => {
    const q = productName.trim().toLowerCase();
    if (!q) return matchingProductNames.slice(0, 8);
    return matchingProductNames.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [matchingProductNames, productName]);

  const handleVerify = (e) => {
    e.preventDefault();
    setVerifyError('');
    setSuggestions([]);
    setShowCompanyMenu(false);
    setShowProductMenu(false);

    const cName = companyName.trim().toLowerCase();
    const pName = productName.trim().toLowerCase();

    if (!cName) {
      setVerifyError('Please enter the Company Name.');
      return;
    }
    if (!pName) {
      setVerifyError('Please enter the Product Name you want to discuss.');
      return;
    }

    const activeProducts = (products || []).filter((p) => p && (p.status === 'Active' || !p.status));

    // Priority 1: Match both Product Name and Company Name
    const exactMatch = activeProducts.find((p) => {
      const compObj = getCompany ? getCompany(p.companyId) : null;
      const sName = (
        p.company ||
        p.supplier?.company ||
        p.supplier?.name ||
        compObj?.name ||
        ''
      ).toLowerCase();
      const prodName = (p.name || '').toLowerCase();
      const prodSku = (p.id || p.sku || '').toLowerCase();

      const isProductMatch = prodName.includes(pName) || pName.includes(prodName) || prodSku === pName;
      const isCompanyMatch = sName.includes(cName) || cName.includes(sName);

      return isProductMatch && isCompanyMatch;
    });

    if (exactMatch) {
      onSelectProduct(exactMatch);
      return;
    }

    // Priority 2: Check if company is registered in TradeExpress database
    const matchedSupplier = allSuppliers.find((s) => {
      const name = (s.companyName || '').toLowerCase();
      return name === cName || name.includes(cName) || cName.includes(name);
    });

    if (matchedSupplier) {
      // Check if this registered company has any products matching or listed in catalog
      const companyProds = activeProducts.filter((p) => {
        const compObj = getCompany ? getCompany(p.companyId) : null;
        const sName = (
          p.company ||
          p.supplier?.company ||
          p.supplier?.name ||
          compObj?.name ||
          ''
        ).toLowerCase();
        return sName.includes(cName) || cName.includes(sName);
      });

      // If supplier has exact/matching products in catalog, select it
      const specificProd = companyProds.find((p) => {
        const prodName = (p.name || '').toLowerCase();
        const prodSku = (p.id || p.sku || '').toLowerCase();
        return prodName.includes(pName) || pName.includes(prodName) || prodSku === pName;
      });
      if (specificProd) {
        onSelectProduct(specificProd);
        return;
      }

      // If supplier is registered in our database, proceed with direct RFQ to this supplier
      const directInquiryProduct = {
        id: `inq-${Date.now()}`,
        name: productName.trim(),
        company: matchedSupplier.companyName,
        companyId: matchedSupplier.id,
        supplierId: matchedSupplier.supplierId || matchedSupplier.id,
        supplier: {
          id: matchedSupplier.supplierId || matchedSupplier.id,
          company: matchedSupplier.companyName,
          name: matchedSupplier.companyName,
          city: matchedSupplier.city || '',
          country: matchedSupplier.country || 'India',
          isVerified: Boolean(matchedSupplier.isVerified),
        },
        category: 'Direct Supplier Quote Request',
        moq: 1,
        unit: 'piece',
        price: 0,
        currency: 'INR',
        status: 'Active',
        isCustomInquiry: true,
      };

      onSelectProduct(directInquiryProduct);
      return;
    }

    // Priority 3: Match by Product Name alone across catalog
    const matchingProds = activeProducts.filter((p) => {
      const prodName = (p.name || '').toLowerCase();
      const prodSku = (p.id || p.sku || '').toLowerCase();
      return prodName.includes(pName) || pName.includes(prodName) || prodSku === pName;
    });

    if (matchingProds.length === 1) {
      onSelectProduct(matchingProds[0]);
      return;
    }

    if (matchingProds.length > 1) {
      setSuggestions(matchingProds.slice(0, 4));
      setVerifyError(`Multiple products match "${productName}". Please select your intended product:`);
      return;
    }

    // Priority 4: No match in database
    setSuggestions(activeProducts.slice(0, 4));
    setVerifyError(
      `No registered product or supplier found in the database matching "${productName}" by "${companyName}". Please check the spelling or select a verified catalog product below:`
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-5 sm:p-6 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-2xs">
            <Search className="size-4" />
          </span>
          <h3 className="text-base font-bold text-navy-900 sm:text-lg">
            Find Registered Product & Supplier
          </h3>
        </div>
        <p className="text-xs text-muted sm:text-sm leading-relaxed">
          Enter the supplier company name and the product name you want quotations for. The system will verify both in our database and prepare your locked RFQ.
        </p>
      </div>

      {/* Clean 2-Field Form */}
      <form onSubmit={handleVerify} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs relative z-30 overflow-visible">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 relative overflow-visible">
          {/* Field 1: Company Name */}
          <div ref={companyMenuRef} className={`relative ${showCompanyMenu ? 'z-50' : 'z-20'}`}>
            <Input
              id="rfq-company-name"
              label="Company Name"
              required
              autoComplete="off"
              value={companyName}
              onFocus={() => setShowCompanyMenu(true)}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setShowCompanyMenu(true);
                if (verifyError) setVerifyError('');
              }}
              placeholder="e.g. Mumbai Industrial Solutions"
              hint="Enter registered supplier or manufacturer company name."
            />

            {/* Custom Registered Suppliers Dropdown (No browser autofill or saved data) */}
            {showCompanyMenu && filteredCompanyDropdown.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-black/10">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span>Registered Suppliers</span>
                  <span className="text-[9px] font-normal text-slate-400">Select to fill</span>
                </div>
                {filteredCompanyDropdown.map((name) => {
                  const supInfo = allSuppliers.find((s) => (s.companyName || '').toLowerCase() === name.toLowerCase());
                  return (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCompanyName(name);
                        setShowCompanyMenu(false);
                        if (verifyError) setVerifyError('');
                      }}
                      className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-xs text-navy-900 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 className="size-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium truncate">{name}</span>
                      </div>
                      {supInfo?.isVerified ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 shrink-0">
                          <ShieldCheck className="size-3" /> Verified
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 shrink-0">Supplier</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick-fill popular suppliers */}
            {registeredCompanyNames.length > 0 && !companyName && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Suggestions:</span>
                {registeredCompanyNames.slice(0, 3).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setCompanyName(name);
                      if (verifyError) setVerifyError('');
                    }}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Field 2: Product Name */}
          <div ref={productMenuRef} className={`relative ${showProductMenu ? 'z-50' : 'z-20'}`}>
            <Input
              id="rfq-product-name"
              label="Product Name"
              required
              autoComplete="off"
              value={productName}
              onFocus={() => setShowProductMenu(true)}
              onChange={(e) => {
                setProductName(e.target.value);
                setShowProductMenu(true);
                if (verifyError) setVerifyError('');
              }}
              placeholder="e.g. Cordless Impact Drill 20V"
              hint="Enter product name you want to discuss and get quotes for."
            />

            {/* Custom Products Dropdown */}
            {showProductMenu && filteredProductDropdown.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-black/10">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span>Registered Products</span>
                  <span className="text-[9px] font-normal text-slate-400">Select to fill</span>
                </div>
                {filteredProductDropdown.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setProductName(name);
                      setShowProductMenu(false);
                      if (verifyError) setVerifyError('');
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-navy-900 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
                  >
                    <Package className="size-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Quick-fill matching products if company chosen */}
            {matchingProductNames.length > 0 && !productName && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Available:</span>
                {matchingProductNames.slice(0, 3).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setProductName(name);
                      if (verifyError) setVerifyError('');
                    }}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Verification Error & Suggestions */}
        {verifyError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-3">
            <p className="font-semibold text-amber-950 flex items-center gap-1.5">
              <HelpCircle className="size-4 text-amber-700 shrink-0" />
              <span>{verifyError}</span>
            </p>

            {suggestions.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-amber-200/60">
                <span className="font-bold uppercase tracking-wider text-[10px] text-amber-900">
                  Select a Verified Database Product:
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.map((p) => {
                    const comp = getCompany ? getCompany(p.companyId) : null;
                    const sName = comp?.name || p.company || 'Verified Supplier';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectProduct(p)}
                        className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-2.5 text-left hover:border-emerald-600 hover:bg-emerald-50/50 transition-all shadow-2xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-navy-900">{p.name}</p>
                          <p className="truncate text-[11px] text-muted">{sName} · SKU: {p.id}</p>
                        </div>
                        <span className="shrink-0 rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
                          Select
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <p className="text-xs text-muted">
            Step 1 of 2 · Enter Details
          </p>

          <Button
            type="submit"
            variant="primary"
            iconRight={ArrowRight}
            disabled={loading || !companyName.trim() || !productName.trim()}
            className="font-bold"
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
