import { transportApi } from '../../api/transportApi';

const DISPATCHED = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'DELIVERY_FAILED', 'RETURN_IN_TRANSIT', 'RETURNED'];
const tomorrow = () => { const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0); return d; };

const ISSUE_OPTIONS = [
  { value: 'DAMAGED', label: 'Damaged goods' },
  { value: 'MISSING', label: 'Missing goods' },
  { value: 'SHORTAGE', label: 'Short quantity' },
  { value: 'DELAY', label: 'Delay' },
  { value: 'BREAKDOWN', label: 'Truck breakdown' },
  { value: 'OTHER', label: 'Other' },
];
const PAYER_OPTIONS = [
  { value: 'SUPPLIER', label: 'Supplier pays' },
  { value: 'BUYER', label: 'Buyer pays' },
  { value: 'PLATFORM', label: 'TradeExpress pays' },
];
const DOC_OPTIONS = [
  { value: 'LR_BILTY', label: 'Lorry receipt (LR / bilty)' },
  { value: 'EWAY_BILL', label: 'E-way bill' },
  { value: 'COMMERCIAL_INVOICE', label: 'Tax invoice' },
  { value: 'PACKING_LIST', label: 'Packing list' },
  { value: 'WEIGHT_SLIP', label: 'Weight slip' },
  { value: 'PICKUP_PROOF', label: 'Pickup proof' },
  { value: 'OTHER', label: 'Other' },
];

const act = (id, action) => (body) => transportApi.shipmentAction(id, action, body);

/** Admin approval of a supplier's transport request (used on the shipment panel and the requests list). */
export function approveRequestAction(request) {
  return {
    key: 'approve-request',
    label: 'Approve & assign truck',
    title: `Approve ${request.requestNumber}`,
    intro: `Goods ready ${request.pickupDate ? new Date(request.pickupDate).toLocaleDateString('en-IN') : ''}${request.cargoDetails?.totalWeightKg ? ` · ${request.cargoDetails.totalWeightKg} kg` : ''}${request.cargoDetails?.preferredVehicleType ? ` · prefers ${request.cargoDetails.preferredVehicleType.replace(/_/g, ' ').toLowerCase()}` : ''}${request.targetFreight ? ` · target freight ₹${request.targetFreight}` : ''}${request.loadingRequirements ? ` · ${request.loadingRequirements}` : ''}`,
    fields: [
      { name: 'vehicleId', label: 'Truck', type: 'vehicle', required: true },
      { name: 'driverId', label: 'Driver', type: 'driver', required: true },
      { name: 'pickupScheduledAt', label: 'Pickup date & time', type: 'datetime', required: true, half: true, default: request.pickupDate || tomorrow() },
      { name: 'estimatedDeliveryAt', label: 'Estimated delivery', type: 'datetime', half: true, default: request.expectedDeliveryDate },
      { name: 'approvedFreight', label: 'Approved freight (₹)', type: 'number', required: true, half: true, default: request.targetFreight ?? '' },
      { name: 'freightPayer', label: 'Freight paid by', type: 'select', options: PAYER_OPTIONS, required: true, half: true, default: 'SUPPLIER' },
      { name: 'notes', label: 'Notes for the supplier', type: 'textarea' },
    ],
    submit: (body) => transportApi.approveRequest(request.id, body),
  };
}

export function rejectRequestAction(request) {
  return {
    key: 'reject-request',
    label: 'Reject request',
    danger: true,
    fields: [{ name: 'reason', label: 'Reason (shown to the supplier)', type: 'textarea', required: true }],
    submit: (body) => transportApi.rejectRequest(request.id, body),
  };
}

/**
 * Steps the viewer can take on this shipment right now. The backend enforces the same rules; this only decides
 * which buttons to show.
 */
