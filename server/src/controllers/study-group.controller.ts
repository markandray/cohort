import { Request, Response } from 'express';
import * as studyGroupService from '../services/study-group.service';

export async function createStudyGroup(req: Request, res: Response) {
  const classId = req.params.id as string;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const studentId = req.user!.userId;
    const studyGroup = await studyGroupService.createStudyGroup(studentId, classId, name.trim());
    return res.status(201).json({ studyGroup });
  } catch (err) {
    if (err instanceof Error && err.message === 'CLASS_NOT_FOUND') {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    console.error('[study-group] createStudyGroup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function listStudyGroups(req: Request, res: Response) {
  const classId = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const studyGroups = await studyGroupService.listStudyGroupsForClass(classId, userId, role);
    return res.status(200).json({ studyGroups });
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
    console.error('[study-group] listStudyGroups error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function joinStudyGroup(req: Request, res: Response) {
  const groupId = req.params.id as string;

  try {
    const studentId = req.user!.userId;
    const membership = await studyGroupService.joinStudyGroup(studentId, groupId);
    return res.status(201).json({ membership });
  } catch (err) {
    if (err instanceof Error && err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Study group not found' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    if (err instanceof Error && err.message === 'ALREADY_MEMBER') {
      return res.status(409).json({ error: 'You are already a member of this group' });
    }
    console.error('[study-group] joinStudyGroup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function leaveStudyGroup(req: Request, res: Response) {
  const groupId = req.params.id as string;

  try {
    const studentId = req.user!.userId;
    await studyGroupService.leaveStudyGroup(studentId, groupId);
    return res.status(200).json({ message: 'Left study group' });
  } catch (err) {
    if (err instanceof Error && err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Study group not found' });
    }
    if (err instanceof Error && err.message === 'NOT_MEMBER') {
      return res.status(404).json({ error: 'You are not a member of this group' });
    }
    console.error('[study-group] leaveStudyGroup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getGroupMembers(req: Request, res: Response) {
  const groupId = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const members = await studyGroupService.getGroupMembers(groupId, userId, role);
    return res.status(200).json({ members });
  } catch (err) {
    if (err instanceof Error && err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Study group not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    console.error('[study-group] getGroupMembers error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function updateStudyGroup(req: Request, res: Response) {
  const groupId = req.params.id as string;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const userId = req.user!.userId;
    const studyGroup = await studyGroupService.updateStudyGroup(groupId, userId, name.trim());
    return res.status(200).json({ studyGroup });
  } catch (err) {
    if (err instanceof Error && err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Study group not found' });
    }
    if (err instanceof Error && err.message === 'NOT_GROUP_OWNER') {
      return res.status(403).json({ error: 'Only the creator can rename this group' });
    }
    console.error('[study-group] updateStudyGroup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function deleteStudyGroup(req: Request, res: Response) {
  const groupId = req.params.id as string;

  try {
    const userId = req.user!.userId;
    await studyGroupService.deleteStudyGroup(groupId, userId);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Study group not found' });
    }
    if (err instanceof Error && err.message === 'NOT_GROUP_OWNER') {
      return res.status(403).json({ error: 'Only the creator can delete this group' });
    }
    console.error('[study-group] deleteStudyGroup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export async function getStudyGroup(req: Request, res: Response) {
  const groupId = req.params.id as string;

  try {
    const { userId, role } = req.user!;
    const studyGroup = await studyGroupService.getStudyGroupById(groupId, userId, role);
    return res.status(200).json({ studyGroup });
  } catch (err) {
    if (err instanceof Error && err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Study group not found' });
    }
    if (err instanceof Error && err.message === 'NOT_CLASS_OWNER') {
      return res.status(403).json({ error: 'You do not teach this class' });
    }
    if (err instanceof Error && err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }
    console.error('[study-group] getStudyGroup error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}