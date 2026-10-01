import { useEffect, useRef } from 'react';

interface SendLaterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  startTime: string;
  onSetStartTime: (time: string) => void;
  onSubmit: () => void;
}

export function SendLaterPopover({
  isOpen,
  onClose,
  startTime,
  onSetStartTime,
  onSubmit,
}: SendLaterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const getQuickOptions = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const options = [
      {
        label: 'Tomorrow 9:00 AM',
        value: new Date(tomorrow).setHours(9, 0, 0, 0),
      },
      {
        label: 'Tomorrow 11:00 AM',
        value: new Date(tomorrow).setHours(11, 0, 0, 0),
      },
      {
        label: 'Tomorrow 3:00 PM',
        value: new Date(tomorrow).setHours(15, 0, 0, 0),
      },
    ];

    return options.map((opt) => ({
      label: opt.label,
      value: new Date(opt.value).toISOString().slice(0, 16),
    }));
  };

  const quickOptions = getQuickOptions();

  const isValidFutureTime = () => {
    const selected = new Date(startTime);
    const now = new Date();
    return selected > now;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-64 bg-white border border-[var(--color-border)] rounded-lg shadow-lg p-4 z-10"
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Schedule for
          </label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => onSetStartTime(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Quick options
          </label>
          <div className="space-y-1">
            {quickOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSetStartTime(option.value)}
                className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {!isValidFutureTime() && (
          <p className="text-xs text-red-600">Time must be in the future</p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!isValidFutureTime()}
            className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-md hover:bg-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
