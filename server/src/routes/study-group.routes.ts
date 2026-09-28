import { Router } from 'express';
import * as studyGroupController from '../controllers/study-group.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/:id', requireAuth, studyGroupController.getStudyGroup);
router.post('/:id/join', requireAuth, requireRole('STUDENT'), studyGroupController.joinStudyGroup);
router.post('/:id/leave', requireAuth, requireRole('STUDENT'), studyGroupController.leaveStudyGroup);
router.get('/:id/members', requireAuth, studyGroupController.getGroupMembers);
router.patch('/:id', requireAuth, studyGroupController.updateStudyGroup);
router.delete('/:id', requireAuth, studyGroupController.deleteStudyGroup);

export default router;