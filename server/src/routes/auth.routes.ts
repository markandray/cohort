import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

router.get('/teacher-only', requireAuth, requireRole('TEACHER'), (req, res) => {
  res.status(200).json({ message: 'Welcome, teacher', user: req.user });
});

export default router;