import { Request, Response } from 'express';
import * as classService from '../services/class.service';

export async function createClass(req: Request, res: Response) {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    // teacher_id comes from the authenticated user, never the request body.
    const teacherId = req.user!.userId;
    const newClass = await classService.createClass(teacherId, name.trim());
    return res.status(201).json({ class: newClass });
  } catch (err) {
    console.error('[class] createClass error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function listClasses(req: Request, res: Response) {
  try {
    const { userId, role } = req.user!;
    const classes = await classService.listClasses(userId, role);
    return res.status(200).json({ classes });
  } catch (err) {
    console.error('[class] listClasses error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getClass(req: Request, res: Response) {
  const id = req.params.id as string;

  try {
    const classRecord = await classService.getClassById(id);
    return res.status(200).json({ class: classRecord });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    console.error('[class] getClass error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function enroll(req: Request, res: Response) {
  const id = req.params.id as string;

  try {
    // student_id comes from the authenticated user, never the request body.
    const studentId = req.user!.userId;
    const enrollment = await classService.enrollStudent(studentId, id);
    return res.status(201).json({ enrollment });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'ALREADY_ENROLLED') {
      return res.status(409).json({ error: 'Already enrolled in this class' });
    }
    console.error('[class] enroll error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getClassEnrollments(req: Request, res: Response) {
  const id = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const enrollments = await classService.getClassEnrollments(id, userId, role);
    return res.status(200).json({ enrollments });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    console.error('[class] getClassEnrollments error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getMyEnrollments(req: Request, res: Response) {
  try {
    const studentId = req.user!.userId;
    const enrollments = await classService.getMyEnrollments(studentId);
    return res.status(200).json({ enrollments });
  } catch (err) {
    console.error('[class] getMyEnrollments error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function joinByCode(req: Request, res: Response) {
  const { classCode } = req.body;

  if (!classCode || typeof classCode !== 'string' || !classCode.trim()) {
    return res.status(400).json({ error: 'classCode is required' });
  }

  try {
    const studentId = req.user!.userId;
    const result = await classService.joinClassByCode(studentId, classCode.trim().toUpperCase());
    return res.status(201).json({ enrollment: result.enrollment, class: result.class });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Invalid class code' });
    }
    if (err instanceof Error && err.message === 'ALREADY_ENROLLED') {
      return res.status(409).json({ error: 'Already enrolled in this class' });
    }
    console.error('[class] joinByCode error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}