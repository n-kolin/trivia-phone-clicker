import { Router, Request, Response } from 'express';
import * as authService from '../services/authService';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const token = await authService.loginUser(username, password, ip);
    res.json({ token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'IP_BLOCKED') {
      res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many failed attempts. Try again later.' });
    } else {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Logged out' });
});

export default router;
