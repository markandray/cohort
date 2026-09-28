import { Request, Response } from 'express';
import * as noteService from '../services/note.service';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createNote(req: Request, res: Response) {
  const { title, content, classId } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (!isNonEmptyString(content)) {
    return res.status(400).json({ error: 'content is required' });
  }

  if (classId !== undefined) {
    if (classId === null || typeof classId !== 'string' || !classId.trim()) {
      return res.status(400).json({ error: 'classId must be a non-empty string' });
    }
  }

  try {
    const { userId, role } = req.user!;
    const note = await noteService.createNote(
      userId,
      role,
      title.trim(),
      content.trim(),
      classId !== undefined ? classId.trim() : undefined
    );
    return res.status(201).json({ note });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'NOT_RELATED_TO_CLASS') {
      return res.status(403).json({ error: 'You are not related to this class' });
    }
    console.error('[note] createNote error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getMyNotes(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const notes = await noteService.getMyNotes(userId);
    return res.status(200).json({ notes });
  } catch (err) {
    console.error('[note] getMyNotes error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getNote(req: Request, res: Response) {
  const noteId = req.params.id as string;

  try {
    const userId = req.user!.userId;
    const note = await noteService.getNoteById(noteId, userId);
    return res.status(200).json({ note });
  } catch (err) {
    if (err instanceof Error && err.message === 'NOTE_NOT_FOUND') {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (err instanceof Error && err.message === 'NOT_NOTE_OWNER') {
      return res.status(403).json({ error: 'You do not own this note' });
    }
    console.error('[note] getNote error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function updateNote(req: Request, res: Response) {
  const noteId = req.params.id as string;
  const body = req.body ?? {};

  const hasTitle = 'title' in body;
  const hasContent = 'content' in body;
  const hasClassId = 'classId' in body;

  if (!hasTitle && !hasContent && !hasClassId) {
    return res.status(400).json({ error: 'No recognized fields provided' });
  }

  const updates: { title?: string; content?: string; classId?: string | null } = {};

  if (hasTitle) {
    if (!isNonEmptyString(body.title)) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    updates.title = body.title.trim();
  }

  if (hasContent) {
    if (!isNonEmptyString(body.content)) {
      return res.status(400).json({ error: 'content cannot be empty' });
    }
    updates.content = body.content.trim();
  }

  if (hasClassId) {
    if (body.classId === null) {
      // Explicit null — remove the class association.
      updates.classId = null;
    } else if (typeof body.classId !== 'string' || !body.classId.trim()) {
      return res.status(400).json({ error: 'classId must be a non-empty string or null' });
    } else {
      updates.classId = body.classId.trim();
    }
  }

  try {
    const { userId, role } = req.user!;
    const note = await noteService.updateNote(noteId, userId, role, updates);
    return res.status(200).json({ note });
  } catch (err) {
    if (err instanceof Error && err.message === 'NOTE_NOT_FOUND') {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (err instanceof Error && err.message === 'NOT_NOTE_OWNER') {
      return res.status(403).json({ error: 'You do not own this note' });
    }
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'NOT_RELATED_TO_CLASS') {
      return res.status(403).json({ error: 'You are not related to this class' });
    }
    console.error('[note] updateNote error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function deleteNote(req: Request, res: Response) {
  const noteId = req.params.id as string;

  try {
    const userId = req.user!.userId;
    await noteService.deleteNote(noteId, userId);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === 'NOTE_NOT_FOUND') {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (err instanceof Error && err.message === 'NOT_NOTE_OWNER') {
      return res.status(403).json({ error: 'You do not own this note' });
    }
    console.error('[note] deleteNote error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}