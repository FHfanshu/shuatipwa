import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import PracticePage from './pages/PracticePage';
import WrongPage from './pages/WrongPage';
import SettingsPage from './pages/SettingsPage';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

function AppLayout() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/practice/') || location.pathname.startsWith('/wrong/');

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative">
      <main className={hideNav ? '' : 'pb-20'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
    <BrowserRouter basename={basename}>
      <AppLayout />
    </BrowserRouter>
  );
}
