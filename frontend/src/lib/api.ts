import type { CampaignCreationResponse, ScheduledResponse, SearchResponse, Sender, SentResponse } from '../types/email';

// Vite proxy forwards /api and /dev to the backend on port 4000.
const API_BASE = '/api';

export async function fetchScheduledEmails(): Promise<ScheduledResponse> {
  const res = await fetch(`${API_BASE}/emails/scheduled`);
  if (!res.ok) throw new Error('Failed to fetch scheduled emails');
  return res.json();
}

export async function fetchSentEmails(): Promise<SentResponse> {
  const res = await fetch(`${API_BASE}/emails/sent`);
  if (!res.ok) throw new Error('Failed to fetch sent emails');
  return res.json();
}

export async function searchEmails(query: string, status?: string): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (status && status !== 'ALL') params.append('status', status);
  
  const res = await fetch(`${API_BASE}/emails/search?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to search emails');
  return res.json();
}

export async function createCampaign(payload: {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}): Promise<CampaignCreationResponse> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create campaign');
  }
  return res.json();
}

// Development endpoint to seed a sender and get its ID.
export async function seedDevSender(): Promise<Sender> {
  const res = await fetch('/dev/seed-sender', { method: 'POST' });
  if (!res.ok) {
     const errorData = await res.json().catch(() => ({}));
     throw new Error(errorData.error || 'Failed to seed development sender. Did you set ETHEREAL_USER and ETHEREAL_PASSWORD in backend/.env?');
  }
  const data = await res.json();
  return data.sender;
}
