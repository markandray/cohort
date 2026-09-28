import request from 'supertest';
import app from '../app';
import { createUser, createClass, enrollStudent, authHeader } from './helpers';
import { prisma } from '../config/database';
import redis from '../config/redis';

afterAll(async () => {
  await redis.quit();
  await prisma.$disconnect();
});

describe('GET /api/classes', () => {
  it('STUDENT sees only classes they are enrolled in', async () => {
    const student = await createUser('STUDENT');
    const teacher = await createUser('TEACHER');
    const enrolledClass = await createClass(teacher.id);
    const otherClass = await createClass(teacher.id);
    await enrollStudent(student.id, enrolledClass.id);

    const res = await request(app).get('/api/classes').set(authHeader(student));

    expect(res.status).toBe(200);
    const ids = res.body.classes.map((c: { id: string }) => c.id);
    expect(ids).toContain(enrolledClass.id);
    expect(ids).not.toContain(otherClass.id);
  });

  it('STUDENT with no enrollments sees an empty list', async () => {
    const student = await createUser('STUDENT');
    const teacher = await createUser('TEACHER');
    await createClass(teacher.id);

    const res = await request(app).get('/api/classes').set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.classes).toEqual([]);
  });

  it('TEACHER sees only classes they teach', async () => {
    const teacher = await createUser('TEACHER');
    const otherTeacher = await createUser('TEACHER');
    const ownClass = await createClass(teacher.id);
    const otherClass = await createClass(otherTeacher.id);

    const res = await request(app).get('/api/classes').set(authHeader(teacher));

    expect(res.status).toBe(200);
    const ids = res.body.classes.map((c: { id: string }) => c.id);
    expect(ids).toContain(ownClass.id);
    expect(ids).not.toContain(otherClass.id);
  });

  it('ADMIN sees all classes regardless of ownership or enrollment', async () => {
    const admin = await createUser('ADMIN');
    const teacher1 = await createUser('TEACHER');
    const teacher2 = await createUser('TEACHER');
    const classA = await createClass(teacher1.id);
    const classB = await createClass(teacher2.id);

    const res = await request(app).get('/api/classes').set(authHeader(admin));

    expect(res.status).toBe(200);
    const ids = res.body.classes.map((c: { id: string }) => c.id);
    expect(ids).toContain(classA.id);
    expect(ids).toContain(classB.id);
  });
});