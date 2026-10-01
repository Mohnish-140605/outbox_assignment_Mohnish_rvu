import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../auth/AuthContext';
import { disconnectSlack } from '../lib/api';

function backendOrigin(): string {
  return (import.meta.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:4000').replace(/\/$/, '');
}

function slackConnectUrl(): string {
  return `${backendOrigin()}/auth/slack`;
}

function queueDashboardUrl(): string {
  return `${backendOrigin()}/admin/queues/`;
}

export function Layout() {
  const location = useLocation();
  const { user, logout, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackBusy, setSlackBusy] = useState(false);

  const slackQuery = searchParams.get('slack');
  const errorQuery = searchParams.get('error');

  let banner: { kind: 'success' | 'error'; text: string } | null = null;
  if (slackQuery === 'connected') {
    banner = { kind: 'success', text: 'Slack connected. You will be notified when a sender hits its hourly send limit.' };
  } else if (errorQuery === 'slack_denied') {
    banner = { kind: 'error', text: 'Slack authorization was cancelled.' };
  } else if (errorQuery === 'slack_not_configured') {
    banner = { kind: 'error', text: 'Slack is not configured on the server.' };
  } else if (errorQuery === 'slack_failed') {
    banner = { kind: 'error', text: 'Slack connection failed. Please try again.' };
  }

  const dismissBanner = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('slack');
    next.delete('error');
    setSearchParams(next, { replace: true });
  };

  const getTitle = () => {
    switch (location.pathname) {
      case '/compose': return 'Compose Campaign';
      case '/scheduled': return 'Scheduled Emails';
      case '/sent': return 'Sent Emails';
      case '/search': return 'Search Emails';
      default: return 'Dashboard';
    }
  };

  const initials = (user?.name ?? 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const onDisconnectSlack = async () => {
    setSlackBusy(true);
    setSlackError(null);
    try {
      await disconnectSlack();
      await refresh();
    } catch {
      setSlackError('Could not disconnect Slack.');
    } finally {
      setSlackBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      <Sidebar queueDashboardUrl={queueDashboardUrl()} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 gap-4">
          <h2 className="text-xl font-semibold text-gray-800 truncate">{getTitle()}</h2>
          {user && (
            <div className="flex items-center gap-3 min-w-0">
              {user.slackConnected ? (
                <button
                  type="button"
                  onClick={() => void onDisconnectSlack()}
                  disabled={slackBusy}
                  className="shrink-0 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                >
                  {slackBusy ? 'Disconnecting…' : `Disconnect Slack${user.slackTeamName ? ` (${user.slackTeamName})` : ''}`}
                </button>
              ) : (
                <a
                  href={slackConnectUrl()}
                  className="shrink-0 text-sm font-medium text-gray-700 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-100"
                >
                  Connect Slack
                </a>
              )}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {initials || 'U'}
                </div>
              )}
              <div className="hidden sm:flex sm:flex-col min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate">{user.name}</span>
                <span className="text-xs text-gray-500 truncate">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="ml-2 shrink-0 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100"
              >
                Log out
              </button>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-4">
            {banner && (
              <div
                className={`p-4 rounded-lg border text-sm ${
                  banner.kind === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p>{banner.text}</p>
                  <button type="button" onClick={dismissBanner} className="text-xs font-medium underline">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {slackError && (
              <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm">
                {slackError}
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
