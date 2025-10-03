import { Router, Request, Response } from 'express';

const router: Router = Router();

// Placeholder devices routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Devices endpoint - to be implemented' });
});

export default router;