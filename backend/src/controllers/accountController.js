import * as preferencesService from '../services/preferencesService.js';
import * as sessionService from '../services/sessionService.js';
import * as accountService from '../services/accountService.js';
import * as accountSecurityService from '../services/accountSecurityService.js';
import * as accountDeletionService from '../services/accountDeletionService.js';

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

export async function getPreferences(req, res, next) {
  try {
    res.json({ success: true, data: await preferencesService.getPreferences(req.user.id) });
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const data = await preferencesService.updatePreferences(req.user.id, req.body || {});
    res.json({ success: true, message: 'Your preferences have been saved.', data });
  } catch (error) {
    next(error);
  }
}

export async function exportData(req, res, next) {
  try {
    const data = await preferencesService.exportAccountData(req.user.id);
    res.setHeader('Content-Disposition', 'attachment; filename="tradeexpress-my-data.json"');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listSessions(req, res, next) {
  try {
    res.json({ success: true, data: await sessionService.listSessions(req.user.id) });
  } catch (error) {
    next(error);
  }
}

export async function revokeSession(req, res, next) {
  try {
    const data = await sessionService.revokeSession(req.user, req.params.id);
    res.json({ success: true, message: 'That device has been signed out.', data });
  } catch (error) {
    next(error);
  }
}

export async function revokeOtherSessions(req, res, next) {
  try {
    const data = await sessionService.revokeOtherSessions(req.user);
    res.json({ success: true, message: data.revoked ? 'All other devices have been signed out.' : 'You were not signed in on any other device.', data });
  } catch (error) {
    next(error);
  }
}

export async function changePhone(req, res, next) {
  try {
    const { grant, phone, country, verificationToken } = req.body;
    const data = await accountSecurityService.changePhoneWithGrant(req.user.id, { grant, phone, country, verificationToken });
    res.json({ success: true, message: 'Your phone number has been updated.', data });
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

// Account deletion (Buyers and Suppliers only; checked again in the service)

export async function getDeletionStatus(req, res, next) {
  try {
    const data = await accountDeletionService.getDeletionStatus(req.user.id, req.user.role);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    const data = await accountDeletionService.deleteOwnAccount(req.user.id, req.user.role, { grant: req.body.grant, confirmation: req.body.confirmation });
    res.json({ success: true, message: 'Your account has been deleted.', data });
  } catch (error) {
    next(error);
  }
}
