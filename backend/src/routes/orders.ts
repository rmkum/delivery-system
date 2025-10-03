import { Router, Request, Response } from 'express';

const router: Router = Router();

// Placeholder orders routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Orders endpoint - to be implemented' });
});

export default router;