import express, { Request, Response, NextFunction } from 'express';
import prisma from './db';
import redisClient from './redis';
import campaignRouter from './routes/campaigns';
import { DEV_USER_ID } from './devUser';
import { reconcilePendingJobs } from './services/schedulingService';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// All campaign and email routes live under /api via a single mount.
// The router itself defines /campaigns, /emails/scheduled, /emails/sent.
app.use('/api', campaignRouter);

// Development-only endpoint: creates a Sender row for the placeholder user
// so we have a valid senderId to test POST /api/campaigns.
// This will be removed once real Sender management APIs exist.
app.post('/dev/seed-sender', async (req: Request, res: Response) => {
  // Guard: this endpoint must never run in production.
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  // Read Ethereal credentials from environment variables.
  // These must be set in backend/.env before running verification.
  const etherealUser = process.env.ETHEREAL_USER;
  const etherealPass = process.env.ETHEREAL_PASSWORD;
  const etherealHost = process.env.ETHEREAL_HOST || 'smtp.ethereal.email';
  const etherealPort = Number(process.env.ETHEREAL_PORT) || 587;

  if (!etherealUser || !etherealPass) {
    res.status(500).json({
      error: 'ETHEREAL_USER and ETHEREAL_PASSWORD must be set in backend/.env to seed the development sender.',
    });
    return;
  }

  const smtpConfig = { host: etherealHost, port: etherealPort, user: etherealUser, pass: etherealPass };

  try {
    // Ensure the placeholder User row exists before creating the Sender.
    await prisma.user.upsert({
      where: { id: DEV_USER_ID },
      update: {},
      create: {
        id: DEV_USER_ID,
        googleId: 'dev-google-id',
        name: 'Dev User',
        email: 'devuser@example.com',
      },
    });

    const existing = await prisma.sender.findFirst({ where: { userId: DEV_USER_ID } });
    if (existing) {
      // Update credentials in case they changed.
      await prisma.sender.update({ where: { id: existing.id }, data: { email: etherealUser, smtpConfig } });
      res.json({ message: 'Dev sender updated with current credentials.', sender: { id: existing.id, email: etherealUser } });
      return;
    }

    const sender = await prisma.sender.create({
      data: {
        userId: DEV_USER_ID,
        email: etherealUser,
        label: 'Development Sender (Ethereal)',
        smtpConfig,
      },
    });
    res.status(201).json({ message: 'Dev sender created.', sender: { id: sender.id, email: sender.email } });
  } catch (err) {
    console.error('Seed sender failed:', err);
    res.status(500).json({ error: 'Failed to create dev sender.' });
  }
});

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

  // Start the BullMQ worker. It will process jobs as they become due.
  const worker = startEmailWorker();

  app.listen(PORT, () => {
    console.log(`Express server is running on http://localhost:${PORT}`);
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
