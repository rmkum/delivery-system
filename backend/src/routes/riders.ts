import { Router, Request, Response } from 'express';

const router: Router = Router();

// Placeholder riders routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Riders endpoint - to be implemented' });
});

export default router;