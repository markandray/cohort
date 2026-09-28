import { Router } from 'express';
import * as noteController from '../controllers/note.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, noteController.createNote);
router.get('/me', requireAuth, noteController.getMyNotes);
router.get('/:id', requireAuth, noteController.getNote);
router.patch('/:id', requireAuth, noteController.updateNote);
router.delete('/:id', requireAuth, noteController.deleteNote);

export default router;