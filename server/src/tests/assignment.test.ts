import request from 'supertest';
import app from '../app';
import { resetDb, disconnectDb } from './db';
import { createUser, authHeader, createClass, enrollStudent, createAssignment } from './helpers';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/classes/:id/assignments', () => {
  it('teacher creates assignment in own class → 201', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(teacher))
      .send({ title: 'HW1', dueDate: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.assignment).toMatchObject({ title: 'HW1', class_id: klass.id });
  });

  it('teacher creates in another teacher\'s class → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(other))
      .send({ title: 'HW1', dueDate: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(403);
  });

  it('admin creates in any class → 201', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(admin))
      .send({ title: 'HW1', dueDate: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(201);
  });

  it('missing class → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .post(`/api/classes/00000000-0000-0000-0000-000000000000/assignments`)
      .set(authHeader(teacher))
      .send({ title: 'HW1', dueDate: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(404);
  });

  it('missing title → 400', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(teacher))
      .send({ dueDate: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(400);
  });

  it('invalid dueDate → 400', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(teacher))
      .send({ title: 'HW1', dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('student cannot create (role gate) → 403', async () => {
    const student = await createUser('STUDENT');
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(student))
      .send({ title: 'HW1', dueDate: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/classes/:id/assignments', () => {
  it('enrolled student can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(1);
  });

  it('unenrolled student cannot list → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(student));

    expect(res.status).toBe(403);
  });

  it('class teacher can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
  });

  it('other teacher cannot list → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('admin can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/assignments`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('missing class → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get(`/api/classes/00000000-0000-0000-0000-000000000000/assignments`)
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/assignments/:id', () => {
  it('enrolled student can get → 200', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.assignment.id).toBe(assignment.id);
  });

  it('unenrolled student cannot get → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}`)
      .set(authHeader(student));

    expect(res.status).toBe(403);
  });

  it('other teacher cannot get → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('admin can get → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('missing assignment → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get(`/api/assignments/00000000-0000-0000-0000-000000000000`)
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});