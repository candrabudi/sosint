import { PLATFORM_LABELS, type ParsedUrl, parseUrlList, type Platform } from '@sig/shared';
import { ClipboardPaste, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { PlatformDot } from './Platform';

/**
 * Textarea untuk menempel banyak link sekaligus. Setiap link dirapikan,
 * dideteksi platformnya, dan duplikat dibuang. Hasil valid dikirim via onChange.
 */
export function BulkLinkInput({
  onChange, existing = [], autoFocus,
}: {
  onChange: (links: ParsedUrl[]) => void;
  /** URL yang sudah ada (dihitung sebagai duplikat) */
  existing?: string[];
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // pakai key string agar array baru dengan isi sama tidak memicu parse ulang (mencegah loop render)
  const existingKey = existing.join('\n');
  const parsed = useMemo(() => parseUrlList(text, existingKey ? existingKey.split('\n') : []), [text, existingKey]);
  const links = useMemo(() => parsed.valid.filter((l) => !removed.has(l.url)), [parsed, removed]);

  useEffect(() => onChange(links), [links, onChange]);

  const counts = useMemo(() => {
    const m = new Map<Platform, number>();
    links.forEach((l) => m.set(l.platform, (m.get(l.platform) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [links]);

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      setText((t) => (t ? `${t}\n${clip}` : clip));
    } catch {
      /* izin clipboard ditolak — user bisa paste manual */
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={autoFocus}
          rows={5}
          spellCheck={false}
          placeholder={'Tempel link di sini — satu per baris, atau dipisah spasi/koma.\nhttps://instagram.com/p/...\nhttps://tiktok.com/@brand/video/...\nhttps://x.com/brand/status/...'}
          className="w-full resize-y rounded-xl border border-line bg-card px-3.5 py-3 font-mono text-[13px] leading-relaxed outline-none transition-[border-color,box-shadow] placeholder:font-sans placeholder:text-ink-3 hover:border-ink-3/50 focus:border-ink-3 focus:ring-4 focus:ring-ink/5"
        />
        <div className="absolute bottom-3 right-3 flex gap-1">
          {text && (
            <button type="button" onClick={() => { setText(''); setRemoved(new Set()); }}
              className="rounded-lg bg-shell px-2 py-1 text-[12px] text-ink-2 transition-colors hover:text-ink">
              Bersihkan
            </button>
          )}
          <button type="button" onClick={pasteFromClipboard}
            className="flex items-center gap-1 rounded-lg bg-shell px-2 py-1 text-[12px] text-ink-2 transition-colors hover:text-ink">
            <ClipboardPaste size={12} /> Tempel
          </button>
        </div>
      </div>

      {(links.length > 0 || parsed.invalid.length > 0 || parsed.duplicates > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="font-medium">{links.length} link terdeteksi</span>
          {counts.map(([p, n]) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-shell py-0.5 pl-0.5 pr-2">
              <PlatformDot platform={p} size={18} className="ring-0" /> {PLATFORM_LABELS[p]} {n}
            </span>
          ))}
          {parsed.duplicates > 0 && <span className="text-ink-3">· {parsed.duplicates} duplikat dilewati</span>}
        </div>
      )}

      <AnimatePresence initial={false}>
        {parsed.invalid.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              {parsed.invalid.length} bukan link valid dan diabaikan:{' '}
              <span className="break-all font-mono">{parsed.invalid.slice(0, 5).join(', ')}{parsed.invalid.length > 5 && ' …'}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {links.length > 0 && (
        <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-xl border border-line p-1.5">
          <AnimatePresence initial={false}>
            {links.map((l) => (
              <motion.div key={l.url} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-shell">
                <PlatformDot platform={l.platform} size={24} className="ring-0" />
                <span className="w-[72px] shrink-0 text-[12px] text-ink-2">{PLATFORM_LABELS[l.platform]}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{l.url.replace(/^https:\/\//, '')}</span>
                <button type="button" onClick={() => setRemoved((s) => new Set(s).add(l.url))} aria-label="Keluarkan link"
                  className="rounded-md p-1 text-ink-3 opacity-0 transition hover:text-accent group-hover:opacity-100">
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
