ALTER TABLE "User"
ADD COLUMN "slackTeamId" TEXT,
ADD COLUMN "slackChannelId" TEXT;

CREATE TABLE "SlackNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "SlackNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlackNotification_userId_acknowledgedAt_createdAt_idx"
ON "SlackNotification"("userId", "acknowledgedAt", "createdAt");

ALTER TABLE "SlackNotification"
ADD CONSTRAINT "SlackNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;