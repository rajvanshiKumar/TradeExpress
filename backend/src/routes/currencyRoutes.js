import { Router } from 'express';
import { getExchangeRates } from '../services/exchangeRateService.js';

const router = Router();

/** GET /api/currency/rates: rates relative to 1 INR, for approximate display prices only. */
router.get('/rates', async (req, res, next) => {
  try {
    const { base, rates, updatedAt, stale } = await getExchangeRates();
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.json({
      success: true,
      data: { base, rates, updatedAt, stale, provider: 'ExchangeRate-API', providerUrl: 'https://www.exchangerate-api.com' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
