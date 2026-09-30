import { PrismaClient } from '@prisma/client';

// Create a single shared PrismaClient instance.
// This prevents exhausting the database connection pool by accidentally creating
// multiple instances across different files in the application.
const prisma = new PrismaClient();

export default prisma;
