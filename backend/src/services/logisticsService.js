import prisma from '../config/db.js';
import { getIO } from './socketService.js';
import {
  SHIPMENT_STATUSES,
  validateStatusTransition,
} from './logisticsStateMachine.js';

// Helper to format order / shipment tracking code
function generateNumber(prefix) {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${dateStr}-${rand}`;
}

// ==========================================
// 1. TRANSPORT COMPANIES & PARTNERS
// ==========================================

export async function createTransportCompany(user, data) {
  const slug = (data.name || 'transporter')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + `-${Date.now().toString(36)}`;

  const company = await prisma.transportCompany.create({
    data: {
      name: data.name.trim(),
      slug,
      companyType: data.companyType || (user.role === 'TRANSPORT_PARTNER' ? 'TRADEEXPRESS_PARTNER' : 'THIRD_PARTY'),
      ownerId: user.id,
      contactPerson: data.contactPerson || user.name,
      email: data.email || user.email,
      phone: data.phone || user.phone || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      postalCode: data.postalCode || '',
      country: data.country || 'India',
      gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
      pan: data.pan ? data.pan.trim().toUpperCase() : null,
      ibaApproved: Boolean(data.ibaApproved),
      ibaCode: data.ibaCode || null,
      status: 'ACTIVE',
      verificationStatus: user.role === 'SUPER_ADMIN' ? 'VERIFIED' : 'PENDING',
      fleetSize: parseInt(data.fleetSize, 10) || 1,
      operatingRoutes: data.operatingRoutes || ['All India'],
      serviceTypes: data.serviceTypes || ['FTL', 'PTL'],
    },
  });

  return company;
}

export async function getTransportCompanies({ companyType, status, verificationStatus, search } = {}) {
  const where = {};
  if (companyType) where.companyType = companyType;
  if (status) where.status = status;
  if (verificationStatus) where.verificationStatus = verificationStatus;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { contactPerson: { contains: search } },
      { city: { contains: search } },
      { gstin: { contains: search } },
    ];
  }

  return prisma.transportCompany.findMany({
    where,
    include: {
      _count: {
        select: {
          vehicles: true,
          drivers: true,
          shipments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTransportCompanyById(id) {
  return prisma.transportCompany.findUnique({
    where: { id },
    include: {
      vehicles: true,
      drivers: true,
      shipments: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function verifyTransportCompany(id, adminUser, { verificationStatus, rejectionReason }) {
  const company = await prisma.transportCompany.update({
    where: { id },
    data: {
      verificationStatus,
      verifiedAt: verificationStatus === 'VERIFIED' ? new Date() : null,
      verifiedBy: adminUser.name || adminUser.email,
      rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
    },
  });

  // Log audit trail
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: adminUser.role,
      action: 'TRANSPORTER_VERIFICATION_REVIEW',
      resource: 'TRANSPORT_COMPANIES',
      targetId: id,
      details: { verificationStatus, rejectionReason },
      result: 'SUCCESS',
    },
  });

  return company;
}

// ==========================================
// 2. FLEET VEHICLES
// ==========================================

export async function addVehicle(user, companyId, data) {
  // Validate company access
  const company = await prisma.transportCompany.findUnique({ where: { id: companyId } });
  if (!company) {
    const error = new Error('Transport company not found.');
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && company.ownerId !== user.id) {
    const error = new Error('Unauthorized to manage vehicles for this company.');
    error.statusCode = 403;
    throw error;
  }

  const vehicle = await prisma.transportVehicle.create({
    data: {
      companyId,
      vehicleNumber: data.vehicleNumber.trim().toUpperCase(),
      vehicleType: data.vehicleType || 'Open Truck',
      capacityTons: Number(data.capacityTons) || 9.0,
      make: data.make || 'Tata Motors',
      model: data.model || '',
      yearOfManufacture: data.yearOfManufacture ? parseInt(data.yearOfManufacture, 10) : null,
      rcNumber: data.rcNumber ? data.rcNumber.trim().toUpperCase() : null,
      rcDocumentUrl: data.rcDocumentUrl || null,
      rcExpiryDate: data.rcExpiryDate ? new Date(data.rcExpiryDate) : null,
      insuranceNumber: data.insuranceNumber || null,
      insuranceDocumentUrl: data.insuranceDocumentUrl || null,
      insuranceExpiryDate: data.insuranceExpiryDate ? new Date(data.insuranceExpiryDate) : null,
      fitnessExpiryDate: data.fitnessExpiryDate ? new Date(data.fitnessExpiryDate) : null,
      permitNumber: data.permitNumber || null,
      permitType: data.permitType || 'NATIONAL',
      permitDocumentUrl: data.permitDocumentUrl || null,
      permitExpiryDate: data.permitExpiryDate ? new Date(data.permitExpiryDate) : null,
      pucExpiryDate: data.pucExpiryDate ? new Date(data.pucExpiryDate) : null,
      gpsImei: data.gpsImei || null,
      gpsProvider: data.gpsProvider || null,
      isVerified: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
      status: 'AVAILABLE',
    },
  });

  return vehicle;
}

export async function getVehicles({ companyId, vehicleType, status } = {}) {
  const where = {};
  if (companyId) where.companyId = companyId;
  if (vehicleType) where.vehicleType = vehicleType;
  if (status) where.status = status;

  return prisma.transportVehicle.findMany({
    where,
    include: {
      company: {
        select: { id: true, name: true, phone: true, verificationStatus: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function verifyVehicle(id, adminUser, { isVerified, verificationNotes }) {
  return prisma.transportVehicle.update({
    where: { id },
    data: {
      isVerified: Boolean(isVerified),
      verifiedAt: isVerified ? new Date() : null,
      verificationNotes: verificationNotes || null,
    },
  });
}

// ==========================================
// 3. TRANSPORT DRIVERS
// ==========================================

export async function addDriver(user, companyId, data) {
  const company = await prisma.transportCompany.findUnique({ where: { id: companyId } });
  if (!company) {
    const error = new Error('Transport company not found.');
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && company.ownerId !== user.id) {
    const error = new Error('Unauthorized to manage drivers for this company.');
    error.statusCode = 403;
    throw error;
  }

  const driver = await prisma.transportDriver.create({
    data: {
      companyId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      alternatePhone: data.alternatePhone || null,
      licenseNumber: data.licenseNumber.trim().toUpperCase(),
      licenseType: data.licenseType || 'COMMERCIAL_HEAVY',
      licenseExpiryDate: data.licenseExpiryDate ? new Date(data.licenseExpiryDate) : null,
      licenseDocumentUrl: data.licenseDocumentUrl || null,
      aadhaarNumber: data.aadhaarNumber ? data.aadhaarNumber.slice(-4).padStart(12, 'X') : null,
      aadhaarDocumentUrl: data.aadhaarDocumentUrl || null,
      panNumber: data.panNumber ? data.panNumber.trim().toUpperCase() : null,
      experienceYears: parseInt(data.experienceYears, 10) || 5,
      isVerified: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      status: 'AVAILABLE',
    },
  });

  return driver;
}

export async function getDrivers({ companyId, status } = {}) {
  const where = {};
  if (companyId) where.companyId = companyId;
  if (status) where.status = status;

  return prisma.transportDriver.findMany({
    where,
    include: {
      company: {
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function verifyDriver(id, adminUser, { isVerified, verificationNotes }) {
  return prisma.transportDriver.update({
    where: { id },
    data: {
      isVerified: Boolean(isVerified),
      verifiedAt: isVerified ? new Date() : null,
      verificationNotes: verificationNotes || null,
    },
  });
}

// ==========================================
// 4. TRANSPORT REQUESTS (TradeExpress-Managed)
// ==========================================

export async function createTransportRequest(supplierUser, data) {
  const requestNumber = generateNumber('TR');

  let order = null;
  if (data.orderId) {
    order = await prisma.order.findUnique({ where: { id: data.orderId } });
  }

  const transportRequest = await prisma.transportRequest.create({
    data: {
      requestNumber,
      orderId: data.orderId || null,
      supplierId: supplierUser.id,
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      cargoDetails: {
        goodsDescription: data.cargoDetails?.goodsDescription || 'General Bulk Cargo',
        packageType: data.cargoDetails?.packageType || 'Pallets',
        totalWeightKg: Number(data.cargoDetails?.totalWeightKg || 1000),
        volumeCft: Number(data.cargoDetails?.volumeCft || 100),
        packageCount: parseInt(data.cargoDetails?.packageCount, 10) || 10,
        isFragile: Boolean(data.cargoDetails?.isFragile),
        isHazardous: Boolean(data.cargoDetails?.isHazardous),
      },
      pickupDate: new Date(data.pickupDate),
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
      targetFreight: data.targetFreight ? Number(data.targetFreight) : null,
      loadingRequirements: data.loadingRequirements || null,
      status: 'OPEN',
    },
    include: {
      supplier: {
        select: { id: true, name: true, company: true, phone: true, email: true },
      },
      order: {
        select: { id: true, orderNumber: true, total: true },
      },
    },
  });

  // Notify verified transport partners via Socket.IO
  const io = getIO();
  if (io) {
    io.emit('transport_request:created', {
      requestId: transportRequest.id,
      requestNumber: transportRequest.requestNumber,
      fromCity: data.pickupAddress?.city,
      toCity: data.deliveryAddress?.city,
      cargo: transportRequest.cargoDetails,
      pickupDate: transportRequest.pickupDate,
    });
  }

  return transportRequest;
}

export async function getTransportRequests(user, { status, search } = {}) {
  const where = {};
  if (user.role === 'SUPPLIER') {
    where.supplierId = user.id;
  }
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { requestNumber: { contains: search } },
      { 'pickupAddress.city': { contains: search } },
      { 'deliveryAddress.city': { contains: search } },
    ];
  }

  return prisma.transportRequest.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, company: true, email: true, phone: true } },
      order: { select: { id: true, orderNumber: true, total: true } },
      quotes: {
        include: {
          transporter: { select: { id: true, name: true, rating: true, phone: true } },
        },
      },
      shipment: { select: { id: true, shipmentNumber: true, trackingNumber: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOpenTransportRequestsForPartners(partnerUser) {
  return prisma.transportRequest.findMany({
    where: { status: 'OPEN' },
    include: {
      supplier: { select: { id: true, name: true, company: true, city: true, state: true } },
      quotes: {
        where: { partnerUserId: partnerUser.id },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ==========================================
// 5. FREIGHT QUOTATIONS & BIDDING
// ==========================================

export async function submitFreightQuote(partnerUser, requestId, data) {
  // Find partner's transport company
  const company = await prisma.transportCompany.findFirst({
    where: { ownerId: partnerUser.id },
  });

  if (!company) {
    const error = new Error('You must register and verify a Transport Company before submitting freight quotes.');
    error.statusCode = 400;
    throw error;
  }

  const request = await prisma.transportRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== 'OPEN') {
    const error = new Error('This transport request is no longer open for quotations.');
    error.statusCode = 400;
    throw error;
  }

  const quoteNumber = generateNumber('TQ');
  const baseFreight = Number(data.baseFreight);
  const loadingCharges = Number(data.loadingCharges || 0);
  const unloadingCharges = Number(data.unloadingCharges || 0);
  const fuelSurcharge = Number(data.fuelSurcharge || 0);
  const tollTaxes = Number(data.tollTaxes || 0);
  const subtotalFreight = baseFreight + loadingCharges + unloadingCharges + fuelSurcharge + tollTaxes;
  const gstRate = 5.00; // Standard 5% GST for Goods Transport Agency (GTA)
  const gstAmount = Math.round((subtotalFreight * (gstRate / 100) + Number.EPSILON) * 100) / 100;
  const totalFreight = Math.round((subtotalFreight + gstAmount + Number.EPSILON) * 100) / 100;

  const validUntil = data.validUntil ? new Date(data.validUntil) : new Date(Date.now() + 48 * 3600 * 1000);

  const quote = await prisma.transportQuote.create({
    data: {
      quoteNumber,
      requestId,
      transporterId: company.id,
      partnerUserId: partnerUser.id,
      baseFreight,
      loadingCharges,
      unloadingCharges,
      fuelSurcharge,
      tollTaxes,
      gstRate,
      gstAmount,
      totalFreight,
      transitDays: parseInt(data.transitDays, 10) || 3,
      vehicleTypeOffered: data.vehicleTypeOffered || 'Container 32ft',
      validUntil,
      terms: data.terms || 'Standard Indian Road Transport Association terms apply.',
      status: 'PENDING',
    },
    include: {
      transporter: true,
      request: true,
    },
  });

  // Notify supplier via Socket.IO
  const io = getIO();
  if (io) {
    io.to(`user:${request.supplierId}`).emit('transport_quote:received', {
      requestId,
      quote,
    });
  }

  return quote;
}

export async function acceptFreightQuote(supplierUser, quoteId) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.transportQuote.findUnique({
      where: { id: quoteId },
      include: {
        request: {
          include: { order: true },
        },
        transporter: true,
      },
    });

    if (!quote) {
      const error = new Error('Freight quote not found.');
      error.statusCode = 404;
      throw error;
    }

    if (quote.request.supplierId !== supplierUser.id && supplierUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Unauthorized to accept quotes for this transport request.');
      error.statusCode = 403;
      throw error;
    }

    if (quote.status !== 'PENDING') {
      const error = new Error(`Cannot accept quote with status '${quote.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Mark this quote as ACCEPTED
    await tx.transportQuote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED' },
    });

    // 2. Reject other quotes on this request
    await tx.transportQuote.updateMany({
      where: {
        requestId: quote.requestId,
        id: { not: quoteId },
      },
      data: { status: 'REJECTED' },
    });

    // 3. Mark transport request as ASSIGNED
    await tx.transportRequest.update({
      where: { id: quote.requestId },
      data: {
        status: 'ASSIGNED',
        assignedQuoteId: quoteId,
      },
    });

    // 4. Create the TradeExpress-managed Shipment
    const shipmentNumber = generateNumber('SHP');
    const trackingNumber = generateNumber('TRX');
    const estimatedDeliveryAt = new Date(Date.now() + (quote.transitDays || 3) * 24 * 3600 * 1000);

    const shipment = await tx.shipment.create({
      data: {
        shipmentNumber,
        trackingNumber,
        orderId: quote.request.orderId,
        transportMethod: 'TRADEEXPRESS_MANAGED',
        requestId: quote.requestId,
        acceptedQuoteId: quoteId,
        supplierId: quote.request.supplierId,
        buyerId: quote.request.order?.userId || null,
        transporterId: quote.transporterId,
        pickupAddress: quote.request.pickupAddress,
        deliveryAddress: quote.request.deliveryAddress,
        cargoDetails: quote.request.cargoDetails,
        totalWeightKg: quote.request.cargoDetails?.totalWeightKg || 1000,
        totalPackages: quote.request.cargoDetails?.packageCount || 10,
        freightCharges: quote.totalFreight,
        freightPayer: 'SUPPLIER',
        status: SHIPMENT_STATUSES.TRANSPORT_ASSIGNED,
        pickupScheduledAt: quote.request.pickupDate,
        estimatedDeliveryAt,
        deliveryOtp: String(Math.floor(100000 + Math.random() * 900000)),
      },
    });

    // 5. Create initial audit event
    await tx.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: SHIPMENT_STATUSES.TRANSPORT_ASSIGNED,
        title: 'Transport Assigned (TradeExpress Partner)',
        description: `Freight quote accepted from ${quote.transporter.name} for ₹${quote.totalFreight}. Transporter vehicle & driver assignment pending.`,
        actorId: supplierUser.id,
        actorRole: supplierUser.role,
        actorName: supplierUser.name,
      },
    });

    // 6. Create FreightPayment record held in Escrow
    const tdsAmount = Math.round((Number(quote.totalFreight) * 0.01 + Number.EPSILON) * 100) / 100; // 1% TDS Sec 194C
    const platformFee = Math.round((Number(quote.totalFreight) * 0.02 + Number.EPSILON) * 100) / 100; // 2% platform fee
    const netPayable = Math.round((Number(quote.totalFreight) - tdsAmount - platformFee + Number.EPSILON) * 100) / 100;

    await tx.freightPayment.create({
      data: {
        shipmentId: shipment.id,
        orderId: quote.request.orderId,
        payerId: supplierUser.id,
        transporterId: quote.transporterId,
        grossAmount: quote.totalFreight,
        platformFee,
        tdsAmount,
        netPayable,
        paymentMethod: 'ESCROW',
        escrowStatus: 'HELD',
      },
    });

    // Socket broadcasts
    const io = getIO();
    if (io) {
      io.to(`user:${quote.partnerUserId}`).emit('transport_quote:accepted', {
        quoteId,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        trackingNumber: shipment.trackingNumber,
      });
      io.to(`user:${supplierUser.id}`).emit('shipment:created', shipment);
    }

    return shipment;
  });
}

