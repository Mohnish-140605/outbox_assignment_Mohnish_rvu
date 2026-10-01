import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchEmails } from '../lib/api';
import { EmailList } from '../components/email/EmailList';
import type { EmailJob } from '../types/email';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialQuery = searchParams.get('q') || '';
    setQuery(initialQuery);
  }, [searchParams]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchEmails(query, status);
        setJobs(data.items);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, status]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search subject, body, or recipient..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <EmailList
        jobs={jobs}
        loading={loading}
        error={error}
        emptyMessage="No matching emails found"
      />
    </div>
  );
}
