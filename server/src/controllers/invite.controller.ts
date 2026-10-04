import { Request, Response } from 'express';
import * as inviteService from '../services/invite.service';

export async function create(req: Request, res: Response) {
  const { role, expiresInHours } = req.body ?? {};

  try {
    const invite = await inviteService.createInvite(req.user!.userId, role, expiresInHours);
    res.set('Cache-Control', 'no-store'); // this response carries a one-time secret
    return res.status(201).json({ invite });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_INVITE_ROLE') {
      return res.status(400).json({ error: 'role must be TEACHER or ADMIN' });
    }
    if (err instanceof Error && err.message === 'INVALID_EXPIRY') {
      return res.status(400).json({ error: 'expiresInHours must be a number between 1 and 720' });
    }
    console.error('[invite] create error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function list(_req: Request, res: Response) {
  try {
    const invites = await inviteService.listInvites();
    return res.status(200).json({ invites });
  } catch (err) {
    console.error('[invite] list error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function revoke(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid invite id' });
  }

  try {
    await inviteService.revokeInvite(id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === 'INVITE_NOT_FOUND') {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }
    console.error('[invite] revoke error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
