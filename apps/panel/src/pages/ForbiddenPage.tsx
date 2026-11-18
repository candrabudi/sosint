import { ShieldX } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';

export function ForbiddenPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-3xl bg-shell p-10 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><ShieldX size={24} /></span>
      <div>
        <h2 className="text-[22px] font-medium tracking-tight">Akses ditolak</h2>
        <p className="mt-1 text-[15px] text-ink-2">Halaman ini hanya dapat diakses oleh admin.</p>
      </div>
      <Link to="/" className="rounded-xl border border-line bg-card px-4 py-2 text-[14px] transition-colors hover:text-accent">
        Kembali ke dashboard
      </Link>
    </motion.div>
  );
}
