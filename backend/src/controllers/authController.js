import * as authService from '../services/authService.js';
import * as otpService from '../services/otpService.js';

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
    const { email, name, purpose } = req.body;
    const result = await otpService.requestEmailVerificationOtp({ email, name, purpose });
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
    const addresses = await authService.getUserAddresses(req.user.id);
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
    const address = await authService.saveAddress(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Address saved.',
      data: address,
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
    const result = await authService.submitKyc(req.user.id, req.body);
    res.json({
      success: true,
      message: 'KYC submitted successfully. Status: PENDING verification.',
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

