# ReachInbox Email Scheduler

ReachInbox is a full-stack email campaign scheduler. It stores campaigns in PostgreSQL, schedules recipient jobs with BullMQ/Redis, sends through Ethereal SMTP, indexes email records in Elasticsearch, and provides an authenticated React dashboard.

## Architecture

```mermaid
flowchart LR
   Browser[React + Vite dashboard] -->|session-authenticated API| API[Express API]
   API --> CampaignService[Campaign service]
   CampaignService --> DB[(PostgreSQL)]
   CampaignService --> Queue[BullMQ delayed jobs]
   Queue <--> Redis[(Redis)]
   Queue --> Worker[Email worker]
   Worker --> RateLimit[Atomic hourly rate limiter]
   RateLimit <--> Redis
   Worker --> SMTP[Ethereal SMTP]
   Worker --> Search[Elasticsearch indexing]
   Worker --> Slack[Slack incoming webhook]
   Slack -->|successful post only| Events[(Slack notification events)]
   Browser -->|8-second polling| Events
   Browser -->|authenticated UI| Board[Bull Board]
   Board --> Queue
```

### Scheduling and worker lifecycle

```mermaid
sequenceDiagram
   participant UI as Compose UI
   participant API as Express API
   participant DB as PostgreSQL
   participant Q as BullMQ / Redis
   participant W as Email worker
   participant SMTP as Ethereal SMTP

   UI->>API: POST /api/campaigns
   API->>DB: Create Campaign + PENDING EmailJobs
   API->>Q: Add delayed job (jobId = EmailJob.id)
   Q-->>W: Activate when scheduled
   W->>DB: Atomic PENDING → PROCESSING claim
   W->>W: Check per-sender UTC hourly limit
   alt Rate limit reached
      W->>DB: Keep PENDING and move scheduledAt
      W->>Q: Move job to delayed
   else Allowed
      W->>SMTP: Send text or HTML + CID attachments
      SMTP-->>W: Accepted / preview URL
      W->>DB: Mark SENT; index for search
   end
```

### Persistence, rate limiting, and concurrency

- PostgreSQL is the source of truth for campaign and email status. BullMQ job IDs equal `EmailJob.id` for idempotent queue insertion.
- On startup, `reconcilePendingJobs` finds pending rows and ensures their BullMQ entries exist. PostgreSQL, Redis, and Elasticsearch use Docker named volumes for local persistence.
- The worker atomically claims `PENDING → PROCESSING`. Transient send failures return the row to `PENDING` until BullMQ attempts are exhausted; the final failure is recorded as `FAILED`.
- `EMAIL_WORKER_CONCURRENCY` controls worker parallelism (default: `5`). PostgreSQL conditional updates prevent multiple workers from claiming the same pending row.
- Campaign `delayBetweenEmails` is measured in seconds. Rate limiting uses atomic Redis Lua counters per sender and UTC hour. Jobs over the limit are deferred, not dropped; scheduling preserves campaign order and spacing.
- On the first rate-limit hit per sender/hour, the worker posts to Slack if connected. A persistent in-app event is written only after a successful Slack HTTP response; Redis deduplication prevents repeat webhook posts in the same hour.
- Sent and failed jobs are indexed in Elasticsearch. Slack and Elasticsearch failures do not roll back email state transitions.

## Features

| Area                        | Implemented features                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Backend: scheduler          | Campaign creation, BullMQ delayed jobs, stable job IDs, worker processing, configurable concurrency                  |
| Backend: persistence        | PostgreSQL campaigns/email jobs, startup reconciliation, Redis-backed BullMQ and session store                       |
| Backend: rate limiting      | Atomic per-sender UTC-hour Redis counters, safe deferred scheduling, Slack success events                            |
| Backend: email              | Ethereal SMTP, plain-text fallback, HTML mail, bounded inline image CID attachments, preview URLs                    |
| Backend: search/operations  | Elasticsearch indexing/search, authenticated Bull Board, Google and Slack OAuth                                      |
| Frontend: account           | Google login/logout, Slack connection state and disconnect/reconnect controls                                        |
| Frontend: campaign workflow | Recipient entry and CSV/TXT upload, TipTap formatting, inline images, send time, delay, hourly limit                 |
| Frontend: email dashboard   | Scheduled, sent and failed email lists; search and status filters                                                    |
| Frontend: notifications     | Authenticated Slack-event polling, acknowledgement, toast, optional sound and valid Slack destination when available |

