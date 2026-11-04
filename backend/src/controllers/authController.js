import { revokeCurrentSession } from '../services/sessionService.js';
import * as authService from '../services/authService.js';
import * as otpService from '../services/otpService.js';
import * as addressService from '../services/addressService.js';

export async function sendMobileOtp(req, res, next) {
  try {
    const { phone, country } = req.body;
    const result = await otpService.requestMobileOtp({ phone, country });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyMobileOtp(req, res, next) {
  try {
    const { phone, country, otp } = req.body;
    const result = await otpService.verifyMobileOtp({ phone, country, otp });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resendMobileOtp(req, res, next) {
  try {
    const { phone, country } = req.body;
    const result = await otpService.resendMobileOtp({ phone, country });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function sendEmailOtp(req, res, next) {
  try {
    const { email, role } = req.body;
    const result = await otpService.requestEmailLoginOtp({ email, role });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    otpService.validateEmailLoginOtp({ email, otp, consume: false });
    res.json({ success: true, message: 'Email OTP code is valid.' });
  } catch (error) {
    next(error);
  }
}

export async function sendEmailVerificationOtp(req, res, next) {
  try {
    const { email, name, purpose, role } = req.body;
    const result = await otpService.requestEmailVerificationOtp({ email, name, purpose, role });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailVerificationOtp(req, res, next) {
  try {
    const { email, otp, purpose } = req.body;
    const result = await otpService.verifyEmailVerificationOtp({ email, otp, purpose });
    res.json(result);
  } catch (error) {
    next(error);
  }
}


export async function sendMobileLoginOtp(req, res, next) {
  try {
    const { phone, country, role } = req.body;
    const result = await otpService.requestMobileLoginOtp({ phone, country, role });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function loginMobile(req, res, next) {
  try {
    const { phone, country, otp, role } = req.body;
    const { user, token } = await otpService.verifyAndLoginMobile({ phone, country, otp, role });
    res.json({
      success: true,
      message: 'Signed in successfully via mobile OTP.',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function adminLogin(req, res, next) {
  try {
    const { user, token } = await authService.loginUser({
      ...req.body,
      isAdminLogin: true,
    });
    res.json({
      success: true,
      message: 'Super Admin signed in successfully.',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function register(req, res, next) {
  try {
    const upperRole = (req.body.role || '').toUpperCase();
    if (upperRole === 'SUPPLIER') {
      const result = await authService.registerSupplier({
        ...req.body,
        req,
      });
      return res.status(201).json({
        success: true,
        message: 'Supplier account created successfully. Your profile is pending compliance verification.',
        data: result,
      });
    }

    // Comprehensive enterprise Buyer registration
    if (req.body.businessAddress || req.body.buyerType || req.body.state) {
      const result = await authService.registerBuyer({
        ...req.body,
        req,
      });
      return res.status(201).json({
        success: true,
        message: 'Buyer account created successfully.',
        data: result,
      });
    }

    const { user, token } = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function googleAuth(req, res, next) {
  try {
    const result = await authService.authenticateGoogle({ code: req.body.code, role: req.body.role });
    res.json({
      success: true,
      message: result.status === 'SIGNED_IN' ? 'Signed in with Google.' : 'Google account verified. Complete your supplier signup.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function registerBuyer(req, res, next) {
  try {
    const result = await authService.registerBuyer({
      ...req.body,
      req,
    });
    res.status(201).json({
      success: true,
      message: 'Buyer account created successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function registerSupplier(req, res, next) {
  try {
    const result = await authService.registerSupplier({
      ...req.body,
      req,
    });
    res.status(201).json({
      success: true,
      message: 'Supplier account created successfully. Your profile is pending compliance verification.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { user, token } = await authService.loginUser(req.body);
    res.json({
      success: true,
      message: 'Signed in successfully.',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAddresses(req, res, next) {
  try {
    const addresses = await addressService.listAddresses(req.user.id);
    res.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
}

export async function addAddress(req, res, next) {
  try {
    const address = await addressService.createAddress(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Address saved.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAddress(req, res, next) {
  try {
    const address = await addressService.updateAddress(req.user.id, req.params.id, req.body);
    res.json({
      success: true,
      message: 'Address updated.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
}

export async function setDefaultAddress(req, res, next) {
  try {
    const address = await addressService.setDefaultAddress(req.user.id, req.params.id);
    res.json({
      success: true,
      message: 'Default shipping address updated.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAddress(req, res, next) {
  try {
    const result = await addressService.deleteAddress(req.user.id, req.params.id);
    res.json({
      success: true,
      message: 'Address deleted.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await authService.updateUserProfile(req.user.id, req.body);
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitKyc(req, res, next) {
  try {
    const submit = req.body?.submit === true;
    const result = await authService.submitKyc(req.user.id, { ...req.body, submit });
    res.json({
      success: true,
      message: submit ? 'Business details submitted for verification. Status: In review.' : 'Business details saved.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getKyc(req, res, next) {
  try {
    const result = await authService.getKycStatus(req.user.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


/** Signs out the device making the request (its login token stops working immediately). */
export async function logout(req, res, next) {
  try {
    await revokeCurrentSession(req.user.id);
    res.json({ success: true, message: 'Signed out.' });
  } catch (error) {
    next(error);
  }
}
