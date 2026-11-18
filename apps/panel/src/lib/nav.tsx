import type { UserRole } from '@sig/shared';
import { ChartNoAxesCombined, Database, Gauge, LayoutDashboard, Link2, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavItem {
  path: string;
  label: string;
  /** judul di topbar */
  title: string;
  icon: ReactNode;
  /** kosong = semua role boleh */
  roles?: UserRole[];
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', title: 'Realtime Monitoring', icon: <LayoutDashboard size={17} /> },
  { path: '/content', label: 'Analitik Konten', title: 'Analitik Konten', icon: <ChartNoAxesCombined size={17} /> },
  { path: '/accounts', label: 'Performa Akun', title: 'Performa Akun', icon: <Gauge size={17} /> },
  { path: '/data-url', label: 'Data Url', title: 'Data Url', icon: <Link2 size={17} /> },
  { path: '/data', label: 'Kelola Data', title: 'Kelola Data', icon: <Database size={17} /> },
  { path: '/users', label: 'Users', title: 'Users', icon: <Users size={17} />, roles: ['admin'] },
  { path: '/settings', label: 'Pengaturan', title: 'Pengaturan', icon: <Settings size={17} />, roles: ['admin'] },
];

export const canAccess = (item: NavItem, role?: UserRole) => !item.roles || (!!role && item.roles.includes(role));
