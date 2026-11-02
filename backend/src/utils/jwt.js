import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export function signJwt(payload, options = {}) {
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
    ...options,
  });
}

export function verifyJwt(token) {
  try {
    return jwt.verify(token, ENV.JWT_SECRET);
  } catch (error) {
    return null;
  }
}
