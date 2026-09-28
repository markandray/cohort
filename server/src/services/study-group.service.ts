import { prisma } from '../config/database';

async function checkClassAccess(classId: string, userId: string, role: string) {
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

  // ADMIN falls through with no check, same convention as assignment.service.ts.
}

export async function createStudyGroup(
  studentId: string,
  classId: string,
  name: string
) {
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { student_id: studentId, class_id: classId },
  });
  if (!enrollment) {
    throw new Error('NOT_ENROLLED');
  }

  return prisma.$transaction(async (tx) => {
    const group = await tx.studyGroup.create({
      data: {
        class_id: classId,
        name,
        created_by: studentId,
      },
    });

    await tx.groupMember.create({
      data: {
        group_id: group.id,
        student_id: studentId,
      },
    });

    return group;
  });
}

export async function listStudyGroupsForClass(
  classId: string,
  userId: string,
  role: string
) {
  await checkClassAccess(classId, userId, role);

  return prisma.studyGroup.findMany({
    where: { class_id: classId },
    include: { _count: { select: { members: true } } },
    orderBy: { created_at: 'desc' },
  });
}

export async function joinStudyGroup(studentId: string, groupId: string) {
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { student_id: studentId, class_id: group.class_id },
  });
  if (!enrollment) {
    throw new Error('NOT_ENROLLED');
  }

  try {
    return await prisma.groupMember.create({
      data: {
        group_id: groupId,
        student_id: studentId,
      },
    });
  } catch (err: any) {
    // Prisma unique constraint violation → @@unique([group_id, student_id])
    if (err.code === 'P2002') {
      throw new Error('ALREADY_MEMBER');
    }
    throw err;
  }
}

export async function leaveStudyGroup(studentId: string, groupId: string) {
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  const membership = await prisma.groupMember.findFirst({
    where: { group_id: groupId, student_id: studentId },
  });
  if (!membership) {
    throw new Error('NOT_MEMBER');
  }

  await prisma.groupMember.delete({ where: { id: membership.id } });
}

export async function getGroupMembers(
  groupId: string,
  userId: string,
  role: string
) {
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  await checkClassAccess(group.class_id, userId, role);

  return prisma.groupMember.findMany({
    where: { group_id: groupId },
    include: { student: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateStudyGroup(
  groupId: string,
  userId: string,
  name: string
) {
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  if (group.created_by !== userId) {
    throw new Error('NOT_GROUP_OWNER');
  }

  return prisma.studyGroup.update({
    where: { id: groupId },
    data: { name },
  });
}

export async function deleteStudyGroup(groupId: string, userId: string) {
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  if (group.created_by !== userId) {
    throw new Error('NOT_GROUP_OWNER');
  }

  // GroupMember → StudyGroup has no onDelete: Cascade in the schema, so
  // members must be cleared first or the delete hits an FK constraint.
  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { group_id: groupId } }),
    prisma.studyGroup.delete({ where: { id: groupId } }),
  ]);
}

export async function getStudyGroupById(
  groupId: string,
  userId: string,
  role: string
) {
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  await checkClassAccess(group.class_id, userId, role);

  return group;
}