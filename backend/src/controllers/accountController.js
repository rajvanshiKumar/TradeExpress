import * as accountService from '../services/accountService.js';
import * as accountSecurityService from '../services/accountSecurityService.js';

// The account is always the authenticated user's own: req.user comes from the verified login token.

export async function getSettings(req, res, next) {
  try {
    const data = await accountService.getAccountSettings(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { name, company, city } = req.body;
    const data = await accountService.updateAccountProfile(req.user.id, req.user.role, { name, company, city });
    res.json({ success: true, message: 'Profile updated.', data });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatar(req, res, next) {
  try {
    const data = await accountService.saveAvatar(req.user.id, req.file, `${req.protocol}://${req.get('host')}`);
    res.json({ success: true, message: 'Profile photo updated.', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAvatar(req, res, next) {
  try {
    const data = await accountService.removeAvatar(req.user.id);
    res.json({ success: true, message: 'Profile photo removed.', data });
  } catch (error) {
    next(error);
  }
}

// Verified changes: password and email (codes are sent to and checked for req.user only)

export async function sendVerificationCode(req, res, next) {
  try {
    const data = await accountSecurityService.sendAccountCode(req.user.id, req.body.purpose);
    res.json({ success: true, message: `We sent a 6-digit code to ${data.maskedTarget}.`, data });
  } catch (error) {
    next(error);
  }
}

export async function verifyVerificationCode(req, res, next) {
  try {
    const data = await accountSecurityService.verifyAccountCode(req.user.id, req.body.purpose, req.body.otp);
    res.json({ success: true, message: 'Verified.', data });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { grant, newPassword, confirmPassword } = req.body;
    const data = await accountSecurityService.changePasswordWithGrant(req.user.id, { grant, newPassword, confirmPassword });
    res.json({ success: true, message: 'Your password has been updated successfully.', data });
  } catch (error) {
    next(error);
  }
}

export async function requestEmailChange(req, res, next) {
  try {
    const data = await accountSecurityService.requestEmailChange(req.user.id, { grant: req.body.grant, newEmail: req.body.newEmail });
    res.json({ success: true, message: `We sent a 6-digit code to ${data.maskedTarget}.`, data });
  } catch (error) {
    next(error);
  }
}

export async function verifyNewEmail(req, res, next) {
  try {
    const data = await accountSecurityService.completeEmailChange(req.user.id, { grant: req.body.grant, otp: req.body.otp });
    res.json({ success: true, message: 'Your email address has been changed successfully.', data });
  } catch (error) {
    next(error);
  }
}
