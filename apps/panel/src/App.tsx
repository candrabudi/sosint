import { Globe, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { useMe } from './lib/auth';
import { useTheme } from './lib/theme';
import type { UserRole } from '@sig/shared';
import { Toaster } from 'sonner';
import { navItems } from './lib/nav';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataUrlDetailPage } from './pages/DataUrlDetailPage';
import { DataUrlsPage } from './pages/DataUrlsPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas text-ink-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-ink shadow-sm"
      >
        <Globe size={30} strokeWidth={1.6} />
      </motion.div>
      <Loader2 size={18} className="animate-spin" />
    </div>
  );
}

/** Hanya untuk user yang sudah login; selain itu diarahkan ke /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Hanya untuk role tertentu (dicek juga di API). */
function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { data: user } = useMe();
  if (user?.role !== role) return <ForbiddenPage />;
  return children;
}

/** Halaman tamu (login); user yang sudah login diarahkan ke dashboard. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe();
  if (isLoading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function PanelLayout({ dark, onTheme }: { dark: boolean; onTheme: (d: boolean) => void }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar dark={dark} onTheme={onTheme} />
      <div className="min-w-0 flex-1 px-4 pb-6 lg:pl-0 lg:pr-5">
        <Topbar />
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  const { dark, setDark } = useTheme();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        theme={dark ? 'dark' : 'light'}
        richColors
        closeButton
        toastOptions={{ className: '!rounded-2xl !font-sans' }}
      />
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage dark={dark} onTheme={setDark} /></GuestOnly>} />
        <Route element={<RequireAuth><PanelLayout dark={dark} onTheme={setDark} /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="data-url" element={<DataUrlsPage />} />
          <Route path="data-url/:id" element={<DataUrlDetailPage />} />
          <Route path="users" element={<RequireRole role="admin"><UsersPage /></RequireRole>} />
          <Route path="settings" element={<RequireRole role="admin"><SettingsPage /></RequireRole>} />
          {navItems
            .filter((n) => !['/', '/users', '/data-url', '/settings'].includes(n.path))
            .map((n) => <Route key={n.path} path={n.path.slice(1)} element={<ComingSoonPage title={n.title} />} />)}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
