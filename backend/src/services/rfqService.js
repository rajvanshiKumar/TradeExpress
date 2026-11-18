import prisma from '../config/db.js';
import { assertSupplierCanTrade } from './supplierDeletionService.js';
import { createNotification } from './notificationService.js';
import * as productService from './productService.js';

export async function createRfq({
  buyerId = null,
  buyerName,
  buyerEmail,
  buyerCompany = null,
  title,
  categorySlug = null,
  targetPrice = null,
  quantity,
  unit = 'piece',
  deliveryPincode = null,
  destinationCountry = 'India',
  requiredByDate = null,
  specifications = '',
  attachmentUrl = null,
  items = [],
  products = [],
  supplierId = null,
  supplierIds = [],
  targetSupplierIds = [],
  targetSuppliers = [],
  deliveryLocation = null,
  deliveryAddress = null,
  deliveryTime = null,
  expectedDeliveryDate = null,
  paymentPreference = null,
  additionalMessage = null,
  supplierSelectionMethod = null,
  source = null,
  customProduct = null,
  savedComparison = null,
  productId = null,
  variant = null,
}) {
  const cleanEmail = (buyerEmail || '').trim().toLowerCase();

  // Combine products / items array
  const inputProducts = Array.isArray(products) && products.length > 0
    ? products
    : (Array.isArray(items) && items.length > 0 ? items : []);

  let cleanTitle = (title || '').trim();
  if (!cleanTitle && inputProducts.length > 0) {
    cleanTitle = `RFQ for ${inputProducts.map((p) => p.name || p.productName).filter(Boolean).join(', ')}`;
  }
  if (!cleanTitle) {
    cleanTitle = 'Wholesale Request for Quotation';
  }

  let qty = Number(quantity);
  if ((!qty || isNaN(qty) || qty < 1) && inputProducts.length > 0) {
    qty = inputProducts.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0);
  }
  if (!qty || isNaN(qty) || qty < 1) {
    qty = 1;
  }

  // 1. Prevent duplicate submissions within a 5-second window
  const fiveSecondsAgo = new Date(Date.now() - 5000);
  if (cleanEmail && cleanTitle) {
    const duplicate = await prisma.rfq.findFirst({
      where: {
        OR: [
          ...(buyerId ? [{ buyerId }] : []),
          { buyerEmail: { equals: cleanEmail } },
        ],
        title: cleanTitle,
        quantity: qty,
        createdAt: { gte: fiveSecondsAgo },
      },
      include: {
        items: { include: { product: true } },
        quotations: {
          include: {
            supplier: {
              select: { id: true, name: true, email: true, company: true, isVerified: true, kycStatus: true, phone: true },
            },
            versions: { orderBy: { versionNumber: 'desc' } },
          },
        },
      },
    });

    if (duplicate) {
      return duplicate;
    }
  }

  // 2. Compile targeted suppliers & exclude buyer's own ID
  const rawTargetSupplierIds = Array.from(
    new Set([
      ...(Array.isArray(targetSupplierIds) ? targetSupplierIds : []),
      ...(Array.isArray(supplierIds) ? supplierIds : []),
      ...(supplierId ? [supplierId] : []),
    ].filter(Boolean))
  ).filter((sId) => !buyerId || sId !== buyerId);

  // Validate product, supplier, variant and MOQ on backend
  const primaryProductId = productId || inputProducts.find((p) => p.productId)?.productId;
  if (primaryProductId) {
    try {
      const dbProduct = await prisma.product.findUnique({
        where: { id: primaryProductId },
        include: { supplier: true },
      });
      if (dbProduct) {
        if (dbProduct.status === 'ARCHIVED' || dbProduct.status === 'INACTIVE') {
          const err = new Error(`The selected product "${dbProduct.name}" is currently inactive.`);
          err.statusCode = 400;
          throw err;
        }

        const productMoq = Number(dbProduct.moq) || 1;
        if (qty < productMoq) {
          const err = new Error(
            `Requested quantity (${qty}) must meet or exceed the minimum order quantity (${productMoq} ${dbProduct.unit || 'unit'}s).`
          );
          err.statusCode = 400;
          throw err;
        }

        if (dbProduct.supplierId && !rawTargetSupplierIds.includes(dbProduct.supplierId)) {
          rawTargetSupplierIds.push(dbProduct.supplierId);
        }

        const selectedVariant = variant || inputProducts[0]?.variant;
        if (selectedVariant && typeof selectedVariant === 'object' && dbProduct.variants && typeof dbProduct.variants === 'object') {
          for (const [varName, varVal] of Object.entries(selectedVariant)) {
            if (varVal && Array.isArray(dbProduct.variants[varName])) {
              if (!dbProduct.variants[varName].includes(varVal)) {
                const err = new Error(
                  `Invalid option "${varVal}" for variant "${varName}". Available options: ${dbProduct.variants[varName].join(', ')}`
                );
                err.statusCode = 400;
                throw err;
              }
            }
          }
        }
      }
    } catch (valErr) {
      if (valErr.statusCode) throw valErr;
    }
  }

  // Validate supplier IDs against real database suppliers (exclude suspended/ineligible)
  let confirmedSuppliers = [];
  if (rawTargetSupplierIds.length > 0) {
    confirmedSuppliers = await prisma.user.findMany({
      where: {
        id: { in: rawTargetSupplierIds },
        role: 'SUPPLIER',
        status: { not: 'SUSPENDED' },
      },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        city: true,
        country: true,
        isVerified: true,
        kycStatus: true,
      },
    });
  }

  const allTargetSupplierIds = confirmedSuppliers.map((s) => s.id);

  const rfqNumber = `TS-RFQ-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  let reqDate = null;
  const targetDateStr = requiredByDate || expectedDeliveryDate;
  if (targetDateStr) {
    const parsed = new Date(targetDateStr);
    if (!isNaN(parsed.getTime())) reqDate = parsed;
  }

  // Format combined specifications
  let finalSpecs = (specifications || '').trim();
  if (!finalSpecs && inputProducts.length > 0) {
    finalSpecs = inputProducts
      .map((p, idx) => `Product ${idx + 1} (${p.name || p.productName}): ${p.specifications || 'Standard wholesale inquiry'}`)
      .join('\n');
  }
  if (!finalSpecs) {
    finalSpecs = 'Standard wholesale inquiry.';
  }

  // Map individual items for multi-product RFQ
  const finalItems = inputProducts.length > 0
    ? inputProducts.map((p) => {
        const pQty = Number(p.quantity) || 1;
        const pUnit = p.unit || unit || 'piece';
        const pPrice = p.targetPrice ? Number(p.targetPrice) : null;
        const notesArr = [
          p.specifications ? `Specs: ${p.specifications}` : '',
          p.brand || p.preferredBrand ? `Brand: ${p.brand || p.preferredBrand}` : '',
          p.quality || p.qualityRequirements ? `Quality: ${p.quality || p.qualityRequirements}` : '',
          p.packaging || p.packagingRequirements ? `Packaging: ${p.packaging || p.packagingRequirements}` : '',
        ].filter(Boolean);

        return {
          productId: p.productId || null,
          productName: (p.name || p.productName || cleanTitle).trim(),
          quantity: pQty,
          unit: pUnit,
          targetPrice: pPrice,
          notes: notesArr.length > 0 ? notesArr.join(' | ') : null,
        };
      })
    : [];

  const comparisonData = {
    ...(savedComparison && typeof savedComparison === 'object' ? savedComparison : {}),
    targetSupplierIds: allTargetSupplierIds,
    targetSuppliers: confirmedSuppliers.map((s) => ({
      id: s.id,
      name: s.name,
      company: s.company || s.name,
      isVerified: Boolean(s.isVerified || s.kycStatus === 'VERIFIED'),
      location: [s.city, s.country || 'India'].filter(Boolean).join(', '),
    })),
    supplierSelectionMethod: supplierSelectionMethod || (allTargetSupplierIds.length === 1 ? 'specific' : 'multiple'),
    deliveryLocation: deliveryLocation || null,
    deliveryAddress: deliveryAddress || null,
    paymentPreference: paymentPreference || null,
    additionalMessage: additionalMessage || null,
    products: inputProducts,
    deliveryTime: deliveryTime || null,
    source: source || (allTargetSupplierIds.length === 1 ? 'product_page' : 'header_rfq'),
    customProduct: customProduct || null,
  };

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber,
      buyerId,
      buyerName: buyerName?.trim() || 'Anonymous Buyer',
      buyerEmail: buyerEmail?.trim() || 'buyer@example.com',
      buyerCompany: buyerCompany?.trim() || null,
      title: cleanTitle,
      categorySlug: categorySlug || null,
      targetPrice: targetPrice !== null && targetPrice !== undefined && targetPrice !== '' ? Number(targetPrice) : null,
      quantity: qty,
      unit: unit || 'piece',
      deliveryPincode: deliveryPincode ? String(deliveryPincode).trim() : null,
      destinationCountry: destinationCountry || 'India',
      requiredByDate: reqDate,
      specifications: finalSpecs,
      attachmentUrl: attachmentUrl || null,
      savedComparison: comparisonData,
      status: 'OPEN',
      items: finalItems.length > 0 ? {
        create: finalItems.map((it) => ({
          productId: it.productId || null,
          productName: it.productName,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.targetPrice,
          notes: it.notes,
        })),
      } : undefined,
    },
    include: {
      items: { include: { product: true } },
      quotations: {
        include: {
          supplier: {
            select: { id: true, name: true, email: true, company: true, isVerified: true, kycStatus: true, phone: true },
          },
          versions: { orderBy: { versionNumber: 'desc' } },
        },
      },
    },
  });

  // 3. Send independent RFQ notification to each targeted confirmed supplier
  for (const supId of allTargetSupplierIds) {
    try {
      await createNotification({
        userId: supId,
        type: 'RFQ_RECEIVED',
        title: 'New RFQ Received',
        message: `${rfq.buyerCompany || rfq.buyerName} requested a quote for ${rfq.title}.`,
        link: '/supplier/inquiries',
      });
    } catch (notifErr) {
      console.error(`[RFQ] Failed to notify supplier ${supId}:`, notifErr?.message);
    }
  }

  return rfq;
}

export async function getMatchingSuppliers({ productId, categorySlug, search, productNames = [], excludeUserId = null }) {
  // If productId is provided, use the established productService.getProductSuppliers
  if (productId) {
    try {
      const productSuppliers = await productService.getProductSuppliers(productId);
      if (productSuppliers && productSuppliers.length > 0) {
        return productSuppliers
          .filter((s) => !excludeUserId || s.supplierId !== excludeUserId)
          .map((s) => ({
            id: s.supplierId,
            supplierId: s.supplierId,
            companyName: s.companyName,
            name: s.contactPerson || s.companyName,
            email: s.email,
            phone: s.phone,
            isVerified: s.isVerified,
            kycStatus: s.kycStatus,
            location: s.location,
            city: s.city,
            country: s.country,
            rating: s.averageRating,
            reviewCount: s.reviewCount,
            price: s.price,
            moq: s.moq,
            leadTimeDays: s.leadTimeDays,
            productId: s.productId,
            productName: s.productName,
          }));
      }
    } catch {
      // Fall through to general query
    }
  }

  // 1. Identify suppliers matching product keywords from Step 1
  let matchedSupplierIdsFromProducts = [];
  if (Array.isArray(productNames) && productNames.length > 0) {
    const keywords = productNames
      .flatMap((p) => String(p).toLowerCase().split(/[\s,]+/))
      .filter((w) => w.length >= 3 && !['and', 'for', 'the', 'with', 'set', 'box'].includes(w));

    if (keywords.length > 0) {
      try {
        const matchingProducts = await prisma.product.findMany({
          where: {
            status: 'Active',
            OR: keywords.map((k) => ({
              OR: [
                { name: { contains: k } },
                { description: { contains: k } },
                { categorySlug: { contains: k } },
              ],
            })),
          },
          select: { supplierId: true, name: true },
          take: 50,
        });

        matchedSupplierIdsFromProducts = Array.from(
          new Set(matchingProducts.map((p) => p.supplierId).filter(Boolean))
        );
      } catch (err) {
        console.warn('Error matching products for suppliers:', err?.message);
      }
    }
  }

  const where = {
    role: 'SUPPLIER',
    status: { not: 'SUSPENDED' },
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    ...(search
      ? {
          OR: [
            { company: { contains: search } },
            { name: { contains: search } },
            { city: { contains: search } },
          ],
        }
      : {}),
  };

  const suppliers = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      city: true,
      country: true,
      isVerified: true,
      kycStatus: true,
      warehouseAddress: true,
      products: {
        where: {
          status: 'Active',
          ...(categorySlug ? { categorySlug } : {}),
        },
        select: {
          id: true,
          name: true,
          price: true,
          moq: true,
          unit: true,
          leadTimeDays: true,
        },
        take: 3,
      },
    },
    take: 30,
  });

  // Rank: product matches first, then verified, then name
  suppliers.sort((a, b) => {
    const aProductMatch = matchedSupplierIdsFromProducts.includes(a.id) ? 1 : 0;
    const bProductMatch = matchedSupplierIdsFromProducts.includes(b.id) ? 1 : 0;
    if (aProductMatch !== bProductMatch) return bProductMatch - aProductMatch;

    const aVer = (a.isVerified || a.kycStatus === 'VERIFIED') ? 1 : 0;
    const bVer = (b.isVerified || b.kycStatus === 'VERIFIED') ? 1 : 0;
    return bVer - aVer;
  });

  return suppliers.map((sup) => {
    const isVerified = Boolean(sup.isVerified || sup.kycStatus === 'VERIFIED');
    const matchedProduct = sup.products[0];
    const isProductMatch = matchedSupplierIdsFromProducts.includes(sup.id);

    return {
      id: sup.id,
      supplierId: sup.id,
      companyName: sup.company || sup.name,
      name: sup.name,
      email: sup.email,
      phone: sup.phone,
      isVerified,
      kycStatus: sup.kycStatus || 'NOT_SUBMITTED',
      location: [sup.city, sup.country || 'India'].filter(Boolean).join(', '),
      city: sup.city,
      country: sup.country || 'India',
      rating: 0,
      reviewCount: 0,
      price: matchedProduct ? Number(matchedProduct.price) : null,
      moq: matchedProduct ? matchedProduct.moq : 1,
      leadTimeDays: matchedProduct?.leadTimeDays || 14,
      productId: matchedProduct?.id || null,
      productName: matchedProduct?.name || null,
      productCount: sup.products.length,
      isProductMatch,
    };
  });
}

export async function listRfqs({ buyerId, supplierId, status, categorySlug, search }) {
  const where = {};

  if (buyerId) where.buyerId = buyerId;
  if (status && status !== 'ALL') where.status = status;
  if (categorySlug) where.categorySlug = categorySlug;
  if (search) {
    where.OR = [
      { rfqNumber: { contains: search } },
      { title: { contains: search } },
      { specifications: { contains: search } },
      { buyerName: { contains: search } },
    ];
  }

  const rfqs = await prisma.rfq.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              photo: true,
              unit: true,
              moq: true,
              price: true,
              supplierId: true,
            },
          },
        },
      },
      quotations: {
        include: {
          supplier: {
            select: { id: true, name: true, email: true, company: true, isVerified: true, kycStatus: true, phone: true },
          },
          versions: { orderBy: { versionNumber: 'desc' } },
        },
      },
    },
  });

  // If filtered for supplier, filter and annotate RFQs for this supplier
  if (supplierId) {
    const filtered = rfqs.filter((r) => {
      // 1. Supplier has already submitted a quotation
      if (r.quotations.some((q) => q.supplierId === supplierId)) return true;
      // 2. An item's product belongs to this supplier
      if (r.items.some((it) => it.product?.supplierId === supplierId)) return true;
      // 3. The RFQ explicitly targeted this supplier
      const saved = r.savedComparison;
      if (saved && typeof saved === 'object') {
        const targets = saved.targetSupplierIds;
        if (Array.isArray(targets) && targets.length > 0) {
          return targets.includes(supplierId);
        }
      }
      // 4. Open public RFQ without specific target suppliers (visible to all suppliers)
      const hasSpecificTargets = saved && Array.isArray(saved.targetSupplierIds) && saved.targetSupplierIds.length > 0;
      if (!hasSpecificTargets) {
        return true;
      }
      return false;
    });

    return filtered.map((r) => ({
      ...r,
      quotationCount: r.quotations.length,
      myQuote: r.quotations.find((q) => q.supplierId === supplierId) || null,
      targetSuppliers: r.savedComparison?.targetSuppliers || [],
      deliveryTime: r.savedComparison?.deliveryTime || null,
      additionalMessage: r.savedComparison?.additionalMessage || null,
      source: r.savedComparison?.source || null,
    }));
  }

  return rfqs.map((r) => ({
    ...r,
    quotationCount: r.quotations.length,
    targetSuppliers: r.savedComparison?.targetSuppliers || [],
    deliveryTime: r.savedComparison?.deliveryTime || null,
    additionalMessage: r.savedComparison?.additionalMessage || null,
    source: r.savedComparison?.source || null,
  }));
}

export async function getRfqById(idOrNumber) {
  const rfq = await prisma.rfq.findFirst({
    where: {
      OR: [{ id: idOrNumber }, { rfqNumber: idOrNumber }],
    },
    include: {
      items: true,
      buyer: {
        select: { id: true, name: true, email: true, phone: true, company: true },
      },
      quotations: {
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { id: true, name: true, email: true, company: true },
          },
          versions: { orderBy: { versionNumber: 'desc' } },
          items: true,
        },
      },
    },
  });

  if (!rfq) {
    const error = new Error(`RFQ '${idOrNumber}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return rfq;
}

