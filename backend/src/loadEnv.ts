import path from 'path';
import dotenv from 'dotenv';

// Load backend/.env before any module reads process.env.
// Prisma also loads this file; this keeps Express/OAuth config consistent.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
