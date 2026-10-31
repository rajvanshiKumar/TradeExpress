import * as verificationService from '../services/verificationService.js';
import prisma from '../config/db.js';

/**
 * Controller to handle PAN-Aadhaar Link Status verification.
 * POST /api/verification/pan-aadhaar/link-status
 */
export async function getPanAadhaarLinkStatus(req, res, next) {
  try {
    const { aadhaarNumber, aadhaar, pan, panNumber, userConsent, consent } = req.body;
    const finalAadhaar = aadhaarNumber || aadhaar;
    const finalPan = pan || panNumber || null;
    const finalConsent = userConsent !== undefined ? userConsent : consent;

    const userId = req.user ? req.user.id : null;

    const result = await verificationService.checkPanAadhaarLinkStatus({
      aadhaarNumber: finalAadhaar,
      pan: finalPan,
      userConsent: finalConsent,
      userId,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'VERIFICATION_ERROR',
          message: error.message,
        },
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * Controller to fetch existing PAN-Aadhaar Link Status for the logged-in user.
 * GET /api/verification/pan-aadhaar/status
 */
export async function getMyPanAadhaarStatus(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        panAadhaarStatus: true,
        panAadhaarLinked: true,
        panAadhaarMaskedPan: true,
        panAadhaarCheckedAt: true,
        aadhaarLast4: true,
        aadhaarConsent: true,
        isVerified: true,
        kycStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: {
        status: user.panAadhaarStatus || 'NOT_STARTED',
        linked: user.panAadhaarLinked || false,
        maskedPan: user.panAadhaarMaskedPan || null,
        checkedAt: user.panAadhaarCheckedAt || null,
        aadhaarLast4: user.aadhaarLast4 || null,
        kycStatus: user.kycStatus || 'NOT_SUBMITTED',
        isVerified: user.isVerified || false,
        disclaimer: 'PAN-Aadhaar linkage is statutory verification only and does not award Gold Supplier badge or full KYC verification.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to verify standard 15-character Indian GSTIN.
 * POST /api/verification/gstin/verify
 * POST /api/verification/gst/verify
 */
export async function verifyGstin(req, res, next) {
  try {
    const { gstin, gstinNumber, legalName } = req.body;
    const finalGstin = gstin || gstinNumber;

    if (!finalGstin) {
      return res.status(400).json({
        success: false,
        message: 'GSTIN is required for verification.',
      });
    }

    const userId = req.user ? req.user.id : null;

    const result = await verificationService.verifyGstin({
      gstin: finalGstin,
      legalName,
      userId,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'VERIFICATION_ERROR',
          message: error.message,
        },
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * Controller to fetch saved GSTIN details for the logged-in user.
 * GET /api/verification/gstin/status
 */
export async function getMyGstStatus(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        gstin: true,
        gstStatus: true,
        pan: true,
        taxId: true,
        state: true,
        isVerified: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: {
        gstin: user.gstin || null,
        gstStatus: user.gstStatus || null,
        pan: user.pan || null,
        taxId: user.taxId || null,
        state: user.state || null,
        isVerified: user.isVerified || false,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to verify 12-digit Aadhaar number with statutory consent.
 * POST /api/verification/aadhaar/verify
 */
export async function verifyAadhaar(req, res, next) {
  try {
    const { aadhaarNumber, aadhaar, userConsent, consent } = req.body;
    const finalAadhaar = aadhaarNumber || aadhaar;
    const finalConsent = userConsent !== undefined ? userConsent : consent;

    const result = await verificationService.verifyAadhaar({
      aadhaarNumber: finalAadhaar,
      userConsent: finalConsent,
      userId: req.user ? req.user.id : null,
    });

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'VERIFICATION_ERROR',
          message: error.message,
        },
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * Controller to verify 10-character PAN number and taxpayer status.
 * POST /api/verification/pan/verify
 */
export async function verifyPan(req, res, next) {
  try {
    const { pan, panNumber } = req.body;
    const finalPan = pan || panNumber;

    const result = await verificationService.verifyPan({
      pan: finalPan,
      userId: req.user ? req.user.id : null,
    });

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'VERIFICATION_ERROR',
          message: error.message,
        },
        message: error.message,
      });
    }
    next(error);
  }
}
