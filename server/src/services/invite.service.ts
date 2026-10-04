import { createHash, randomBytes } from 'crypto';
import { prisma } from '../config/database';

export const INVITE_ROLES = ['TEACHER', 'ADMIN'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

const DEFAULT_EXPIRY_HOURS = 72;
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 24 * 30;

// SHA-256 is right here (not bcrypt): the code is 256 bits of randomness, so there's
// nothing to brute-force, and we need a deterministic hash to look the invite up by.
export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function createInvite(
  createdBy: string,
  role: InviteRole,
  expiresInHours: number = DEFAULT_EXPIRY_HOURS
) {
  if (!INVITE_ROLES.includes(role)) {
    throw new Error('INVALID_INVITE_ROLE');
  }
  if (
    typeof expiresInHours !== 'number' ||
    !Number.isFinite(expiresInHours) ||
    expiresInHours < MIN_EXPIRY_HOURS ||
    expiresInHours > MAX_EXPIRY_HOURS
  ) {
    throw new Error('INVALID_EXPIRY');
  }

  const code = randomBytes(32).toString('base64url');

  const invite = await prisma.invite.create({
    data: {
      token_hash: hashInviteCode(code),
      role,
      expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      created_by: createdBy,
    },
  });

  // The raw code exists only in this return value. It is never stored.
  return { id: invite.id, role: invite.role, expires_at: invite.expires_at, code };
}

export async function listInvites() {
  const now = new Date();
  const invites = await prisma.invite.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { redeemer: { select: { id: true, name: true, email: true } } },
  });

  return invites.map((i) => ({
    id: i.id,
    role: i.role,
    created_at: i.created_at,
    expires_at: i.expires_at,
    used_at: i.used_at,
    redeemed_by: i.redeemer,
    status: i.used_at ? 'USED' : i.expires_at <= now ? 'EXPIRED' : 'PENDING',
  }));
}

export async function revokeInvite(id: string) {
  const { count } = await prisma.invite.deleteMany({
    where: { id, used_at: null },
  });
  if (count !== 1) {
    throw new Error('INVITE_NOT_FOUND');
  }
}