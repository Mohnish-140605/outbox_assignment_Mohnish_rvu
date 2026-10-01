import { RefreshCw } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  count?: number;
  countLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  limitNote?: string;
}

export function PageHeader({
  title,
  count,
  countLabel,
  onRefresh,
  refreshing = false,
  limitNote,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-main)]">{title}</h1>
          {count !== undefined && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {count} {countLabel || 'emails'}
            </p>
          )}
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      {limitNote && (
        <p className="text-xs text-[var(--color-text-muted)]">{limitNote}</p>
      )}
    </div>
  );
}
