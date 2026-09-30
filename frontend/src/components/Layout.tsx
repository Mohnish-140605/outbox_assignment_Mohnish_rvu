import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  const location = useLocation();
  
  const getTitle = () => {
    switch (location.pathname) {
      case '/compose': return 'Compose Campaign';
      case '/scheduled': return 'Scheduled Emails';
      case '/sent': return 'Sent Emails';
      case '/search': return 'Search Emails';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">{getTitle()}</h2>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
