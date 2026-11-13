import seedInquiries from '../data/inquiries';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection, wait } from './localCollection';
import makeId from '../utils/ids';
import { isApiConfigured, apiGet, apiPost } from './apiClient';

const inquiries = createCollection(STORAGE_KEYS.inquiries, seedInquiries);

export function mapRfqToInquiry(rfq) {
  const item = rfq.items?.[0];
  const meta = (rfq.savedComparison && typeof rfq.savedComparison === 'object') ? rfq.savedComparison : {};
  const quotations = rfq.quotations || [];
  const latestQuote = quotations[0] || null;

  let quote = null;
  if (latestQuote) {
    quote = {
      id: latestQuote.id,
      quoteNumber: latestQuote.quoteNumber,
      unitPrice: Number(latestQuote.unitPrice),
      leadTimeDays: latestQuote.leadTimeDays,
      freightCharge: Number(latestQuote.freightCharge || 0),
      note: latestQuote.notes || '',
      status: latestQuote.status,
      round: latestQuote.currentVersion || 1,
      lastProposedBy: latestQuote.versions?.[0]?.proposedBy || 'SUPPLIER',
      supplier: latestQuote.supplier,
      versions: (latestQuote.versions || []).map((v) => ({
        version: v.versionNumber,
        unitPrice: Number(v.unitPrice),
        leadTimeDays: v.leadTimeDays,
        note: v.notes || '',
        freightCharge: Number(v.freightCharge || 0),
        proposedBy: v.proposedBy,
        at: v.createdAt,
      })),
    };
  }

  let status = 'Submitted';
  if (rfq.status === 'CLOSED') {
    status = 'Accepted';
  } else if (quotations.length > 0) {
    if (quotations.some((q) => q.status === 'ACCEPTED')) {
      status = 'Accepted';
    } else if (quotations.some((q) => q.status === 'COUNTERED')) {
      status = 'Negotiating';
    } else {
      status = 'Quoted';
    }
  }

  return {
    id: rfq.rfqNumber || rfq.id,
    rfqId: rfq.id,
    rfqNumber: rfq.rfqNumber,
    buyerId: rfq.buyerId || 'guest',
    buyerName: rfq.buyerName,
    buyerEmail: rfq.buyerEmail,
    buyerCompany: rfq.buyerCompany,
    productId: item?.productId || null,
    productName: item?.productName || rfq.title,
    companyId: meta.targetSupplierIds?.[0] || latestQuote?.supplierId || null,
    targetSupplierIds: meta.targetSupplierIds || [],
    targetSuppliers: meta.targetSuppliers || [],
    source: meta.source || null,
    quantity: Number(rfq.quantity),
    unit: rfq.unit || 'piece',
    specifications: rfq.specifications,
    targetPrice: rfq.targetPrice !== null && rfq.targetPrice !== undefined ? Number(rfq.targetPrice) : null,
    destinationCountry: rfq.destinationCountry || 'India',
    deliveryPincode: rfq.deliveryPincode,
    deliveryTime: meta.deliveryTime || 'Within 30 days',
    message: meta.additionalMessage || '',
    attachmentUrl: rfq.attachmentUrl || null,
    status,
    createdAt: rfq.createdAt,
    quote,
    quotations,
  };
}

