import crypto from 'node:crypto';
import prisma from '../../config/db.js';
import { auditTransport } from './transportAudit.js';
import { VEHICLE_BUSY_STATUSES } from './shipmentStateMachine.js';

/**
 * Trucks, drivers and transport providers.
 *
 * A supplier's own trucks live in their private fleet (a TransportCompany of type SUPPLIER_FLEET owned by them).
 * TradeExpress's trucks live in the platform fleet, and outside transporters are TransportCompany rows of type
 * THIRD_PARTY managed by Super Admin. Suppliers can only see and use their own fleet.
 */

export const VEHICLE_TYPES = ['MINI_TRUCK', 'LCV', 'OPEN_TRUCK', 'CLOSED_TRUCK', 'CONTAINER_20FT', 'CONTAINER_32FT', 'TRAILER', 'FLATBED', 'REEFER', 'TANKER'];
export const BODY_TYPES = ['OPEN', 'CLOSED', 'CONTAINER', 'FLATBED', 'REEFER', 'TANKER'];
export const OWNERSHIP_TYPES = ['OWNED', 'LEASED', 'HIRED'];
export const VEHICLE_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'INACTIVE'];
export const LICENSE_CLASSES = ['LMV', 'TRANSPORT_LMV', 'COMMERCIAL_HEAVY', 'HAZARDOUS', 'ODC'];
export const DRIVER_STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_DUTY', 'ON_LEAVE', 'INACTIVE'];

const PLATFORM_FLEET_SLUG = 'tradeexpress-platform-fleet';

const isStaff = (user) => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function code(prefix) {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `${prefix}-${date}-${crypto.randomInt(100000, 999999)}`;
}

const clean = (value) => (typeof value === 'string' ? value.trim() : value);
const optionalText = (value, max = 500) => {
  const text = clean(value);
  if (text === undefined || text === null || text === '') return null;
  return String(text).slice(0, max);
};

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail(`${label} is not a valid date.`);
  return date;
}

function optionalNumber(value, label, { min = 0, max = 1e7 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw fail(`${label} must be a number between ${min} and ${max}.`);
  return number;
}

/** "mh 12-ab 1234" -> "MH12AB1234". Accepts state series and BH series plates. */
export function normaliseVehicleNumber(value) {
  const plate = String(value || '').toUpperCase().replace(/[\s.-]/g, '');
  const stateSeries = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;
  const bhSeries = /^\d{2}BH\d{4}[A-Z]{1,2}$/;
  if (!stateSeries.test(plate) && !bhSeries.test(plate)) {
    throw fail('Enter a valid Indian vehicle registration number, for example MH 12 AB 1234.');
  }
  return plate;
}

/** Driving licence numbers are 15-16 characters (state code + RTO + year + serial). */
export function normaliseLicenceNumber(value) {
  const licence = String(value || '').toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{9,13}$/.test(licence)) {
    throw fail('Enter a valid driving licence number, for example MH14 20110012345.');
  }
  return licence;
}

function normalisePhone(value, label, required = true) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!digits && !required) return null;
  if (!/^[6-9]\d{9}$/.test(digits)) throw fail(`${label} must be a 10-digit Indian mobile number.`);
  return digits;
}

