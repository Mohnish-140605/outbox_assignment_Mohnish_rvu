import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { ComposePage } from './pages/ComposePage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { SearchPage } from './pages/SearchPage';

function AppRoutes() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/compose" replace />} />
        <Route path="compose" element={<ComposePage />} />
        <Route path="scheduled" element={<ScheduledPage />} />
        <Route path="sent" element={<SentPage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/compose" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
