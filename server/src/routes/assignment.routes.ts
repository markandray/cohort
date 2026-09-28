import { Router } from 'express';
import * as assignmentController from '../controllers/assignment.controller';
import * as submissionController from '../controllers/submission.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/:id', requireAuth, assignmentController.getAssignment);

// Week 3: Submissions nested under an assignment
router.post('/:id/submit', requireAuth, requireRole('STUDENT'), submissionController.submitAssignment);
router.get('/:id/submissions', requireAuth, requireRole('TEACHER', 'ADMIN'), submissionController.getSubmissionsForAssignment);

// Week 6: Grading
router.patch('/:assignmentId/submissions/:submissionId/grade', requireAuth, requireRole('TEACHER', 'ADMIN'), submissionController.gradeSubmission);

// Week 6: Resubmission
router.patch('/:id/submit', requireAuth, requireRole('STUDENT'), submissionController.resubmitAssignment);

export default router;