export const maskLicence = (value) => (value ? `${value.slice(0, 4)}${'•'.repeat(Math.max(0, value.length - 7))}${value.slice(-3)}` : null);
export const maskPhone = (value) => (value ? `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : null);
const maskAadhaar = (value) => (value ? `XXXX XXXX ${String(value).replace(/\D/g, '').slice(-4)}` : null);

// ---------------------------------------------------------------------------
// Fleets (TransportCompany)
// ---------------------------------------------------------------------------

/** The supplier's private fleet, created on first use. */
export async function getSupplierFleet(supplier, tx = prisma) {
  const existing = await tx.transportCompany.findUnique({ where: { ownerId: supplier.id } });
  if (existing) return existing;
  const profile = await tx.user.findUnique({ where: { id: supplier.id }, select: { name: true, email: true, phone: true, company: true, city: true, state: true } });
  return tx.transportCompany.create({
    data: {
      name: `${profile?.company || profile?.name || 'Supplier'} Fleet`,
      slug: `fleet-${supplier.id}`,
      companyType: 'SUPPLIER_FLEET',
      ownerId: supplier.id,
      contactPerson: profile?.name || 'Supplier',
      email: profile?.email || 'unknown@tradeexpress.local',
      phone: profile?.phone || '',
      city: profile?.city || null,
      state: profile?.state || null,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });
}

/** TradeExpress's own fleet, used when Super Admin registers platform trucks. */
export async function getPlatformFleet(tx = prisma) {
  const existing = await tx.transportCompany.findUnique({ where: { slug: PLATFORM_FLEET_SLUG } });
  if (existing) return existing;
  return tx.transportCompany.create({
    data: {
      name: 'TradeExpress Fleet',
      slug: PLATFORM_FLEET_SLUG,
      companyType: 'TRADEEXPRESS_PARTNER',
      contactPerson: 'TradeExpress Operations',
      email: 'operations@tradeexpress.local',
      phone: '',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });
}

/** Which fleet a new truck or driver goes into. Suppliers always use their own; admins pick a provider. */
async function resolveFleetForWrite(user, providerId) {
  if (!isStaff(user)) return getSupplierFleet(user);
  if (!providerId) return getPlatformFleet();
  const provider = await prisma.transportCompany.findUnique({ where: { id: String(providerId) } });
  if (!provider || provider.companyType === 'SUPPLIER_FLEET') throw fail('Choose TradeExpress Fleet or a registered transport provider.');
  return provider;
}

/** Where-clause limiting fleet records to what the user may see. */
async function fleetScope(user, { providerId, includeSupplierFleets } = {}) {
  if (isStaff(user)) {
    if (providerId) return { companyId: String(providerId) };
    // Admins manage platform and provider fleets; supplier-owned fleets are shown only when asked for (oversight)
    return includeSupplierFleets === 'true' ? {} : { company: { companyType: { not: 'SUPPLIER_FLEET' } } };
  }
  const fleet = await prisma.transportCompany.findUnique({ where: { ownerId: user.id }, select: { id: true } });
  return { companyId: fleet?.id || '__none__' };
}

// ---------------------------------------------------------------------------
// Transport providers (Super Admin)
// ---------------------------------------------------------------------------

export async function listProviders() {
  const platform = await getPlatformFleet();
  const providers = await prisma.transportCompany.findMany({
    where: { companyType: { in: ['THIRD_PARTY', 'TRADEEXPRESS_PARTNER'] } },
    orderBy: [{ companyType: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { vehicles: true, drivers: true, shipments: true } } },
  });
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.id === platform.id ? 'PLATFORM' : 'EXTERNAL',
    contactPerson: p.contactPerson,
    phone: p.phone,
    email: p.email,
    city: p.city,
    state: p.state,
    gstin: p.gstin,
    status: p.status,
    vehicles: p._count.vehicles,
    drivers: p._count.drivers,
    shipments: p._count.shipments,
  }));
}

export async function createProvider(adminUser, data, req) {
  const name = clean(data.name);
  if (!name || name.length < 3) throw fail('Provider name must be at least 3 characters.');
  const contactPerson = clean(data.contactPerson);
  if (!contactPerson) throw fail('Contact person is required.');
  const email = clean(data.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Enter a valid email address.');
  const gstin = optionalText(data.gstin, 15)?.toUpperCase() || null;
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw fail('GSTIN format is invalid.');

  const provider = await prisma.transportCompany.create({
    data: {
      name,
      slug: `provider-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomInt(1000, 9999)}`,
      companyType: 'THIRD_PARTY',
      contactPerson,
      email,
      phone: normalisePhone(data.phone, 'Phone'),
      address: optionalText(data.address, 1000),
      city: optionalText(data.city, 100),
      state: optionalText(data.state, 100),
      postalCode: optionalText(data.postalCode, 10),
      gstin,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy: adminUser.id,
    },
  });
  await auditTransport({ req, action: 'TRANSPORT_PROVIDER_CREATED', targetId: provider.id, details: { name } });
  return provider;
}

export async function updateProvider(adminUser, providerId, data, req) {
  const provider = await prisma.transportCompany.findUnique({ where: { id: providerId } });
  if (!provider || provider.companyType === 'SUPPLIER_FLEET') throw fail('Transport provider not found.', 404);
  const update = {};
  if (data.name !== undefined) update.name = clean(data.name);
  if (data.contactPerson !== undefined) update.contactPerson = clean(data.contactPerson);
  if (data.phone !== undefined) update.phone = normalisePhone(data.phone, 'Phone');
  if (data.email !== undefined) update.email = clean(data.email);
  if (data.city !== undefined) update.city = optionalText(data.city, 100);
  if (data.state !== undefined) update.state = optionalText(data.state, 100);
  if (data.status !== undefined) {
    if (!['ACTIVE', 'SUSPENDED'].includes(data.status)) throw fail('Status must be ACTIVE or SUSPENDED.');
    update.status = data.status;
  }
  const updated = await prisma.transportCompany.update({ where: { id: providerId }, data: update });
  await auditTransport({ req, action: 'TRANSPORT_PROVIDER_UPDATED', targetId: providerId, details: update });
  return updated;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/** Document and status problems that stop a truck being used for a trip ending at `tripEnd`. */
export function vehicleProblems(vehicle, tripEnd = new Date()) {
  const problems = [];
  const end = new Date(tripEnd);
  if (['MAINTENANCE', 'INACTIVE'].includes(vehicle.status)) problems.push(`Truck is marked ${vehicle.status.toLowerCase()}.`);
  if (!vehicle.rcNumber) problems.push('Registration certificate number is missing.');
  if (!vehicle.insuranceExpiryDate) problems.push('Insurance expiry date is missing.');
  const expiries = [
    ['Insurance', vehicle.insuranceExpiryDate],
    ['Registration certificate', vehicle.rcExpiryDate],
    ['Fitness certificate', vehicle.fitnessExpiryDate],
    ['Permit', vehicle.permitExpiryDate],
    ['Pollution (PUC) certificate', vehicle.pucExpiryDate],
  ];
  for (const [label, date] of expiries) {
    if (date && new Date(date) < end) problems.push(`${label} expires on ${new Date(date).toISOString().slice(0, 10)}, before the trip ends.`);
  }
  if (vehicle.company?.status && vehicle.company.status !== 'ACTIVE') problems.push('The truck\'s transport provider is suspended.');
  return problems;
}

export function driverProblems(driver, tripEnd = new Date()) {
  const problems = [];
  if (['ON_LEAVE', 'INACTIVE'].includes(driver.status)) problems.push(`Driver is ${driver.status.toLowerCase().replace('_', ' ')}.`);
  if (driver.verificationStatus === 'REJECTED') problems.push('Driver verification was rejected.');
  if (!driver.licenseExpiryDate) problems.push('Driving licence expiry date is missing.');
  else if (new Date(driver.licenseExpiryDate) < new Date(tripEnd)) problems.push('Driving licence expires before the trip ends.');
  return problems;
}

function vehicleData(data, { partial = false } = {}) {
  const out = {};
  const want = (key) => !partial || data[key] !== undefined;

  if (want('vehicleNumber')) out.vehicleNumber = normaliseVehicleNumber(data.vehicleNumber);
  if (want('vehicleType')) {
    if (!VEHICLE_TYPES.includes(data.vehicleType)) throw fail('Choose a vehicle type.');
    out.vehicleType = data.vehicleType;
  }
  if (want('bodyType') && data.bodyType) {
    if (!BODY_TYPES.includes(data.bodyType)) throw fail('Choose a body type.');
    out.bodyType = data.bodyType;
  }
  if (want('capacityKg')) {
    const kg = optionalNumber(data.capacityKg, 'Maximum permitted load (kg)', { min: 100, max: 60000 });
    if (kg === null) throw fail('Maximum permitted load (kg) is required.');
    out.capacityTons = Math.round((kg / 1000) * 100) / 100;
  }
  for (const [key, label, max] of [['cargoLengthM', 'Cargo length (m)', 20], ['cargoWidthM', 'Cargo width (m)', 4], ['cargoHeightM', 'Cargo height (m)', 5], ['cargoVolumeCbm', 'Cargo volume (m³)', 200]]) {
    if (want(key)) out[key] = optionalNumber(data[key], label, { min: 0, max });
  }
  if (want('make')) out.make = optionalText(data.make, 80);
  if (want('model')) out.model = optionalText(data.model, 80);
  if (want('yearOfManufacture')) out.yearOfManufacture = optionalNumber(data.yearOfManufacture, 'Year of manufacture', { min: 1980, max: new Date().getFullYear() });
  if (want('ownershipType')) {
    const ownership = data.ownershipType || 'OWNED';
    if (!OWNERSHIP_TYPES.includes(ownership)) throw fail('Ownership must be owned, leased or hired.');
    out.ownershipType = ownership;
  }
  if (want('ownerName')) out.ownerName = optionalText(data.ownerName, 120);
  if (want('rcNumber')) {
    out.rcNumber = optionalText(data.rcNumber, 40)?.toUpperCase() || null;
    if (!out.rcNumber && !partial) throw fail('Registration certificate (RC) number is required.');
  }
  if (want('rcExpiryDate')) out.rcExpiryDate = optionalDate(data.rcExpiryDate, 'RC validity');
  if (want('insuranceNumber')) {
    out.insuranceNumber = optionalText(data.insuranceNumber, 60);
    if (!out.insuranceNumber && !partial) throw fail('Insurance policy number is required.');
  }
  if (want('insuranceExpiryDate')) {
    out.insuranceExpiryDate = optionalDate(data.insuranceExpiryDate, 'Insurance expiry');
    if (!out.insuranceExpiryDate && !partial) throw fail('Insurance expiry date is required.');
  }
  if (want('fitnessExpiryDate')) out.fitnessExpiryDate = optionalDate(data.fitnessExpiryDate, 'Fitness certificate expiry');
  if (want('permitNumber')) out.permitNumber = optionalText(data.permitNumber, 60);
  if (want('permitType') && data.permitType) {
    if (!['NATIONAL', 'STATE'].includes(data.permitType)) throw fail('Permit type must be national or state.');
    out.permitType = data.permitType;
  }
  if (want('permitExpiryDate')) out.permitExpiryDate = optionalDate(data.permitExpiryDate, 'Permit expiry');
  if (want('pucExpiryDate')) out.pucExpiryDate = optionalDate(data.pucExpiryDate, 'PUC expiry');
  if (want('operationalNotes')) out.operationalNotes = optionalText(data.operationalNotes, 2000);
  if (out.insuranceExpiryDate && !partial && out.insuranceExpiryDate < new Date()) throw fail('Insurance has already expired. Renew it before registering the truck.');
  return out;
}

function formatVehicle(v, viewer) {
  const currentShipment = v.shipments?.[0] || null;
  return {
    id: v.id,
    vehicleCode: v.vehicleCode,
    vehicleNumber: v.vehicleNumber,
    vehicleType: v.vehicleType,
    bodyType: v.bodyType,
    capacityKg: Math.round(Number(v.capacityTons) * 1000),
    cargoLengthM: v.cargoLengthM === null ? null : Number(v.cargoLengthM),
    cargoWidthM: v.cargoWidthM === null ? null : Number(v.cargoWidthM),
    cargoHeightM: v.cargoHeightM === null ? null : Number(v.cargoHeightM),
    cargoVolumeCbm: v.cargoVolumeCbm === null ? null : Number(v.cargoVolumeCbm),
    make: v.make,
    model: v.model,
    yearOfManufacture: v.yearOfManufacture,
    ownershipType: v.ownershipType,
    ownerName: v.ownerName,
    provider: v.company ? { id: v.company.id, name: v.company.name, type: v.company.companyType } : null,
    rcNumber: v.rcNumber,
    rcExpiryDate: v.rcExpiryDate,
    insuranceNumber: v.insuranceNumber,
    insuranceExpiryDate: v.insuranceExpiryDate,
    fitnessExpiryDate: v.fitnessExpiryDate,
    permitNumber: v.permitNumber,
    permitType: v.permitType,
    permitExpiryDate: v.permitExpiryDate,
    pucExpiryDate: v.pucExpiryDate,
    status: v.status,
    isVerified: v.isVerified,
    maintenanceNotes: v.maintenanceNotes,
    operationalNotes: v.operationalNotes,
    lastAssignedAt: v.lastAssignedAt,
    currentShipment: currentShipment ? { id: currentShipment.id, shipmentNumber: currentShipment.shipmentNumber, status: currentShipment.status } : null,
    problems: vehicleProblems(v),
    canEdit: isStaff(viewer) || v.company?.ownerId === viewer.id,
    createdAt: v.createdAt,
  };
}

const vehicleInclude = {
  company: { select: { id: true, name: true, companyType: true, ownerId: true, status: true } },
  shipments: { where: { status: { in: VEHICLE_BUSY_STATUSES } }, select: { id: true, shipmentNumber: true, status: true }, take: 1, orderBy: { updatedAt: 'desc' } },
};

export async function listVehicles(user, { status, search, providerId, vehicleType, includeSupplierFleets } = {}) {
  const where = { AND: [await fleetScope(user, { providerId, includeSupplierFleets })] };
  if (status) where.AND.push({ status });
  if (vehicleType) where.AND.push({ vehicleType });
  if (search) where.AND.push({ OR: [{ vehicleNumber: { contains: String(search).toUpperCase().replace(/[\s-]/g, '') } }, { vehicleCode: { contains: search } }, { make: { contains: search } }] });
  const vehicles = await prisma.transportVehicle.findMany({ where, include: vehicleInclude, orderBy: { createdAt: 'desc' }, take: 200 });
  return vehicles.map((v) => formatVehicle(v, user));
}

async function loadVehicleForWrite(user, vehicleId) {
  const vehicle = await prisma.transportVehicle.findUnique({ where: { id: vehicleId }, include: vehicleInclude });
  if (!vehicle) throw fail('Truck not found.', 404);
  if (!isStaff(user) && vehicle.company?.ownerId !== user.id) throw fail('Truck not found.', 404);
  return vehicle;
}

export async function createVehicle(user, data, req) {
  const fields = vehicleData(data);
  const fleet = await resolveFleetForWrite(user, data.providerId);
  const duplicate = await prisma.transportVehicle.findFirst({ where: { vehicleNumber: fields.vehicleNumber }, select: { id: true } });
  if (duplicate) throw fail('A truck with this registration number is already registered on TradeExpress.', 409);

  const vehicle = await prisma.transportVehicle.create({
    data: { ...fields, companyId: fleet.id, vehicleCode: code('VH'), status: 'AVAILABLE', isVerified: isStaff(user) },
    include: vehicleInclude,
  });
  await auditTransport({ req, actorRole: user.role, action: 'VEHICLE_REGISTERED', targetId: vehicle.id, details: { vehicleNumber: vehicle.vehicleNumber, fleet: fleet.name } });
  return formatVehicle(vehicle, user);
}

export async function updateVehicle(user, vehicleId, data, req) {
  const vehicle = await loadVehicleForWrite(user, vehicleId);
  const fields = vehicleData(data, { partial: true });
  if (fields.vehicleNumber && fields.vehicleNumber !== vehicle.vehicleNumber) {
    const duplicate = await prisma.transportVehicle.findFirst({ where: { vehicleNumber: fields.vehicleNumber, id: { not: vehicleId } }, select: { id: true } });
    if (duplicate) throw fail('A truck with this registration number is already registered on TradeExpress.', 409);
  }
  const updated = await prisma.transportVehicle.update({ where: { id: vehicleId }, data: fields, include: vehicleInclude });
  await auditTransport({ req, actorRole: user.role, action: 'VEHICLE_UPDATED', targetId: vehicleId, details: Object.keys(fields) });
  return formatVehicle(updated, user);
}

/** Availability changes made by people: available, maintenance or inactive. ASSIGNED / IN_TRANSIT follow shipments. */
export async function setVehicleStatus(user, vehicleId, { status, notes }, req) {
  const vehicle = await loadVehicleForWrite(user, vehicleId);
  if (!['AVAILABLE', 'MAINTENANCE', 'INACTIVE'].includes(status)) throw fail('Status must be available, maintenance or inactive.');
  if (vehicle.shipments.length && status !== 'AVAILABLE') {
    throw fail(`This truck is booked on shipment ${vehicle.shipments[0].shipmentNumber}. Release it from that shipment first.`, 409);
  }
  const updated = await prisma.transportVehicle.update({
    where: { id: vehicleId },
    data: { status: vehicle.shipments.length ? vehicle.status : status, maintenanceNotes: status === 'MAINTENANCE' ? optionalText(notes, 2000) : vehicle.maintenanceNotes },
    include: vehicleInclude,
  });
  await auditTransport({ req, actorRole: user.role, action: 'VEHICLE_STATUS_CHANGED', targetId: vehicleId, details: { from: vehicle.status, to: status, notes } });
  return formatVehicle(updated, user);
}

export async function verifyVehicle(adminUser, vehicleId, { isVerified, notes }, req) {
  const vehicle = await prisma.transportVehicle.findUnique({ where: { id: vehicleId }, include: vehicleInclude });
  if (!vehicle) throw fail('Truck not found.', 404);
  const updated = await prisma.transportVehicle.update({
    where: { id: vehicleId },
    data: { isVerified: Boolean(isVerified), verifiedAt: new Date(), verificationNotes: optionalText(notes, 2000) },
    include: vehicleInclude,
  });
  await auditTransport({ req, action: 'VEHICLE_VERIFIED', targetId: vehicleId, details: { isVerified: Boolean(isVerified), notes } });
  return formatVehicle(updated, adminUser);
}

export async function getVehicleHistory(user, vehicleId) {
  await loadVehicleForWrite(user, vehicleId);
  const shipments = await prisma.shipment.findMany({
    where: { vehicleId },
    select: { id: true, shipmentNumber: true, status: true, pickupScheduledAt: true, dispatchedAt: true, deliveredAt: true, driverName: true, order: { select: { orderNumber: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return shipments.map((s) => ({ ...s, orderNumber: s.order?.orderNumber || null, order: undefined }));
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

function formatDriver(d, viewer) {
  const staff = isStaff(viewer);
  return {
    id: d.id,
    driverCode: d.driverCode,
    name: d.name,
    phone: d.phone,
    alternatePhone: d.alternatePhone,
    licenseNumber: staff || d.company?.ownerId === viewer.id ? d.licenseNumber : maskLicence(d.licenseNumber),
    licenseNumberMasked: maskLicence(d.licenseNumber),
    licenseType: d.licenseType,
    licenseExpiryDate: d.licenseExpiryDate,
    aadhaarMasked: maskAadhaar(d.aadhaarNumber),
    experienceYears: d.experienceYears,
    verificationStatus: d.verificationStatus,
    verificationNotes: staff ? d.verificationNotes : undefined,
    status: d.status,
    assignedVehicleId: d.assignedVehicleId,
    emergencyContactName: d.emergencyContactName,
    emergencyContactPhone: d.emergencyContactPhone,
    provider: d.company ? { id: d.company.id, name: d.company.name, type: d.company.companyType } : null,
    problems: driverProblems(d),
    canEdit: staff || d.company?.ownerId === viewer.id,
    createdAt: d.createdAt,
  };
}

const driverInclude = { company: { select: { id: true, name: true, companyType: true, ownerId: true, status: true } } };

function driverData(data, { partial = false } = {}) {
  const out = {};
  const want = (key) => !partial || data[key] !== undefined;
  if (want('name')) {
    const name = clean(data.name);
    if (!name || name.length < 3 || name.length > 100) throw fail('Driver name must be 3 to 100 characters.');
    out.name = name;
  }
  if (want('phone')) out.phone = normalisePhone(data.phone, 'Mobile number');
  if (want('alternatePhone')) out.alternatePhone = normalisePhone(data.alternatePhone, 'Alternate mobile number', false);
  if (want('licenseNumber')) out.licenseNumber = normaliseLicenceNumber(data.licenseNumber);
  if (want('licenseType')) {
    if (!LICENSE_CLASSES.includes(data.licenseType)) throw fail('Choose the authorised vehicle class on the licence.');
    out.licenseType = data.licenseType;
  }
  if (want('licenseExpiryDate')) {
    out.licenseExpiryDate = optionalDate(data.licenseExpiryDate, 'Licence expiry');
    if (!out.licenseExpiryDate) throw fail('Driving licence expiry date is required.');
    if (out.licenseExpiryDate < new Date()) throw fail('The driving licence has expired.');
  }
  if (want('experienceYears')) out.experienceYears = optionalNumber(data.experienceYears, 'Experience (years)', { min: 0, max: 50 }) ?? 0;
  if (want('emergencyContactName')) out.emergencyContactName = optionalText(data.emergencyContactName, 100);
  if (want('emergencyContactPhone')) out.emergencyContactPhone = normalisePhone(data.emergencyContactPhone, 'Emergency contact number', false);
  if (want('status') && data.status !== undefined) {
    if (!DRIVER_STATUSES.includes(data.status)) throw fail('Choose a valid driver availability.');
    out.status = data.status;
  }
  return out;
}

export async function listDrivers(user, { status, search, providerId, includeSupplierFleets } = {}) {
  const where = { AND: [await fleetScope(user, { providerId, includeSupplierFleets })] };
  if (status) where.AND.push({ status });
  if (search) where.AND.push({ OR: [{ name: { contains: search } }, { phone: { contains: search } }, { driverCode: { contains: search } }] });
  const drivers = await prisma.transportDriver.findMany({ where, include: driverInclude, orderBy: { createdAt: 'desc' }, take: 200 });
  return drivers.map((d) => formatDriver(d, user));
}

async function loadDriverForWrite(user, driverId) {
  const driver = await prisma.transportDriver.findUnique({ where: { id: driverId }, include: driverInclude });
  if (!driver || (!isStaff(user) && driver.company?.ownerId !== user.id)) throw fail('Driver not found.', 404);
  return driver;
}

export async function createDriver(user, data, req) {
  const fields = driverData(data);
  const fleet = await resolveFleetForWrite(user, data.providerId);
  const duplicate = await prisma.transportDriver.findFirst({ where: { licenseNumber: fields.licenseNumber }, select: { id: true } });
  if (duplicate) throw fail('A driver with this licence number is already registered on TradeExpress.', 409);
  const driver = await prisma.transportDriver.create({
    data: {
      ...fields,
      companyId: fleet.id,
      driverCode: code('DR'),
      status: fields.status || 'AVAILABLE',
      verificationStatus: isStaff(user) ? 'VERIFIED' : 'PENDING',
      isVerified: isStaff(user),
    },
    include: driverInclude,
  });
  await auditTransport({ req, actorRole: user.role, action: 'DRIVER_REGISTERED', targetId: driver.id, details: { name: driver.name, fleet: fleet.name } });
  return formatDriver(driver, user);
}

export async function updateDriver(user, driverId, data, req) {
  const driver = await loadDriverForWrite(user, driverId);
  const fields = driverData(data, { partial: true });
  if (fields.licenseNumber && fields.licenseNumber !== driver.licenseNumber) {
    const duplicate = await prisma.transportDriver.findFirst({ where: { licenseNumber: fields.licenseNumber, id: { not: driverId } }, select: { id: true } });
    if (duplicate) throw fail('A driver with this licence number is already registered on TradeExpress.', 409);
    // A new licence needs fresh verification
    if (!isStaff(user)) Object.assign(fields, { verificationStatus: 'PENDING', isVerified: false });
  }
  const updated = await prisma.transportDriver.update({ where: { id: driverId }, data: fields, include: driverInclude });
  await auditTransport({ req, actorRole: user.role, action: 'DRIVER_UPDATED', targetId: driverId, details: Object.keys(fields) });
  return formatDriver(updated, user);
}

export async function verifyDriver(adminUser, driverId, { verificationStatus, notes }, req) {
  if (!['VERIFIED', 'REJECTED'].includes(verificationStatus)) throw fail('Verification must be VERIFIED or REJECTED.');
  if (verificationStatus === 'REJECTED' && !clean(notes)) throw fail('Give a reason when rejecting a driver.');
  const driver = await prisma.transportDriver.findUnique({ where: { id: driverId } });
  if (!driver) throw fail('Driver not found.', 404);
  const updated = await prisma.transportDriver.update({
    where: { id: driverId },
    data: { verificationStatus, isVerified: verificationStatus === 'VERIFIED', verifiedAt: new Date(), verificationNotes: optionalText(notes, 2000) },
    include: driverInclude,
  });
  await auditTransport({ req, action: 'DRIVER_VERIFICATION', targetId: driverId, details: { verificationStatus, notes } });
  return formatDriver(updated, adminUser);
}

/**
 * Loads a truck and driver for assignment, checking the user may use them. Suppliers may only use their own fleet;
 * admins may use any non-supplier fleet, or the shipment supplier's own fleet when acting for them.
 */
export async function loadAssignableFleet(user, { vehicleId, driverId, shipmentSupplierId }, tx = prisma) {
  const vehicle = await tx.transportVehicle.findUnique({ where: { id: String(vehicleId || '') }, include: { company: true } });
  const driver = await tx.transportDriver.findUnique({ where: { id: String(driverId || '') }, include: { company: true } });
  if (!vehicle) throw fail('Choose a registered truck.', 400);
  if (!driver) throw fail('Choose a registered driver.', 400);

  const usable = (company) => {
    if (isStaff(user)) return company.companyType !== 'SUPPLIER_FLEET' || company.ownerId === shipmentSupplierId;
    return company.ownerId === user.id;
  };
  if (!usable(vehicle.company)) throw fail('You can only assign trucks from your own fleet.', 403);
  if (!usable(driver.company)) throw fail('You can only assign drivers from your own fleet.', 403);
  return { vehicle, driver };
}
