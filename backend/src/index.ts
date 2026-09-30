import './loadEnv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import prisma from './db';
import redisClient from './redis';
import { getSessionConfig } from './config/auth';
import authRouter from './routes/auth';
import slackRouter from './routes/slack';
import campaignRouter from './routes/campaigns';
import { createBullBoardAdapter, requireAuthRedirect, BULL_BOARD_PATH } from './bullBoard';
import { reconcilePendingJobs } from './services/schedulingService';
import { reconcileEmailSearchIndex } from './services/emailSearchService';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker';

const app = express();
const PORT = process.env.PORT || 4000;
const authConfig = getSessionConfig();

app.use(
  cors({
    origin: authConfig.frontendOrigin,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    name: 'reachinbox.sid',
    secret: authConfig.sessionSecret,
    store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Local HTTP development cannot use Secure cookies. Production HTTPS should
      // set NODE_ENV=production so this flag becomes true. Behind a reverse proxy,
      // also set TRUST_PROXY=1 so Express trusts X-Forwarded-Proto.
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use('/auth', authRouter);
app.use('/auth', slackRouter);

const bullBoardAdapter = createBullBoardAdapter();
app.use(BULL_BOARD_PATH, requireAuthRedirect, bullBoardAdapter.getRouter());

// All campaign, sender, and email routes live under /api.
// Authentication is enforced on the campaign router.
app.use('/api', campaignRouter);

app.get('/health', async (req: Request, res: Response) => {  
  //check if the database and redis are connected using prisma and redisClient
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';
  let isHealthy = true;

  try {
    // Ping the database so that it retrieves and gets data successfully from the database if the data
    //is not retrieved and get successfully then the database is disconnected 
    await prisma.$queryRaw `SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    console.error('Database health check failed:', err);
    isHealthy = false;
  }

  try {
    // Ping Redis
    const pingResult = await redisClient.ping();
    if (pingResult === 'PONG') {
      redisStatus = 'connected';
    } else {
      isHealthy = false;
    }
  } 
  
  catch (err) {
    console.error('Redis health check failed:', err);
    isHealthy = false;
  }

  const status = isHealthy ? 'ok' : 'error'; //ternary operator is used here to  reduce the number of lines and this is faster way to write codes
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    database: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString()
  });
});

async function startup() {
  console.log('Starting backend service...');

  try {
    console.log('Connecting to PostgreSQL...');
    await prisma.$connect();
    console.log('PostgreSQL connected.');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL on startup:', error);
    process.exit(1);
  }

  try {
    console.log('Connecting to Redis...');
    // isOpen is false when the client has not yet connected or was disconnected.
    // Guarding here prevents a "Socket already opened" error on ts-node-dev restarts.
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    console.log('Redis connected.');
  } catch (error) {
    console.error('Failed to connect to Redis on startup:', error);
    process.exit(1);
  }

  // Run startup reconciliation before accepting HTTP traffic.
  // This re-enqueues any PENDING EmailJobs that lost their BullMQ entry
  // due to a crash between the PostgreSQL commit and the queue.add call.
  try {
    await reconcilePendingJobs();
  } catch (error) {
    // Reconciliation failure is logged but does not prevent the server from
    // starting — existing in-queue jobs will still be processed normally.
    console.error('Startup reconciliation encountered an error:', error);
  }

  // Reconcile PostgreSQL EmailJobs into the Elasticsearch search index.
  // This is a best-effort operation: if Elasticsearch is unavailable, we log
  // the error and continue — email scheduling and delivery are unaffected.
  // The reconciliation runs again on the next restart.
  try {
    await reconcileEmailSearchIndex();
  } catch (error) {
    console.error('Elasticsearch reconciliation encountered an error (search may be stale):', error);
  }

  // Start the BullMQ worker. It will process jobs as they become due.
  const worker = startEmailWorker();

  app.listen(PORT, () => {
    console.log(`Express server is running on http://localhost:${PORT}`);
    console.log(`BullMQ dashboard: http://localhost:${PORT}${BULL_BOARD_PATH}`);
  });

  // Graceful shutdown: finish in-flight jobs before exiting.
  async function shutdown(signal: string) {
    console.log(`\nReceived ${signal}. Shutting down gracefully…`);
    await stopEmailWorker(worker);
    await prisma.$disconnect();
    await redisClient.disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Global error handler — must be registered AFTER all routes.
// Catches malformed JSON from body-parser and any other unhandled errors.
// The four-parameter signature is required for Express to recognise this as an error handler.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // SyntaxError is what body-parser throws when the JSON payload is malformed.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }
  // For all other unexpected errors, log internally and return a safe generic message.
  console.error('Unhandled application error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// Execute the startup flow
startup();