const inquiryService = {
  async listInquiries(options) {
    const local = await inquiries.list(options);
    try {
      if (isApiConfigured) {
        const res = await apiGet('rfq');
        const backendRfqs = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(backendRfqs) && backendRfqs.length > 0) {
          const mapped = backendRfqs.map(mapRfqToInquiry);
          const seen = new Set();
          const combined = [];
          for (const item of mapped) {
            seen.add(item.id);
            if (item.rfqNumber) seen.add(item.rfqNumber);
            if (item.rfqId) seen.add(item.rfqId);
            combined.push(item);
          }
          for (const item of local) {
            if (!seen.has(item.id) && !seen.has(item.rfqNumber)) {
              combined.push(item);
            }
          }
          return combined;
        }
      }
    } catch {
      // Fallback cleanly to local
    }
    return local;
  },

  saveInquiries: (records) => inquiries.saveAll(records),

  /** Builds an RFQ record. Persists to backend API when available. */
  async createInquiry(values, extra = {}) {
    const {
      product,
      company,
      buyer,
      targetSupplierIds,
      targetSuppliers,
      source,
      deliveryTime,
      deliveryPincode,
      deliveryLocation,
      deliveryAddress,
      paymentPreference,
      expectedDeliveryDate,
      supplierSelectionMethod,
      products,
    } = extra;

    if (isApiConfigured) {
      try {
        // The supplier(s) the buyer chose go only to them; without a choice, the product's own supplier is used
        const chosenIds = (Array.isArray(targetSupplierIds) ? targetSupplierIds : []).filter(Boolean);
        const targetIds = Array.from(
          new Set(chosenIds.length ? chosenIds : [
            ...(company?.id ? [company.id] : []),
            ...(product?.supplierId ? [product.supplierId] : []),
          ].filter(Boolean))
        );

        const prods = products || values.products || (product ? [{
          // Only catalogue products saved in the database (they belong to a supplier account) can be linked to an
          // RFQ line; sample listings are sent by name
          productId: product.supplierId ? product.id : null,
          name: product.name,
          quantity: Number(values.quantity),
          unit: product.unit || 'piece',
          targetPrice: values.targetPrice ? Number(values.targetPrice) : null,
          specifications: values.specifications,
        }] : [{
          name: values.productName || 'Wholesale Product',
          quantity: Number(values.quantity),
          unit: values.unit || 'piece',
          targetPrice: values.targetPrice ? Number(values.targetPrice) : null,
          specifications: values.specifications,
        }]);

        const totalQty = prods.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0);
        const titleStr = values.title || (prods.length > 0 ? `RFQ for ${prods.map(p => p.name || p.productName).join(', ')}` : values.productName);

        const payload = {
          title: titleStr,
          quantity: totalQty,
          unit: prods[0]?.unit || values.unit || 'piece',
          targetPrice: values.targetPrice !== '' && values.targetPrice !== null && values.targetPrice !== undefined ? Number(values.targetPrice) : null,
          specifications: values.specifications || 'Standard wholesale inquiry.',
          deliveryPincode: values.deliveryPincode || values.pincode || deliveryPincode || null,
          destinationCountry: values.destinationCountry || 'India',
          deliveryLocation: values.deliveryLocation || deliveryLocation || null,
          deliveryAddress: values.deliveryAddress || deliveryAddress || null,
          deliveryTime: values.deliveryTime || deliveryTime || 'Within 30 days',
          expectedDeliveryDate: values.expectedDeliveryDate || expectedDeliveryDate || values.requiredByDate || null,
          paymentPreference: values.paymentPreference || paymentPreference || null,
          additionalMessage: values.message || values.additionalMessage || '',
          attachmentUrl: values.attachmentUrl || null,
          requiredByDate: values.requiredByDate || values.expectedDeliveryDate || expectedDeliveryDate || null,
          buyerName: values.buyerName || buyer?.name || 'Anonymous Buyer',
          buyerEmail: values.buyerEmail || buyer?.email || 'buyer@example.com',
          buyerCompany: values.buyerCompany || values.companyName || buyer?.company || buyer?.companyName || null,
          source: source || (product ? 'product_page' : 'header_rfq'),
          supplierId: targetIds[0] || null,
          supplierIds: targetIds,
          targetSupplierIds: targetIds,
          targetSuppliers: targetSuppliers || (company ? [{ id: company.id, name: company.name }] : []),
          supplierSelectionMethod: supplierSelectionMethod || (targetIds.length === 1 ? 'specific' : 'multiple'),
          products: prods,
          items: prods.map((p) => ({
            productId: p.productId || null,
            productName: p.name || p.productName || 'Wholesale Product',
            quantity: Number(p.quantity) || 1,
            unit: p.unit || 'piece',
            targetPrice: p.targetPrice ? Number(p.targetPrice) : null,
            notes: p.notes || [
              p.specifications ? `Specs: ${p.specifications}` : '',
              p.preferredBrand || p.brand ? `Brand: ${p.preferredBrand || p.brand}` : '',
              p.qualityRequirements || p.quality ? `Quality: ${p.qualityRequirements || p.quality}` : '',
              p.packagingRequirements || p.packaging ? `Packaging: ${p.packagingRequirements || p.packaging}` : '',
            ].filter(Boolean).join(' | ') || null,
          })),
        };

        const res = await apiPost('rfq', payload);
        if (res?.data) {
          return mapRfqToInquiry(res.data);
        }
        throw new Error('The quote request could not be confirmed by the server. Please try again.');
      } catch (err) {
        // Never report a request as sent when the server did not save it; the form shows this message instead
        throw new Error(err?.message || 'The quote request could not be sent. Please try again.');
      }
    }

    await wait();
    return {
      id: makeId('TS-RFQ'),
      buyerId: buyer?.id ?? 'guest',
      buyerName: values.buyerName.trim(),
      buyerEmail: values.buyerEmail.trim(),
      productId: product?.id ?? null,
      productName: product?.name ?? values.productName.trim(),
      companyId: company?.id ?? product?.companyId ?? null,
      quantity: Number(values.quantity),
      unit: product?.unit ?? 'unit',
      specifications: values.specifications.trim(),
      targetPrice: values.targetPrice === '' ? null : Number(values.targetPrice),
      destinationCountry: values.destinationCountry,
      deliveryTime: values.deliveryTime,
      message: values.message.trim(),
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      quote: null,
      quotations: [],
    };
  },
};

export default inquiryService;
