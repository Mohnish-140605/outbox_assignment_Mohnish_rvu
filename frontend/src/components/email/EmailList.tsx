import { EmailRow } from './EmailRow';
import { Inbox, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { EmailJob } from '../../types/email';

interface EmailListProps {
  jobs: EmailJob[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptySubtext?: string;
  showComposeButton?: boolean;
}

export function EmailList({
  jobs,
  loading = false,
  error = null,
  emptyMessage = 'No emails found',
  emptySubtext,
  showComposeButton = false,
}: EmailListProps) {
  if (loading) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-md overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] animate-pulse"
          >
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
        <p>{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-[var(--color-border)] rounded-md">
        <Inbox className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
        <p className="text-[var(--color-text-main)] font-medium mb-1">{emptyMessage}</p>
        {emptySubtext && <p className="text-[var(--color-text-muted)] text-sm mb-4">{emptySubtext}</p>}
        {showComposeButton && (
          <NavLink
            to="/compose"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[var(--color-accent)] text-[var(--color-accent)] font-medium text-sm hover:bg-[var(--color-accent-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1"
          >
            <Plus className="w-4 h-4" />
            Compose email
          </NavLink>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-md overflow-hidden">
      {jobs.map((job) => (
        <EmailRow key={job.id} job={job} />
      ))}
    </div>
  );
}
