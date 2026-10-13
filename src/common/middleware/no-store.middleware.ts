import { type NextFunction, type Request, type Response } from 'express';

export function noStoreMiddleware(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}
