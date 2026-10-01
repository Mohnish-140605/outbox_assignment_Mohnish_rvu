import { Send } from 'lucide-react';
import { APP_NAME } from '../../lib/brand';

export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
        <Send className="w-4 h-4 text-white" />
      </div>
      <span className="font-semibold text-[18px] text-[var(--color-text-main)]">{APP_NAME}</span>
    </div>
  );
}
