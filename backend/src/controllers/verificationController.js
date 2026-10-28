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