export async function submitQuote(rfqId, {
  supplierId,
  unitPrice,
  moq = 1,
  availableQuantity = null,
  priceBreaks = null,
  gstPercentage = 18.0,
  freightCharge = 0,
  otherCharges = 0,
  otherChargesDesc = null,
  shippingMethod = 'Road Express',
  leadTimeDays = 14,
  estimatedDeliveryDate = null,
  paymentTerms = '100% Advance',
  validityDate = null,
  sampleAvailable = false,
  sampleCost = 0,
  customizationDetails = null,
  taxDutyNotes = null,
  notes = '',
  attachmentUrl = null,
}) {
  // No new quotes while an approved account deletion is in its grace period
  await assertSupplierCanTrade(supplierId);
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: { quotations: true },
  });

  if (!rfq) {
    const error = new Error('RFQ not found.');
    error.statusCode = 404;
    throw error;
  }

  if (rfq.status === 'CLOSED' || rfq.status === 'EXPIRED') {
    const error = new Error(`Cannot quote on this RFQ because it is ${rfq.status}.`);
    error.statusCode = 400;
    throw error;
  }

  // Check if supplier already has a quote for this RFQ
  let quotation = await prisma.quotation.findFirst({
    where: { rfqId, supplierId },
    include: { versions: true },
  });

  const parsedValidDate = validityDate ? new Date(validityDate) : new Date(Date.now() + 15 * 86400000);
  const parsedEstDate = estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null;

  if (quotation) {
    if (quotation.currentVersion >= 3) {
      const error = new Error('Maximum 3 rounds of negotiation reached for this quote. Please accept or decline the existing terms.');
      error.statusCode = 400;
      throw error;
    }

    const nextVer = quotation.currentVersion + 1;
    // Update existing quotation and create version
    quotation = await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        unitPrice: Number(unitPrice),
        moq: Number(moq) || 1,
        availableQuantity: availableQuantity !== null && availableQuantity !== undefined ? Number(availableQuantity) : null,
        priceBreaks: priceBreaks || null,
        gstPercentage: Number(gstPercentage),
        freightCharge: Number(freightCharge),
        otherCharges: Number(otherCharges) || 0,
        otherChargesDesc: otherChargesDesc || null,
        shippingMethod: shippingMethod || 'Road Express',
        leadTimeDays: Number(leadTimeDays),
        estimatedDeliveryDate: parsedEstDate,
        paymentTerms,
        validityDate: parsedValidDate,
        sampleAvailable: Boolean(sampleAvailable),
        sampleCost: Number(sampleCost) || 0,
        customizationDetails: customizationDetails || null,
        taxDutyNotes: taxDutyNotes || null,
        notes: notes?.trim() || null,
        attachmentUrl: attachmentUrl || quotation.attachmentUrl,
        currentVersion: nextVer,
        status: 'SENT',
        versions: {
          create: {
            versionNumber: nextVer,
            unitPrice: Number(unitPrice),
            moq: Number(moq) || 1,
            availableQuantity: availableQuantity !== null && availableQuantity !== undefined ? Number(availableQuantity) : null,
            priceBreaks: priceBreaks || null,
            gstPercentage: Number(gstPercentage),
            freightCharge: Number(freightCharge),
            otherCharges: Number(otherCharges) || 0,
            otherChargesDesc: otherChargesDesc || null,
            shippingMethod: shippingMethod || 'Road Express',
            leadTimeDays: Number(leadTimeDays),
            paymentTerms,
            notes: notes?.trim() || null,
            proposedBy: 'SUPPLIER',
          },
        },
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        supplier: { select: { id: true, name: true, company: true } },
      },
    });
  } else {
    // Initial Round 1 Quote
    const quoteNumber = `TS-QTE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    quotation = await prisma.quotation.create({
      data: {
        quoteNumber,
        rfqId,
        supplierId,
        currency: 'INR',
        unitPrice: Number(unitPrice),
        moq: Number(moq) || 1,
        availableQuantity: availableQuantity !== null && availableQuantity !== undefined ? Number(availableQuantity) : null,
        priceBreaks: priceBreaks || null,
        gstPercentage: Number(gstPercentage),
        freightCharge: Number(freightCharge),
        otherCharges: Number(otherCharges) || 0,
        otherChargesDesc: otherChargesDesc || null,
        shippingMethod: shippingMethod || 'Road Express',
        leadTimeDays: Number(leadTimeDays),
        estimatedDeliveryDate: parsedEstDate,
        paymentTerms,
        validityDate: parsedValidDate,
        sampleAvailable: Boolean(sampleAvailable),
        sampleCost: Number(sampleCost) || 0,
        customizationDetails: customizationDetails || null,
        taxDutyNotes: taxDutyNotes || null,
        notes: notes?.trim() || null,
        attachmentUrl: attachmentUrl || null,
        currentVersion: 1,
        status: 'SENT',
        versions: {
          create: {
            versionNumber: 1,
            unitPrice: Number(unitPrice),
            moq: Number(moq) || 1,
            availableQuantity: availableQuantity !== null && availableQuantity !== undefined ? Number(availableQuantity) : null,
            priceBreaks: priceBreaks || null,
            gstPercentage: Number(gstPercentage),
            freightCharge: Number(freightCharge),
            otherCharges: Number(otherCharges) || 0,
            otherChargesDesc: otherChargesDesc || null,
            shippingMethod: shippingMethod || 'Road Express',
            leadTimeDays: Number(leadTimeDays),
            paymentTerms,
            notes: notes?.trim() || null,
            proposedBy: 'SUPPLIER',
          },
        },
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        supplier: { select: { id: true, name: true, company: true } },
      },
    });

    // Move RFQ to QUOTED if currently OPEN
    if (rfq.status === 'OPEN') {
      await prisma.rfq.update({
        where: { id: rfqId },
        data: { status: 'QUOTED' },
      });
    }
  }

  if (rfq.buyerId) {
    createNotification({
      userId: rfq.buyerId,
      title: `Quotation Received: ${rfq.title}`,
      message: `A supplier submitted a quote of ₹${Number(unitPrice).toLocaleString('en-IN')}/unit for your RFQ #${rfq.rfqNumber}.`,
      type: 'QUOTE',
      link: `/buyer/quotes`,
    }).catch(() => {});
  }

  return quotation;
}

