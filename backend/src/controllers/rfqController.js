import * as rfqService from '../services/rfqService.js';

export async function createRfq(req, res, next) {
  try {
    const rfq = await rfqService.createRfq({
      ...req.body,
      buyerId: req.user?.id || req.body.buyerId || null,
      buyerName: req.body.buyerName || req.user?.name,
      buyerEmail: req.body.buyerEmail || req.user?.email,
      buyerCompany: req.body.buyerCompany || req.user?.companyName,
    });
    res.status(201).json({
      success: true,
      message: 'RFQ created successfully.',
      data: rfq,
    });
  } catch (error) {
    next(error);
  }
}

export async function listRfqs(req, res, next) {
  try {
    const { status, category, search, scope } = req.query;
    let buyerId = null;
    let supplierId = null;

    if (scope === 'buyer' && req.user) {
      buyerId = req.user.id;
    } else if (scope === 'supplier' && req.user) {
      supplierId = req.user.id;
    }

    const rfqs = await rfqService.listRfqs({
      buyerId,
      supplierId,
      status,
      categorySlug: category,
      search,
    });

    res.json({ success: true, count: rfqs.length, data: rfqs });
  } catch (error) {
    next(error);
  }
}

export async function getRfq(req, res, next) {
  try {
    const rfq = await rfqService.getRfqById(req.params.id);
    res.json({ success: true, data: rfq });
  } catch (error) {
    next(error);
  }
}

export async function submitQuote(req, res, next) {
  try {
    const supplierId = req.user?.id || req.body.supplierId;
    if (!supplierId) {
      return res.status(401).json({ success: false, message: 'Supplier authentication required.' });
    }

    const quotation = await rfqService.submitQuote(req.params.id, {
      ...req.body,
      supplierId,
    });

    res.status(201).json({
      success: true,
      message: 'Quote submitted successfully.',
      data: quotation,
    });
  } catch (error) {
    next(error);
  }
}

export async function counterQuote(req, res, next) {
  try {
    const role = req.user?.role || req.body.role || 'BUYER';
    const quote = await rfqService.counterOffer(req.params.quoteId, {
      ...req.body,
      role,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: `Counter-offer submitted (Round ${quote.currentVersion} of 3).`,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptQuote(req, res, next) {
  try {
    const quote = await rfqService.acceptQuote(req.params.quoteId, {
      buyerId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Quote accepted! Ready for checkout and order completion.',
      data: quote,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectQuote(req, res, next) {
  try {
    const quote = await rfqService.rejectQuote(req.params.quoteId, {
      reason: req.body.reason,
    });

    res.json({
      success: true,
      message: 'Quote rejected.',
      data: quote,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRfqComparison(req, res, next) {
  try {
    const comparison = await rfqService.getRfqComparison(req.params.id, req.user);
    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
}

export async function saveComparison(req, res, next) {
  try {
    const saved = await rfqService.saveComparisonPreferences(req.params.id, req.user?.id, req.body);
    res.json({
      success: true,
      message: 'Comparison preferences saved.',
      data: saved,
    });
  } catch (error) {
    next(error);
  }
}

