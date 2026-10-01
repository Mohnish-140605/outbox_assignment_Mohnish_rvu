import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCampaign, ensureSender } from '../lib/api';
import { RichTextEditor } from '../components/email/RichTextEditor';
import { SendLaterPopover } from '../components/email/SendLaterPopover';
import { RecipientsInput } from '../components/email/RecipientsInput';
import { Clock, X } from 'lucide-react';

export function ComposePage() {
  const navigate = useNavigate();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delay, setDelay] = useState<number>(5);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [showSendLaterPopover, setShowSendLaterPopover] = useState(false);

  // Initialize start time to local now
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setStartTime(now.toISOString().slice(0, 16));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
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
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails: delay,
        hourlyLimit: hourlyLimit
      });

      setSuccess(true);

      // Reset form on success
      setSubject('');
      setBody('');
      setRecipients([]);
      setEditorError(null);

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

  const handleSendLaterDone = () => {
    setShowSendLaterPopover(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border border-[var(--color-border)] rounded-lg shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h1 className="text-xl font-semibold text-[var(--color-text-main)]">New email</h1>
          <button
            type="button"
            onClick={() => navigate('/scheduled')}
            className="p-2 rounded-lg hover:bg-gray-100 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          <div className="space-y-4">
            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                To
              </label>
              <RecipientsInput
                recipients={recipients}
                onRecipientsChange={setRecipients}
                placeholder="Add recipients..."
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                Subject
              </label>
              <input
                required
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                Message
              </label>
              <RichTextEditor
                value={body}
                onChange={setBody}
                onValidationError={setEditorError}
              />
              {editorError && (
                <p className="mt-2 text-sm text-red-700" role="alert">{editorError}</p>
              )}
            </div>

            {/* Schedule settings */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                    Send at
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="datetime-local"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSendLaterPopover(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                      aria-label="Quick schedule options"
                    >
                      <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                  <SendLaterPopover
                    isOpen={showSendLaterPopover}
                    onClose={() => setShowSendLaterPopover(false)}
                    startTime={startTime}
                    onSetStartTime={setStartTime}
                    onSubmit={handleSendLaterDone}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                    Delay between emails (seconds)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={delay}
                    onChange={e => setDelay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                    Hourly limit
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={hourlyLimit}
                    onChange={e => setHourlyLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => navigate('/scheduled')}
              className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || recipients.length === 0}
              className="px-4 py-2 bg-[var(--color-accent)] text-white font-medium rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting ? 'Scheduling...' : (
                <>
                  <Clock className="w-4 h-4" />
                  Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