// ==========================================
// 6. SUPPLIER-MANAGED SHIPMENTS
// ==========================================

export async function createSupplierManagedShipment(supplierUser, data) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify vehicle availability if assigning existing fleet vehicle
    let vehicle = null;
    if (data.vehicleId) {
      vehicle = await tx.transportVehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) {
        const err = new Error('Vehicle not found.');
        err.statusCode = 404;
        throw err;
      }
      if (vehicle.status !== 'AVAILABLE') {
        const err = new Error(`Vehicle ${vehicle.vehicleNumber} is currently ${vehicle.status}. Please select an available vehicle.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 2. Verify driver availability if assigning existing driver
    let driver = null;
    if (data.driverId) {
      driver = await tx.transportDriver.findUnique({ where: { id: data.driverId } });
      if (!driver) {
        const err = new Error('Driver not found.');
        err.statusCode = 404;
        throw err;
      }
      if (driver.status !== 'AVAILABLE') {
        const err = new Error(`Driver ${driver.name} is currently ${driver.status}. Please select an available driver.`);
        err.statusCode = 400;
        throw err;
      }
    }

    const shipmentNumber = generateNumber('SHP');
    const trackingNumber = data.lrNumber ? `TRX-${data.lrNumber.replace(/[^A-Za-z0-9]/g, '')}` : generateNumber('TRX');
    const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));

    let order = null;
    if (data.orderId) {
      order = await tx.order.findUnique({ where: { id: data.orderId } });
    }

    const shipment = await tx.shipment.create({
      data: {
        shipmentNumber,
        trackingNumber,
        orderId: data.orderId || null,
        transportMethod: 'SUPPLIER_MANAGED',
        supplierId: supplierUser.id,
        buyerId: order?.userId || data.buyerId || null,
        transporterId: data.transporterId || null,
        vehicleId: data.vehicleId || null,
        driverId: data.driverId || null,
        vehicleNumber: vehicle?.vehicleNumber || data.vehicleNumber?.trim().toUpperCase() || 'OWN-FLEET',
        driverName: driver?.name || data.driverName?.trim() || 'Assigned Driver',
        driverPhone: driver?.phone || data.driverPhone?.trim() || '',
        lrNumber: data.lrNumber ? data.lrNumber.trim().toUpperCase() : null,
        ewayBillNumber: data.ewayBillNumber ? data.ewayBillNumber.trim().toUpperCase() : null,
        ewayBillExpiry: data.ewayBillExpiry ? new Date(data.ewayBillExpiry) : null,
        pickupAddress: data.pickupAddress,
        deliveryAddress: data.deliveryAddress,
        cargoDetails: data.cargoDetails || {},
        totalWeightKg: Number(data.totalWeightKg || 1000),
        totalPackages: parseInt(data.totalPackages, 10) || 1,
        freightCharges: Number(data.freightCharges || 0),
        freightPayer: data.freightPayer || 'SUPPLIER',
        status: SHIPMENT_STATUSES.DOCUMENTS_PENDING,
        pickupScheduledAt: data.pickupScheduledAt ? new Date(data.pickupScheduledAt) : new Date(),
        estimatedDeliveryAt: data.estimatedDeliveryAt ? new Date(data.estimatedDeliveryAt) : null,
        deliveryOtp,
        notes: data.notes || 'Supplier-managed transport arranged; awaiting Super Admin verification.',
      },
    });

    // Mark vehicle and driver as ASSIGNED to prevent concurrent double-booking
    if (vehicle) {
      await tx.transportVehicle.update({
        where: { id: vehicle.id },
        data: { status: 'ASSIGNED' },
      });
    }
    if (driver) {
      await tx.transportDriver.update({
        where: { id: driver.id },
        data: { status: 'ASSIGNED' },
      });
    }

    // Create initial audit timeline event
    await tx.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: SHIPMENT_STATUSES.DOCUMENTS_PENDING,
        title: 'Truck Details & Documents Submitted (Awaiting Super Admin Verification)',
        description: `Supplier-managed transport arranged with Vehicle ${shipment.vehicleNumber} and Driver ${shipment.driverName}. Super Admin review and verification required before dispatch.`,
        actorId: supplierUser.id,
        actorRole: supplierUser.role,
        actorName: supplierUser.name,
      },
    });

    // If initial documents provided (e.g. LR/Bilty or RC), save them
    if (data.documents && Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        if (doc.fileUrl) {
          await tx.shipmentDocument.create({
            data: {
              shipmentId: shipment.id,
              docType: doc.docType || 'LR_BILTY',
              docNumber: doc.docNumber || null,
              title: doc.title || 'Transport Document',
              fileUrl: doc.fileUrl,
              fileName: doc.fileName || 'document.pdf',
              uploadedByUserId: supplierUser.id,
              uploadedByRole: supplierUser.role,
              isVerified: true,
            },
          });
        }
      }
    }

    // Broadcast creation
    const io = getIO();
    if (io) {
      io.to(`user:${supplierUser.id}`).emit('shipment:created', shipment);
      if (shipment.buyerId) {
        io.to(`user:${shipment.buyerId}`).emit('shipment:created', shipment);
      }
    }

    return shipment;
  });
}

// ==========================================
// 7. SHIPMENTS QUERYING & DETAIL (IDOR PROTECTION)
// ==========================================

export async function getShipments(user, { status, transportMethod, search, startDate, endDate, page = 1, limit = 20 } = {}) {
  const where = {};

  // Role-based scoping (Strict IDOR enforcement)
  if (user.role === 'SUPPLIER') {
    where.supplierId = user.id;
  } else if (user.role === 'BUYER') {
    where.buyerId = user.id;
  } else if (user.role === 'TRANSPORT_PARTNER') {
    // Transporter sees shipments assigned to their transport company
    const myCompany = await prisma.transportCompany.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });
    if (myCompany) {
      where.transporterId = myCompany.id;
    } else {
      return { shipments: [], total: 0, page, totalPages: 0 };
    }
  }
  // ADMIN and SUPER_ADMIN see all

  if (status) where.status = status;
  if (transportMethod) where.transportMethod = transportMethod;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (search) {
    where.OR = [
      { shipmentNumber: { contains: search } },
      { trackingNumber: { contains: search } },
      { vehicleNumber: { contains: search } },
      { driverName: { contains: search } },
      { lrNumber: { contains: search } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, shipments] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, company: true, email: true, phone: true } },
        buyer: { select: { id: true, name: true, company: true, email: true, phone: true } },
        transporter: { select: { id: true, name: true, phone: true, rating: true, ibaApproved: true } },
        vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, make: true } },
        driver: { select: { id: true, name: true, phone: true, licenseNumber: true } },
        order: { select: { id: true, orderNumber: true, total: true } },
        documents: true,
        deliveryProof: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    shipments,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / take),
  };
}

export async function getShipmentById(id, user) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, company: true, email: true, phone: true } },
      buyer: { select: { id: true, name: true, company: true, email: true, phone: true } },
      transporter: {
        include: {
          vehicles: { select: { id: true, vehicleNumber: true, vehicleType: true, status: true } },
          drivers: { select: { id: true, name: true, phone: true, status: true } },
        },
      },
      vehicle: true,
      driver: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          items: true,
        },
      },
      documents: true,
      events: { orderBy: { timestamp: 'desc' } },
      locations: {
        take: 50,
        orderBy: { recordedAt: 'desc' },
      },
      deliveryProof: true,
      freightPayment: true,
    },
  });

  if (!shipment) {
    const error = new Error('Shipment not found.');
    error.statusCode = 404;
    throw error;
  }

  // IDOR protection check
  if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    const isSupplier = shipment.supplierId === user.id;
    const isBuyer = shipment.buyerId === user.id;
    const isTransporterOwner = shipment.transporter?.ownerId === user.id;

    if (!isSupplier && !isBuyer && !isTransporterOwner) {
      const error = new Error('Forbidden. You do not have access to view this shipment.');
      error.statusCode = 403;
      throw error;
    }
  }

  return shipment;
}

export async function getShipmentByTrackingNumber(trackingNumber) {
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: trackingNumber.trim() },
    select: {
      id: true,
      shipmentNumber: true,
      trackingNumber: true,
      transportMethod: true,
      status: true,
      vehicleNumber: true,
      driverName: true,
      pickupScheduledAt: true,
      pickedUpAt: true,
      dispatchedAt: true,
      estimatedDeliveryAt: true,
      deliveredAt: true,
      pickupAddress: true,
      deliveryAddress: true,
      currentLocation: true,
      events: {
        select: {
          id: true,
          status: true,
          title: true,
          description: true,
          location: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
      },
      locations: {
        take: 30,
        orderBy: { recordedAt: 'desc' },
      },
    },
  });

  if (!shipment) {
    const error = new Error('Tracking number not found.');
    error.statusCode = 404;
    throw error;
  }

  return shipment;
}

// ==========================================
// 8. CONTROLLED STATUS TRANSITIONS
// ==========================================

export async function updateShipmentStatus(id, user, { newStatus, notes, location, latitude, longitude }) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id },
      include: {
        transporter: true,
        vehicle: true,
        driver: true,
      },
    });

    if (!shipment) {
      const error = new Error('Shipment not found.');
      error.statusCode = 404;
      throw error;
    }

    // Authorize participant or Admin
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const isSupplier = shipment.supplierId === user.id;
      const isBuyer = shipment.buyerId === user.id;
      const isTransporter = shipment.transporter?.ownerId === user.id;

      if (!isSupplier && !isBuyer && !isTransporter) {
        const error = new Error('Forbidden. You cannot update this shipment.');
        error.statusCode = 403;
        throw error;
      }
    }

    // State machine transition validation
    const transitionCheck = validateStatusTransition(shipment.status, newStatus, user.role);
    if (!transitionCheck.valid) {
      const error = new Error(transitionCheck.error);
      error.statusCode = 400;
      throw error;
    }

    // Step 4 & 5 rule: Required verification must be complete before dispatch
    if ([SHIPMENT_STATUSES.PICKED_UP, SHIPMENT_STATUSES.IN_TRANSIT, SHIPMENT_STATUSES.OUT_FOR_DELIVERY].includes(newStatus)) {
      if (shipment.status === SHIPMENT_STATUSES.DOCUMENTS_PENDING || shipment.status === SHIPMENT_STATUSES.TRANSPORT_PENDING) {
        const error = new Error('Shipment cannot be dispatched. Required Super Admin verification must be complete before dispatch.');
        error.statusCode = 400;
        throw error;
      }
    }

    const updatePayload = {
      status: newStatus,
    };

    if (newStatus === SHIPMENT_STATUSES.PICKED_UP) {
      updatePayload.pickedUpAt = new Date();
      updatePayload.dispatchedAt = new Date();
      // Step 5: Update linked order status to SHIPPED
      if (shipment.orderId) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { orderStatus: 'SHIPPED' },
        }).catch(() => {});
      }
      if (shipment.buyerId) {
        await createNotification({
          userId: shipment.buyerId,
          title: 'Consignment Dispatched!',
          message: `Your consignment (AWB: ${shipment.trackingNumber}) has been picked up and dispatched.`,
          type: 'SHIPMENT',
          link: `/buyer/shipments`,
        }).catch(() => {});
      }
    } else if (newStatus === SHIPMENT_STATUSES.IN_TRANSIT) {
      if (!shipment.dispatchedAt) {
        updatePayload.dispatchedAt = new Date();
      }
      if (shipment.orderId) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { orderStatus: 'SHIPPED' },
        }).catch(() => {});
      }
    } else if (newStatus === SHIPMENT_STATUSES.DELIVERED) {
      updatePayload.deliveredAt = new Date();
    } else if (newStatus === SHIPMENT_STATUSES.CANCELLED) {
      updatePayload.cancelledAt = new Date();
    } else if (newStatus === SHIPMENT_STATUSES.DELIVERY_DISPUTED) {
      updatePayload.disputedAt = new Date();
      updatePayload.disputeStatus = 'PENDING';
      updatePayload.disputeReason = notes || 'Delivery condition or consignment dispute raised.';
    }

    // Update coordinates if provided
    if (latitude && longitude) {
      updatePayload.currentLocation = {
        lat: Number(latitude),
        lng: Number(longitude),
        address: location || 'En route checkpoint',
        timestamp: new Date().toISOString(),
      };
    }

    const updatedShipment = await tx.shipment.update({
      where: { id },
      data: updatePayload,
    });

    // Record audit event
    await tx.shipmentEvent.create({
      data: {
        shipmentId: id,
        status: newStatus,
        title: `Status updated to ${newStatus.replace(/_/g, ' ')}`,
        description: notes || `Shipment transition triggered by ${user.role}.`,
        location: location || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
      },
    });

    // Release vehicle and driver when shipment concludes
    if (newStatus === SHIPMENT_STATUSES.DELIVERED || newStatus === SHIPMENT_STATUSES.CANCELLED || newStatus === SHIPMENT_STATUSES.RETURNED) {
      if (shipment.vehicleId) {
        await tx.transportVehicle.update({
          where: { id: shipment.vehicleId },
          data: { status: 'AVAILABLE' },
        });
      }
      if (shipment.driverId) {
        await tx.transportDriver.update({
          where: { id: shipment.driverId },
          data: { status: 'AVAILABLE' },
        });
      }

      // If delivered and linked to an Order, update Order Status to DELIVERED
      if (newStatus === SHIPMENT_STATUSES.DELIVERED && shipment.orderId) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: {
            orderStatus: 'DELIVERED',
            deliveryAcceptedAt: new Date(),
          },
        });
      }
    }

    // Emit real-time updates via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`shipment:${id}`).emit('shipment:status_changed', {
        shipmentId: id,
        status: newStatus,
        notes,
        location,
        updatedAt: new Date().toISOString(),
      });
      if (shipment.supplierId) io.to(`user:${shipment.supplierId}`).emit('shipment:updated', updatedShipment);
      if (shipment.buyerId) io.to(`user:${shipment.buyerId}`).emit('shipment:updated', updatedShipment);
    }

    return updatedShipment;
  });
}

// ==========================================
// 9. VEHICLE & DRIVER ASSIGNMENT
// ==========================================

export async function assignVehicleAndDriver(shipmentId, user, { vehicleId, driverId }) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: { transporter: true },
    });

    if (!shipment) {
      const error = new Error('Shipment not found.');
      error.statusCode = 404;
      throw error;
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const isSupplier = shipment.supplierId === user.id;
      const isTransporter = shipment.transporter?.ownerId === user.id;
      if (!isSupplier && !isTransporter) {
        const error = new Error('Unauthorized to assign fleet to this shipment.');
        error.statusCode = 403;
        throw error;
      }
    }

    const vehicle = await tx.transportVehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      const error = new Error('Vehicle not found.');
      error.statusCode = 404;
      throw error;
    }

    const driver = await tx.transportDriver.findUnique({ where: { id: driverId } });
    if (!driver) {
      const error = new Error('Driver not found.');
      error.statusCode = 404;
      throw error;
    }

    if (vehicle.status !== 'AVAILABLE') {
      const error = new Error(`Vehicle ${vehicle.vehicleNumber} is currently ${vehicle.status}.`);
      error.statusCode = 400;
      throw error;
    }

    if (driver.status !== 'AVAILABLE') {
      const error = new Error(`Driver ${driver.name} is currently ${driver.status}.`);
      error.statusCode = 400;
      throw error;
    }

    // Release old vehicle/driver if previously assigned
    if (shipment.vehicleId && shipment.vehicleId !== vehicleId) {
      await tx.transportVehicle.update({
        where: { id: shipment.vehicleId },
        data: { status: 'AVAILABLE' },
      });
    }
    if (shipment.driverId && shipment.driverId !== driverId) {
      await tx.transportDriver.update({
        where: { id: shipment.driverId },
        data: { status: 'AVAILABLE' },
      });
    }

    // Reserve new vehicle and driver
    await tx.transportVehicle.update({
      where: { id: vehicleId },
      data: { status: 'ASSIGNED' },
    });
    await tx.transportDriver.update({
      where: { id: driverId },
      data: { status: 'ASSIGNED' },
    });

    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        vehicleId,
        driverId,
        vehicleNumber: vehicle.vehicleNumber,
        driverName: driver.name,
        driverPhone: driver.phone,
        status: SHIPMENT_STATUSES.DOCUMENTS_PENDING,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipmentId,
        status: SHIPMENT_STATUSES.DOCUMENTS_PENDING,
        title: 'Vehicle & Driver Assigned (Awaiting Super Admin Verification)',
        description: `Assigned Vehicle ${vehicle.vehicleNumber} (${vehicle.vehicleType}) and Driver ${driver.name} (Ph: ${driver.phone}). Required Super Admin verification must be completed before dispatch.`,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
      },
    });

    return updatedShipment;
  });
}

// ==========================================
// 10. REAL GPS TELEMETRY (NO FAKE DATA)
// ==========================================

export async function recordGpsTelemetry(shipmentId, user, data) {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);

  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    const error = new Error('Invalid latitude coordinates.');
    error.statusCode = 400;
    throw error;
  }

  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    const error = new Error('Invalid longitude coordinates.');
    error.statusCode = 400;
    throw error;
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    const error = new Error('Shipment not found.');
    error.statusCode = 404;
    throw error;
  }

  const locationRecord = await prisma.shipmentLocation.create({
    data: {
      shipmentId,
      vehicleId: shipment.vehicleId,
      latitude,
      longitude,
      altitude: data.altitude ? Number(data.altitude) : null,
      speed: data.speed ? Number(data.speed) : null,
      heading: data.heading ? Number(data.heading) : null,
      accuracy: data.accuracy ? Number(data.accuracy) : null,
      address: data.address || null,
      batteryLevel: data.batteryLevel ? parseInt(data.batteryLevel, 10) : null,
      source: data.source || 'DRIVER_APP',
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
    },
  });

  const locationSnapshot = {
    lat: latitude,
    lng: longitude,
    speed: data.speed ? Number(data.speed) : 0,
    heading: data.heading ? Number(data.heading) : 0,
    accuracy: data.accuracy ? Number(data.accuracy) : 5,
    address: data.address || '',
    timestamp: locationRecord.recordedAt.toISOString(),
  };

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      currentLocation: locationSnapshot,
    },
  });

  // Broadcast live telemetry to clients watching this shipment
  const io = getIO();
  if (io) {
    io.to(`shipment:${shipmentId}`).emit('shipment:telemetry', {
      shipmentId,
      location: locationSnapshot,
    });
  }

  return locationRecord;
}

export async function getShipmentLocations(shipmentId, user) {
  await getShipmentById(shipmentId, user); // Validates IDOR access

  return prisma.shipmentLocation.findMany({
    where: { shipmentId },
    orderBy: { recordedAt: 'asc' },
  });
}

// ==========================================
// 11. DOCUMENTS MANAGEMENT
// ==========================================

export async function uploadShipmentDocument(shipmentId, user, docData) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    const error = new Error('Shipment not found.');
    error.statusCode = 404;
    throw error;
  }

  const doc = await prisma.shipmentDocument.create({
    data: {
      shipmentId,
      docType: docData.docType || 'LR_BILTY',
      docNumber: docData.docNumber || null,
      title: docData.title || 'Document',
      fileUrl: docData.fileUrl,
      fileName: docData.fileName || 'document.pdf',
      fileSize: docData.fileSize || 0,
      mimeType: docData.mimeType || 'application/pdf',
      uploadedByUserId: user.id,
      uploadedByRole: user.role,
      isVerified: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
    },
  });

  await prisma.shipmentEvent.create({
    data: {
      shipmentId,
      status: shipment.status,
      title: `Document Uploaded: ${doc.title}`,
      description: `Uploaded by ${user.role} (${doc.docType}).`,
      actorId: user.id,
      actorRole: user.role,
      actorName: user.name,
    },
  });

  return doc;
}

export async function verifyShipmentDocument(documentId, adminOrTransporterUser, { isVerified }) {
  const doc = await prisma.shipmentDocument.update({
    where: { id: documentId },
    data: {
      isVerified: Boolean(isVerified),
      verifiedBy: adminOrTransporterUser.name || adminOrTransporterUser.email,
      verifiedAt: isVerified ? new Date() : null,
    },
  });

  return doc;
}

export async function verifyShipment(shipmentId, adminUser, { isApproved, action, reason }) {
  if (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ADMIN') {
    const error = new Error('Forbidden. Only Super Admin or Admin can verify shipments.');
    error.statusCode = 403;
    throw error;
  }

  const effectiveAction = (action || (isApproved ? 'APPROVE' : 'REJECT')).toUpperCase();

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: true,
        documents: true,
        vehicle: true,
        driver: true,
        transporter: true,
      },
    });

    if (!shipment) {
      const error = new Error('Shipment not found.');
      error.statusCode = 404;
      throw error;
    }

    if (effectiveAction === 'APPROVE' || isApproved === true) {
      // 1. Transition to READY_FOR_PICKUP
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: SHIPMENT_STATUSES.READY_FOR_PICKUP,
          notes: reason ? `[Approved] ${reason}` : 'Approved by Super Admin for dispatch.',
        },
      });

      // 2. Mark attached documents as verified
      await tx.shipmentDocument.updateMany({
        where: { shipmentId },
        data: {
          isVerified: true,
          verifiedBy: adminUser.name || 'Super Admin',
          verifiedAt: new Date(),
        },
      });

      // 3. Mark vehicle & driver verified if associated
      if (shipment.vehicleId) {
        await tx.transportVehicle.update({
          where: { id: shipment.vehicleId },
          data: { isVerified: true, verifiedAt: new Date(), verificationNotes: 'Verified during shipment approval' },
        }).catch(() => {});
      }
      if (shipment.driverId) {
        await tx.transportDriver.update({
          where: { id: shipment.driverId },
          data: { isVerified: true, verificationNotes: 'Verified during shipment approval' },
        }).catch(() => {});
      }

      // 4. Create verification audit event
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          status: SHIPMENT_STATUSES.READY_FOR_PICKUP,
          title: 'Shipment Verified & Approved by Super Admin',
          description: reason || `Vehicle (${shipment.vehicleNumber}), driver (${shipment.driverName}) and transport documents verified by ${adminUser.name}. Approved for dispatch.`,
          actorId: adminUser.id,
          actorRole: adminUser.role,
          actorName: adminUser.name,
        },
      });

      // 5. Notify supplier
      if (shipment.supplierId) {
        await createNotification({
          userId: shipment.supplierId,
          title: `Shipment #${shipment.shipmentNumber} Approved for Dispatch`,
          message: `Super Admin has approved vehicle (${shipment.vehicleNumber}) and documents. Consignment is ready for pickup and dispatch.`,
          type: 'SHIPMENT',
          link: `/supplier/shipping`,
        }).catch(() => {});
      }

      const io = getIO();
      if (io) {
        io.to(`shipment:${shipmentId}`).emit('shipment:status_changed', {
          shipmentId,
          status: SHIPMENT_STATUSES.READY_FOR_PICKUP,
          notes: 'Shipment verified and approved by Super Admin.',
          updatedAt: new Date().toISOString(),
        });
        if (shipment.supplierId) io.to(`user:${shipment.supplierId}`).emit('shipment:updated', updatedShipment);
      }

      return updatedShipment;
    } else if (effectiveAction === 'CORRECTION' || effectiveAction === 'REQUEST_CORRECTION') {
      // Correction Requested branch: remains in DOCUMENTS_PENDING for rectification
      const correctionNote = reason || 'Super Admin requested corrections on vehicle or document submission.';
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: SHIPMENT_STATUSES.DOCUMENTS_PENDING,
          notes: `[Correction Requested] ${correctionNote}`,
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          status: SHIPMENT_STATUSES.DOCUMENTS_PENDING,
          title: 'Correction Requested by Super Admin',
          description: correctionNote,
          actorId: adminUser.id,
          actorRole: adminUser.role,
          actorName: adminUser.name,
        },
      });

      if (shipment.supplierId) {
        await createNotification({
          userId: shipment.supplierId,
          title: `Action Required: Correction Requested on Shipment #${shipment.shipmentNumber}`,
          message: `Super Admin requested updates: ${correctionNote}. Please review truck details and documents.`,
          type: 'SHIPMENT',
          link: `/supplier/shipping`,
        }).catch(() => {});
      }

      const io = getIO();
      if (io) {
        io.to(`shipment:${shipmentId}`).emit('shipment:correction_requested', {
          shipmentId,
          reason: correctionNote,
          updatedAt: new Date().toISOString(),
        });
        if (shipment.supplierId) io.to(`user:${shipment.supplierId}`).emit('shipment:updated', updatedShipment);
      }

      return updatedShipment;
    } else {
      // Rejection branch: cancel consignment and release fleet
      const rejectionNote = reason || 'Vehicle, driver, or transport documents rejected by Super Admin.';
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: SHIPMENT_STATUSES.CANCELLED,
          notes: `[Verification Rejected] ${rejectionNote}`,
        },
      });

      // Free vehicle & driver back to available if assigned
      if (shipment.vehicleId) {
        await tx.transportVehicle.update({
          where: { id: shipment.vehicleId },
          data: { status: 'AVAILABLE' },
        }).catch(() => {});
      }
      if (shipment.driverId) {
        await tx.transportDriver.update({
          where: { id: shipment.driverId },
          data: { status: 'AVAILABLE' },
        }).catch(() => {});
      }

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          status: SHIPMENT_STATUSES.CANCELLED,
          title: 'Shipment Verification Rejected by Super Admin',
          description: rejectionNote,
          actorId: adminUser.id,
          actorRole: adminUser.role,
          actorName: adminUser.name,
        },
      });

      if (shipment.supplierId) {
        await createNotification({
          userId: shipment.supplierId,
          title: `Shipment #${shipment.shipmentNumber} Verification Rejected`,
          message: `Reason: ${rejectionNote}`,
          type: 'SHIPMENT',
          link: `/supplier/shipping`,
        }).catch(() => {});
      }

      const io = getIO();
      if (io) {
        io.to(`shipment:${shipmentId}`).emit('shipment:rejected', {
          shipmentId,
          reason: rejectionNote,
        });
        if (shipment.supplierId) io.to(`user:${shipment.supplierId}`).emit('shipment:updated', updatedShipment);
      }

      return updatedShipment;
    }
  });
}

