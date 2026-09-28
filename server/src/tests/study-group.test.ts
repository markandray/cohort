import request from 'supertest';
import app from '../app';
import { resetDb, disconnectDb } from './db';
import {
  createUser,
  authHeader,
  createClass,
  enrollStudent,
  createStudyGroup,
  addGroupMember,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/classes/:id/study-groups', () => {
  it('enrolled student creates a group → 201, creator auto-joins', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(student))
      .send({ name: 'Study Buddies' });

    expect(res.status).toBe(201);
    expect(res.body.studyGroup).toMatchObject({
      name: 'Study Buddies',
      class_id: klass.id,
      created_by: student.id,
    });

    const membersRes = await request(app)
      .get(`/api/study-groups/${res.body.studyGroup.id}/members`)
      .set(authHeader(student));
    expect(membersRes.status).toBe(200);
    expect(membersRes.body.members).toHaveLength(1);
    expect(membersRes.body.members[0].student.id).toBe(student.id);
  });

  it('unenrolled student → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(student))
      .send({ name: 'Study Buddies' });

    expect(res.status).toBe(403);
  });

  it('teacher cannot create (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(teacher))
      .send({ name: 'Study Buddies' });

    expect(res.status).toBe(403);
  });

  it('admin cannot create (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(admin))
      .send({ name: 'Study Buddies' });

    expect(res.status).toBe(403);
  });

  it('missing class → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/classes/00000000-0000-0000-0000-000000000000/study-groups')
      .set(authHeader(student))
      .send({ name: 'Study Buddies' });

    expect(res.status).toBe(404);
  });

  it('missing name → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const res = await request(app)
      .post(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(student))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/classes/:id/study-groups', () => {
  it('enrolled student can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    await createStudyGroup(klass.id, student.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.studyGroups).toHaveLength(1);
    expect(res.body.studyGroups[0]._count.members).toBe(1);
  });

  it('unrelated student → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(student));

    expect(res.status).toBe(403);
  });

  it('owning teacher can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
  });

  it('non-owning teacher → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('admin can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);

    const res = await request(app)
      .get(`/api/classes/${klass.id}/study-groups`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('missing class → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get('/api/classes/00000000-0000-0000-0000-000000000000/study-groups')
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/study-groups/:id/join', () => {
  it('enrolled student joins → 201', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const joiner = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    await enrollStudent(joiner.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/join`)
      .set(authHeader(joiner));

    expect(res.status).toBe(201);
  });

  it('already a member → 409', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/join`)
      .set(authHeader(creator));

    expect(res.status).toBe(409);
  });

  it('unenrolled student → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const outsider = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/join`)
      .set(authHeader(outsider));

    expect(res.status).toBe(403);
  });

  it('teacher cannot join (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/join`)
      .set(authHeader(teacher));

    expect(res.status).toBe(403);
  });

  it('admin cannot join (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/join`)
      .set(authHeader(admin));

    expect(res.status).toBe(403);
  });

  it('missing group → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/study-groups/00000000-0000-0000-0000-000000000000/join')
      .set(authHeader(student));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/study-groups/:id/leave', () => {
  it('member leaves → 200', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const joiner = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    await enrollStudent(joiner.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);
    await addGroupMember(group.id, joiner.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/leave`)
      .set(authHeader(joiner));

    expect(res.status).toBe(200);
  });

  it('non-member → 404', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const outsider = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .post(`/api/study-groups/${group.id}/leave`)
      .set(authHeader(outsider));

    expect(res.status).toBe(404);
  });

  it('missing group → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .post('/api/study-groups/00000000-0000-0000-0000-000000000000/leave')
      .set(authHeader(student));

    expect(res.status).toBe(404);
  });

  it('creator can leave and still rename/delete afterward', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const leaveRes = await request(app)
      .post(`/api/study-groups/${group.id}/leave`)
      .set(authHeader(creator));
    expect(leaveRes.status).toBe(200);

    const renameRes = await request(app)
      .patch(`/api/study-groups/${group.id}`)
      .set(authHeader(creator))
      .send({ name: 'Renamed After Leaving' });
    expect(renameRes.status).toBe(200);
    expect(renameRes.body.studyGroup.name).toBe('Renamed After Leaving');

    const deleteRes = await request(app)
      .delete(`/api/study-groups/${group.id}`)
      .set(authHeader(creator));
    expect(deleteRes.status).toBe(204);
  });
});

describe('GET /api/study-groups/:id/members', () => {
  it('enrolled student can view → 200', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}/members`)
      .set(authHeader(creator));

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
  });

  it('unrelated student → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const outsider = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}/members`)
      .set(authHeader(outsider));

    expect(res.status).toBe(403);
  });

  it('owning teacher can view → 200', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}/members`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
  });

  it('non-owning teacher → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(owner.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}/members`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('admin can view → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}/members`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('missing group → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get('/api/study-groups/00000000-0000-0000-0000-000000000000/members')
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/study-groups/:id', () => {
  it('creator renames → 200', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id, 'Old Name');

    const res = await request(app)
      .patch(`/api/study-groups/${group.id}`)
      .set(authHeader(creator))
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.studyGroup.name).toBe('New Name');
  });

  it('non-creator member → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const joiner = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    await enrollStudent(joiner.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);
    await addGroupMember(group.id, joiner.id);

    const res = await request(app)
      .patch(`/api/study-groups/${group.id}`)
      .set(authHeader(joiner))
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('unrelated user → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const outsider = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .patch(`/api/study-groups/${group.id}`)
      .set(authHeader(outsider))
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('missing name → 400', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .patch(`/api/study-groups/${group.id}`)
      .set(authHeader(creator))
      .send({});

    expect(res.status).toBe(400);
  });

  it('missing group → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .patch('/api/study-groups/00000000-0000-0000-0000-000000000000')
      .set(authHeader(student))
      .send({ name: 'New Name' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/study-groups/:id', () => {
  it('creator deletes → 204, group and members gone', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const joiner = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    await enrollStudent(joiner.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);
    await addGroupMember(group.id, joiner.id);

    const res = await request(app)
      .delete(`/api/study-groups/${group.id}`)
      .set(authHeader(creator));

    expect(res.status).toBe(204);

    const membersRes = await request(app)
      .get(`/api/study-groups/${group.id}/members`)
      .set(authHeader(teacher));
    expect(membersRes.status).toBe(404);
  });

  it('non-creator → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const joiner = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    await enrollStudent(joiner.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);
    await addGroupMember(group.id, joiner.id);

    const res = await request(app)
      .delete(`/api/study-groups/${group.id}`)
      .set(authHeader(joiner));

    expect(res.status).toBe(403);
  });

  it('missing group → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .delete('/api/study-groups/00000000-0000-0000-0000-000000000000')
      .set(authHeader(student));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/study-groups/:id', () => {
  it('enrolled student can get → 200', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id, 'My Group');

    const res = await request(app)
      .get(`/api/study-groups/${group.id}`)
      .set(authHeader(creator));

    expect(res.status).toBe(200);
    expect(res.body.studyGroup).toMatchObject({
      id: group.id,
      name: 'My Group',
      class_id: klass.id,
      created_by: creator.id,
    });
  });

  it('unrelated student → 403', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const outsider = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}`)
      .set(authHeader(outsider));

    expect(res.status).toBe(403);
  });

  it('owning teacher can get → 200', async () => {
    const teacher = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
  });

  it('non-owning teacher → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const creator = await createUser('STUDENT');
    const klass = await createClass(owner.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('admin can get → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const creator = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(creator.id, klass.id);
    const group = await createStudyGroup(klass.id, creator.id);

    const res = await request(app)
      .get(`/api/study-groups/${group.id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('missing group → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get('/api/study-groups/00000000-0000-0000-0000-000000000000')
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});