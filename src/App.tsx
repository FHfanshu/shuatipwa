import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import UpdatePrompt from './components/UpdatePrompt';
import NetworkStatus from './components/NetworkStatus';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import BanksPage from './pages/BanksPage';
import ImportPage from './pages/ImportPage';
import PracticePage from './pages/PracticePage';
import WrongPage from './pages/WrongPage';
import SettingsPage from './pages/SettingsPage';

function AppLayout() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/practice/') || location.pathname.startsWith('/wrong/');

  return (
    <div className="min-h-dvh bg-bg-primary max-w-3xl mx-auto relative border-x border-border-subtle/50 shadow-[0_24px_80px_-60px_var(--copper-glow)]">
      <NetworkStatus />
      <main className={hideNav ? '' : 'pb-20'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/banks" element={<BanksPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/practice/:bankId/:mode" element={<PracticePage />} />
          <Route path="/wrong/:bankId" element={<WrongPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppLayout />
        <UpdatePrompt />
      </HashRouter>
    </ErrorBoundary>
  );
}