export async function counterOffer(quoteId, {
  role = 'BUYER',
  unitPrice,
  freightCharge = 0,
  leadTimeDays = 14,
  notes = '',
}) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quoteId },
    include: { versions: true, rfq: true },
  });

  if (!quotation) {
    const error = new Error('Quotation not found.');
    error.statusCode = 404;
    throw error;
  }

  if (['ACCEPTED', 'REJECTED', 'CLOSED'].includes(quotation.status)) {
    const error = new Error(`Cannot counter-offer because quotation is already ${quotation.status}.`);
    error.statusCode = 400;
    throw error;
  }

  // Strictly enforce 3-round negotiation limit
  if (quotation.currentVersion >= 3) {
    const error = new Error('Maximum 3 rounds of negotiation limit reached. Either accept or decline the final offer.');
    error.statusCode = 400;
    throw error;
  }

  const nextVer = quotation.currentVersion + 1;
  const proposedBy = role.toUpperCase() === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER';

  const updated = await prisma.quotation.update({
    where: { id: quoteId },
    data: {
      unitPrice: Number(unitPrice),
      freightCharge: Number(freightCharge),
      leadTimeDays: Number(leadTimeDays),
      notes: notes?.trim() || null,
      currentVersion: nextVer,
      status: 'COUNTERED',
      versions: {
        create: {
          versionNumber: nextVer,
          unitPrice: Number(unitPrice),
          gstPercentage: quotation.gstPercentage,
          freightCharge: Number(freightCharge),
          leadTimeDays: Number(leadTimeDays),
          paymentTerms: quotation.paymentTerms,
          notes: notes?.trim() || null,
          proposedBy,
        },
      },
    },
    include: {
      versions: { orderBy: { versionNumber: 'desc' } },
      supplier: { select: { id: true, name: true, company: true } },
      rfq: true,
    },
  });

  if (proposedBy === 'BUYER' && quotation.supplierId) {
    createNotification({
      userId: quotation.supplierId,
      title: `Counter-Offer: #${quotation.quoteNumber}`,
      message: `Buyer countered Quote #${quotation.quoteNumber} at ₹${Number(unitPrice).toLocaleString('en-IN')}/unit (Round ${nextVer} of 3).`,
      type: 'QUOTE',
      link: `/supplier/inquiries`,
    }).catch(() => {});
  } else if (proposedBy === 'SUPPLIER' && quotation.rfq?.buyerId) {
    createNotification({
      userId: quotation.rfq.buyerId,
      title: `Revised Quote: #${quotation.quoteNumber}`,
      message: `Supplier revised Quote #${quotation.quoteNumber} to ₹${Number(unitPrice).toLocaleString('en-IN')}/unit (Round ${nextVer} of 3).`,
      type: 'QUOTE',
      link: `/buyer/quotes`,
    }).catch(() => {});
  }

  return updated;
}

