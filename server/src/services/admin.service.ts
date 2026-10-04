import bcrypt from 'bcrypt';
import { prisma } from '../config/database';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12;

export async function createAdmin(email: string, password: string, name = 'Admin') {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('WEAK_PASSWORD');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    // Idempotent for an existing admin, but never silently promote someone else.
    if (existing.role !== 'ADMIN') throw new Error('EMAIL_IN_USE_BY_NON_ADMIN');
    return { created: false, id: existing.id };
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, password_hash, name, role: 'ADMIN' },
  });
  return { created: true, id: user.id };
}