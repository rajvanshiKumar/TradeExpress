import seedInquiries from '../data/inquiries';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection, wait } from './localCollection';
import makeId from '../utils/ids';

const inquiries = createCollection(STORAGE_KEYS.inquiries, seedInquiries);

const inquiryService = {
  listInquiries: (options) => inquiries.list(options),
  saveInquiries: (records) => inquiries.saveAll(records),

  /** Builds a quote-request record. Resolves after a short simulated delay; nothing is sent anywhere. */
  async createInquiry(values, { product, company, buyer }) {
    await wait();
    return {
      id: makeId('TS-RFQ'),
      buyerId: buyer?.id ?? 'guest',
      buyerName: values.buyerName.trim(),
      buyerEmail: values.buyerEmail.trim(),
      productId: product?.id ?? null,
      productName: product?.name ?? values.productName.trim(),
      companyId: company?.id ?? product?.companyId ?? null,
      quantity: Number(values.quantity),
      unit: product?.unit ?? 'unit',
      specifications: values.specifications.trim(),
      targetPrice: values.targetPrice === '' ? null : Number(values.targetPrice),
      destinationCountry: values.destinationCountry,
      deliveryTime: values.deliveryTime,
      message: values.message.trim(),
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      quote: null,
    };
  },
};

export default inquiryService;
