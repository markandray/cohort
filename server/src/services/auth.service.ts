import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import {prisma} from '../config/database';
import redis from '../config/redis';
import { env } from '../config/env';

import { Prisma } from '@prisma/client';
import { hashInviteCode } from './invite.service';

const SALT_ROUNDS = 10;

const ACCESS_TOKEN_EXPIRY: SignOptions['expiresIn'] = '15m';
const REFRESH_TOKEN_EXPIRY: SignOptions['expiresIn'] = '7d';

interface TokenPayload {
  userId: string;
  role: string;
}

function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function signRefreshToken(payload: TokenPayload, jti: string): string {
  return jwt.sign(
    { ...payload, jti },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );
}


function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function signup(
  email: string,
  password: string,
  name: string,
  inviteCode?: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new Error('EMAIL_TAKEN');
  }

  // Hash outside the transaction so we don't hold a DB transaction open during bcrypt.
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    // No invite: always a STUDENT. The role is never taken from the caller.
    if (!inviteCode) {
      const user = await prisma.user.create({
        data: { email: normalizedEmail, password_hash, name, role: 'STUDENT' },
      });
      return issueTokens(user.id, user.role);
    }

    const user = await prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({
        where: { token_hash: hashInviteCode(inviteCode) },
      });
      if (!invite || invite.used_at || invite.expires_at <= new Date()) {
        throw new Error('INVALID_INVITE');
      }

      const created = await tx.user.create({
        data: { email: normalizedEmail, password_hash, name, role: invite.role },
      });

      // The actual lock: a conditional update. If a concurrent signup already claimed
      // this invite, this matches 0 rows and we throw, rolling back the user we just
      // created. Exactly one redeemer can ever win.
      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, used_at: null, expires_at: { gt: new Date() } },
        data: { used_at: new Date(), used_by: created.id },
      });
      if (claimed.count !== 1) {
        throw new Error('INVALID_INVITE');
      }

      return created;
    });

    return issueTokens(user.id, user.role);
  } catch (err) {
    // Lost a race on the email unique index between the pre-check and the insert.
    if (isUniqueViolation(err)) {
      throw new Error('EMAIL_TAKEN');
    }
    throw err;
  }
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return issueTokens(user.id, user.role);
}

function issueTokens(userId: string, role: string) {
  const payload: TokenPayload = {
    userId,
    role,
  };

  const jti = randomUUID();

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload, jti);

  return {
    accessToken,
    refreshToken,
    userId,
    role,
  };
}

export async function logout(jti: string, exp: number) {
  const ttl = exp - Math.floor(Date.now() / 1000);

  if (ttl > 0) {
    await redis.set(
      `blacklist:${jti}`,
      '1',
      'EX',
      ttl
    );
  }
}

export async function isBlacklisted(
  jti: string
): Promise<boolean> {
  const result = await redis.get(`blacklist:${jti}`);

  return result !== null;
}

export async function refreshAccessToken(
  refreshToken: string
) {
  let decoded: TokenPayload & {
    jti: string;
    exp: number;
  };

  try {
    decoded = jwt.verify(
      refreshToken,
      env.JWT_REFRESH_SECRET
    ) as typeof decoded;
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (await isBlacklisted(decoded.jti)) {
    throw new Error('TOKEN_REVOKED');
  }

  return signAccessToken({
    userId: decoded.userId,
    role: decoded.role,
  });
}
