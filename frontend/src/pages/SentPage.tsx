import { fetchSentEmails } from '../lib/api';
import { EmailList } from '../components/email/EmailList';
import { PageHeader } from '../components/layout/PageHeader';
import { useEmailList } from '../hooks/useEmailList';

export function SentPage() {
  const { jobs, limit, loading, refreshing, error, reload } = useEmailList(fetchSentEmails);

  const limitNote = jobs.length === limit && limit > 0
    ? `Showing the first ${limit} emails.`
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sent emails"
        count={jobs.length}
        countLabel="sent or failed"
        onRefresh={reload}
        refreshing={refreshing}
        limitNote={limitNote}
      />
      <EmailList
        jobs={jobs}
        loading={loading}
        error={error}
        emptyMessage="No sent emails"
        emptySubtext="Sent and failed emails will appear here."
      />
    </div>
  );
}