// ==========================================
// 12. PROOF OF DELIVERY (POD) & OTP
// ==========================================

export async function recordDeliveryProof(shipmentId, user, data) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });

    if (!shipment) {
      const error = new Error('Shipment not found.');
      error.statusCode = 404;
      throw error;
    }

    // OTP validation if OTP was entered
    let otpVerified = false;
    if (data.deliveryOtp) {
      if (shipment.deliveryOtp && shipment.deliveryOtp === data.deliveryOtp.trim()) {
        otpVerified = true;
      } else {
        const error = new Error('Invalid delivery confirmation OTP.');
        error.statusCode = 400;
        throw error;
      }
    }

    const pod = await tx.deliveryProof.upsert({
      where: { shipmentId },
      update: {
        recipientName: data.recipientName.trim(),
        recipientPhone: data.recipientPhone || null,
        recipientIdProof: data.recipientIdProof || null,
        otpVerified,
        signatureUrl: data.signatureUrl || null,
        photoProofUrls: data.photoProofUrls || [],
        condition: data.condition || 'GOOD',
        receiverNotes: data.receiverNotes || null,
        driverNotes: data.driverNotes || null,
        receivedAt: new Date(),
      },
      create: {
        shipmentId,
        recipientName: data.recipientName.trim(),
        recipientPhone: data.recipientPhone || null,
        recipientIdProof: data.recipientIdProof || null,
        otpVerified,
        signatureUrl: data.signatureUrl || null,
        photoProofUrls: data.photoProofUrls || [],
        condition: data.condition || 'GOOD',
        receiverNotes: data.receiverNotes || null,
        driverNotes: data.driverNotes || null,
        receivedAt: new Date(),
      },
    });

    // Mark shipment DELIVERED
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: SHIPMENT_STATUSES.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    // Release vehicle and driver
    if (shipment.vehicleId) {
      await tx.transportVehicle.update({
        where: { id: shipment.vehicleId },
        data: { status: 'AVAILABLE' },
      });
    }
    if (shipment.driverId) {
      await tx.transportDriver.update({
        where: { id: shipment.driverId },
        data: { status: 'AVAILABLE' },
      });
    }

    // Step 7: Update order status to DELIVERED ONLY when all required fulfillment shipments are delivered
    if (shipment.orderId) {
      const allOrderShipments = await tx.shipment.findMany({
        where: { orderId: shipment.orderId },
        select: { id: true, status: true },
      });

      const allDelivered = allOrderShipments.every(
        (s) => s.id === shipmentId || s.status === SHIPMENT_STATUSES.DELIVERED
      );

      if (allDelivered) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: {
            orderStatus: 'DELIVERED',
            deliveryAcceptedAt: new Date(),
          },
        });

        if (shipment.buyerId) {
          await createNotification({
            userId: shipment.buyerId,
            title: `Order #${shipment.order?.orderNumber || ''} Delivered!`,
            message: `All fulfillment shipments for your order have been successfully delivered and verified.`,
            type: 'ORDER',
            link: `/buyer/orders`,
          }).catch(() => {});
        }
      }
    }

    await tx.shipmentEvent.create({
      data: {
        shipmentId,
        status: SHIPMENT_STATUSES.DELIVERED,
        title: 'Consignment Delivered Successfully',
        description: `Delivered to ${pod.recipientName}. Condition: ${pod.condition}. Proof of delivery recorded.`,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
      },
    });

    // Broadcast
    const io = getIO();
    if (io) {
      io.to(`shipment:${shipmentId}`).emit('shipment:delivered', {
        shipmentId,
        pod,
      });
    }

    return pod;
  });
}

