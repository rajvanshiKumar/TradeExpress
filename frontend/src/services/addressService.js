// Buyer address book, stored in MySQL through /api/auth/addresses.
import { authorizedRequest } from './authorizedApi';

const request = (method, path = '', body) => authorizedRequest(method, `auth/addresses${path}`, body);

/**
 * Adds the legacy keys (line1, line2) that checkout, order history and tracking read, and fills
 * first/last name for addresses saved before those fields existed.
 */
export function toUiAddress(address) {
  const [first = '', ...rest] = String(address.name || '').trim().split(/\s+/);
  return {
    ...address,
    firstName: address.firstName || first,
    lastName: address.lastName || rest.join(' '),
    apartment: address.apartment || '',
    state: address.state || '',
    line1: address.street,
    line2: address.apartment || '',
  };
}

const toPayload = (values) => ({
  country: values.country,
  firstName: values.firstName,
  lastName: values.lastName,
  phone: values.phone,
  street: values.street,
  apartment: values.apartment || null,
  city: values.city,
  state: values.state,
  postalCode: values.postalCode,
  isDefault: Boolean(values.isDefault),
});

const addressService = {
  list: async () => (await request('GET')).map(toUiAddress),
  create: async (values) => toUiAddress(await request('POST', '', toPayload(values))),
  update: async (id, values) => toUiAddress(await request('PUT', `/${encodeURIComponent(id)}`, toPayload(values))),
  setDefault: async (id) => toUiAddress(await request('PATCH', `/${encodeURIComponent(id)}/default`)),
  remove: (id) => request('DELETE', `/${encodeURIComponent(id)}`),
};

export default addressService;
