import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Public auth endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/password-reset/request', authController.requestPasswordReset);
router.post('/password-reset/confirm', authController.confirmPasswordReset);

// Authenticated session & profile endpoints
router.post('/logout', requireAuth, authController.logout);
router.get('/session', requireAuth, authController.session);
router.post('/refresh-session', requireAuth, authController.session);
router.get('/me', requireAuth, authController.getMe);
router.patch('/me', requireAuth, authController.updateMe);

export default router;