// ==========================================
// 13. DELIVERY DISPUTES
// ==========================================

export async function raiseDeliveryDispute(shipmentId, buyerUser, { reason, description, photoProofUrl }) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    const error = new Error('Shipment not found.');
    error.statusCode = 404;
    throw error;
  }

  if (shipment.buyerId !== buyerUser.id && buyerUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only the recipient buyer can report a delivery dispute.');
    error.statusCode = 403;
    throw error;
  }

  const updatedShipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: SHIPMENT_STATUSES.DELIVERY_DISPUTED,
      disputedAt: new Date(),
      disputeReason: reason ? `${reason}: ${description}` : description,
      disputeStatus: 'INVESTIGATING',
    },
  });

  await prisma.shipmentEvent.create({
    data: {
      shipmentId,
      status: SHIPMENT_STATUSES.DELIVERY_DISPUTED,
      title: 'Delivery Dispute Reported by Buyer',
      description: `Reason: ${reason || 'Goods damaged / missing'}. ${description}`,
      actorId: buyerUser.id,
      actorRole: buyerUser.role,
      actorName: buyerUser.name,
    },
  });

  return updatedShipment;
}

export async function resolveDeliveryDispute(shipmentId, adminUser, { resolution, refundAmount, closeStatus = 'DELIVERED' }) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: closeStatus,
        disputeStatus: 'RESOLVED',
        notes: `Dispute resolved by Admin: ${resolution}.`,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipmentId,
        status: closeStatus,
        title: 'Delivery Dispute Resolved by Super Admin',
        description: `Resolution: ${resolution}. Final shipment status: ${closeStatus}.`,
        actorId: adminUser.id,
        actorRole: adminUser.role,
        actorName: adminUser.name,
      },
    });

    // If freight refund was authorized
    if (refundAmount && Number(refundAmount) > 0) {
      await tx.freightPayment.updateMany({
        where: { shipmentId },
        data: {
          escrowStatus: 'REFUNDED',
          releasedAt: new Date(),
        },
      });
    }

    return shipment;
  });
}

