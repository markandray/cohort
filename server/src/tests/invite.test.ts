import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import redis from '../config/redis';
import { createUser, authHeader, createInviteFor } from './helpers';
import { hashInviteCode } from '../services/invite.service';
import { createAdmin } from '../services/admin.service';

afterAll(async () => {
  await redis.quit();
  await prisma.$disconnect();
});

let n = 0;
const newEmail = () => `invitee-${Date.now()}-${++n}@test.com`;
const PASSWORD = 'correct-horse-battery';

function signup(body: Record<string, unknown>) {
  return request(app)
    .post('/api/auth/signup')
    .send({ name: 'Test User', password: PASSWORD, ...body });
}

describe('POST /api/invites', () => {
  it('ADMIN creates a TEACHER invite and only the hash is stored', async () => {
    const admin = await createUser('ADMIN');

    const res = await request(app)
      .post('/api/invites')
      .set(authHeader(admin))
      .send({ role: 'TEACHER' });

    expect(res.status).toBe(201);
    const { id, code, role } = res.body.invite;
    expect(role).toBe('TEACHER');
    expect(typeof code).toBe('string');

    const stored = await prisma.invite.findUnique({ where: { id } });
    expect(stored!.token_hash).toBe(hashInviteCode(code));
    expect(stored!.token_hash).not.toBe(code);
    expect(stored!.created_by).toBe(admin.id);
  });

  it('ADMIN can create an ADMIN invite', async () => {
    const admin = await createUser('ADMIN');
    const res = await request(app)
      .post('/api/invites')
      .set(authHeader(admin))
      .send({ role: 'ADMIN', expiresInHours: 24 });
    expect(res.status).toBe(201);
    expect(res.body.invite.role).toBe('ADMIN');
  });

  it.each(['STUDENT', 'SUPERUSER', undefined])('rejects role %s', async (role) => {
    const admin = await createUser('ADMIN');
    const res = await request(app).post('/api/invites').set(authHeader(admin)).send({ role });
    expect(res.status).toBe(400);
  });

  it.each([0, -5, 721, 'soon', null])('rejects expiresInHours %s', async (expiresInHours) => {
    const admin = await createUser('ADMIN');
    const res = await request(app)
      .post('/api/invites')
      .set(authHeader(admin))
      .send({ role: 'TEACHER', expiresInHours });
    expect(res.status).toBe(400);
  });

  it('TEACHER and STUDENT get 403, unauthenticated gets 401', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');

    const asTeacher = await request(app).post('/api/invites').set(authHeader(teacher)).send({ role: 'TEACHER' });
    const asStudent = await request(app).post('/api/invites').set(authHeader(student)).send({ role: 'TEACHER' });
    const anon = await request(app).post('/api/invites').send({ role: 'TEACHER' });

    expect(asTeacher.status).toBe(403);
    expect(asStudent.status).toBe(403);
    expect(anon.status).toBe(401);
  });
});

describe('GET /api/invites and DELETE /api/invites/:id', () => {
  it('lists invites with status and never exposes hashes or codes', async () => {
    const admin = await createUser('ADMIN');
    const { invite } = await createInviteFor(admin.id, 'TEACHER');
    const { invite: expired } = await createInviteFor(admin.id, 'TEACHER', {
      expires_at: new Date(Date.now() - 1000),
    });

    const res = await request(app).get('/api/invites').set(authHeader(admin));

    expect(res.status).toBe(200);
    const byId = new Map(res.body.invites.map((i: { id: string }) => [i.id, i]));
    expect((byId.get(invite.id) as { status: string }).status).toBe('PENDING');
    expect((byId.get(expired.id) as { status: string }).status).toBe('EXPIRED');
    expect(JSON.stringify(res.body)).not.toContain(invite.token_hash);
  });

  it('non-admins cannot list or revoke', async () => {
    const admin = await createUser('ADMIN');
    const teacher = await createUser('TEACHER');
    const { invite } = await createInviteFor(admin.id, 'TEACHER');

    expect((await request(app).get('/api/invites').set(authHeader(teacher))).status).toBe(403);
    expect((await request(app).delete(`/api/invites/${invite.id}`).set(authHeader(teacher))).status).toBe(403);
  });

  it('revoking an unused invite makes its code unusable; used invites cannot be revoked', async () => {
    const admin = await createUser('ADMIN');
    const { invite, code } = await createInviteFor(admin.id, 'TEACHER');

    const del = await request(app).delete(`/api/invites/${invite.id}`).set(authHeader(admin));
    expect(del.status).toBe(204);
    expect((await signup({ email: newEmail(), inviteCode: code })).status).toBe(400);

    const { invite: used, code: usedCode } = await createInviteFor(admin.id, 'TEACHER');
    expect((await signup({ email: newEmail(), inviteCode: usedCode })).status).toBe(201);
    const delUsed = await request(app).delete(`/api/invites/${used.id}`).set(authHeader(admin));
    expect(delUsed.status).toBe(404);
  });
});

