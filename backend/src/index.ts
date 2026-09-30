import express, { Request, Response } from 'express';
import prisma from './db';
import redisClient from './redis';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

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
    await redisClient.connect();
    console.log('Redis connected.');
  } catch (error) {
    console.error('Failed to connect to Redis on startup:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Express server is running on http://localhost:${PORT}`);
  });
}

// Execute the startup flow
startup();
