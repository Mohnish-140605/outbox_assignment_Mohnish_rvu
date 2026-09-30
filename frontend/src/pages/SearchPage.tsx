import { useState, useEffect } from 'react';
import { searchEmails } from '../lib/api';
import type { EmailJob } from '../types/email';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search subject, body, or recipient..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <h3 className="font-semibold mb-1">Search Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Searching...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg shadow-sm">
          <p className="text-gray-500">No matching emails found.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Recipient</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">{job.recipient}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{job.campaign?.subject || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${job.status === 'SENT' ? 'bg-green-100 text-green-800' : 
                          job.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'}
                      `}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {job.status === 'SENT' && job.sentAt 
                        ? new Date(job.sentAt).toLocaleString() 
                        : job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
