import { NavLink } from 'react-router-dom';
import { Clock, Send, LogOut, Plus, ExternalLink } from 'lucide-react';
import { BrandMark } from './ui/BrandMark';
import { SlackStatus } from './layout/SlackStatus';
import type { AuthUser } from '../types/email';

interface SidebarProps {
  queueDashboardUrl: string;
  slackConnectUrl: string;
  user: AuthUser;
  onLogout: () => void;
  onDisconnectSlack?: () => void;
  slackBusy?: boolean;
  slackError?: string | null;
  setSlackError?: (error: string | null) => void;
  refresh?: () => Promise<void>;
  slackConnectionFailed?: boolean;
  notificationSoundEnabled?: boolean;
  onNotificationSoundChange?: (enabled: boolean) => void;
}

export function Sidebar({
  queueDashboardUrl,
  slackConnectUrl,
  user,
  onLogout,
  onDisconnectSlack,
  slackBusy = false,
  slackError,
  setSlackError,
  refresh,
  slackConnectionFailed = false,
  notificationSoundEnabled = true,
  onNotificationSoundChange,
}: SidebarProps) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 ${isActive
      ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium'
      : 'text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text-main)]'
    }`;

  const firstName = user?.name?.split(/\s+/)[0] || 'User';
  const initials = (user?.name ?? 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <aside className="w-[240px] bg-white border-r border-[var(--color-border)] flex flex-col h-screen shrink-0">
      <div className="px-4 py-4 border-b border-[var(--color-border)]">
        <BrandMark />
      </div>

      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] flex items-center justify-center font-bold text-xs shrink-0">
              {initials || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--color-text-main)] truncate capitalize" title={`${user.name} - ${user.email}`}>
              {firstName}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <NavLink
          to="/compose"
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-[var(--color-accent)] text-[var(--color-accent)] font-medium text-sm hover:bg-[var(--color-accent-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1"
        >
          <Plus className="w-4 h-4" />
          Compose
        </NavLink>
      </div>

      <nav className="flex-1 px-4 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Emails
          </div>
          <div className="space-y-1">
            <NavLink to="/scheduled" className={linkClass} aria-label="Scheduled emails">
              <Clock className="w-4 h-4" />
              Scheduled
            </NavLink>
            <NavLink to="/sent" className={linkClass} aria-label="Sent emails">
              <Send className="w-4 h-4" />
              Sent
            </NavLink>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-[var(--color-border)] space-y-4 pb-4">
        <div>
          <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Integrations
          </div>
          <SlackStatus
            slackConnectUrl={slackConnectUrl}
            slackConnected={user.slackConnected}
            slackTeamName={user.slackTeamName}
            onDisconnect={onDisconnectSlack}
            slackBusy={slackBusy}
            slackError={slackError}
            setSlackError={setSlackError}
            refresh={refresh}
            connectionFailed={slackConnectionFailed}
            notificationSoundEnabled={notificationSoundEnabled}
            onNotificationSoundChange={onNotificationSoundChange}
          />
        </div>
        <a
          href={queueDashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text-main)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          title="Opens the Bull Board queue dashboard"
        >
          <ExternalLink className="w-4 h-4" />
          Live queue
        </a>
      </div>
    </aside>
  );
}
