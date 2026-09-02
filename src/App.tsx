import { Navigate, Route, Routes } from 'react-router-dom';
import SessionList from './pages/admin/SessionList';
import SessionPage from './pages/admin/SessionPage';
import IdeaPage from './pages/attendee/IdeaPage';
import { pl } from './i18n/pl';

function NotFound() {
  return (
    <main className="page page--stage">
      <h1 className="stage-title">{pl.errors.notFound}</h1>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<SessionList />} />
      <Route path="/admin/:id" element={<SessionPage />} />
      <Route path="/s/:id" element={<IdeaPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
