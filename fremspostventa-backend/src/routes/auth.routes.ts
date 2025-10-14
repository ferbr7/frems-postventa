import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';
import { auth } from '../middlewares/auth';

const router = Router();
router.post('/register', register);
router.post('/login', login);

router.get('/me', auth, async (req, res) => {
  const u = (req as any).user;
  res.json({ ok:true, user: u });
});

export default router;