## Requirements

- Node.js 20.19+ (or a current Node.js 22 release) and npm
- Docker with the Compose plugin
- Google OAuth client credentials for browser login
- Ethereal SMTP account for test email delivery
- Slack app credentials for Slack notifications (optional)

## Local Setup

### 1. Start PostgreSQL, Redis, and Elasticsearch

From the repository root:

```bash
docker compose up -d
```

The Compose file exposes PostgreSQL on `5432`, Redis on `6379`, and Elasticsearch on `9200`. Local database defaults are in `docker-compose.yml`; change them there and update `DATABASE_URL` in the backend environment together if you change credentials.

### 2. Configure the backend

Copy `backend/.env.example` to `backend/.env`, then fill in local credentials. Keep `.env` private; it is ignored by Git.

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Backend URLs:

- API and health: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- Bull Board: `http://localhost:4000/admin/queues/` (requires login)

Useful checks:

```bash
npm run typecheck
npm run build
npx prisma validate
```

The backend package uses TypeScript 5.x, matching the compiler declared in `backend/package.json`.

### 3. Configure and run the frontend

Copy `frontend/.env.example` to `frontend/.env`. The default Vite proxy forwards `/api`, `/auth`, and `/admin` to the backend, so local development normally needs no additional API URL.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Production frontend check:

```bash
npm run build
```

## Deploy to Render + Elastic Cloud

The repository includes a `render.yaml` Blueprint. It defines:

- A Render Node web service for the Express API and BullMQ worker.
- A Render static site for the Vite frontend, with SPA fallback routing.
- Render PostgreSQL and a persistent Redis-compatible Key Value instance (`noeviction`, journal + snapshot).
- Elastic Cloud as the external Elasticsearch provider.

The Blueprint uses paid service plans for the API, database, and persistent queue storage so scheduled jobs are not lost when a free Redis instance restarts. Review the plans and current pricing shown in Render before creating resources.

### 1. Push the repository to GitHub

Render deploys the repository's selected branch. Confirm your intended changes are committed and pushed. Do not add either `.env` file, `backend/cookie.txt`, or temporary files; they are ignored by Git.

### 2. Create Elastic Cloud credentials

