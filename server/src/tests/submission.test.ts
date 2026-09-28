import request from 'supertest';
import app from '../app';
import { resetDb, disconnectDb } from './db';
import {
  createUser,
  authHeader,
  createClass,
  enrollStudent,
  createAssignment,
  createSubmission,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/assignments/:id/submit', () => {
  it('enrolled student submits → 201', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'my answer' });

    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({
      assignment_id: assignment.id,
      student_id: student.id,
      content: 'my answer',
    });
  });

  it('submits with fileUrl only → 201', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ fileUrl: 'https://example.com/my-answer.pdf' });

    expect(res.status).toBe(201);
    expect(res.body.submission.file_url).toBe('https://example.com/my-answer.pdf');
  });

  it('unenrolled student cannot submit → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'my answer' });

    expect(res.status).toBe(403);
  });

  it('teacher cannot submit (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(teacher))
      .send({ content: 'my answer' });

    expect(res.status).toBe(403);
  });

  it('missing assignment → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .post(`/api/assignments/00000000-0000-0000-0000-000000000000/submit`)
      .set(authHeader(student))
      .send({ content: 'my answer' });

    expect(res.status).toBe(404);
  });

  it('duplicate submission → 409', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'second attempt' });

    expect(res.status).toBe(409);
  });

  it('empty content and fileUrl → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({});

    expect(res.status).toBe(400);
  });

  it('whitespace-only content and fileUrl → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: '   ', fileUrl: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/assignments/:id/submissions', () => {
  it('class teacher can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}/submissions`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
  });

  it('other teacher cannot list → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const klass = await createClass(owner.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}/submissions`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  it('student cannot list (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}/submissions`)
      .set(authHeader(student));

    expect(res.status).toBe(403);
  });

  it('admin can list → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .get(`/api/assignments/${assignment.id}/submissions`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('missing assignment → 404', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get(`/api/assignments/00000000-0000-0000-0000-000000000000/submissions`)
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/submissions/me', () => {
  it('student sees own submissions → 200', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .get('/api/submissions/me')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.submissions[0].assignment.id).toBe(assignment.id);
  });

  it('teacher cannot access (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');

    const res = await request(app)
      .get('/api/submissions/me')
      .set(authHeader(teacher));

    expect(res.status).toBe(403);
  });

  it('no submissions yet → 200 with empty array', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .get('/api/submissions/me')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.submissions).toEqual([]);
  });
});

describe('PATCH /api/assignments/:assignmentId/submissions/:submissionId/grade', () => {
  it('owning teacher grades with grade only → 200, feedback unchanged', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 88 });

    expect(res.status).toBe(200);
    expect(res.body.submission.grade).toBe(88);
    expect(res.body.submission.feedback).toBeNull();
  });

  it('owning teacher grades with feedback only → 200, grade unchanged', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ feedback: 'Good work' });

    expect(res.status).toBe(200);
    expect(res.body.submission.feedback).toBe('Good work');
    expect(res.body.submission.grade).toBeNull();
  });

  it('owning teacher grades with both → 200', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 95, feedback: 'Excellent' });

    expect(res.status).toBe(200);
    expect(res.body.submission.grade).toBe(95);
    expect(res.body.submission.feedback).toBe('Excellent');
  });

  it('owning teacher can re-grade → 200, value updates', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 70 });

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 85 });

    expect(res.status).toBe(200);
    expect(res.body.submission.grade).toBe(85);
  });

  it('non-owning teacher → 403', async () => {
    const owner = await createUser('TEACHER');
    const other = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(owner.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(other))
      .send({ grade: 50 });

    expect(res.status).toBe(403);
  });

  it('student cannot grade (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(student))
      .send({ grade: 50 });

    expect(res.status).toBe(403);
  });

  it('admin can grade → 200', async () => {
    const teacher = await createUser('TEACHER');
    const admin = await createUser('ADMIN');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(admin))
      .send({ grade: 60 });

    expect(res.status).toBe(200);
  });

  it('grade below 0 → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: -5 });

    expect(res.status).toBe(400);
  });

  it('grade above 100 → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 101 });

    expect(res.status).toBe(400);
  });

  it('non-numeric grade → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 'A' });

    expect(res.status).toBe(400);
  });

  it('empty/whitespace feedback → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ feedback: '   ' });

    expect(res.status).toBe(400);
  });

  it('neither grade nor feedback provided → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({});

    expect(res.status).toBe(400);
  });

  it('missing assignment → 404', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/00000000-0000-0000-0000-000000000000/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 50 });

    expect(res.status).toBe(404);
  });

  it('missing submission → 404', async () => {
    const teacher = await createUser('TEACHER');
    const klass = await createClass(teacher.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/00000000-0000-0000-0000-000000000000/grade`)
      .set(authHeader(teacher))
      .send({ grade: 50 });

    expect(res.status).toBe(404);
  });

  it('submission belongs to a different assignment → 404', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignmentA = await createAssignment(klass.id);
    const assignmentB = await createAssignment(klass.id);
    const submission = await createSubmission(assignmentA.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignmentB.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 50 });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/assignments/:id/submit (resubmission)', () => {
  it('owner resubmits with new content → 200, content and submitted_at update', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const original = await createSubmission(assignment.id, student.id, { content: 'first draft' });

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'revised draft' });

    expect(res.status).toBe(200);
    expect(res.body.submission.id).toBe(original.id);
    expect(res.body.submission.content).toBe('revised draft');
    expect(new Date(res.body.submission.submitted_at).getTime()).toBeGreaterThanOrEqual(
      new Date(original.submitted_at).getTime()
    );
  });

  it('resubmitting clears a previously-set grade and feedback', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    const submission = await createSubmission(assignment.id, student.id);

    await request(app)
      .patch(`/api/assignments/${assignment.id}/submissions/${submission.id}/grade`)
      .set(authHeader(teacher))
      .send({ grade: 90, feedback: 'Great job' });

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'updated answer' });

    expect(res.status).toBe(200);
    expect(res.body.submission.grade).toBeNull();
    expect(res.body.submission.feedback).toBeNull();
  });

  it('resubmit with fileUrl only → 200, content cleared', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id, { content: 'old content' });

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ fileUrl: 'https://example.com/v2.pdf' });

    expect(res.status).toBe(200);
    expect(res.body.submission.file_url).toBe('https://example.com/v2.pdf');
    expect(res.body.submission.content).toBeNull();
  });

  it('student with no existing submission → 404 NO_EXISTING_SUBMISSION', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'first attempt via PATCH' });

    expect(res.status).toBe(404);
  });

  it('different enrolled student has no submission of their own → 404', async () => {
    const teacher = await createUser('TEACHER');
    const studentA = await createUser('STUDENT');
    const studentB = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(studentA.id, klass.id);
    await enrollStudent(studentB.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, studentA.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(studentB))
      .send({ content: 'attempt' });

    expect(res.status).toBe(404);
  });

  it('teacher cannot resubmit (role gate) → 403', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(teacher))
      .send({ content: 'attempt' });

    expect(res.status).toBe(403);
  });

  it('missing assignment → 404', async () => {
    const student = await createUser('STUDENT');

    const res = await request(app)
      .patch('/api/assignments/00000000-0000-0000-0000-000000000000/submit')
      .set(authHeader(student))
      .send({ content: 'attempt' });

    expect(res.status).toBe(404);
  });

  it('empty/whitespace content and fileUrl → 400', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .patch(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: '   ', fileUrl: '   ' });

    expect(res.status).toBe(400);
  });

  it('existing POST /submit still 409s on duplicate (unchanged Week 3 behavior)', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student.id);

    const res = await request(app)
      .post(`/api/assignments/${assignment.id}/submit`)
      .set(authHeader(student))
      .send({ content: 'trying to submit again via POST' });

    expect(res.status).toBe(409);
  });
});