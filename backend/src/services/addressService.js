import prisma from '../config/db.js';
import { isSupportedCountry, normalizeMobile } from './otpService.js';

const MAX_ADDRESSES_PER_USER = 20;

const ADDRESS_SELECT = {
  id: true,
  label: true,
  name: true,
  firstName: true,
  lastName: true,
  company: true,
  gstin: true,
  phone: true,
  street: true,
  apartment: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
};

function badRequest(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  if (field) error.errors = [{ field, message }];
  return error;
}

function notFound() {
  // The same response for "does not exist" and "belongs to someone else", so ids cannot be probed
  const error = new Error('Address not found.');
  error.statusCode = 404;
  return error;
}

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Validates and normalizes an address payload. Only whitelisted fields are read, so ownership
 * fields such as userId can never be supplied by the client.
 */
function buildAddressData(input = {}) {
  const country = clean(input.country) || 'India';
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const street = clean(input.street);
  const apartment = clean(input.apartment);
  const city = clean(input.city);
  const state = clean(input.state);
  const postalCode = clean(input.postalCode).toUpperCase();

  if (!firstName) throw badRequest('First name is required.', 'firstName');
  if (!lastName) throw badRequest('Last name is required.', 'lastName');
  if (!street) throw badRequest('Street address or P.O. box is required.', 'street');
  if (!city) throw badRequest('City is required.', 'city');
  if (!state) throw badRequest('State / province is required.', 'state');
  if (!postalCode) throw badRequest('Postal code is required.', 'postalCode');

  const limits = { firstName: 60, lastName: 60, street: 180, apartment: 120, city: 80, state: 80 };
  const values = { firstName, lastName, street, apartment, city, state };
  for (const [field, max] of Object.entries(limits)) {
    if (values[field].length > max) throw badRequest(`${field} must be ${max} characters or fewer.`, field);
  }

  if (country === 'India' ? !/^[1-9][0-9]{5}$/.test(postalCode) : !/^[A-Z0-9\s-]{3,10}$/.test(postalCode)) {
    throw badRequest(country === 'India' ? 'Enter a valid 6-digit Indian PIN code.' : 'Enter a valid postal / ZIP code.', 'postalCode');
  }

  if (!isSupportedCountry(country)) throw badRequest('Please select a supported country / region.', 'country');

  const phone = normalizeMobile(input.phone, country);
  if (!phone.ok) throw badRequest(`Enter a valid ${country} phone number.`, 'phone');

  return {
    label: clean(input.label).slice(0, 30) || 'Shipping address',
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    company: clean(input.company).slice(0, 120) || null,
    phone: phone.formattedPhone,
    street,
    apartment: apartment || null,
    city,
    state,
    postalCode,
    country,
  };
}

async function findOwnedAddress(tx, userId, addressId) {
  const address = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true, isDefault: true } });
  if (!address) throw notFound();
  return address;
}

export function listAddresses(userId) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: ADDRESS_SELECT,
  });
}

export async function createAddress(userId, input) {
  const data = buildAddressData(input);

  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw badRequest(`You can save up to ${MAX_ADDRESSES_PER_USER} addresses. Delete one to add another.`);
    }

    // The first address is always the default; otherwise only when requested
    const isDefault = count === 0 || input.isDefault === true;
    if (isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    return tx.address.create({ data: { ...data, userId, isDefault }, select: ADDRESS_SELECT });
  });
}

export async function updateAddress(userId, addressId, input) {
  const data = buildAddressData(input);

  return prisma.$transaction(async (tx) => {
    const existing = await findOwnedAddress(tx, userId, addressId);

    // Unticking "default" on the current default is ignored: a buyer always keeps one default
    const isDefault = existing.isDefault || input.isDefault === true;
    if (isDefault && !existing.isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    return tx.address.update({ where: { id: existing.id }, data: { ...data, isDefault }, select: ADDRESS_SELECT });
  });
}

export async function setDefaultAddress(userId, addressId) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOwnedAddress(tx, userId, addressId);
    await tx.address.updateMany({ where: { userId, isDefault: true, NOT: { id: existing.id } }, data: { isDefault: false } });
    return tx.address.update({ where: { id: existing.id }, data: { isDefault: true }, select: ADDRESS_SELECT });
  });
}

export async function deleteAddress(userId, addressId) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOwnedAddress(tx, userId, addressId);
    await tx.address.delete({ where: { id: existing.id } });

    // Promote the most recent remaining address so the buyer still has a default
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { id: existing.id };
  });
}
