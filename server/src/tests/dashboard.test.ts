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
  setSubmissionGrade,
  createStudyGroup,
  createNote,
} from './helpers';

const DASHBOARD_QUERY = `
  query {
    dashboard {
      role
      student {
        classCount
        upcomingAssignments { id title dueDate className }
        overdueAssignments { id title dueDate className }
        currentGrades { submissionId assignmentTitle grade feedback }
        studyGroups { id name className }
        studyGroupCount
        noteCount
      }
      teacher {
        classCount
        ungradedSubmissions { submissionId assignmentId assignmentTitle studentName className submittedAt }
        upcomingAssignments { id title dueDate className }
      }
      admin {
        totalStudents
        totalTeachers
        totalAdmins
        totalClasses
        totalAssignments
        totalUngradedSubmissions
      }
    }
  }
`;

function gql(user: { id: string; role: string }) {
  return request(app)
    .post('/api/graphql')
    .set(authHeader(user))
    .send({ query: DASHBOARD_QUERY });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('GraphQL dashboard — auth', () => {
  it('unauthenticated request → 401', async () => {
    const res = await request(app).post('/api/graphql').send({ query: DASHBOARD_QUERY });
    expect(res.status).toBe(401);
  });
});

describe('GraphQL dashboard — STUDENT', () => {
  it('returns correct role and nulls out teacher/admin', async () => {
    const student = await createUser('STUDENT');

    const res = await gql(student);

    expect(res.status).toBe(200);
    expect(res.body.data.dashboard.role).toBe('STUDENT');
    expect(res.body.data.dashboard.teacher).toBeNull();
    expect(res.body.data.dashboard.admin).toBeNull();
  });

  it('classCount reflects enrolled classes', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const classA = await createClass(teacher.id);
    const classB = await createClass(teacher.id);
    await enrollStudent(student.id, classA.id);
    await enrollStudent(student.id, classB.id);

    const res = await gql(student);

    expect(res.body.data.dashboard.student.classCount).toBe(2);
  });

  it('upcomingAssignments includes due-within-7-days and not-yet-submitted only', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const withinWindowUnsubmitted = await createAssignment(klass.id, {
      title: 'Due soon, not submitted',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    const withinWindowSubmitted = await createAssignment(klass.id, {
      title: 'Due soon, already submitted',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await createSubmission(withinWindowSubmitted.id, student.id);
    await createAssignment(klass.id, {
      title: 'Too far out',
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    const res = await gql(student);
    const titles = res.body.data.dashboard.student.upcomingAssignments.map((a: any) => a.title);

    expect(titles).toContain('Due soon, not submitted');
    expect(titles).not.toContain('Due soon, already submitted');
    expect(titles).not.toContain('Too far out');
    expect(res.body.data.dashboard.student.upcomingAssignments[0].id).toBe(withinWindowUnsubmitted.id);
  });

  it('overdueAssignments includes past-due and not-yet-submitted only', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    await createAssignment(klass.id, {
      title: 'Overdue, not submitted',
      due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    const overdueSubmitted = await createAssignment(klass.id, {
      title: 'Overdue, already submitted',
      due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    await createSubmission(overdueSubmitted.id, student.id);

    const res = await gql(student);
    const titles = res.body.data.dashboard.student.overdueAssignments.map((a: any) => a.title);

    expect(titles).toContain('Overdue, not submitted');
    expect(titles).not.toContain('Overdue, already submitted');
  });

  it('currentGrades includes only graded submissions', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const gradedAssignment = await createAssignment(klass.id, { title: 'Graded one' });
    const gradedSubmission = await createSubmission(gradedAssignment.id, student.id);
    await setSubmissionGrade(gradedSubmission.id, 92, 'Nice work');

    const ungradedAssignment = await createAssignment(klass.id, { title: 'Ungraded one' });
    await createSubmission(ungradedAssignment.id, student.id);

    const res = await gql(student);
    const grades = res.body.data.dashboard.student.currentGrades;

    expect(grades).toHaveLength(1);
    expect(grades[0]).toMatchObject({
      submissionId: gradedSubmission.id,
      assignmentTitle: 'Graded one',
      grade: 92,
      feedback: 'Nice work',
    });
  });

  it('studyGroups and studyGroupCount reflect membership', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);
    const group = await createStudyGroup(klass.id, student.id, 'Study Buddies');

    const res = await gql(student);

    expect(res.body.data.dashboard.student.studyGroupCount).toBe(1);
    expect(res.body.data.dashboard.student.studyGroups[0]).toMatchObject({
      id: group.id,
      name: 'Study Buddies',
      className: klass.name,
    });
  });

  it('noteCount reflects note count', async () => {
    const student = await createUser('STUDENT');
    await createNote(student.id);
    await createNote(student.id);

    const res = await gql(student);

    expect(res.body.data.dashboard.student.noteCount).toBe(2);
  });
});

describe('GraphQL dashboard — TEACHER', () => {
  it('returns correct role and nulls out student/admin', async () => {
    const teacher = await createUser('TEACHER');

    const res = await gql(teacher);

    expect(res.body.data.dashboard.role).toBe('TEACHER');
    expect(res.body.data.dashboard.student).toBeNull();
    expect(res.body.data.dashboard.admin).toBeNull();
  });

  it('classCount reflects classes taught', async () => {
    const teacher = await createUser('TEACHER');
    await createClass(teacher.id);
    await createClass(teacher.id);

    const res = await gql(teacher);

    expect(res.body.data.dashboard.teacher.classCount).toBe(2);
  });

  it('ungradedSubmissions includes only ungraded, scoped to classes taught', async () => {
    const teacher = await createUser('TEACHER');
    const otherTeacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    const otherClass = await createClass(otherTeacher.id);
    await enrollStudent(student.id, klass.id);
    await enrollStudent(student.id, otherClass.id);

    const ungradedAssignment = await createAssignment(klass.id, { title: 'Needs grading' });
    const ungradedSubmission = await createSubmission(ungradedAssignment.id, student.id);

    const gradedAssignment = await createAssignment(klass.id, { title: 'Already graded' });
    const gradedSubmission = await createSubmission(gradedAssignment.id, student.id);
    await setSubmissionGrade(gradedSubmission.id, 80);

    const otherTeacherAssignment = await createAssignment(otherClass.id, { title: 'Not mine' });
    await createSubmission(otherTeacherAssignment.id, student.id);

    const res = await gql(teacher);
    const submissions = res.body.data.dashboard.teacher.ungradedSubmissions;
    const titles = submissions.map((s: any) => s.assignmentTitle);

    expect(titles).toContain('Needs grading');
    expect(titles).not.toContain('Already graded');
    expect(titles).not.toContain('Not mine');
    expect(submissions[0]).toMatchObject({
      submissionId: ungradedSubmission.id,
      assignmentId: ungradedAssignment.id,
      studentName: expect.any(String),
      className: klass.name,
    });
  });

  it('upcomingAssignments includes due-within-7-days regardless of submission status', async () => {
    const teacher = await createUser('TEACHER');
    const student = await createUser('STUDENT');
    const klass = await createClass(teacher.id);
    await enrollStudent(student.id, klass.id);

    const upcoming = await createAssignment(klass.id, {
      title: 'Due soon',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await createSubmission(upcoming.id, student.id);
    await createAssignment(klass.id, {
      title: 'Too far out',
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    const res = await gql(teacher);
    const titles = res.body.data.dashboard.teacher.upcomingAssignments.map((a: any) => a.title);

    expect(titles).toContain('Due soon');
    expect(titles).not.toContain('Too far out');
  });
});

describe('GraphQL dashboard — ADMIN', () => {
  it('returns correct role and nulls out student/teacher', async () => {
    const admin = await createUser('ADMIN');

    const res = await gql(admin);

    expect(res.body.data.dashboard.role).toBe('ADMIN');
    expect(res.body.data.dashboard.student).toBeNull();
    expect(res.body.data.dashboard.teacher).toBeNull();
  });

  it('platform-wide counts are correct', async () => {
    const teacher = await createUser('TEACHER');
    const student1 = await createUser('STUDENT');
    const student2 = await createUser('STUDENT');
    const admin = await createUser('ADMIN');
    const klass = await createClass(teacher.id);
    await enrollStudent(student1.id, klass.id);
    await enrollStudent(student2.id, klass.id);

    const assignment = await createAssignment(klass.id);
    await createSubmission(assignment.id, student1.id);
    const gradedSubmission = await createSubmission(assignment.id, student2.id);
    await setSubmissionGrade(gradedSubmission.id, 75);

    const res = await gql(admin);
    const totals = res.body.data.dashboard.admin;

    expect(totals).toMatchObject({
      totalStudents: 2,
      totalTeachers: 1,
      totalAdmins: 1,
      totalClasses: 1,
      totalAssignments: 1,
      totalUngradedSubmissions: 1,
    });
  });
});