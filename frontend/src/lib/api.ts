import type { AuthUser, CampaignCreationResponse, ScheduledResponse, SearchResponse, Sender, SentResponse } from '../types/email';
import type { SlackNotificationsResponse } from '../types/notifications';

const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiOrigin}${input}`, {
    ...init,
    credentials: 'include',
    headers: init.headers,
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await apiFetch('/auth/me');
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    throw new Error('Failed to load the current user');
  }
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to log out');
  }
}

export async function disconnectSlack(): Promise<void> {
  const res = await apiFetch('/auth/slack/disconnect', { method: 'POST' });
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to disconnect Slack');
  }
}

export async function fetchScheduledEmails(): Promise<ScheduledResponse> {
  const res = await apiFetch('/api/emails/scheduled');
  if (!res.ok) throw new Error('Failed to fetch scheduled emails');
  return res.json();
}

export async function fetchSentEmails(): Promise<SentResponse> {
  const res = await apiFetch('/api/emails/sent');
  if (!res.ok) throw new Error('Failed to fetch sent emails');
  return res.json();
}

export async function searchEmails(query: string, status?: string): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (status && status !== 'ALL') params.append('status', status);

  const res = await apiFetch(`/api/emails/search?${params.toString()}`);
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
  const res = await apiFetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || 'Failed to create campaign');
  }
  return res.json();
}

export async function ensureSender(): Promise<Sender> {
  const res = await apiFetch('/api/senders/ensure', { method: 'POST' });
  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || 'Failed to resolve sender');
  }
  const data = await res.json();
  return data.sender;
}

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return new Error(payload.error);
  }
  return new Error(fallback);
}

export async function fetchSlackNotifications(limit = 10): Promise<SlackNotificationsResponse> {
  const res = await apiFetch(`/api/notifications/slack?limit=${limit}`);
  if (!res.ok) throw await readApiError(res, 'Failed to fetch Slack notifications.');
  return res.json();
}

export async function acknowledgeSlackNotifications(ids: string[]): Promise<void> {
  const res = await apiFetch('/api/notifications/slack/acknowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw await readApiError(res, 'Failed to acknowledge Slack notifications.');
}
