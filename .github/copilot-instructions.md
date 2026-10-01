---
name: code-quality
description: Write and review code in this TypeScript, Express, BullMQ, Prisma and React project so it is reusable, scalable, easy to read and easy to explain. Use for every code change, refactor or review.
---

# Code quality guide

## Goal
Every change is small, readable by a new teammate in one pass, and explainable by the author in an interview. Remove code before adding code.

## Working rules (apply in order)
1. Read the callers and the existing owner of the behaviour before writing. Reuse an existing function, component or module before creating one.
2. Check the installed version in node_modules or the official docs before using any library API. Never guess an API, option or flag.
3. Make the smallest change that meets the request. Do not reformat or rename unrelated code.
4. Preserve observable behaviour (API shapes, status codes, DB columns, queue names, job ids) unless the task is to change it. If you change one, list every caller you updated.
5. Run the cheapest check that proves the change: typecheck, then lint, then the one relevant test. Say what you ran and what you did not run. Never claim something works without running it.
6. End every answer with: what changed, what you verified, what is still unverified.

## Readability and size limits
- One responsibility per file. The first comment line states it.
- Function max 40 lines, file max 200 lines, max 3 positional params (use an object after that), nesting max 3 levels, no nested ternaries.
- Names say what and why (markJobSent, not handleStuff). Use early returns instead of deep if/else.
- Comments explain why (a constraint, trade-off or failure case), never what. Delete comments that restate the code. Never write a claim in a comment that you have not verified.
- No dead code, commented-out code, unused exports or debug scripts. Log through one logger, not scattered console.log.

## Reusable and DRY
- Second copy of the same logic: extract it. A third copy must never exist.
- One zod schema per endpoint; the handler uses the inferred type.
- Read config once in a validated config module. No process.env anywhere else.
- Frontend: UI primitives live in components/ui (Button, Input, Textarea, Modal, Table, StatusBadge, EmptyState, ErrorBanner, Spinner). Pages compose them and hold no repeated class strings. Data loading lives in hooks. lib/api has one request<T>() helper.
- Derived state uses useMemo or a plain variable, not useEffect plus setState. Clean up timers and listeners.
- Types for API responses are shared and never use plain string where a union exists.

## Scalable
- No awaited network call inside a loop for batch work. Use createMany, queue.addBulk and Elasticsearch bulk.
- Cap and paginate every list query and every startup scan.
- HTTP handlers only validate, persist and enqueue. Slow work belongs in the worker.
- Every hot-path query has an index in schema.prisma.

## Project invariants (never break these)
- No cron, node-cron, agenda or setInterval scheduling. Scheduling is BullMQ delayed jobs only.
- The Postgres EmailJob row is the source of truth. BullMQ jobId equals EmailJob.id (idempotency).
- Status changes only through atomic conditional updates (PENDING to PROCESSING to SENT or FAILED). Do not mark FAILED until retry attempts are exhausted.
- Rate-limit counters live in Redis, updated atomically (Lua), keyed by sender plus UTC hour. Limited jobs are delayed to the next window, never dropped or failed.
- Minimum delay between sends is enforced at send time and documented in the README. Delay is in seconds everywhere, including UI labels.
- Slack and Elasticsearch failures never fail a send.
- Secrets live only in .env. Never log them, return them to the client or commit them.

## Stack specifics
- BullMQ: concurrency comes from config. Defer a job with job.moveToDelayed plus DelayedError. Shutdown closes the worker first.
- Prisma: use select instead of full include on hot paths. Keep transactions short. No DB calls inside route files; call a service.
- Express: one asyncHandler plus one error middleware. Correct status codes. No business logic in routes.
- TypeScript: strict mode, no any, no non-null assertions. Parse unknown input at the boundary.

## When asked to review
Return findings ordered by severity. For each: location, observed problem, smallest fix, behaviour to preserve, how to verify. Separate facts from guesses. Do not edit code during a review unless asked.

## Pitfalls
- A smaller file is not automatically better. Check callers before splitting.
- A test that mocks Redis or Postgres does not prove concurrency or restart behaviour. Use the real services.
- Do not add layers, abstractions or libraries for hypothetical future needs.