export async function acceptQuote(quoteId, { buyerId = null }) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quoteId },
    include: { rfq: true, supplier: true },
  });

  if (!quotation) {
    const error = new Error('Quotation not found.');
    error.statusCode = 404;
    throw error;
  }

  if (quotation.status === 'ACCEPTED') {
    return quotation;
  }

  // Update Quotation to ACCEPTED
  const updatedQuote = await prisma.quotation.update({
    where: { id: quoteId },
    data: { status: 'ACCEPTED' },
    include: {
      supplier: { select: { id: true, name: true, email: true, company: true } },
      rfq: true,
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  });

  // Close the parent RFQ
  await prisma.rfq.update({
    where: { id: quotation.rfqId },
    data: { status: 'CLOSED' },
  });

  if (quotation.supplierId) {
    createNotification({
      userId: quotation.supplierId,
      title: `Quote Accepted: #${quotation.quoteNumber}`,
      message: `Buyer accepted Quote #${quotation.quoteNumber}! The negotiated order has been locked.`,
      type: 'QUOTE',
      link: `/supplier/inquiries`,
    }).catch(() => {});
  }

  return updatedQuote;
}

export async function rejectQuote(quoteId, { reason = '' }) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quoteId },
  });

  if (!quotation) {
    const error = new Error('Quotation not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.quotation.update({
    where: { id: quoteId },
    data: {
      status: 'REJECTED',
      notes: reason ? `[Rejected: ${reason}] ${quotation.notes || ''}` : quotation.notes,
    },
  });

  return updated;
}

