import { Router, Request, Response } from 'express';

const router: Router = Router();

// Placeholder slots routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Slots endpoint - to be implemented' });
});

export default router;