import { Router, Request, Response } from 'express';

const router: Router = Router();

// Placeholder auth routes
router.post('/login', (req: Request, res: Response) => {
  res.json({ message: 'Auth endpoint - to be implemented' });
});

export default router;