import {
  type CommentQuery, type CommentSummary, DEFAULT_PAGE_SIZE, type DataUrlLink, type LinkComment, PLATFORM_LABELS, supportsComments,
} from '@sig/shared';
import { BadgeCheck, CornerDownRight, ExternalLink, Heart, Pin, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useDataUrlComments } from '../../lib/dataUrls';
import { fmtCompact, fmtDateTime, fmtNumber, fmtRelative } from '../../lib/format';
import { Modal } from '../ui/dialog';
import { Menu } from '../ui/dropdown';
import { Pagination } from '../ui/pagination';
import { Tip } from '../ui/tooltip';
import { PlatformDot } from './Platform';

type Polarity = NonNullable<CommentQuery['polarity']>;

const POLARITY: Record<Polarity, { label: string; color: string; badge: string }> = {
  positive: { label: 'Positif', color: 'var(--pos)', badge: 'bg-good-soft text-good' },
  neutral: { label: 'Netral', color: 'var(--ink-3)', badge: 'bg-shell text-ink-2' },
  negative: { label: 'Negatif', color: 'var(--accent)', badge: 'bg-accent-soft text-accent' },
  none: { label: 'Tanpa sentimen', color: 'var(--line)', badge: 'bg-shell text-ink-3' },
};

const EMOTIONS: Record<string, string> = {
  joy: 'Senang', trust: 'Percaya', fear: 'Takut', surprise: 'Terkejut', sadness: 'Sedih',
  disgust: 'Jijik', anger: 'Marah', anticipation: 'Antisipasi',
};

const SORTS = { recent: 'Terbaru', likes: 'Like terbanyak', replies: 'Balasan terbanyak' } as const;

