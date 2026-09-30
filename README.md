# ReachInbox Hiring Assignment – Full-stack Email Job Scheduler

## Project Purpose
This project is an email scheduler service and dashboard. It allows scheduling emails, stores them persistently, and manages their sending using rate limiting and background jobs.

## Current Architecture
- **Backend:** Node.js, Express, TypeScript (listening on port 4000)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Infrastructure:** PostgreSQL (Database) and Redis (Queue & Caching) via Docker

## Prerequisites
- Node.js (v20 LTS recommended)
- npm
- Docker & Docker Compose

## How to Start Infrastructure
Ensure Docker is running, then run:
```bash
docker-compose up -d
```

## How to Start Backend
```bash
cd backend
npm install
npm run dev
```
(You can also use `npm run typecheck` to verify TypeScript types)

## How to Start Frontend
```bash
cd frontend
npm install
npm run dev
```
(You can also use `npm run build` to verify TypeScript types and build)
