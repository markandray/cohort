import { prisma } from '../config/database';

function sevenDaysFromNow(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function getStudentDashboard(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { student_id: studentId },
    include: { class: { select: { id: true, name: true } } },
  });
  const classes = enrollments.map((e) => e.class);

  const now = new Date();
  const windowEnd = sevenDaysFromNow();

  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      class_id: { in: classes.map((c) => c.id) },
      due_date: { gte: now, lte: windowEnd },
      NOT: { submissions: { some: { student_id: studentId } } },
    },
    include: { class: { select: { name: true } } },
    orderBy: { due_date: 'asc' },
  });

  const overdueAssignments = await prisma.assignment.findMany({
    where: {
      class_id: { in: classes.map((c) => c.id) },
      due_date: { lt: now },
      NOT: { submissions: { some: { student_id: studentId } } },
    },
    include: { class: { select: { name: true } } },
    orderBy: { due_date: 'asc' },
  });

  const gradedSubmissions = await prisma.submission.findMany({
    where: { student_id: studentId, grade: { not: null } },
    include: { assignment: { select: { title: true } } },
  });

  const memberships = await prisma.groupMember.findMany({
    where: { student_id: studentId },
    include: {
      group: {
        select: { id: true, name: true, class: { select: { name: true } } },
      },
    },
  });
  const studyGroups = memberships.map((m) => m.group);

  const noteCount = await prisma.note.count({ where: { user_id: studentId } });

  return {
    classes,
    classCount: classes.length,
    upcomingAssignments,
    overdueAssignments,
    gradedSubmissions,
    studyGroups,
    studyGroupCount: studyGroups.length,
    noteCount,
  };
}

export async function getTeacherDashboard(teacherId: string) {
  const classes = await prisma.class.findMany({
    where: { teacher_id: teacherId },
    select: { id: true, name: true },
  });

  const ungradedSubmissions = await prisma.submission.findMany({
    where: {
      grade: null,
      assignment: { class: { teacher_id: teacherId } },
    },
    include: {
      assignment: {
        select: { id: true, title: true, class: { select: { name: true } } },
      },
      student: { select: { name: true } },
    },
    orderBy: { submitted_at: 'asc' },
  });

  const windowEnd = sevenDaysFromNow();
  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      class_id: { in: classes.map((c) => c.id) },
      due_date: { gte: new Date(), lte: windowEnd },
    },
    include: { class: { select: { name: true } } },
    orderBy: { due_date: 'asc' },
  });

  return {
    classes,
    classCount: classes.length,
    ungradedSubmissions,
    upcomingAssignments,
  };
}

export async function getAdminDashboard() {
  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true },
  });

  const countFor = (role: string) =>
    usersByRole.find((r) => r.role === role)?._count.role ?? 0;

  const totalClasses = await prisma.class.count();
  const totalAssignments = await prisma.assignment.count();
  const totalUngradedSubmissions = await prisma.submission.count({
    where: { grade: null },
  });

  return {
    totalStudents: countFor('STUDENT'),
    totalTeachers: countFor('TEACHER'),
    totalAdmins: countFor('ADMIN'),
    totalClasses,
    totalAssignments,
    totalUngradedSubmissions,
  };
}