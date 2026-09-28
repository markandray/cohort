import { Router } from 'express';
import * as submissionController from '../controllers/submission.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', requireAuth, requireRole('STUDENT'), submissionController.getMySubmissions);

export default router;