function SentimentBar({ summary, active, onPick }: { summary: CommentSummary; active?: Polarity; onPick: (p?: Polarity) => void }) {
  const parts = (Object.keys(POLARITY) as Polarity[]).map((p) => ({ p, n: summary.polarity[p] })).filter((x) => x.n > 0);
  const analysed = summary.total - summary.polarity.none;
  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
        <span className="text-ink-2"><b className="text-[18px] font-medium text-ink">{fmtNumber(summary.total)}</b> komentar
          {summary.new24h > 0 && <span className="ml-2 text-pos">+{summary.new24h} baru 24 jam</span>}
        </span>
        <span className="text-ink-3">{analysed ? `${fmtNumber(analysed)} punya data sentimen (X)` : 'Sentimen hanya tersedia dari X'}</span>
      </div>
      <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-shell">
        {parts.map((x) => <div key={x.p} style={{ width: `${(x.n / Math.max(1, summary.total)) * 100}%`, background: POLARITY[x.p].color }} />)}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {parts.map((x) => (
          <button key={x.p} onClick={() => onPick(active === x.p ? undefined : x.p)}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition-colors ${active === x.p ? 'bg-ink text-canvas' : 'bg-shell text-ink-2 hover:text-ink'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: POLARITY[x.p].color }} />
            {POLARITY[x.p].label} <span className="opacity-70">{Math.round((x.n / Math.max(1, summary.total)) * 100)}%</span>
          </button>
        ))}
        {summary.emotions.length > 0 && <span className="mx-1 self-center text-ink-3">·</span>}
        {summary.emotions.map((e) => (
          <span key={e.emotion} className="rounded-lg bg-blue-soft px-2 py-1 text-[12px] text-blue">
            {EMOTIONS[e.emotion] ?? e.emotion} <span className="opacity-70">{e.comments}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CommentRow({ c, showPost }: { c: LinkComment; showPost: boolean }) {
  return (
    <div className="flex gap-3 border-t border-line px-4 py-3 text-[14px] first:border-t-0">
      <span className="relative shrink-0">
        {c.authorAvatar
          ? <img src={c.authorAvatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full bg-shell object-cover" />
          : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-shell text-[13px] font-medium uppercase text-ink-2">{c.author[0]}</span>}
        <PlatformDot platform={c.platform} size={15} className="absolute -right-1 -bottom-1" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-medium">{c.authorName || c.author}</span>
          {c.authorVerified && <BadgeCheck size={13} className="text-blue" />}
          <span className="text-[12px] text-ink-3">@{c.author}{c.authorFollowers != null && ` · ${fmtCompact(c.authorFollowers)} followers`}</span>
          {c.isPinned && <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-3"><Pin size={10} />disematkan</span>}
          {c.polarity && (
            <span className={`rounded-md px-1.5 py-px text-[11px] ${POLARITY[c.polarity as Polarity]?.badge ?? 'bg-shell text-ink-2'}`}>
              {POLARITY[c.polarity as Polarity]?.label ?? c.polarity}{c.dominantEmotion && ` · ${EMOTIONS[c.dominantEmotion] ?? c.dominantEmotion}`}
            </span>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-ink">{c.text || <span className="text-ink-3">(tanpa teks)</span>}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
          {c.postedAt && <Tip label={fmtDateTime(c.postedAt)}><span>{fmtRelative(c.postedAt)}</span></Tip>}
          <span className="inline-flex items-center gap-1"><Heart size={12} />{fmtCompact(c.likes)}</span>
          <span className="inline-flex items-center gap-1"><CornerDownRight size={12} />{fmtCompact(c.replies)}</span>
          {c.views > 0 && <span>{fmtCompact(c.views)} views</span>}
          {showPost && <span className="truncate">pada {c.postUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}</span>}
          {c.url && (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <ExternalLink size={12} />buka
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Modal daftar komentar (semua link atau satu link), dengan filter & pagination. */
export function CommentsDialog({ dataUrlId, links, open, onOpenChange, linkId, onLinkChange }: {
  dataUrlId: string; links: DataUrlLink[]; open: boolean; onOpenChange: (o: boolean) => void;
  linkId?: string; onLinkChange: (id?: string) => void;
}) {
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const [polarity, setPolarity] = useState<Polarity | undefined>();
  const [sort, setSort] = useState<keyof typeof SORTS>('recent');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  useEffect(() => setPage(1), [deferred, polarity, sort, pageSize, linkId]);

  const { data, isLoading, isPlaceholderData } = useDataUrlComments(dataUrlId, {
    linkId, polarity, sort, search: deferred || undefined, page, pageSize,
  }, open);
  const commentLinks = links.filter((l) => supportsComments(l.platform));
  const selected = links.find((l) => l.id === linkId);
  const failed = links.filter((l) => l.commentsSyncError);

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="flex max-h-[88vh] max-w-[880px] flex-col"
      title={selected ? `Komentar ${selected.meta?.author ? `@${selected.meta.author}` : PLATFORM_LABELS[selected.platform]}` : 'Semua komentar'}
      description="Ditarik setiap sinkron dari X, TikTok, dan Instagram (1 halaman terbaru per link).">
      {failed.length > 0 && (
        <div className="mb-3">
          <Tip label={<span className="block max-w-[280px]">{failed.map((l) => l.commentsSyncError).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}</span>}>
            <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-[12px] text-accent">{failed.length} link gagal ambil komentar</span>
          </Tip>
        </div>
      )}

      {data && <SentimentBar summary={data.summary} active={polarity} onPick={setPolarity} />}

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-line px-3 focus-within:border-ink-3 sm:max-w-[300px]">
            <Search size={15} className="text-ink-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari isi atau akun..."
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
            {search && <button onClick={() => setSearch('')} aria-label="Hapus pencarian" className="text-ink-3 hover:text-ink"><X size={13} /></button>}
          </label>
          <Menu align="start"
            items={[{ label: 'Semua link', onSelect: () => onLinkChange(undefined) },
              ...commentLinks.map((l) => ({
                label: `${l.meta?.author ? `@${l.meta.author}` : PLATFORM_LABELS[l.platform]} · ${l.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 36)}`,
                icon: <PlatformDot platform={l.platform} size={16} className="ring-0" />, onSelect: () => onLinkChange(l.id),
              }))]}
            trigger={
              <button className={`flex h-9 max-w-[280px] items-center gap-1.5 truncate rounded-xl border px-3 text-[13px] ${selected ? 'border-ink text-ink' : 'border-line text-ink-2'}`}>
                <span className="text-ink-3">Link:</span>
                <span className="truncate">{selected ? (selected.meta?.author ? `@${selected.meta.author}` : PLATFORM_LABELS[selected.platform]) : 'Semua'}</span>
              </button>
            } />
          <Menu align="start"
            items={(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => ({ label: SORTS[k], onSelect: () => setSort(k) }))}
            trigger={<button className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] text-ink-2"><span className="text-ink-3">Urut:</span>{SORTS[sort]}</button>} />
          {(polarity || linkId || search) && (
            <button onClick={() => { setPolarity(undefined); onLinkChange(undefined); setSearch(''); }}
              className="h-9 rounded-xl px-3 text-[13px] text-ink-2 hover:bg-shell hover:text-ink">Reset</button>
          )}
        </div>

        <div className={`min-h-[200px] flex-1 overflow-y-auto transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <span className="h-9 w-9 rounded-full bg-shell" />
              <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-shell" /><div className="h-3 w-3/4 rounded bg-shell" /></div>
            </div>
          ))}
          {data && data.items.length === 0 && (
            <div className="py-12 text-center text-[14px] text-ink-3">
              {data.summary.total ? 'Tidak ada komentar yang cocok dengan filter.' : 'Belum ada komentar. Komentar ditarik saat link disinkron.'}
            </div>
          )}
          {data?.items.map((c) => <CommentRow key={c.id} c={c} showPost={!linkId} />)}
        </div>

        {data && (
          <Pagination page={page} pageSize={pageSize} total={data.total} unit="komentar" loading={isPlaceholderData}
            onPageChange={setPage} onPageSizeChange={setPageSize} />
        )}
      </div>
    </Modal>
  );
}