// ==========================================
// 14. FREIGHT ESCROW PAYMENTS
// ==========================================

export async function getFreightPayments(user, { status, startDate, endDate } = {}) {
  const where = {};
  if (status) where.escrowStatus = status;

  if (user.role === 'TRANSPORT_PARTNER') {
    const myCompany = await prisma.transportCompany.findFirst({ where: { ownerId: user.id } });
    if (myCompany) {
      where.transporterId = myCompany.id;
    } else {
      return [];
    }
  } else if (user.role === 'SUPPLIER') {
    where.payerId = user.id;
  }

  return prisma.freightPayment.findMany({
    where,
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          trackingNumber: true,
          status: true,
          deliveredAt: true,
        },
      },
      transporter: {
        select: { id: true, name: true, phone: true, gstin: true },
      },
      payer: {
        select: { id: true, name: true, company: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function releaseFreightEscrow(id, adminUser, reason) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.freightPayment.findUnique({
      where: { id },
      include: { shipment: true, transporter: true },
    });

    if (!payment) {
      const error = new Error('Freight payment record not found.');
      error.statusCode = 404;
      throw error;
    }

    if (payment.escrowStatus !== 'HELD') {
      const error = new Error(`Payment is already in status '${payment.escrowStatus}'.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await tx.freightPayment.update({
      where: { id },
      data: {
        escrowStatus: 'RELEASED',
        releasedAt: new Date(),
        transactionRef: `TRX-PAY-${Date.now()}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        action: 'FREIGHT_ESCROW_RELEASE',
        resource: 'FREIGHT_PAYMENTS',
        targetId: id,
        details: {
          grossAmount: payment.grossAmount,
          netPayable: payment.netPayable,
          transporterId: payment.transporterId,
          reason,
        },
        result: 'SUCCESS',
      },
    });

    return updated;
  });
}

