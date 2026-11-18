import { Bell, Clock, LogOut, RefreshCw, Settings, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { navItems } from '../lib/nav';
import { initials, useLogout, useMe } from '../lib/auth';
import { Menu } from './ui/dropdown';
import { Tip } from './ui/tooltip';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}


export function Topbar() {
  const now = useNow();
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = navItems.find((n) => (n.path === '/' ? pathname === '/' : pathname.startsWith(n.path)))?.title ?? 'SOSINTELEGENT';
  const [lastSync, setLastSync] = useState(() => new Date());
  const [spinning, setSpinning] = useState(false);

  const ago = Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000));
  const agoText = ago < 60 ? `${ago} detik lalu` : `${Math.floor(ago / 60)} menit lalu`;

  function refresh() {
    setSpinning(true);
    // nanti: queryClient.invalidateQueries()
    setTimeout(() => {
      setLastSync(new Date());
      setSpinning(false);
    }, 700);
  }

  // dikunci ke zona Asia/Jakarta supaya label WIB selalu benar
  const tz = 'Asia/Jakarta';
  const date = now.toLocaleDateString('id-ID', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });

  return (
    <header className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[20px] font-medium leading-tight">{title}</h1>
        <p className="text-[13px] text-ink-3">{date}</p>
      </div>

      {/* status live */}
      <div className="hidden items-center gap-2 rounded-full bg-card px-4 py-2.5 text-[13px] shadow-sm md:flex">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pos" />
        </span>
        <span className="font-medium text-ink">Live</span>
        <span className="text-ink-3">· sinkron {agoText}</span>
      </div>

      {/* jam */}
      <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 shadow-sm">
        <Clock size={16} className="text-ink-3" />
        <span className="font-mono text-[14px] tabular-nums text-ink">{time}</span>
        <span className="text-[12px] text-ink-3">WIB</span>
      </div>

      <Tip label="Refresh data">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={refresh}
          disabled={spinning}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink-2 shadow-sm transition-colors hover:text-ink disabled:cursor-wait"
          aria-label="Refresh data"
        >
          <motion.span animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.7, ease: 'easeInOut' }}>
            <RefreshCw size={18} />
          </motion.span>
        </motion.button>
      </Tip>

      <Tip label="Notifikasi (3 baru)">
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink-2 shadow-sm transition-colors hover:text-ink"
          aria-label="Notifikasi"
        >
          <Bell size={18} />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
        </motion.button>
      </Tip>

      {user && (
        <div className="hidden text-right leading-tight xl:block">
          <div className="text-[14px] font-medium">{user.fullName}</div>
          <div className="text-[12px] capitalize text-ink-3">{user.role}</div>
        </div>
      )}
      <Menu
        items={[
          { label: 'Profil saya', icon: <User size={14} /> },
          ...(user?.role === 'admin' ? [{ label: 'Pengaturan', icon: <Settings size={14} />, onSelect: () => navigate('/settings') }] : []),
          'separator',
          {
            label: 'Keluar',
            icon: <LogOut size={14} />,
            danger: true,
            onSelect: () => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) }),
          },
        ]}
        trigger={
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#6b4a3a] to-[#c99b7a] text-sm font-semibold text-white ring-2 ring-card"
            aria-label="Menu akun"
          >
            {user ? initials(user.fullName) : "?"}
          </motion.button>
        }
      />
    </header>
  );
}