1. Create an Elasticsearch deployment in [Elastic Cloud](https://cloud.elastic.co/).
2. Copy the deployment's HTTPS Elasticsearch endpoint.
3. Create an API key limited to the `reachinbox-emails` index. The app needs index creation/mapping, indexing, and search privileges (for example, `manage`, `read`, and `write` on that index).
4. Keep the endpoint and encoded API key for the Render Blueprint prompts. Do not put them in source control.

### 3. Create the Render services

1. In Render, choose **New → Blueprint** and connect this repository's deployment branch.
2. Render reads `render.yaml`. Review the planned resources and costs before confirming provisioning.
3. Supply the prompted secret values:
   - Required for sign-in: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
   - Required for test sending: `ETHEREAL_USER`, `ETHEREAL_PASSWORD`.
   - Required for search: `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`.
   - Optional for Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_CALLBACK_URL`.
4. After Render provisions the services, copy the actual API and frontend `onrender.com` URLs. If Render assigned different URLs than the service names imply, update the callback values and matching provider settings below.

The Blueprint references the generated PostgreSQL, Redis, frontend-origin, and API-origin values between Render services. It runs `prisma migrate deploy` before starting the API. The backend binds to Render's injected `PORT` and reports health at `/health`.

### 4. Configure OAuth redirect URLs

In Google Cloud Console, add the deployed frontend URL as an authorized JavaScript origin and set the exact authorized redirect URI to:

```text
https://<your-api-service>.onrender.com/auth/google/callback
```

Set `GOOGLE_CALLBACK_URL` in the Render API service to that same callback URL.

If using Slack, set `SLACK_CALLBACK_URL` to:

```text
https://<your-api-service>.onrender.com/auth/slack/callback
```

Add that exact URL to the Slack app's OAuth redirect URLs. Slack credentials may remain unset if Slack integration is not needed.

### 5. Verify the deployment

After both services report **Live**:

1. Open `https://<your-frontend-service>.onrender.com`.
2. Check `https://<your-api-service>.onrender.com/health` reports PostgreSQL and Redis connected.
3. Sign in with Google, ensure the sender uses valid SMTP settings, then send a test campaign. Ethereal captures mail and provides a preview; it does not deliver to real inboxes.
4. Confirm scheduled jobs appear in the authenticated Bull Board route at `https://<your-api-service>.onrender.com/admin/queues/`.
5. If Elasticsearch is unavailable or its API key is invalid, email sending continues but search/indexing will be stale; fix the Elastic Cloud settings and redeploy.

## External Services

### Google OAuth

Create a **Web application** OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:4000/auth/google/callback`
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `backend/.env`.
- Set a long random `SESSION_SECRET` in `backend/.env`. Never put server secrets in `frontend/.env`.

Local sessions use an HTTP-only, `SameSite=Lax` cookie. For production HTTPS, set `NODE_ENV=production`; behind a TLS-terminating proxy, also set `TRUST_PROXY=1`.

### Ethereal Email

1. Create a test mailbox at [ethereal.email](https://ethereal.email).
2. Copy its SMTP host, port, username, and password into `ETHEREAL_HOST`, `ETHEREAL_PORT`, `ETHEREAL_USER`, and `ETHEREAL_PASSWORD` in `backend/.env`.
3. Restart the backend after changing credentials. Compose refreshes the saved sender configuration before creating a campaign.
4. Ethereal captures test mail; it does not deliver to real recipients. The worker logs an Ethereal preview URL after a successful send.

Rich-text images are embedded locally as data URLs in the campaign body, limited to 2 MB total per email, then converted to CID attachments at send time. Supported formats are PNG, JPEG, GIF, and WebP. No external image-hosting service is used.

### Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Enable Incoming Webhooks and configure the `incoming-webhook` OAuth scope.
3. Add redirect URL `http://localhost:4000/auth/slack/callback`.
4. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_CALLBACK_URL` in `backend/.env`.
5. Sign in, connect Slack, and select a channel. Disconnect/reconnect remains available in the sidebar.

The in-app notification appears only after Slack accepts the webhook. It is polled every 8 seconds and acknowledged to prevent repeats. A channel link is shown only when the OAuth connection contains team and channel IDs; reconnect Slack if an older connection has no IDs.

## API Routes

| Method | Route                                  | Purpose                              |
| ------ | -------------------------------------- | ------------------------------------ |
| `GET`  | `/auth/google`                         | Start Google sign-in                 |
| `POST` | `/auth/logout`                         | End the session                      |
| `GET`  | `/auth/slack`                          | Start Slack connection               |
| `POST` | `/auth/slack/disconnect`               | Disconnect Slack                     |
| `POST` | `/api/campaigns`                       | Create a campaign and recipient jobs |
| `GET`  | `/api/emails/scheduled`                | List scheduled emails                |
| `GET`  | `/api/emails/sent`                     | List sent and failed emails          |
| `GET`  | `/api/emails/search`                   | Search email records                 |
| `GET`  | `/api/notifications/slack`             | Poll unread Slack-success events     |
| `POST` | `/api/notifications/slack/acknowledge` | Acknowledge displayed events         |
| `GET`  | `/admin/queues/`                       | Authenticated Bull Board UI          |

## Data and Security Notes

- SMTP configuration and OAuth tokens stay server-side; they are not returned to the frontend or indexed in Elasticsearch.
- Slack notification rows contain user ID, event type, title/message, timestamps, and acknowledgement state only. Slack team/channel IDs are stored separately for validated navigation links.
- Ethereal is for testing. Configure a production SMTP provider and secure production infrastructure before real delivery.
- PostgreSQL and Redis persistence in local development relies on the named Docker volumes in `docker-compose.yml`.
