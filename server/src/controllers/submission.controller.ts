import { Request, Response } from 'express';
import * as submissionService from '../services/submission.service';

export async function submitAssignment(req: Request, res: Response) {
  const assignmentId = req.params.id as string;
  const { content, fileUrl } = req.body;

  const trimmedContent = typeof content === 'string' ? content.trim() : undefined;
  const trimmedFileUrl = typeof fileUrl === 'string' ? fileUrl.trim() : undefined;

  if (!trimmedContent && !trimmedFileUrl) {
    return res.status(400).json({ error: 'content or fileUrl is required' });
  }

  try {
    // student_id comes from the authenticated user, never the request body.
    const studentId = req.user!.userId;
    const submission = await submissionService.submitAssignment(
      studentId,
      assignmentId,
      trimmedContent || undefined,
      trimmedFileUrl || undefined
    );
    return res.status(201).json({ submission });
  } catch (err) {
    if (err instanceof Error && err.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    if (err instanceof Error && err.message === 'ALREADY_SUBMITTED') {
      return res.status(409).json({ error: 'You have already submitted this assignment' });
    }
    console.error('[submission] submitAssignment error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getSubmissionsForAssignment(req: Request, res: Response) {
  const assignmentId = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const submissions = await submissionService.getSubmissionsForAssignment(assignmentId, userId, role);
    return res.status(200).json({ submissions });
  } catch (err) {
    if (err instanceof Error && err.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You are not authorized to view these submissions' });
    }
    console.error('[submission] getSubmissionsForAssignment error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getMySubmissions(req: Request, res: Response) {
  try {
    const studentId = req.user!.userId;
    const submissions = await submissionService.getMySubmissions(studentId);
    return res.status(200).json({ submissions });
  } catch (err) {
    console.error('[submission] getMySubmissions error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function gradeSubmission(req: Request, res: Response) {
  const assignmentId = req.params.assignmentId as string;
  const submissionId = req.params.submissionId as string;
  const body = req.body ?? {};

  const hasGrade = 'grade' in body;
  const hasFeedback = 'feedback' in body;

  if (!hasGrade && !hasFeedback) {
    return res.status(400).json({ error: 'grade or feedback is required' });
  }

  const updates: { grade?: number; feedback?: string } = {};

  if (hasGrade) {
    if (typeof body.grade !== 'number' || Number.isNaN(body.grade) || body.grade < 0 || body.grade > 100) {
      return res.status(400).json({ error: 'grade must be a number between 0 and 100' });
    }
    updates.grade = body.grade;
  }

  if (hasFeedback) {
    if (typeof body.feedback !== 'string' || !body.feedback.trim()) {
      return res.status(400).json({ error: 'feedback cannot be empty' });
    }
    updates.feedback = body.feedback.trim();
  }

  try {
    const { userId, role } = req.user!;
    const submission = await submissionService.gradeSubmission(
      assignmentId,
      submissionId,
      userId,
      role,
      updates
    );
    return res.status(200).json({ submission });
  } catch (err) {
    if (err instanceof Error && err.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    if (err instanceof Error && err.message === 'SUBMISSION_NOT_FOUND') {
      return res.status(404).json({ error: 'Submission not found' });
    }
    console.error('[submission] gradeSubmission error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function resubmitAssignment(req: Request, res: Response) {
  const assignmentId = req.params.id as string;
  const { content, fileUrl } = req.body;

  const trimmedContent = typeof content === 'string' ? content.trim() : undefined;
  const trimmedFileUrl = typeof fileUrl === 'string' ? fileUrl.trim() : undefined;

  if (!trimmedContent && !trimmedFileUrl) {
    return res.status(400).json({ error: 'content or fileUrl is required' });
  }

  try {
    const studentId = req.user!.userId;
    const submission = await submissionService.resubmitAssignment(
      studentId,
      assignmentId,
      trimmedContent || undefined,
      trimmedFileUrl || undefined
    );
    return res.status(200).json({ submission });
  } catch (err) {
    if (err instanceof Error && err.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (err instanceof Error && err.message === 'NO_EXISTING_SUBMISSION') {
      return res.status(404).json({ error: 'No existing submission to update — submit first' });
    }
    console.error('[submission] resubmitAssignment error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}