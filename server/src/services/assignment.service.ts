import { prisma } from '../config/database';

export async function createAssignment(
  teacherId: string,
  isAdmin: boolean,
  classId: string,
  title: string,
  description: string | undefined,
  dueDate: Date
) {
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  if (!isAdmin && classRecord.teacher_id !== teacherId) {
    throw new Error('NOT_CLASS_OWNER');
  }

  return prisma.assignment.create({
    data: {
      class_id: classId,
      title,
      description,
      due_date: dueDate,
    },
  });
}

export async function listAssignmentsForClass(
  classId: string,
  userId: string,
  role: string
) {
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  if (role === 'TEACHER' && classRecord.teacher_id !== userId) {
    throw new Error('NOT_CLASS_OWNER');
  }

  if (role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findFirst({
      where: { student_id: userId, class_id: classId },
    });
    if (!enrollment) {
      throw new Error('NOT_ENROLLED');
    }
  }

  return prisma.assignment.findMany({
    where: { class_id: classId },
    orderBy: { due_date: 'asc' },
  });
}

export async function getAssignmentById(
  assignmentId: string,
  userId: string,
  role: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: true },
  });

  if (!assignment) {
    throw new Error('ASSIGNMENT_NOT_FOUND');
  }

  if (role === 'TEACHER' && assignment.class.teacher_id !== userId) {
    throw new Error('NOT_CLASS_OWNER');
  }

  if (role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findFirst({
      where: { student_id: userId, class_id: assignment.class_id },
    });
    if (!enrollment) {
      throw new Error('NOT_ENROLLED');
    }
  }

  return assignment;
}