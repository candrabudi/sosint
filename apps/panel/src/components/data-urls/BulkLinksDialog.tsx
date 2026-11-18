import type { ParsedUrl } from '@sig/shared';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { useAddLinksBulk } from '../../lib/dataUrls';
import { Modal } from '../ui/dialog';
import { BulkLinkInput } from './BulkLinkInput';

export function BulkLinksDialog({
  open, onOpenChange, dataUrlId, existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dataUrlId: string;
  existing: string[];
}) {
  const bulk = useAddLinksBulk(dataUrlId);
  const [links, setLinks] = useState<ParsedUrl[]>([]);
  const onLinks = useCallback((l: ParsedUrl[]) => setLinks(l), []);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !bulk.isPending && onOpenChange(o)}
      title="Tambah link"
      description="Tempel satu atau banyak link sekaligus — platform terdeteksi otomatis."
      className="max-w-[620px]"
    >
      {/* key=open → input direset setiap dialog dibuka */}
      <BulkLinkInput key={String(open)} onChange={onLinks} existing={existing} autoFocus />
      <p className="mt-2 text-[12px] text-ink-3">Angka analitik dimulai dari 0 dan bisa diperbarui per link setelahnya.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => onOpenChange(false)} disabled={bulk.isPending}
          className="rounded-xl border border-line px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
          Batal
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={!links.length || bulk.isPending}
          onClick={() => bulk.mutate(links.map((l) => l.url), { onSuccess: () => onOpenChange(false) })}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {bulk.isPending && <Loader2 size={16} className="animate-spin" />}
          Tambahkan {links.length || ''} link
        </motion.button>
      </div>
    </Modal>
  );
}
