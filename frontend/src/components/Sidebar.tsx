import { NavLink } from 'react-router-dom';
import { PenSquare, Clock, Send, Search, Activity } from 'lucide-react';

export function Sidebar({ queueDashboardUrl }: { queueDashboardUrl: string }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive
        ? 'bg-green-50 text-green-700 font-medium'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shrink-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">ReachInbox</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <NavLink to="/compose" className={linkClass}>
          <PenSquare className="w-5 h-5" />
          Compose
        </NavLink>
        <NavLink to="/scheduled" className={linkClass}>
          <Clock className="w-5 h-5" />
          Scheduled
        </NavLink>
        <NavLink to="/sent" className={linkClass}>
          <Send className="w-5 h-5" />
          Sent
        </NavLink>
        <NavLink to="/search" className={linkClass}>
          <Search className="w-5 h-5" />
          Search
        </NavLink>
        <a
          href={queueDashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <Activity className="w-5 h-5" />
          Queue dashboard
        </a>
      </nav>
    </aside>
  );
}
