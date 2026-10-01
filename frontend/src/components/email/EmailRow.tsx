import { StatusPill } from './StatusPill';
import { formatRelativeTime, formatFullDateTime } from '../../lib/format';
import type { EmailJob } from '../../types/email';

interface EmailRowProps {
  job: EmailJob;
}

export function EmailRow({ job }: EmailRowProps) {
  const { recipient, status, campaign, scheduledAt, sentAt, updatedAt, failureReason } = job;

  const getTimeSource = () => {
    if (status === 'SENT' && sentAt) {
      return sentAt;
    }
    if (status === 'FAILED' && updatedAt) {
      return updatedAt;
    }
    if (status === 'PENDING' && scheduledAt) {
      return scheduledAt;
    }
    if (status === 'PROCESSING' && updatedAt) {
      return updatedAt;
    }
    return null;
  };

  const timeSource = getTimeSource();
  const secondaryText = status === 'FAILED' && failureReason ? failureReason : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-main)]">To: {recipient}</span>
          <StatusPill job={job} />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="font-medium text-[var(--color-text-main)]">{campaign?.subject || '(No subject)'}</span>
          {secondaryText && (
            <>
              <span className="text-[var(--color-text-muted)]"> – </span>
              <span className="text-[var(--color-text-muted)]">{secondaryText}</span>
            </>
          )}
        </div>
      </div>
      <div
        className="shrink-0 text-xs text-[var(--color-text-muted)] whitespace-nowrap"
        title={timeSource ? formatFullDateTime(timeSource) : undefined}
      >
        {timeSource ? formatRelativeTime(timeSource) : '-'}
      </div>
    </div>
  );
}