export function shipmentActions(shipment, role) {
  const id = shipment.id;
  const s = shipment.status;
  const staff = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const items = [];

  if (role === 'BUYER') {
    if (s === 'DELIVERED_PENDING_CONFIRMATION') {
      items.push({
        key: 'confirm-delivery', label: 'Confirm delivery', primary: true, size: 'lg',
        intro: 'Check the goods, then record what you received. Damaged or missing quantities are reported to the supplier and TradeExpress automatically.',
        fields: [
          { name: 'otp', label: 'Delivery code (from your email)', type: 'otp', required: true, half: true },
          { name: 'receiverName', label: 'Received by', type: 'text', required: true, half: true },
          { name: 'deliveryItems', label: 'Quantities received', type: 'deliveryItems' },
          { name: 'condition', label: 'Overall condition', type: 'select', default: 'GOOD', options: [{ value: 'GOOD', label: 'Good' }, { value: 'DAMAGED', label: 'Some goods damaged' }, { value: 'PARTIAL', label: 'Partly received' }] },
          { name: 'notes', label: 'Notes', type: 'textarea' },
          { name: 'photo', label: 'Photo (optional, for damage)', type: 'file', as: 'photoUrls' },
        ],
        submit: act(id, 'confirm-delivery'),
      });
      items.push({ key: 'resend-delivery-code', label: 'Email a new code', direct: true, submit: act(id, 'resend-delivery-code'), done: 'A new delivery code was emailed to you.' });
    }
    if (DISPATCHED.includes(s)) items.push(reportIssue(id, role));
    return items;
  }

  if (s === 'AWAITING_TRANSPORT') {
    items.push({
      key: 'assign-truck', label: staff ? 'Assign a truck' : 'Assign my own truck', primary: true,
      intro: 'The truck must be available, its insurance and permits valid for the whole trip, and big enough for the cargo.',
      fields: [
        { name: 'vehicleId', label: 'Truck', type: 'vehicle', required: true },
        { name: 'driverId', label: 'Driver', type: 'driver', required: true },
        { name: 'pickupScheduledAt', label: 'Pickup date & time', type: 'datetime', required: true, half: true, default: tomorrow() },
        { name: 'estimatedDeliveryAt', label: 'Estimated delivery', type: 'datetime', half: true },
        { name: 'freightCharges', label: 'Freight charges (₹, optional)', type: 'number', half: true },
        { name: 'freightPayer', label: 'Freight paid by', type: 'select', options: PAYER_OPTIONS, half: true, default: 'SUPPLIER' },
      ],
      submit: act(id, 'assign-truck'),
    });
    if (role === 'SUPPLIER') {
      items.push({
        key: 'request-transport', label: 'Request truck from TradeExpress',
        intro: 'TradeExpress operations will arrange a suitable truck and confirm the freight charges.',
        fields: [
          { name: 'pickupDate', label: 'Goods ready for pickup on', type: 'datetime', required: true, half: true, default: tomorrow() },
          { name: 'expectedDeliveryDate', label: 'Deliver by', type: 'datetime', half: true },
          { name: 'preferredVehicleType', label: 'Preferred truck type', type: 'select', half: true, options: [{ value: 'MINI_TRUCK', label: 'Mini truck' }, { value: 'LCV', label: 'LCV' }, { value: 'OPEN_TRUCK', label: 'Open truck' }, { value: 'CLOSED_TRUCK', label: 'Closed truck' }, { value: 'CONTAINER_20FT', label: 'Container 20 ft' }, { value: 'CONTAINER_32FT', label: 'Container 32 ft' }, { value: 'TRAILER', label: 'Trailer' }, { value: 'REEFER', label: 'Refrigerated' }] },
          { name: 'targetFreight', label: 'Target freight (₹, optional)', type: 'number', half: true },
          { name: 'loadingRequirements', label: 'Loading / handling requirements', type: 'textarea' },
        ],
        submit: act(id, 'request-transport'),
      });
    }
  }
  if (s === 'TRANSPORT_REQUESTED' && shipment.request) {
    if (staff) {
      items.push({ ...approveRequestAction(shipment.request), primary: true });
      items.push(rejectRequestAction(shipment.request));
    } else {
      items.push({ key: 'withdraw', label: 'Withdraw request', direct: true, confirm: 'Withdraw this transport request?', submit: () => transportApi.cancelRequest(shipment.request.id), done: 'Request withdrawn.' });
    }
  }
  if (s === 'TRANSPORT_ASSIGNED') {
    items.push({ key: 'schedule-pickup', label: 'Confirm pickup', fields: [{ name: 'pickupScheduledAt', label: 'Pickup date & time', type: 'datetime', required: true, default: shipment.pickupScheduledAt }, { name: 'notes', label: 'Notes', type: 'textarea' }], submit: act(id, 'schedule-pickup') });
  }
  if (['TRANSPORT_ASSIGNED', 'PICKUP_SCHEDULED'].includes(s)) {
    items.push({ key: 'start-loading', label: 'Start loading', primary: true, direct: true, submit: act(id, 'start-loading'), done: 'Loading started.' });
    items.push({ key: 'release-truck', label: 'Release truck', fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'e.g. Truck broke down; will assign another' }], submit: act(id, 'release-truck') });
  }
  if (s === 'LOADING_IN_PROGRESS') {
    items.push({
      key: 'confirm-loading', label: 'Confirm loading', primary: true, size: 'lg',
      fields: [
        { name: 'loadingItems', label: 'Actually loaded', type: 'loadingItems', hint: 'Units not loaded become free for another shipment.' },
        { name: 'totalPackages', label: 'Number of packages', type: 'number', required: true, half: true, default: shipment.totalPackages ?? '' },
        { name: 'totalWeightKg', label: 'Loaded weight (kg)', type: 'number', required: true, half: true, default: shipment.totalWeightKg ?? '' },
        { name: 'lrNumber', label: 'LR / bilty number', type: 'text', half: true },
        { name: 'ewayBillNumber', label: 'E-way bill number', type: 'text', half: true, hint: 'Required for consignments above ₹50,000.' },
        { name: 'proof', label: 'Pickup / loading proof', type: 'file', as: 'documents', docType: 'PICKUP_PROOF', docTitle: 'Loading proof' },
      ],
      submit: act(id, 'confirm-loading'),
    });
  }
  if (s === 'LOADED') {
    items.push({
      key: 'dispatch', label: 'Dispatch', primary: true,
      intro: 'Dispatch confirms the truck has picked up the goods. Stock leaves your inventory and the buyer is notified.',
      fields: [{ name: 'location', label: 'Dispatched from', type: 'text', default: [shipment.pickupAddress?.city, shipment.pickupAddress?.state].filter(Boolean).join(', ') }, { name: 'estimatedDeliveryAt', label: 'Estimated delivery', type: 'datetime', default: shipment.estimatedDeliveryAt }],
      submit: act(id, 'dispatch'),
    });
  }
  if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'RETURN_IN_TRANSIT'].includes(s)) {
    items.push({
      key: 'tracking', label: 'Add location update',
      intro: 'Location updates are reported by you, not GPS. They appear on the buyer\'s tracking timeline.',
      fields: [
        { name: 'location', label: 'Reported location', type: 'text', required: true, placeholder: 'e.g. Vadodara toll plaza, NH48' },
        { name: 'eventAt', label: 'Time at that location', type: 'datetime', default: new Date() },
        { name: 'remarks', label: 'Remarks', type: 'textarea' },
        { name: 'delayReason', label: 'Delay reason (if delayed)', type: 'text', half: true },
        { name: 'estimatedDeliveryAt', label: 'New estimated delivery', type: 'datetime', half: true },
      ],
      submit: act(id, 'tracking'),
    });
  }
  if (['IN_TRANSIT', 'DELIVERY_FAILED'].includes(s)) {
    items.push({ key: 'out-for-delivery', label: s === 'DELIVERY_FAILED' ? 'Retry delivery' : 'Out for delivery', primary: true, fields: [{ name: 'location', label: 'Location', type: 'text' }], submit: act(id, 'out-for-delivery') });
  }
  if (s === 'OUT_FOR_DELIVERY') {
    items.push({ key: 'arrived', label: 'Arrived at buyer', primary: true, intro: 'The buyer gets a single-use delivery code by email to confirm what they received.', fields: [{ name: 'location', label: 'Location', type: 'text' }, { name: 'notes', label: 'Notes', type: 'textarea' }], submit: act(id, 'arrived') });
  }
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED_PENDING_CONFIRMATION'].includes(s)) {
    items.push({ key: 'delivery-failed', label: 'Delivery failed', danger: true, fields: [{ name: 'reason', label: 'What happened?', type: 'textarea', required: true }, { name: 'location', label: 'Location', type: 'text' }], submit: act(id, 'delivery-failed') });
  }
  if (['IN_TRANSIT', 'DELIVERY_FAILED'].includes(s)) {
    items.push({ key: 'return', label: 'Return to supplier', fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], submit: act(id, 'return') });
  }
  if (s === 'RETURN_IN_TRANSIT') {
    items.push({ key: 'returned', label: 'Returned goods received', primary: true, intro: 'Confirms the goods are physically back in your warehouse. They are added back to stock.', fields: [{ name: 'notes', label: 'Notes', type: 'textarea' }], submit: act(id, 'returned') });
  }
  if (['TRANSPORT_ASSIGNED', 'PICKUP_SCHEDULED', 'LOADING_IN_PROGRESS', 'LOADED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_FAILED'].includes(s) && (staff || shipment.transportMethod !== 'TRADEEXPRESS_MANAGED')) {
    items.push({
      key: 'change-truck', label: 'Change truck / driver',
      fields: [
        { name: 'vehicleId', label: 'New truck', type: 'vehicle', required: true },
        { name: 'driverId', label: 'New driver', type: 'driver', required: true },
        { name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'e.g. Breakdown near Nashik' },
        { name: 'location', label: 'Where the switch happens', type: 'text' },
      ],
      submit: act(id, 'change-truck'),
    });
  }
  if (!['DELIVERED', 'RETURNED', 'CANCELLED'].includes(s)) {
    items.push({ key: 'documents', label: 'Add document', fields: [{ name: 'docType', label: 'Document type', type: 'select', options: DOC_OPTIONS, required: true, half: true }, { name: 'docNumber', label: 'Document number', type: 'text', half: true }, { name: 'title', label: 'Title', type: 'text' }, { name: 'file', label: 'File', type: 'file', required: true }], submit: (body) => transportApi.shipmentAction(id, 'documents', { ...body, fileUrl: body.fileUrl }) });
  }
  if (['AWAITING_TRANSPORT', 'TRANSPORT_REQUESTED', 'TRANSPORT_ASSIGNED', 'PICKUP_SCHEDULED', 'LOADING_IN_PROGRESS', 'LOADED'].includes(s)) {
    items.push({ key: 'cancel', label: 'Cancel shipment', danger: true, fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], submit: act(id, 'cancel') });
  }
  items.push(reportIssue(id, role));
  if (staff && shipment.freight) {
    items.push({ key: 'freight', label: 'Freight payment', fields: [{ name: 'freightCharges', label: 'Freight charges (₹)', type: 'number', half: true, default: shipment.freight.charges }, { name: 'freightPaymentStatus', label: 'Payment status', type: 'select', half: true, required: true, default: shipment.freight.paymentStatus, options: [{ value: 'PENDING', label: 'Pending' }, { value: 'PAID', label: 'Paid' }, { value: 'NOT_APPLICABLE', label: 'Not applicable' }] }], submit: (body) => transportApi.updateFreight(id, body) });
  }
  return items;
}

function reportIssue(id, role) {
  return {
    key: 'issues', label: 'Report an issue',
    fields: [
      { name: 'issueType', label: 'Issue', type: 'select', options: role === 'BUYER' ? ISSUE_OPTIONS.filter((o) => o.value !== 'BREAKDOWN') : ISSUE_OPTIONS, required: true, half: true },
      { name: 'quantity', label: 'Quantity affected', type: 'number', half: true },
      { name: 'description', label: 'Describe the issue', type: 'textarea', required: true },
      { name: 'photo', label: 'Photo (optional)', type: 'file', as: 'photoUrls' },
    ],
    submit: (body) => transportApi.shipmentAction(id, 'issues', body),
  };
}
