import request from 'supertest';
import app from '../app';
import { resetDb, disconnectDb } from './db';
import {
  createUser,
  authHeader,
  createClass,
  enrollStudent,
  createNote,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/notes', () => {
  it('creates a note without classId → 201', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note', content: 'Some content' });

    expect(res.status).toBe(201);
    expect(res.body.note).toMatchObject({
      title: 'My note',
      content: 'Some content',
      user_id: user.id,
      class_id: null,
    });
  });

  it('creates a note with a valid related class → 201', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(student))
      .send({ title: 'Class note', content: 'Content', classId: klass.id });

    expect(res.status).toBe(201);
    expect(res.body.note.class_id).toBe(klass.id);
  });

  it('unauthenticated create is rejected → 401', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 'My note', content: 'Some content' });

    expect(res.status).toBe(401);
  });

  it('missing title → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ content: 'Some content' });

    expect(res.status).toBe(400);
  });

  it('whitespace-only title → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: '   ', content: 'Some content' });

    expect(res.status).toBe(400);
  });

  it('missing content → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note' });

    expect(res.status).toBe(400);
  });

  it('whitespace-only content → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note', content: '   ' });

    expect(res.status).toBe(400);
  });

  it('non-string classId → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note', content: 'Content', classId: 12345 });

    expect(res.status).toBe(400);
  });

  it('classId: null on create → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note', content: 'Content', classId: null });

    expect(res.status).toBe(400);
  });

  it('empty string classId on create → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note', content: 'Content', classId: '' });

    expect(res.status).toBe(400);
  });

  it('whitespace-only classId on create → 400', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({ title: 'My note', content: 'Content', classId: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/notes — class relationship authorization', () => {
  it('enrolled STUDENT can attach → 201', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(student))
      .send({ title: 'Note', content: 'Content', classId: klass.id });

    expect(res.status).toBe(201);
  });

  it('class-owning TEACHER can attach → 201', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(teacher))
      .send({ title: 'Note', content: 'Content', classId: klass.id });

    expect(res.status).toBe(201);
  });

  it('ADMIN can attach to any class → 201', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(admin))
      .send({ title: 'Note', content: 'Content', classId: klass.id });

    expect(res.status).toBe(201);
  });

  it('unrelated STUDENT → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(student))
      .send({ title: 'Note', content: 'Content', classId: klass.id });

    expect(res.status).toBe(403);
  });

  it('non-owning TEACHER → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(other))
      .send({ title: 'Note', content: 'Content', classId: klass.id });

    expect(res.status).toBe(403);
  });

  it('nonexistent class → 404', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/notes')
      .set(authHeader(user))
      .send({
        title: 'Note',
        content: 'Content',
        classId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/notes/:id and /api/notes/me', () => {
  it('user can get their own note → 200', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.note.id).toBe(note.id);
  });

  it('another user gets 403', async () => {
    const owner = await createUser('STUDENT');
    const other = await createUser('STUDENT');
    const note = await createNote(owner.id);

    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('nonexistent note → 404', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .get('/api/notes/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user));

    expect(res.status).toBe(404);
  });

  it('GET /me only returns the authenticated user\'s notes', async () => {
    const userA = await createUser('STUDENT');
    const userB = await createUser('STUDENT');
    await createNote(userA.id, { title: 'A1' });
    await createNote(userA.id, { title: 'A2' });
    await createNote(userB.id, { title: 'B1' });

    const res = await request(app)
      .get('/api/notes/me')
      .set(authHeader(userA));

    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(2);
    expect(res.body.notes.every((n: any) => n.user_id === userA.id)).toBe(true);
  });

  it('unauthenticated access is rejected → 401', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app).get(`/api/notes/${note.id}`);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notes/:id', () => {
  it('updates title only', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id, { title: 'Old', content: 'Same' });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ title: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('New');
    expect(res.body.note.content).toBe('Same');
  });

  it('updates content only', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id, { title: 'Same', content: 'Old' });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ content: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.note.content).toBe('New');
    expect(res.body.note.title).toBe('Same');
  });

  it('updates classId only', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const note = await createNote(student.id, { title: 'T', content: 'C' });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(student))
      .send({ classId: klass.id });

    expect(res.status).toBe(200);
    expect(res.body.note.class_id).toBe(klass.id);
    expect(res.body.note.title).toBe('T');
  });

  it('updates title + content together', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id, { title: 'Old', content: 'Old' });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ title: 'New title', content: 'New content' });

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('New title');
    expect(res.body.note.content).toBe('New content');
  });

  it('changes classId to another valid related class', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klassA = await createClass(teacher.id);
    const klassB = await createClass(teacher.id);
    await enrollStudent(student.id, klassA.id);
    await enrollStudent(student.id, klassB.id);
    const note = await createNote(student.id, { class_id: klassA.id });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(student))
      .send({ classId: klassB.id });

    expect(res.status).toBe(200);
    expect(res.body.note.class_id).toBe(klassB.id);
  });

  it('classId: null removes the class association', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const note = await createNote(student.id, { class_id: klass.id });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(student))
      .send({ classId: null });

    expect(res.status).toBe(200);
    expect(res.body.note.class_id).toBeNull();
  });

  it('omitted classId leaves existing association unchanged', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const note = await createNote(student.id, { class_id: klass.id });

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(student))
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.note.class_id).toBe(klass.id);
  });

  it('empty/whitespace title → 400', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ title: '   ' });

    expect(res.status).toBe(400);
  });

  it('empty/whitespace content → 400', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ content: '   ' });

    expect(res.status).toBe(400);
  });

  it('invalid classId type → 400', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ classId: 12345 });

    expect(res.status).toBe(400);
  });

  it('empty/whitespace classId → 400', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ classId: '   ' });

    expect(res.status).toBe(400);
  });

  it('nonexistent class on classId change → 404', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ classId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('unrelated student changing classId → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    const note = await createNote(student.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(student))
      .send({ classId: klass.id });

    expect(res.status).toBe(403);
  });

  it('non-owning teacher changing classId → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);
    const note = await createNote(other.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(other))
      .send({ classId: klass.id });

    expect(res.status).toBe(403);
  });

  it('empty PATCH / no recognized fields → 400', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({});

    expect(res.status).toBe(400);
  });

  it('unrecognized fields only → 400', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(user))
      .send({ somethingElse: 'value' });

    expect(res.status).toBe(400);
  });

  it('another user cannot update someone else\'s note → 403', async () => {
    const owner = await createUser('STUDENT');
    const other = await createUser('STUDENT');
    const note = await createNote(owner.id);

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set(authHeader(other))
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('nonexistent note → 404', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .patch('/api/notes/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user))
      .send({ title: 'New' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('owner can delete and receives 204', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set(authHeader(user));

    expect(res.status).toBe(204);
  });

  it('deleted note can no longer be fetched', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    await request(app).delete(`/api/notes/${note.id}`).set(authHeader(user));

    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set(authHeader(user));

    expect(res.status).toBe(404);
  });

  it('another user gets 403', async () => {
    const owner = await createUser('STUDENT');
    const other = await createUser('STUDENT');
    const note = await createNote(owner.id);

    const res = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('nonexistent note → 404', async () => {
    const user = await createUser('STUDENT');

    const res = await request(app)
      .delete('/api/notes/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user));

    expect(res.status).toBe(404);
  });

  it('unauthenticated delete is rejected → 401', async () => {
    const user = await createUser('STUDENT');
    const note = await createNote(user.id);

    const res = await request(app).delete(`/api/notes/${note.id}`);

    expect(res.status).toBe(401);
  });
});