# ReachInbox Hiring Assignment – Full-stack Email Job Scheduler

## Project Purpose
This project is an email scheduler service and dashboard. It allows scheduling emails, stores them persistently, and manages their sending using rate limiting and background jobs.

## Current Architecture
- **Backend:** Node.js, Express, TypeScript (listening on port 4000)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Infrastructure:** PostgreSQL (database), Redis (queue, sessions, rate-limit counters), Elasticsearch (email search) via Docker

### How scheduling works
1. The compose UI creates a campaign via `POST /api/campaigns`.
2. Each recipient becomes a PostgreSQL `EmailJob` (`PENDING`) with a `scheduledAt` timestamp.
3. A matching **BullMQ delayed job** is added to the `email-scheduler` queue. There is no cron.
4. The BullMQ worker claims the row (`PENDING` → `PROCESSING`), enforces the sender hourly cap, sends via Ethereal SMTP, then marks `SENT` or `FAILED`.
5. Sent and failed jobs are indexed into Elasticsearch for dashboard search.

### Persistence on restart
- Delayed jobs live in Redis (BullMQ). PostgreSQL is the source of truth for job status.
- On startup, `reconcilePendingJobs` re-enqueues `PENDING` rows that have no BullMQ job (crash between DB commit and `queue.add`).
- Idempotency: only one worker can win the `PENDING` → `PROCESSING` update; `SENT` / `FAILED` jobs are skipped.

### Rate limiting, delay, and concurrency
- **Worker concurrency:** `EMAIL_WORKER_CONCURRENCY` (default `5`). Safe because status transitions are atomic in Postgres.
- **Delay between emails:** set per campaign (`delayBetweenEmails`, seconds). The scheduler spaces `scheduledAt` by that amount. When a job is pushed into the next hour because of the cap, `getNextSafeScheduleTime` keeps campaign order and spacing.
- **Emails per hour:** Redis fixed-window counters keyed by `senderId` + UTC hour (`reachinbox:rl:sender:<id>:<YYYY-MM-DDTHH>`). The Lua script is atomic across workers. When the cap is hit the job is **not dropped**: status returns to `PENDING`, `scheduledAt` moves into the next hour, and BullMQ `moveToDelayed` is used.
- Under load (1000+ jobs at the same time), workers process up to `EMAIL_WORKER_CONCURRENCY` in parallel; excess stay delayed in Redis. Jobs that would exceed the hourly cap are deferred rather than failed.

### Slack notifications
When a sender first hits the hourly cap in a given UTC hour, the worker posts to that user's Slack incoming webhook (if connected). Later blocked jobs in the same hour are deduped with a Redis `SET NX` key so Slack is not spammed. If Slack is not connected, nothing is sent and the worker continues.

### Live queue dashboard
Bull Board is mounted at `/admin/queues` (login required). Use **Queue dashboard** in the sidebar, or open `http://localhost:4000/admin/queues` while signed in.

## Features implemented
- Google OAuth login (authorization-code flow, httpOnly session cookie)
- Compose campaign (CSV/text leads, start time, delay, hourly limit)
- Scheduled and sent email lists (loading / empty / error states)
- Elasticsearch search
- BullMQ delayed scheduling, restart reconciliation, per-sender hourly rate limit
- Slack OAuth connect / disconnect and live rate-limit webhooks
- Authenticated BullMQ (Bull Board) dashboard

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
npx prisma db push
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

## Google OAuth (local development)

Authentication uses a **server-side Google OAuth 2.0 authorization-code flow**. The browser only receives the `reachinbox.sid` session cookie. Google client secrets, `SESSION_SECRET`, database URLs, Redis URLs, and SMTP passwords must never be placed in the frontend.

1. Copy `backend/.env.example` to `backend/.env` (if you do not already have one) and copy `frontend/.env.example` to `frontend/.env`.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type **Web application** (reuse this client; do not create a second one unless you need a separate environment).
3. Set **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - `http://localhost:4000`
4. Set **Authorized redirect URI** to exactly the value of `GOOGLE_CALLBACK_URL` in `backend/.env`. For local development that is:

   `http://localhost:4000/auth/google/callback`

   Do not hardcode a production callback in source. Use the environment variable for each environment.
5. Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, and a long random `SESSION_SECRET` in `backend/.env` only.
6. Sign in from the app at `http://localhost:5173` with **Sign in with Google**.

### Session cookies

- **Local:** `httpOnly`, `sameSite=lax`, `secure=false` (HTTP).
- **Production:** set `NODE_ENV=production` so the cookie is `Secure` (HTTPS). If TLS terminates at a reverse proxy, set `TRUST_PROXY=1` so Express honors `X-Forwarded-Proto`.

## Slack OAuth (rate-limit alerts)

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Enable **Incoming Webhooks** and **OAuth**.
3. Add redirect URL: `http://localhost:4000/auth/slack/callback` (must match `SLACK_CALLBACK_URL`).
4. Copy the Client ID and Client Secret into `backend/.env` as `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.
5. In the dashboard, click **Connect Slack**, pick a channel, then schedule enough emails to hit a sender's hourly limit. Slack should receive a message at that moment. **Disconnect Slack** clears the stored webhook; later limit hits stay silent until you reconnect.

## Ethereal Email

Create a test account at [ethereal.email](https://ethereal.email) and set `ETHEREAL_HOST`, `ETHEREAL_PORT`, `ETHEREAL_USER`, and `ETHEREAL_PASSWORD` in `backend/.env`. Preview URLs for sent messages are logged by the worker.

## Assumptions and trade-offs
- One Ethereal sender is auto-created per user (`POST /api/senders/ensure`). SMTP JSON is stored unencrypted (assignment scope).
- Hourly windows are UTC calendar hours in Redis, not rolling 60-minute windows.
- Slack is notified once per sender per hour window, not once per blocked job.
- Elasticsearch and Slack failures are best-effort and do not roll back a successful send or reschedule.
