import { Router } from 'express';
import * as inviteController from '../controllers/invite.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.post('/', inviteController.create);
router.get('/', inviteController.list);
router.delete('/:id', inviteController.revoke);

export default router;