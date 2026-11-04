/**
 * Manual provider: trucks, drivers and milestones are entered by the supplier or TradeExpress operations team.
 * It never invents data: there is no live GPS, ETA prediction or external booking, and every tracking event it
 * produces is labelled source MANUAL.
 */
const ManualTransportProvider = {
  code: 'MANUAL',
  label: 'Manual (entered by supplier / TradeExpress operations)',
  capabilities: {
    booking: false,
    quotes: false,
    liveTracking: false,
    eta: false,
    proofOfDelivery: true, // delivery code + receiver acknowledgment captured in TradeExpress
    webhooks: false,
  },

  async bookVehicle() {
    return { externalReference: null };
  },

  async getQuote() {
    return null;
  },

  async getTracking() {
    return [];
  },

  async estimateArrival(shipment) {
    return shipment?.estimatedDeliveryAt || null;
  },

  async parseWebhook() {
    const error = new Error('The manual transport provider does not accept webhooks.');
    error.statusCode = 400;
    throw error;
  },
};

export default ManualTransportProvider;
