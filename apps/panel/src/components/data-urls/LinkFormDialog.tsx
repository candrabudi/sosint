import { zodResolver } from '@hookform/resolvers/zod';
import { type DataUrlLink, type LinkInput, linkInputSchema, type LinkPayload } from '@sig/shared';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAddLink, useUpdateLink } from '../../lib/dataUrls';
import { Modal } from '../ui/dialog';
import { LinkFields } from './LinkFields';

export function LinkFormDialog({
  open, onOpenChange, dataUrlId, link,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dataUrlId: string;
  link?: DataUrlLink | null;
}) {
  const add = useAddLink(dataUrlId);
  const update = useUpdateLink(dataUrlId);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LinkInput, unknown, LinkPayload>({ resolver: zodResolver(linkInputSchema) });
  const { handleSubmit, reset, formState: { errors, isDirty } } = form;

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    reset(link
      ? { platform: link.platform, url: link.url, views: link.views, likes: link.likes, comments: link.comments, shares: link.shares, saves: link.saves }
      : { platform: 'instagram', url: '', views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  }, [open, link, reset]);

  const pending = add.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (link) await update.mutateAsync({ id: link.id, ...values });
      else await add.mutateAsync(values);
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={link ? 'Edit link & analitik' : 'Tambah link'}
      description={link ? 'Perbarui angka analitik terbaru dari postingan ini.' : 'Platform terdeteksi otomatis dari URL.'}
      className="max-w-[600px]"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-[14px] text-accent">{serverError}</div>
        )}
        <LinkFields form={form} errors={errors} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} disabled={pending}
            className="rounded-xl border border-line px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
            Batal
          </button>
          <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={pending || (!!link && !isDirty)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-60">
            {pending && <Loader2 size={16} className="animate-spin" />}
            {link ? 'Simpan' : 'Tambah link'}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
