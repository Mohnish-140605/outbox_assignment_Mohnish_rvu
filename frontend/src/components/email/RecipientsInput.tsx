import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { EMAIL_REGEX } from '../../lib/email';

interface RecipientsInputProps {
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  placeholder?: string;
}

export function RecipientsInput({
  recipients,
  onRecipientsChange,
  placeholder = 'Add recipients...',
}: RecipientsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      addRecipient();
    } else if (e.key === 'Backspace' && inputValue === '' && recipients.length > 0) {
      onRecipientsChange(recipients.slice(0, -1));
    }
  };

  const addRecipient = () => {
    const email = inputValue.trim().toLowerCase();
    if (email && EMAIL_REGEX.test(email) && !recipients.includes(email)) {
      onRecipientsChange([...recipients, email]);
      setInputValue('');
    }
  };

  const removeRecipient = (email: string) => {
    onRecipientsChange(recipients.filter((r) => r !== email));
  };

  const isValidEmail = (email: string) => EMAIL_REGEX.test(email);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setUploadMessage('The recipient file could not be read.');
    reader.onload = () => {
      const contents = typeof reader.result === 'string' ? reader.result : '';
      const addresses = contents.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean);
      const valid = Array.from(new Set(addresses.filter((value) => EMAIL_REGEX.test(value.toLowerCase()))));
      const invalidCount = addresses.length - valid.length;

      if (valid.length === 0) {
        setUploadMessage('No valid email addresses were found in that file.');
        return;
      }

      onRecipientsChange(Array.from(new Set([...recipients, ...valid.map((email) => email.toLowerCase())])));
      setUploadMessage(invalidCount > 0 ? `Added ${valid.length} addresses; skipped ${invalidCount} invalid entries.` : `Added ${valid.length} addresses.`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-md p-2 focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:border-[var(--color-accent)] transition-shadow">
      <div className="flex flex-wrap gap-2">
        {recipients.map((email) => (
          <div
            key={email}
            className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-accent-light)] text-[var(--color-accent)] rounded-md text-sm"
          >
            <span>{email}</span>
            <button
              type="button"
              onClick={() => removeRecipient(email)}
              className="p-0.5 hover:bg-[var(--color-accent)] hover:text-white rounded transition-colors"
              aria-label={`Remove ${email}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addRecipient}
          placeholder={recipients.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[200px] outline-none text-sm bg-transparent"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-[var(--color-text-muted)]" role={uploadMessage?.includes('invalid') || uploadMessage?.startsWith('No valid') ? 'alert' : 'status'}>
          {uploadMessage ?? 'Add addresses separated by commas, spaces, or Enter.'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Choose a CSV or text file of recipients"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload CSV/TXT
        </button>
      </div>
      {inputValue && !isValidEmail(inputValue) && (
        <p className="text-xs text-red-600 mt-1">Invalid email address</p>
      )}
    </div>
  );
}
