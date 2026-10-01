import { useState } from 'react';
import { SlackIcon } from '../ui/SlackIcon';

interface SlackStatusProps {
  slackConnectUrl: string;
  slackConnected: boolean;
  slackTeamName: string | null;
  onDisconnect?: () => void;
  slackBusy?: boolean;
  slackError?: string | null;
  setSlackError?: (error: string | null) => void;
  refresh?: () => Promise<void>;
  connectionFailed?: boolean;
  notificationSoundEnabled?: boolean;
  onNotificationSoundChange?: (enabled: boolean) => void;
}

export function SlackStatus({
  slackConnectUrl,
  slackConnected,
  slackTeamName,
  onDisconnect,
  slackBusy = false,
  slackError,
  setSlackError,
  refresh,
  connectionFailed = false,
  notificationSoundEnabled = true,
  onNotificationSoundChange,
}: SlackStatusProps) {
  const [connecting, setConnecting] = useState(false);

  const handleDisconnect = async () => {
    if (window.confirm('Disconnect Slack? You will stop receiving rate-limit alerts.')) {
      setSlackError?.(null);
      try {
        await onDisconnect?.();
        await refresh?.();
      } catch {
        setSlackError?.('Could not disconnect Slack.');
      }
    }
  };

  return (
    <div className="space-y-2">
      {slackConnected ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlackIcon size={16} />
            <span className="text-sm font-medium text-[var(--color-text-main)]">Connected to Slack</span>
            <span className="h-2 w-2 rounded-full bg-green-500" aria-label="Slack notifications enabled" />
          </div>
          {slackTeamName && (
            <p className="text-xs text-[var(--color-text-muted)] ml-6">{slackTeamName}</p>
          )}
          <div className="ml-6 flex items-center gap-3">
            <button type="button" onClick={handleDisconnect} disabled={slackBusy} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] focus:outline-none focus:underline disabled:opacity-50">
              {slackBusy ? 'Disconnecting...' : 'Disconnect'}
            </button>
            <a href={slackConnectUrl} onClick={() => setConnecting(true)} className="text-xs font-medium text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
              {connecting ? 'Connecting...' : 'Reconnect'}
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlackIcon size={16} />
            <span className="text-sm text-[var(--color-text-muted)]">{connectionFailed ? 'Connection failed' : 'Not connected'}</span>
          </div>
          <a href={slackConnectUrl} onClick={() => setConnecting(true)} className="ml-6 inline-flex rounded px-1 py-0.5 text-sm font-medium text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
            {connecting ? 'Connecting...' : connectionFailed ? 'Try again' : 'Connect Slack'}
          </a>
          <p className="text-xs text-[var(--color-text-muted)] ml-6">
            Get a message when a sender hits its hourly limit.
          </p>
        </div>
      )}
      {slackError && (
        <p className="text-xs text-red-600 ml-6">{slackError}</p>
      )}
      {onNotificationSoundChange && (
        <label className="ml-6 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={notificationSoundEnabled}
            onChange={(event) => onNotificationSoundChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          Notification sound
        </label>
      )}
    </div>
  );
}