describe('POST /api/auth/signup with invites', () => {
  it('no invite creates a STUDENT', async () => {
    const email = newEmail();
    const res = await signup({ email });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('STUDENT');
  });

  it('ignores a client-supplied role', async () => {
    const email = newEmail();
    const res = await signup({ email, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('STUDENT');
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user!.role).toBe('STUDENT');
  });

  it.each(['TEACHER', 'ADMIN'] as const)('valid %s invite creates that role and burns the invite', async (role) => {
    const admin = await createUser('ADMIN');
    const { invite, code } = await createInviteFor(admin.id, role);
    const email = newEmail();

    const res = await signup({ email, inviteCode: code });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(role);
    const after = await prisma.invite.findUnique({ where: { id: invite.id } });
    expect(after!.used_at).not.toBeNull();
    expect(after!.used_by).toBe(res.body.user.id);
  });

  it('an invite role wins over a conflicting body role', async () => {
    const admin = await createUser('ADMIN');
    const { code } = await createInviteFor(admin.id, 'TEACHER');
    const res = await signup({ email: newEmail(), inviteCode: code, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('TEACHER');
  });

  it('rejects an unknown code and creates no user', async () => {
    const email = newEmail();
    const res = await signup({ email, inviteCode: 'not-a-real-code' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('rejects a non-string code', async () => {
    const res = await signup({ email: newEmail(), inviteCode: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('rejects an expired code and creates no user', async () => {
    const admin = await createUser('ADMIN');
    const { code } = await createInviteFor(admin.id, 'TEACHER', {
      expires_at: new Date(Date.now() - 1000),
    });
    const email = newEmail();
    const res = await signup({ email, inviteCode: code });
    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('rejects a reused code', async () => {
    const admin = await createUser('ADMIN');
    const { code } = await createInviteFor(admin.id, 'TEACHER');
    expect((await signup({ email: newEmail(), inviteCode: code })).status).toBe(201);

    const email = newEmail();
    const second = await signup({ email, inviteCode: code });
    expect(second.status).toBe(400);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('a taken email returns 409 and does not burn the invite', async () => {
    const admin = await createUser('ADMIN');
    const existing = await createUser('STUDENT');
    const { invite, code } = await createInviteFor(admin.id, 'TEACHER');

    const res = await signup({ email: existing.email, inviteCode: code });

    expect(res.status).toBe(409);
    const after = await prisma.invite.findUnique({ where: { id: invite.id } });
    expect(after!.used_at).toBeNull();
  });

  it('concurrent redemption: exactly one signup wins', async () => {
    const admin = await createUser('ADMIN');
    const { invite, code } = await createInviteFor(admin.id, 'ADMIN');
    const emailA = newEmail();
    const emailB = newEmail();

    const [a, b] = await Promise.all([
      signup({ email: emailA, inviteCode: code }),
      signup({ email: emailB, inviteCode: code }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 400]);

    const users = await prisma.user.findMany({ where: { email: { in: [emailA, emailB] } } });
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('ADMIN');

    const after = await prisma.invite.findUnique({ where: { id: invite.id } });
    expect(after!.used_by).toBe(users[0].id);
  });
});

describe('createAdmin bootstrap', () => {
  it('creates an ADMIN and is idempotent', async () => {
    const email = newEmail();
    const first = await createAdmin(email, 'a-long-admin-password', 'Root');
    const second = await createAdmin(email, 'a-long-admin-password', 'Root');

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const rows = await prisma.user.findMany({ where: { email } });
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('ADMIN');
    expect(rows[0].password_hash).not.toBe('a-long-admin-password');
  });

  it('refuses to touch an existing non-admin account', async () => {
    const student = await createUser('STUDENT');
    await expect(createAdmin(student.email, 'a-long-admin-password')).rejects.toThrow(
      'EMAIL_IN_USE_BY_NON_ADMIN'
    );
    const after = await prisma.user.findUnique({ where: { id: student.id } });
    expect(after!.role).toBe('STUDENT');
  });

  it('rejects short passwords', async () => {
    await expect(createAdmin(newEmail(), 'short')).rejects.toThrow('WEAK_PASSWORD');
  });
});