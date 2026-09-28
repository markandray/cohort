import { Router } from 'express';
import * as classController from '../controllers/class.controller';
import * as assignmentController from '../controllers/assignment.controller';
import * as studyGroupController from '../controllers/study-group.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, requireRole('TEACHER', 'ADMIN'), classController.createClass);
router.get('/', requireAuth, classController.listClasses);
router.get('/:id', requireAuth, classController.getClass);
router.post('/:id/enroll', requireAuth, requireRole('STUDENT'), classController.enroll);
router.get('/:id/enrollments', requireAuth, requireRole('TEACHER', 'ADMIN'), classController.getClassEnrollments);

// Week 3: Assignments nested under a class
router.post('/:id/assignments', requireAuth, requireRole('TEACHER', 'ADMIN'), assignmentController.createAssignment);
router.get('/:id/assignments', requireAuth, assignmentController.listAssignments);

router.post('/:id/study-groups', requireAuth, requireRole('STUDENT'), studyGroupController.createStudyGroup);
router.get('/:id/study-groups', requireAuth, studyGroupController.listStudyGroups);

router.post('/join', requireAuth, requireRole('STUDENT'), classController.joinByCode);

export default router;