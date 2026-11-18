import { Globe, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router';
import { useMe } from '../lib/auth';
import { canAccess, navItems } from '../lib/nav';
import { Tip } from './ui/tooltip';

export function Sidebar({ dark, onTheme }: { dark: boolean; onTheme: (dark: boolean) => void }) {
  const { data: me } = useMe();
  // menu khusus admin (mis. Management Users) disembunyikan untuk role lain
  const items = navItems.filter((i) => canAccess(i, me?.role));

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col px-4 py-4 lg:flex">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-sm">
          <Globe size={26} strokeWidth={1.6} />
        </div>
        <span className="text-[15px] font-semibold tracking-wide text-ink">SOSINTELEGENT</span>
      </div>

      <nav className="flex flex-col gap-1.5">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className="relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-ink transition-colors hover:bg-card/50"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-card shadow-sm"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className={`relative transition-colors ${isActive ? 'text-accent' : 'text-ink-2'}`}>{item.icon}</span>
                <span className="relative flex-1 truncate whitespace-nowrap text-left">{item.label}</span>
                {item.roles?.includes('admin') && (
                  <span className="relative shrink-0 rounded bg-accent-soft px-1 py-px font-mono text-[9px] uppercase tracking-wide text-accent">admin</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-4">
        <div className="flex rounded-full bg-card/70 p-1">
          <Tip label="Mode terang" side="top">
            <button
              onClick={() => onTheme(false)}
              className={`rounded-full p-2.5 transition-colors ${!dark ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
              aria-label="Light mode"
            >
              <Sun size={18} />
            </button>
          </Tip>
          <Tip label="Mode gelap" side="top">
            <button
              onClick={() => onTheme(true)}
              className={`rounded-full p-2.5 transition-colors ${dark ? 'bg-shell text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
              aria-label="Dark mode"
            >
              <Moon size={18} />
            </button>
          </Tip>
        </div>
        <span className="text-sm text-ink-3">SIG Analytics</span>
      </div>
    </aside>
  );
}
