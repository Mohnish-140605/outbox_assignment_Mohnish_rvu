import { Outlet, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { FlashBanner } from './FlashBanner';
import { PageContainer } from './layout/PageContainer';
import { useAuth } from '../auth/AuthContext';
import { disconnectSlack } from '../lib/api';
import { useSlackNotifications } from '../hooks/useSlackNotifications';
import { SlackNotificationToast } from './SlackNotificationToast';

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
  const { user, logout, refresh } = useAuth();
  const {
    notification,
    acknowledgeDisplayed,
    error: notificationError,
    soundEnabled,
    setSoundEnabled,
  } = useSlackNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackBusy, setSlackBusy] = useState(false);

  const slackQuery = searchParams.get('slack');
  const errorQuery = searchParams.get('error');
  const slackConnectionFailed = ['slack_denied', 'slack_not_configured', 'slack_failed'].includes(errorQuery ?? '');

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

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans text-[var(--color-text-main)]">
      <Sidebar
        queueDashboardUrl={queueDashboardUrl()}
        slackConnectUrl={slackConnectUrl()}
        user={user}
        onLogout={logout}
        onDisconnectSlack={onDisconnectSlack}
        slackBusy={slackBusy}
        slackError={slackError}
        setSlackError={setSlackError}
        refresh={refresh}
        slackConnectionFailed={slackConnectionFailed}
        notificationSoundEnabled={soundEnabled}
        onNotificationSoundChange={setSoundEnabled}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto py-6">
          <PageContainer>
            <div className="space-y-4">
              {banner && (
                <FlashBanner
                  kind={banner.kind}
                  text={banner.text}
                  onDismiss={dismissBanner}
                />
              )}
              {slackError && (
                <div className="p-3 rounded-md border bg-red-50 border-red-200 text-red-700 text-sm">
                  {slackError}
                </div>
              )}
              {notificationError && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Slack notification check failed: {notificationError}
                </div>
              )}
              <Outlet />
            </div>
          </PageContainer>
        </main>
      </div>
      {notification && (
        <SlackNotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => acknowledgeDisplayed(notification.id)}
        />
      )}
    </div>
  );
}
