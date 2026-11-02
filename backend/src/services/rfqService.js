import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';

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
}) {
  const rfqNumber = `TS-RFQ-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  let reqDate = null;
  if (requiredByDate) {
    const parsed = new Date(requiredByDate);
    if (!isNaN(parsed.getTime())) reqDate = parsed;
  }

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber,
      buyerId,
      buyerName: buyerName?.trim() || 'Anonymous Buyer',
      buyerEmail: buyerEmail?.trim() || 'buyer@example.com',
      buyerCompany: buyerCompany?.trim() || null,
      title: title?.trim() || `Inquiry for ${quantity} ${unit}s`,
      categorySlug: categorySlug || null,
      targetPrice: targetPrice !== null && targetPrice !== undefined && targetPrice !== '' ? Number(targetPrice) : null,
      quantity: Number(quantity) || 1,
      unit: unit || 'piece',
      deliveryPincode: deliveryPincode ? String(deliveryPincode).trim() : null,
      destinationCountry: destinationCountry || 'India',
      requiredByDate: reqDate,
      specifications: specifications?.trim() || 'Standard wholesale inquiry.',
      attachmentUrl: attachmentUrl || null,
      status: 'OPEN',
      items: items && items.length > 0 ? {
        create: items.map((it) => ({
          productId: it.productId || null,
          productName: it.productName || title,
          quantity: Number(it.quantity) || Number(quantity) || 1,
          unit: it.unit || unit || 'piece',
          targetPrice: it.targetPrice ? Number(it.targetPrice) : null,
          notes: it.notes || null,
        })),
      } : undefined,
    },
    include: {
      items: true,
      quotations: {
        include: {
          supplier: {
            select: { id: true, name: true, email: true, company: true },
          },
          versions: { orderBy: { versionNumber: 'desc' } },
        },
      },
    },
  });

  return rfq;
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
      items: true,
      quotations: {
        include: {
          supplier: {
            select: { id: true, name: true, email: true, company: true },
          },
          versions: { orderBy: { versionNumber: 'desc' } },
        },
      },
    },
  });

  // If filtered for supplier, annotate which quotes belong to this supplier
  return rfqs.map((r) => ({
    ...r,
    quotationCount: r.quotations.length,
    myQuote: supplierId ? r.quotations.find((q) => q.supplierId === supplierId) || null : undefined,
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
      link: `/inquiries`,
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
      link: `/inquiries`,
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
