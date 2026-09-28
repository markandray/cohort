import { prisma } from '../config/database';

async function verifyClassRelation(classId: string, userId: string, role: string) {
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    throw new Error('CLASS_NOT_FOUND');
  }

  if (role === 'ADMIN') {
    return;
  }

  if (role === 'TEACHER') {
    if (classRecord.teacher_id !== userId) {
      throw new Error('NOT_RELATED_TO_CLASS');
    }
    return;
  }

  if (role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findFirst({
      where: { student_id: userId, class_id: classId },
    });
    if (!enrollment) {
      throw new Error('NOT_RELATED_TO_CLASS');
    }
    return;
  }

  // Any other/unrecognized role — no valid relation to a class.
  throw new Error('NOT_RELATED_TO_CLASS');
}

export async function createNote(
  userId: string,
  role: string,
  title: string,
  content: string,
  classId: string | undefined
) {
  if (classId) {
    await verifyClassRelation(classId, userId, role);
  }

  return prisma.note.create({
    data: {
      user_id: userId,
      class_id: classId ?? null,
      title,
      content,
    },
  });
}

export async function getMyNotes(userId: string) {
  return prisma.note.findMany({
    where: { user_id: userId },
    include: { class: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  });
}

export async function getNoteById(noteId: string, userId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { class: { select: { id: true, name: true } } },
  });

  if (!note) {
    throw new Error('NOTE_NOT_FOUND');
  }

  if (note.user_id !== userId) {
    throw new Error('NOT_NOTE_OWNER');
  }

  return note;
}

interface NoteUpdateFields {
  title?: string;
  content?: string;
  classId?: string | null;
}

export async function updateNote(
  noteId: string,
  userId: string,
  role: string,
  updates: NoteUpdateFields
) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });

  if (!note) {
    throw new Error('NOTE_NOT_FOUND');
  }

  if (note.user_id !== userId) {
    throw new Error('NOT_NOTE_OWNER');
  }

  const data: { title?: string; content?: string; class_id?: string | null } = {};

  if (updates.title !== undefined) {
    data.title = updates.title;
  }

  if (updates.content !== undefined) {
    data.content = updates.content;
  }

  // classId: undefined means "not provided, leave unchanged" — the caller
  // (controller) is responsible for only including this key when the field
  // was actually present in the request body, since `null` is a meaningful
  // value here (explicit class-removal), not "not provided."
  if ('classId' in updates) {
    if (updates.classId === null) {
      data.class_id = null;
    } else if (updates.classId) {
      await verifyClassRelation(updates.classId, userId, role);
      data.class_id = updates.classId;
    }
  }

  return prisma.note.update({
    where: { id: noteId },
    data,
  });
}

export async function deleteNote(noteId: string, userId: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });

  if (!note) {
    throw new Error('NOTE_NOT_FOUND');
  }

  if (note.user_id !== userId) {
    throw new Error('NOT_NOTE_OWNER');
  }

  await prisma.note.delete({ where: { id: noteId } });
}