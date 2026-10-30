import * as logisticsService from '../services/logisticsService.js';

// --- Companies ---
export async function createCompany(req, res, next) {
  try {
    const company = await logisticsService.createTransportCompany(req.user, req.body);
    res.status(201).json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
}

export async function listCompanies(req, res, next) {
  try {
    const companies = await logisticsService.getTransportCompanies(req.query);
    res.json({ success: true, data: companies });
  } catch (err) {
    next(err);
  }
}

export async function getCompanyById(req, res, next) {
  try {
    const company = await logisticsService.getTransportCompanyById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Transport company not found.' });
    }
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
}

export async function verifyCompany(req, res, next) {
  try {
    const company = await logisticsService.verifyTransportCompany(req.params.id, req.user, req.body);
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
}

// --- Vehicles ---
export async function addVehicle(req, res, next) {
  try {
    const vehicle = await logisticsService.addVehicle(req.user, req.body.companyId, req.body);
    res.status(201).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

export async function listVehicles(req, res, next) {
  try {
    const vehicles = await logisticsService.getVehicles(req.query);
    res.json({ success: true, data: vehicles });
  } catch (err) {
    next(err);
  }
}

export async function verifyVehicle(req, res, next) {
  try {
    const vehicle = await logisticsService.verifyVehicle(req.params.id, req.user, req.body);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

// --- Drivers ---
export async function addDriver(req, res, next) {
  try {
    const driver = await logisticsService.addDriver(req.user, req.body.companyId, req.body);
    res.status(201).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

export async function listDrivers(req, res, next) {
  try {
    const drivers = await logisticsService.getDrivers(req.query);
    res.json({ success: true, data: drivers });
  } catch (err) {
    next(err);
  }
}

export async function verifyDriver(req, res, next) {
  try {
    const driver = await logisticsService.verifyDriver(req.params.id, req.user, req.body);
    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// --- Transport Requests ---
export async function createTransportRequest(req, res, next) {
  try {
    const request = await logisticsService.createTransportRequest(req.user, req.body);
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

export async function listTransportRequests(req, res, next) {
  try {
    const requests = await logisticsService.getTransportRequests(req.user, req.query);
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

export async function listOpenRequestsForPartners(req, res, next) {
  try {
    const requests = await logisticsService.getOpenTransportRequestsForPartners(req.user);
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

// --- Freight Quotes ---
export async function submitFreightQuote(req, res, next) {
  try {
    const quote = await logisticsService.submitFreightQuote(req.user, req.params.requestId, req.body);
    res.status(201).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
}

export async function acceptFreightQuote(req, res, next) {
  try {
    const shipment = await logisticsService.acceptFreightQuote(req.user, req.params.quoteId);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

// --- Shipments ---
export async function createSupplierShipment(req, res, next) {
  try {
    const shipment = await logisticsService.createSupplierManagedShipment(req.user, req.body);
    res.status(201).json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function listShipments(req, res, next) {
  try {
    const result = await logisticsService.getShipments(req.user, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getShipmentById(req, res, next) {
  try {
    const shipment = await logisticsService.getShipmentById(req.params.id, req.user);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function trackByNumber(req, res, next) {
  try {
    const shipment = await logisticsService.getShipmentByTrackingNumber(req.params.trackingNumber);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const shipment = await logisticsService.updateShipmentStatus(req.params.id, req.user, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function verifyShipment(req, res, next) {
  try {
    const shipment = await logisticsService.verifyShipment(req.params.id, req.user, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function assignVehicleAndDriver(req, res, next) {
  try {
    const shipment = await logisticsService.assignVehicleAndDriver(req.params.id, req.user, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function uploadDocument(req, res, next) {
  try {
    const doc = await logisticsService.uploadShipmentDocument(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function verifyDocument(req, res, next) {
  try {
    const doc = await logisticsService.verifyShipmentDocument(req.params.docId, req.user, req.body);
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function recordDeliveryProof(req, res, next) {
  try {
    const pod = await logisticsService.recordDeliveryProof(req.params.id, req.user, req.body);
    res.json({ success: true, data: pod });
  } catch (err) {
    next(err);
  }
}

export async function raiseDispute(req, res, next) {
  try {
    const shipment = await logisticsService.raiseDeliveryDispute(req.params.id, req.user, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function resolveDispute(req, res, next) {
  try {
    const shipment = await logisticsService.resolveDeliveryDispute(req.params.id, req.user, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) {
    next(err);
  }
}

export async function recordTelemetry(req, res, next) {
  try {
    const location = await logisticsService.recordGpsTelemetry(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: location });
  } catch (err) {
    next(err);
  }
}

export async function getTelemetry(req, res, next) {
  try {
    const locations = await logisticsService.getShipmentLocations(req.params.id, req.user);
    res.json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
}

// --- Freight Payments ---
export async function listFreightPayments(req, res, next) {
  try {
    const payments = await logisticsService.getFreightPayments(req.user, req.query);
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

export async function releaseFreightPayment(req, res, next) {
  try {
    const payment = await logisticsService.releaseFreightEscrow(req.params.id, req.user, req.body.reason);
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

// --- Metrics ---
export async function getMetrics(req, res, next) {
  try {
    const metrics = await logisticsService.getLogisticsMetrics(req.user);
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
}

