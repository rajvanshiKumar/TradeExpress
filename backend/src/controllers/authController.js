import * as authService from '../services/authService.js';

export async function register(req, res, next) {
  try {
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
