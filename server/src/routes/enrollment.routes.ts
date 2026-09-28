import { Router } from 'express';
import * as classController from '../controllers/class.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', requireAuth, requireRole('STUDENT'), classController.getMyEnrollments);

export default router;