/**
 * Smart Quote Comparison API
 * Returns side-by-side comparison matrix with landed cost calculations, highlights,
 * and competitor IDOR confidentiality enforcement.
 */
export async function getRfqComparison(rfqId, requestingUser = null) {
  const rfq = await prisma.rfq.findFirst({
    where: {
      OR: [{ id: rfqId }, { rfqNumber: rfqId }],
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, photo: true, price: true, moq: true, stock: true },
          },
        },
      },
      buyer: {
        select: { id: true, name: true, email: true, phone: true, company: true },
      },
      quotations: {
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true,
              city: true,
              country: true,
              isVerified: true,
              kycStatus: true,
            },
          },
          versions: { orderBy: { versionNumber: 'desc' } },
          items: true,
        },
      },
    },
  });

  if (!rfq) {
    const error = new Error(`RFQ '${rfqId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Security / IDOR: Competitor suppliers must never view other suppliers' quotations
  if (requestingUser) {
    const isOwner = rfq.buyerId && rfq.buyerId === requestingUser.id;
    const isRfqEmailMatch = rfq.buyerEmail && rfq.buyerEmail.toLowerCase() === requestingUser.email?.toLowerCase();
    const isAdmin = requestingUser.role === 'ADMIN';

    if (!isOwner && !isRfqEmailMatch && !isAdmin) {
      const error = new Error('Access denied. Only the buyer who requested this RFQ or an administrator can view quotation comparisons.');
      error.statusCode = 403;
      throw error;
    }
  }

  const requestedQuantity = Number(rfq.quantity) || 1;

  // Process quotations and calculate landed cost
  const processedQuotes = rfq.quotations.map((q) => {
    const unitPrice = Number(q.unitPrice);
    const gstPct = Number(q.gstPercentage || 18);
    const freight = Number(q.freightCharge || 0);
    const otherCharges = Number(q.otherCharges || 0);

    const subtotal = Math.round(unitPrice * requestedQuantity * 100) / 100;
    const gstAmount = Math.round((subtotal * (gstPct / 100)) * 100) / 100;
    const totalLandedCost = Math.round((subtotal + gstAmount + freight + otherCharges) * 100) / 100;
    const effectiveUnitPrice = Math.round((totalLandedCost / requestedQuantity) * 100) / 100;

    const moq = q.moq || 1;
    const meetsMoq = requestedQuantity >= moq;
    const meetsStock = q.availableQuantity ? q.availableQuantity >= requestedQuantity : true;
    const isGenuinelyVerified = Boolean(q.supplier?.isVerified || q.supplier?.kycStatus === 'VERIFIED');

    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      supplierId: q.supplierId,
      supplier: {
        id: q.supplier.id,
        name: q.supplier.name,
        company: q.supplier.company || q.supplier.name,
        email: q.supplier.email,
        phone: q.supplier.phone,
        city: q.supplier.city,
        country: q.supplier.country || 'India',
        location: `${q.supplier.city ? `${q.supplier.city}, ` : ''}${q.supplier.country || 'India'}`,
        isVerified: isGenuinelyVerified,
        kycStatus: q.supplier.kycStatus || 'NOT_SUBMITTED',
      },
      status: q.status,
      currentVersion: q.currentVersion,
      currency: q.currency || 'INR',
      unitPrice,
      moq,
      availableQuantity: q.availableQuantity,
      priceBreaks: q.priceBreaks || null,
      leadTimeDays: q.leadTimeDays,
      estimatedDeliveryDate: q.estimatedDeliveryDate,
      shippingMethod: q.shippingMethod || 'Road Express',
      gstPercentage: gstPct,
      freightCharge: freight,
      otherCharges,
      otherChargesDesc: q.otherChargesDesc || null,
      paymentTerms: q.paymentTerms || '100% Advance',
      validityDate: q.validityDate,
      sampleAvailable: q.sampleAvailable,
      sampleCost: Number(q.sampleCost || 0),
      customizationDetails: q.customizationDetails || null,
      notes: q.notes,
      attachmentUrl: q.attachmentUrl,
      // Landed cost breakdown
      calculation: {
        requestedQuantity,
        unit: rfq.unit,
        unitPrice,
        subtotal,
        gstPercentage: gstPct,
        gstAmount,
        freightAmount: freight,
        otherCharges,
        otherChargesDesc: q.otherChargesDesc || null,
        totalLandedCost,
        effectiveUnitPrice,
        meetsMoq,
        meetsStock,
      },
      versions: q.versions,
    };
  });

  // Calculate highlights (lowest price, lowest landed total, shortest lead time)
  let lowestUnitPrice = Infinity;
  let lowestTotalCost = Infinity;
  let shortestLeadTime = Infinity;

  processedQuotes.forEach((q) => {
    if (q.unitPrice < lowestUnitPrice) lowestUnitPrice = q.unitPrice;
    if (q.calculation.totalLandedCost < lowestTotalCost) lowestTotalCost = q.calculation.totalLandedCost;
    if (q.leadTimeDays < shortestLeadTime) shortestLeadTime = q.leadTimeDays;
  });

  const quotesWithHighlights = processedQuotes.map((q) => ({
    ...q,
    highlights: {
      isLowestUnitPrice: processedQuotes.length > 1 && q.unitPrice === lowestUnitPrice,
      isLowestTotalCost: processedQuotes.length > 1 && q.calculation.totalLandedCost === lowestTotalCost,
      isShortestLeadTime: processedQuotes.length > 1 && q.leadTimeDays === shortestLeadTime,
      meetsRequestedQuantity: q.calculation.meetsMoq && q.calculation.meetsStock,
    },
  }));

  // Summary spread
  const unitPrices = processedQuotes.map((q) => q.unitPrice);
  const totalCosts = processedQuotes.map((q) => q.calculation.totalLandedCost);
  const leadTimes = processedQuotes.map((q) => q.leadTimeDays);

  const summary = {
    totalQuotes: processedQuotes.length,
    priceSpread: {
      minUnitPrice: unitPrices.length ? Math.min(...unitPrices) : 0,
      maxUnitPrice: unitPrices.length ? Math.max(...unitPrices) : 0,
      spreadUnitPrice: unitPrices.length ? Math.max(...unitPrices) - Math.min(...unitPrices) : 0,
      minTotalCost: totalCosts.length ? Math.min(...totalCosts) : 0,
      maxTotalCost: totalCosts.length ? Math.max(...totalCosts) : 0,
      savingsPotential: totalCosts.length ? Math.max(...totalCosts) - Math.min(...totalCosts) : 0,
    },
    leadTimeSpread: {
      minDays: leadTimes.length ? Math.min(...leadTimes) : 0,
      maxDays: leadTimes.length ? Math.max(...leadTimes) : 0,
    },
    verifiedSuppliersCount: processedQuotes.filter((q) => q.supplier.isVerified).length,
  };

  return {
    rfq: {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      title: rfq.title,
      categorySlug: rfq.categorySlug,
      quantity: rfq.quantity,
      unit: rfq.unit,
      targetPrice: rfq.targetPrice ? Number(rfq.targetPrice) : null,
      destinationCountry: rfq.destinationCountry,
      deliveryPincode: rfq.deliveryPincode,
      requiredByDate: rfq.requiredByDate,
      specifications: rfq.specifications,
      status: rfq.status,
      createdAt: rfq.createdAt,
      items: rfq.items,
      savedComparison: rfq.savedComparison || null,
    },
    summary,
    quotations: quotesWithHighlights,
  };
}

export async function saveComparisonPreferences(rfqId, userId, preferences) {
  const rfq = await prisma.rfq.findFirst({
    where: {
      OR: [{ id: rfqId }, { rfqNumber: rfqId }],
    },
  });

  if (!rfq) {
    const error = new Error('RFQ not found.');
    error.statusCode = 404;
    throw error;
  }

  if (rfq.buyerId && rfq.buyerId !== userId) {
    const error = new Error('Only the buyer who created this RFQ can save comparison preferences.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.rfq.update({
    where: { id: rfq.id },
    data: {
      savedComparison: preferences,
    },
  });

  return updated.savedComparison;
}
