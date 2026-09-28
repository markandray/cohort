import { prisma } from '../config/database';

export async function submitAssignment(
  studentId: string,
  assignmentId: string,
  content: string | undefined,
  fileUrl: string | undefined
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) {
    throw new Error('ASSIGNMENT_NOT_FOUND');
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { student_id: studentId, class_id: assignment.class_id },
  });
  if (!enrollment) {
    throw new Error('NOT_ENROLLED');
  }

  try {
    return await prisma.submission.create({
      data: {
        assignment_id: assignmentId,
        student_id: studentId,
        content,
        file_url: fileUrl,
      },
    });
  } catch (err: any) {
    // Prisma unique constraint violation → @@unique([assignment_id, student_id])
    if (err.code === 'P2002') {
      throw new Error('ALREADY_SUBMITTED');
    }
    throw err;
  }
}

export async function getSubmissionsForAssignment(
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
    // Students never list all submissions for an assignment — that's the grading view.
    throw new Error('NOT_CLASS_OWNER');
  }

  return prisma.submission.findMany({
    where: { assignment_id: assignmentId },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { submitted_at: 'asc' },
  });
}

export async function getMySubmissions(studentId: string) {
  return prisma.submission.findMany({
    where: { student_id: studentId },
    include: {
      assignment: {
        select: { id: true, title: true, due_date: true, class_id: true },
      },
    },
    orderBy: { submitted_at: 'desc' },
  });
}

interface GradeSubmissionFields {
  grade?: number;
  feedback?: string;
}

export async function gradeSubmission(
  assignmentId: string,
  submissionId: string,
  userId: string,
  role: string,
  updates: GradeSubmissionFields
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

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission || submission.assignment_id !== assignmentId) {
    // A submission that exists but belongs to a different assignment is
    // treated identically to "doesn't exist" — see locked contract point 6.
    throw new Error('SUBMISSION_NOT_FOUND');
  }

  const data: { grade?: number; feedback?: string } = {};

  if ('grade' in updates) {
    data.grade = updates.grade;
  }

  if ('feedback' in updates) {
    data.feedback = updates.feedback;
  }

  return prisma.submission.update({
    where: { id: submissionId },
    data,
  });
}

export async function resubmitAssignment(
  studentId: string,
  assignmentId: string,
  content: string | undefined,
  fileUrl: string | undefined
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) {
    throw new Error('ASSIGNMENT_NOT_FOUND');
  }

  const existing = await prisma.submission.findFirst({
    where: { assignment_id: assignmentId, student_id: studentId },
  });
  if (!existing) {
    throw new Error('NO_EXISTING_SUBMISSION');
  }

  return prisma.submission.update({
    where: { id: existing.id },
    data: {
      content: content ?? null,
      file_url: fileUrl ?? null,
      submitted_at: new Date(),
      grade: null,
      feedback: null,
    },
  });
}