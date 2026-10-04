import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import * as authService from '../services/auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

export async function signup(req: Request, res: Response) {
  const { email, password, name, inviteCode } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  // `role` in the body is deliberately ignored. The only way to get a privileged
  // role is a valid invite, and the role comes from the invite row.
  let code: string | undefined;
  if (inviteCode !== undefined && inviteCode !== null && inviteCode !== '') {
    if (typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }
    code = inviteCode.trim();
  }

  try {
    const result = await authService.signup(email, password, name, code);
    setRefreshCookie(res, result.refreshToken);
    return res.status(201).json({
      accessToken: result.accessToken,
      user: { id: result.userId, role: result.role },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    // One generic message for unknown, expired and used codes, so it doesn't leak which.
    if (err instanceof Error && err.message === 'INVALID_INVITE') {
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }
    console.error('[auth] signup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await authService.login(email, password);
    setRefreshCookie(res, result.refreshToken);
    return res.status(200).json({
      accessToken: result.accessToken,
      user: { id: result.userId, role: result.role },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    console.error('[auth] login error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    const accessToken = await authService.refreshAccessToken(token);
    return res.status(200).json({ accessToken });
  } catch (err) {
    if (err instanceof Error && (err.message === 'INVALID_REFRESH_TOKEN' || err.message === 'TOKEN_REVOKED')) {
      return res.status(401).json({ error: 'Invalid or expired session, please log in again' });
    }
    console.error('[auth] refresh error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return res.status(200).json({ message: 'Logged out' });
  }

  try {
    const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
    if (decoded?.jti && decoded?.exp) {
      await authService.logout(decoded.jti, decoded.exp);
    }
  } catch (err) {
    console.error('[auth] logout error (non-fatal):', err);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  return res.status(200).json({ message: 'Logged out' });
}