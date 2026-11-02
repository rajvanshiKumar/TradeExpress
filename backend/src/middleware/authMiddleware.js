import { verifyJwt } from '../utils/jwt.js';
import prisma from '../config/db.js';

export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
        adminPermissions: true,
        isActive: true,
        status: true,
        statusReason: true,
        company: true,
        phone: true,
        city: true,
        country: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (user.isActive === false || user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. Reason: ' + (user.statusReason || 'Violation of terms.'),
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyJwt(token);
  if (!payload) {
    req.user = null;
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
        adminPermissions: true,
        isActive: true,
        status: true,
        company: true,
      },
    });
    req.user = (user && user.isActive !== false && user.status !== 'SUSPENDED') ? user : null;
  } catch {
    req.user = null;
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    // SUPER_ADMIN has platform-wide authority
    if (req.user.role === 'SUPER_ADMIN' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Forbidden. Super Admin access required.' });
  }
  next();
}

export function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    // SUPER_ADMIN has universal access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    if (req.user.role === 'ADMIN') {
      const perms = Array.isArray(req.user.adminPermissions) ? req.user.adminPermissions : [];
      const domain = permissionCode.includes('.') ? permissionCode.split('.')[0] : permissionCode;
      if (
        perms.includes('*') ||
        perms.includes(permissionCode) ||
        perms.includes(`${domain}.*`) ||
        perms.includes(`${domain}.manage`)
      ) {
        return next();
      }
    }
    return res.status(403).json({
      success: false,
      message: `Forbidden. Missing required permission: ${permissionCode}`,
    });
  };
}
