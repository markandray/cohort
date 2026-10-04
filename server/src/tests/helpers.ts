import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { hashInviteCode } from '../services/invite.service';

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function classCode(): string {
  // Deterministic-but-unique per test run: base-32-ish encoding of the shared counter,
  // padded to 6 chars, guarantees no collisions across a full --runInBand run.
  counter += 1;
  let n = counter;
  let code = '';
  for (let i = 0; i < 6; i++) {
    code = CODE_CHARS[n % CODE_CHARS.length] + code;
    n = Math.floor(n / CODE_CHARS.length);
  }
  return code;
}

export async function createUser(role: 'STUDENT' | 'TEACHER' | 'ADMIN') {
  return prisma.user.create({
    data: {
      name: unique(role.toLowerCase()),
      email: `${unique(role.toLowerCase())}@test.com`,
      password_hash: 'not-a-real-hash', // never checked in these tests — requireAuth only verifies the JWT
      role,
    },
  });
}

export async function createInviteFor(
  adminId: string,
  role: 'TEACHER' | 'ADMIN',
  overrides: Partial<{ expires_at: Date }> = {}
) {
  const code = randomBytes(32).toString('base64url');

  const invite = await prisma.invite.create({
    data: {
      token_hash: hashInviteCode(code),
      role,
      created_by: adminId,
      expires_at:
        overrides.expires_at ??
        new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return { invite, code };
}

export function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ userId: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

export function authHeader(user: { id: string; role: string }) {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

export async function createClass(teacherId: string, name = unique('class')) {
  return prisma.class.create({
    data: { name, teacher_id: teacherId, class_code: classCode() },
  });
}

export async function enrollStudent(studentId: string, classId: string) {
  return prisma.enrollment.create({
    data: { student_id: studentId, class_id: classId },
  });
}

export async function createAssignment(classId: string, overrides: Partial<{ title: string; description: string; due_date: Date }> = {}) {
  return prisma.assignment.create({
    data: {
      class_id: classId,
      title: overrides.title ?? unique('assignment'),
      description: overrides.description,
      due_date: overrides.due_date ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function createSubmission(
  assignmentId: string,
  studentId: string,
  overrides: Partial<{ content: string; file_url: string }> = {}
) {
  return prisma.submission.create({
    data: {
      assignment_id: assignmentId,
      student_id: studentId,
      content: overrides.content ?? unique('submission-content'),
      file_url: overrides.file_url,
    },
  });
}

export async function createNote(
  userId: string,
  overrides: Partial<{ title: string; content: string; class_id: string | null }> = {}
) {
  return prisma.note.create({
    data: {
      user_id: userId,
      title: overrides.title ?? unique('note-title'),
      content: overrides.content ?? unique('note-content'),
      class_id: overrides.class_id ?? null,
    },
  });
}

export async function createStudyGroup(
  classId: string,
  creatorId: string,
  name = unique('group')
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.studyGroup.create({
      data: { class_id: classId, name, created_by: creatorId },
    });
    await tx.groupMember.create({
      data: { group_id: group.id, student_id: creatorId },
    });
    return group;
  });
}

export async function addGroupMember(groupId: string, studentId: string) {
  return prisma.groupMember.create({
    data: { group_id: groupId, student_id: studentId },
  });
}

export async function setSubmissionGrade(
  submissionId: string,
  grade: number,
  feedback?: string
) {
  return prisma.submission.update({
    where: { id: submissionId },
    data: { grade, feedback: feedback ?? null },
  });
}