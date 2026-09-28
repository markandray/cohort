import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import {prisma} from '../config/database';
import redis from '../config/redis';
import { env } from '../config/env';

const SALT_ROUNDS = 10;

const ACCESS_TOKEN_EXPIRY: SignOptions['expiresIn'] = '15m';
const REFRESH_TOKEN_EXPIRY: SignOptions['expiresIn'] = '7d';

const ALLOWED_SIGNUP_ROLES = ['STUDENT', 'TEACHER'] as const;
type SignupRole = (typeof ALLOWED_SIGNUP_ROLES)[number];

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

export async function signup(
  email: string,
  password: string,
  name: string,
  role: SignupRole = 'STUDENT'
) {
  // Defense-in-depth: never trust callers to provide a valid role.
  if (!ALLOWED_SIGNUP_ROLES.includes(role)) {
    throw new Error('INVALID_ROLE');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new Error('EMAIL_TAKEN');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password_hash,
      name,
      role,
    },
  });

  return issueTokens(user.id, user.role);
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
