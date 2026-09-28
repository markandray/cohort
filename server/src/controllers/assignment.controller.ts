import { Request, Response } from 'express';
import * as assignmentService from '../services/assignment.service';

export async function createAssignment(req: Request, res: Response) {
  const classId = req.params.id as string;
  const { title, description, dueDate } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (!dueDate || isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: 'dueDate is required and must be a valid date' });
  }

  try {
    // teacher_id comes from the authenticated user, never the request body.
    const { userId, role } = req.user!;
    const isAdmin = role === 'ADMIN';
    const assignment = await assignmentService.createAssignment(
      userId,
      isAdmin,
      classId,
      title.trim(),
      typeof description === 'string' ? description.trim() : undefined,
      new Date(dueDate)
    );
    return res.status(201).json({ assignment });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    console.error('[assignment] createAssignment error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function listAssignments(req: Request, res: Response) {
  const classId = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const assignments = await assignmentService.listAssignmentsForClass(classId, userId, role);
    return res.status(200).json({ assignments });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    console.error('[assignment] listAssignments error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getAssignment(req: Request, res: Response) {
  const assignmentId = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const assignment = await assignmentService.getAssignmentById(assignmentId, userId, role);
    return res.status(200).json({ assignment });
  } catch (err) {
    if (err instanceof Error && err.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    console.error('[assignment] getAssignment error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}