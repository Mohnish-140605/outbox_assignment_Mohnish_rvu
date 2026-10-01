import { fetchScheduledEmails } from '../lib/api';
import { EmailList } from '../components/email/EmailList';
import { PageHeader } from '../components/layout/PageHeader';
import { useEmailList } from '../hooks/useEmailList';

export function ScheduledPage() {
  const { jobs, limit, loading, refreshing, error, reload } = useEmailList(fetchScheduledEmails);

  const limitNote = jobs.length === limit && limit > 0
    ? `Showing the first ${limit} emails.`
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scheduled emails"
        count={jobs.length}
        countLabel="scheduled"
        onRefresh={reload}
        refreshing={refreshing}
        limitNote={limitNote}
      />
      <EmailList
        jobs={jobs}
        loading={loading}
        error={error}
        emptyMessage="No scheduled emails"
        emptySubtext="Create a new campaign to see it here."
        showComposeButton
      />
    </div>
  );
}