// ==========================================
// 15. METRICS & OVERVIEW
// ==========================================

export async function getLogisticsMetrics(user) {
  const where = {};
  if (user.role === 'SUPPLIER') where.supplierId = user.id;
  else if (user.role === 'BUYER') where.buyerId = user.id;
  else if (user.role === 'TRANSPORT_PARTNER') {
    const comp = await prisma.transportCompany.findFirst({ where: { ownerId: user.id } });
    if (comp) where.transporterId = comp.id;
  }

  const [
    totalShipments,
    inTransit,
    delivered,
    disputed,
    openRequests,
    activeVehicles,
    activeDrivers,
  ] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.count({ where: { ...where, status: { in: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } }),
    prisma.shipment.count({ where: { ...where, status: 'DELIVERED' } }),
    prisma.shipment.count({ where: { ...where, status: 'DELIVERY_DISPUTED' } }),
    prisma.transportRequest.count({ where: user.role === 'SUPPLIER' ? { supplierId: user.id } : { status: 'OPEN' } }),
    prisma.transportVehicle.count({ where: { status: 'AVAILABLE' } }),
    prisma.transportDriver.count({ where: { status: 'AVAILABLE' } }),
  ]);

  return {
    totalShipments,
    inTransit,
    delivered,
    disputed,
    openRequests,
    availableVehicles: activeVehicles,
    availableDrivers: activeDrivers,
  };
}

