import { X } from 'lucide-react';

interface FlashBannerProps {
  kind: 'success' | 'error';
  text: string;
  onDismiss: () => void;
}

export function FlashBanner({ kind, text, onDismiss }: FlashBannerProps) {
  return (
    <div
      className={`p-3 rounded-md border text-sm flex items-start justify-between gap-4 ${
        kind === 'success'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      <p>{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
