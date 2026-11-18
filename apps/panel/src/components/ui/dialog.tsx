import { X } from 'lucide-react';
import { AlertDialog as AD, Dialog as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from './cn';

const overlayCls =
  'fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out] data-[state=closed]:animate-[fade-out_120ms_ease-in]';
const contentCls =
  'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-card p-6 shadow-2xl outline-none ' +
  'data-[state=open]:animate-[dialog-in_200ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[dialog-out_120ms_ease-in]';

/** Modal dialog (Radix Dialog) dengan header, isi, dan tombol tutup. */
export function Modal({
  open, onOpenChange, title, description, children, className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlayCls} />
        <D.Content className={cn(contentCls, 'max-w-[480px]', className)}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-[20px] font-medium tracking-tight">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-[14px] text-ink-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="rounded-full p-1.5 text-ink-3 transition-colors hover:bg-shell hover:text-ink" aria-label="Tutup">
              <X size={18} />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Dialog konfirmasi (Radix AlertDialog) untuk aksi berbahaya. */
export function Confirm({
  open, onOpenChange, title, description, confirmLabel = 'Ya, lanjutkan', onConfirm, loading, icon,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className={overlayCls} />
        <AD.Content className={cn(contentCls, 'max-w-[420px]')}>
          {icon && (
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
          )}
          <AD.Title className="text-[19px] font-medium tracking-tight">{title}</AD.Title>
          <AD.Description className="mt-2 text-[14px] leading-relaxed text-ink-2">{description}</AD.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AD.Cancel className="rounded-xl border border-line px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
              Batal
            </AD.Cancel>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? 'Memproses...' : confirmLabel}
            </button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
