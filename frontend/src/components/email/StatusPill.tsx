import { Clock } from 'lucide-react';
import { formatScheduledTime, formatFullDateTime } from '../../lib/format';
import type { EmailJob } from '../../types/email';

interface StatusPillProps {
  job: EmailJob;
}

export function StatusPill({ job }: StatusPillProps) {
  const { status, scheduledAt, failureReason } = job;

  if (status === 'PENDING' && scheduledAt) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-scheduled-bg)] text-[var(--color-scheduled-text)]"
        title={`Scheduled to send at ${formatFullDateTime(scheduledAt)}`}
      >
        <Clock className="w-3 h-3" />
        {formatScheduledTime(scheduledAt)}
      </span>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-scheduled-bg)] text-[var(--color-scheduled-text)]">
        Sending
      </span>
    );
  }

  if (status === 'SENT') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-sent-bg)] text-[var(--color-sent-text)]">
        Sent
      </span>
    );
  }

  if (status === 'FAILED') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-failed-bg)] text-[var(--color-failed-text)]"
        title={failureReason ?? undefined}
      >
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
      {status}
    </span>
  );
}
