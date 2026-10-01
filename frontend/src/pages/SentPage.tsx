import { useEffect, useState } from 'react';
import { fetchSentEmails } from '../lib/api';
import type { EmailJob } from '../types/email';

export function SentPage() {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function load() {
      try {
        setLoading(true);
        const data = await fetchSentEmails();
        if (mounted) {
          setJobs(data.jobs);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading sent emails...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <h3 className="font-semibold mb-1">Failed to load emails</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No sent emails</h3>
        <p className="text-gray-500">Sent and failed emails will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Recipient</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Sent / Failed At</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">{job.recipient}</td>
                <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{job.campaign?.subject || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {job.status === 'SENT' && job.sentAt
                    ? new Date(job.sentAt).toLocaleString()
                    : job.status === 'FAILED' && job.updatedAt
                      ? new Date(job.updatedAt).toLocaleString()
                      : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    title={job.status === 'FAILED' ? job.failureReason ?? undefined : undefined}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      job.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
