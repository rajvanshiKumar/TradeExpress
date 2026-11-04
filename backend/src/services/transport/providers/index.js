import ManualTransportProvider from './ManualTransportProvider.js';

/**
 * Transport provider registry.
 *
 * Every provider implements the same interface, so an external logistics API (truck booking, freight quotes, GPS,
 * ETA, proof of delivery, webhooks) can be added later as another adapter without changing shipment workflows:
 *
 *   code                      string, stored on Shipment.providerCode
 *   capabilities              { booking, quotes, liveTracking, eta, proofOfDelivery, webhooks }
 *   bookVehicle(booking)      -> { externalReference|null }
 *   getQuote(request)         -> { amount, currency, validUntil } | null
 *   getTracking(shipment)     -> [{ status, location, eventAt, source }] (provider-reported events)
 *   estimateArrival(shipment) -> Date | null
 *   parseWebhook(req)         -> [{ shipmentRef, status, location, eventAt }]
 */
const providers = new Map([[ManualTransportProvider.code, ManualTransportProvider]]);

export function getTransportProvider(code = 'MANUAL') {
  const provider = providers.get(code);
  if (!provider) {
    const error = new Error(`Transport provider "${code}" is not configured.`);
    error.statusCode = 501;
    throw error;
  }
  return provider;
}

export function listTransportProviders() {
  return [...providers.values()].map(({ code, label, capabilities }) => ({ code, label, capabilities }));
}
