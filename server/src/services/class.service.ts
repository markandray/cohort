import { randomBytes } from 'crypto';
import {prisma} from '../config/database';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // matches the backfill alphabet

function generateClassCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

export async function createClass(teacherId: string, name: string) {
  // Collision-checked: retry on the rare unique-constraint hit.
  for (let attempt = 0; attempt < 5; attempt++) {
    const class_code = generateClassCode();
    try {
      return await prisma.class.create({
        data: { name, teacher_id: teacherId, class_code },
      });
    } catch (err: any) {
      if (err.code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('CODE_GENERATION_FAILED');
}

export async function listClasses(userId: string, role: string) {
  const where =
    role === 'TEACHER'
      ? { teacher_id: userId }
      : role === 'STUDENT'
      ? { enrollments: { some: { student_id: userId } } }
      : undefined; // ADMIN: no filter, sees everything

  return prisma.class.findMany({
    where,
    select: {
      id: true,
      name: true,
      teacher_id: true,
      created_at: true,
      teacher: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getClassById(classId: string) {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      class_code: true,
      teacher_id: true,
      created_at: true,
      teacher: { select: { id: true, name: true } },
    },
  });

  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  return classRecord;
}

export async function enrollStudent(studentId: string, classId: string) {
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  try {
    return await prisma.enrollment.create({
      data: {
        student_id: studentId,
        class_id: classId,
      },
    });
  } catch (err: any) {
    // Prisma unique constraint violation → @@unique([student_id, class_id])
    if (err.code === 'P2002') {
      throw new Error('ALREADY_ENROLLED');
    }
    throw err;
  }
}

export async function joinClassByCode(studentId: string, classCode: string) {
  const classRecord = await prisma.class.findUnique({ where: { class_code: classCode } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: { student_id: studentId, class_id: classRecord.id },
    });
    return { enrollment, class: classRecord };
  } catch (err: any) {
    if (err.code === 'P2002') {
      throw new Error('ALREADY_ENROLLED');
    }
    throw err;
  }
}

export async function getClassEnrollments(classId: string, requestingUserId: string, requestingUserRole: string) {
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  // Ownership check: a TEACHER may only view enrollments for their own class.
  if (requestingUserRole === 'TEACHER' && classRecord.teacher_id !== requestingUserId) {
    throw new Error('NOT_CLASS_OWNER');
  }

  return prisma.enrollment.findMany({
    where: { class_id: classId },
    select: {
      id: true,
      student: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getMyEnrollments(studentId: string) {
  return prisma.enrollment.findMany({
    where: { student_id: studentId },
    select: {
      id: true,
      class: {
        select: { id: true, name: true, class_code: true, teacher: { select: { id: true, name: true } } },
      },
    },
  });
}