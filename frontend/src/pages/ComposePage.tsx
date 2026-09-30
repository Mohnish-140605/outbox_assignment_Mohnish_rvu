import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCampaign, ensureSender } from '../lib/api';

export function ComposePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delay, setDelay] = useState<number>(0);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);
  
  const [detectedEmails, setDetectedEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Initialize start time to local now
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setStartTime(now.toISOString().slice(0, 16));
  }, []);

  // Parse emails from text box
  useEffect(() => {
    const emails = recipientsText
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    setDetectedEmails(Array.from(new Set(emails))); // unique
  }, [recipientsText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setRecipientsText(prev => prev ? `${prev}\n${text}` : text);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (detectedEmails.length === 0) {
      setError('Please provide at least one valid recipient email address.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(false);

      const sender = await ensureSender();

      // Create campaign
      await createCampaign({
        senderId: sender.id,
        subject,
        body,
        recipients: detectedEmails,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails: delay,
        hourlyLimit: hourlyLimit
      });

      setSuccess(true);
      
      // Reset form on success
      setSubject('');
      setBody('');
      setRecipientsText('');
      
      // Navigate to scheduled after short delay
      setTimeout(() => {
        navigate('/scheduled');
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Campaign created successfully! Redirecting...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              required
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Email subject..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipients (Enter emails or upload CSV/TXT)
            </label>
            <textarea
              required={detectedEmails.length === 0}
              value={recipientsText}
              onChange={e => setRecipientsText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm h-32"
              placeholder="alice@example.com&#10;bob@example.com"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Detected valid emails: <strong className="text-gray-900">{detectedEmails.length}</strong>
              </span>
              <div>
                <input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Upload File
                </label>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              required
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 h-48"
              placeholder="Hello {name}, ..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time (Local)</label>
            <input
              required
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay (ms)</label>
              <input
                required
                type="number"
                min="0"
                value={delay}
                onChange={e => setDelay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Limit</label>
              <input
                required
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={e => setHourlyLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting || detectedEmails.length === 0}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Scheduling...' : 'Schedule Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
