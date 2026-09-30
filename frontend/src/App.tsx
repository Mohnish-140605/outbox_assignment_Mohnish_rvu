import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ComposePage } from './pages/ComposePage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { SearchPage } from './pages/SearchPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/compose" replace />} />
          <Route path="compose" element={<ComposePage />} />
          <Route path="scheduled" element={<ScheduledPage />} />
          <Route path="sent" element={<SentPage />} />
          <Route path="search" element={<SearchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
