import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Request, Response, NextFunction } from 'express';
import { emailQueue } from './queues/emailQueue';
import { getFrontendOrigin } from './config/auth';

export const BULL_BOARD_PATH = '/admin/queues';

export function createBullBoardAdapter(): ExpressAdapter {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  return serverAdapter;
}

/**
 * Bull Board is HTML, so unauthenticated visits redirect to the app login
 * instead of a JSON 401.
 */
export function requireAuthRedirect(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.userId) {
    res.redirect(`${getFrontendOrigin()}/?error=auth_failed`);
    return;
  }
  next();
}
