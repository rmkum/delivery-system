import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Placeholder auth middleware
  next();
};

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  // Placeholder validation middleware
  next();
};