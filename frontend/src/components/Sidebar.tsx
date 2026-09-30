import { NavLink } from 'react-router-dom';
import { PenSquare, Clock, Send, Search } from 'lucide-react';

export function Sidebar() {
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
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
            DU
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Dev User</span>
            <span className="text-xs text-gray-500">Google OAuth coming soon</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
