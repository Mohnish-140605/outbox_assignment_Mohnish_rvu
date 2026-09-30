export interface EmailJob {
  id: string;
  recipient: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  scheduledAt?: string;
  sentAt: string | null;
  campaign?: {
    id: string;
    subject: string;
  };
}

export interface CampaignCreationResponse {
  campaignId: string;
  subject: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  totalRecipients: number;
  emailJobs: {
    id: string;
    recipient: string;
    scheduledAt: string;
    status: string;
  }[];
}

export interface SearchResponse {
  items: EmailJob[];
  total: number;
}

export interface ScheduledResponse {
  jobs: EmailJob[];
  limit: number;
  offset: number;
}

export interface SentResponse {
  jobs: EmailJob[];
  limit: number;
  offset: number;
}

export interface Sender {
  id: string;
  email: string;
  label?: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  slackConnected: boolean;
  slackTeamName: string | null;
}
