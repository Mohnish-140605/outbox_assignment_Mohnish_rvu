import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, X } from 'lucide-react';
import type { SlackNotification } from '../types/notifications';

interface SlackNotificationToastProps {
  notification: SlackNotification;
  onClose: () => void;
}

function getSlackDestination(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'slack.com' || url.pathname !== '/app_redirect') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function SlackNotificationToast({ notification, onClose }: SlackNotificationToastProps) {
  const [closing, setClosing] = useState(false);
  const destination = getSlackDestination(notification.destinationUrl);

  useEffect(() => {
    const dismissTimer = window.setTimeout(() => setClosing(true), 8000);
    return () => window.clearTimeout(dismissTimer);
  }, [notification.id]);

  useEffect(() => {
    if (!closing) return;
    const closeTimer = window.setTimeout(onClose, 180);
    return () => window.clearTimeout(closeTimer);
  }, [closing, onClose]);

  return (
    <section
      role="status"
      aria-live="polite"
      className={`slack-toast fixed left-3 right-3 top-16 z-50 ml-auto w-auto max-w-sm rounded-md border border-[var(--color-border)] border-l-4 border-l-[var(--color-accent)] bg-white p-4 shadow-lg sm:left-auto ${closing ? 'slack-toast-exit' : 'slack-toast-enter'}`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-main)]">{notification.title}</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{notification.message}</p>
          {destination && (
            <a
              href={destination}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              Open in Slack <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setClosing(true)}
          aria-label="Dismiss Slack notification"
          title="Dismiss notification"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}