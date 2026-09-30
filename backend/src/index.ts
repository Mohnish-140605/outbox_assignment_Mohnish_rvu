import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse JSON payloads
app.use(express.json());

// Basic health check endpoint to prove the server is running
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'ReachInbox backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
