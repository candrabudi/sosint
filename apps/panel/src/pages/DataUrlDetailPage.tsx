import {
  type DataUrlLink, DEFAULT_PAGE_SIZE, engagementRate, isSyncable, supportsComments, METRICS, type Metric, PLATFORM_LABELS, type Platform, SYNCABLE_PLATFORMS,
} from '@sig/shared';
import {
  ArrowLeft, BadgeCheck, ChartLine, MessageSquareText, RefreshCw, Bookmark, Copy, ExternalLink, Eye, Heart, Link2, MessageCircle, Pencil, Plus, Repeat2, Trash2, TriangleAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { DataUrlFormDialog } from '../components/data-urls/DataUrlFormDialog';
import { METRIC_LABELS } from '../components/data-urls/LinkFields';
import { BulkLinksDialog } from '../components/data-urls/BulkLinksDialog';
import { CommentsDialog } from '../components/data-urls/Comments';
import { DataUrlHistoryCard, LinkHistoryDialog } from '../components/data-urls/History';
import { LinkFormDialog } from '../components/data-urls/LinkFormDialog';
import { PLATFORM_COLORS, PlatformBadge } from '../components/data-urls/Platform';
import { CountUp, FadeIn } from '../components/motion';
import { Confirm } from '../components/ui/dialog';
import { MoreMenu, RangeSelect } from '../components/ui/dropdown';
import { Pagination } from '../components/ui/pagination';
import { Switch } from '../components/ui/switch';
import { Tip } from '../components/ui/tooltip';
import {
  isAwaitingSync, useDataUrl, useDeleteDataUrl, useDeleteLink, useSyncAll, useSyncLink, useUpdateDataUrl,
} from '../lib/dataUrls';
import { fmtCompact, fmtDate, fmtDateTime, fmtNumber, fmtPercent, fmtRelative } from '../lib/format';

const METRIC_ICONS: Record<Metric, ReactNode> = {
  views: <Eye size={17} />, likes: <Heart size={17} />, comments: <MessageCircle size={17} />, shares: <Repeat2 size={17} />, saves: <Bookmark size={17} />,
};
const METRIC_TONES: Record<Metric, string> = {
  views: 'bg-blue-soft text-blue', likes: 'bg-accent-soft text-accent', comments: 'bg-good-soft text-good',
  shares: 'bg-warn-soft text-warn', saves: 'bg-shell text-ink-2',
};

function ChartTip({ active, payload, metric }: { active?: boolean; payload?: { payload: { platform: Platform; value: number } }[]; metric: Metric }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-ink px-2.5 py-1.5 text-[12px] text-canvas shadow-md">
      {PLATFORM_LABELS[p.platform]} · {fmtNumber(p.value)} {METRIC_LABELS[metric].toLowerCase()}
    </div>
  );
}

export function DataUrlDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useDataUrl(id);
  const update = useUpdateDataUrl();
  const delDataUrl = useDeleteDataUrl();
  const delLink = useDeleteLink(id);
  const syncLink = useSyncLink(id);
  const syncAll = useSyncAll(id);
  const syncingId = syncLink.isPending ? syncLink.variables?.id : null;

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DataUrlLink | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<DataUrlLink | null>(null);
  const [historyLink, setHistoryLink] = useState<DataUrlLink | null>(null);
  const [commentLinkId, setCommentLinkId] = useState<string | undefined>();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chartMetric, setChartMetric] = useState<Metric>('views');
  const [linkPage, setLinkPage] = useState(1);
  const [linkPageSize, setLinkPageSize] = useState(DEFAULT_PAGE_SIZE);

  // link sudah dimuat semua (dibutuhkan grafik), jadi tabelnya dipaginasi di client
  const linkCount = data?.links.length ?? 0;
  const linkPageCount = Math.max(1, Math.ceil(linkCount / linkPageSize));
  const currentLinkPage = Math.min(linkPage, linkPageCount); // tetap valid setelah link dihapus
  const pagedLinks = useMemo(
    () => data?.links.slice((currentLinkPage - 1) * linkPageSize, currentLinkPage * linkPageSize) ?? [],
    [data, currentLinkPage, linkPageSize],
  );

  const byPlatform = useMemo(() => {
    const map = new Map<Platform, number>();
    data?.links.forEach((l) => map.set(l.platform, (map.get(l.platform) ?? 0) + l[chartMetric]));
    return [...map].map(([platform, value]) => ({ platform, label: PLATFORM_LABELS[platform], value })).sort((a, b) => b.value - a.value);
  }, [data, chartMetric]);

  if (isLoading) {
    return (
      <div className="mt-3 space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-shell" />
        <div className="h-72 animate-pulse rounded-3xl bg-shell" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mt-3 flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-3xl bg-shell text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><TriangleAlert size={22} /></span>
        <div className="font-medium">Data Url tidak dapat dimuat</div>
        <div className="text-[14px] text-ink-2">{error?.message}</div>
        <Link to="/data-url" className="rounded-xl border border-line bg-card px-4 py-2 text-[14px] transition-colors hover:text-accent">Kembali ke daftar</Link>
      </div>
    );
  }

  const er = engagementRate(data.totals);
  const syncableCount = data.links.filter((l) => isSyncable(l.platform)).length;
  const openAddLink = () => setBulkOpen(true);
  const linkGrid = 'grid grid-cols-[140px_minmax(280px,1fr)_repeat(5,78px)_64px_96px_190px] items-center gap-3';

  return (
    <div className="mt-3 space-y-4">
      <FadeIn>
        <section className="rounded-3xl bg-shell p-5">
          <Link to="/data-url" className="inline-flex items-center gap-1.5 rounded-lg px-1 text-[14px] text-ink-2 transition-colors hover:text-ink">
            <ArrowLeft size={16} /> Semua Data Url
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4 px-1">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="truncate text-[24px] font-medium tracking-tight">{data.title}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${data.isActive ? 'bg-good-soft text-good' : 'bg-card text-ink-3'}`}>
                  {data.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.tags.map((t) => <span key={t} className="rounded-md bg-blue-soft px-2 py-0.5 text-[13px] text-blue">#{t}</span>)}
                {!data.tags.length && <span className="text-[13px] text-ink-3">Tanpa tag</span>}
              </div>
              <p className="mt-2 text-[13px] text-ink-3">
                Dibuat {fmtDateTime(data.createdAt)}{data.createdBy && ` oleh ${data.createdBy.fullName}`} · diperbarui {fmtRelative(data.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-sm">
                <Switch checked={data.isActive} label="Aktif" onCheckedChange={(v) => update.mutate({ id: data.id, isActive: v })} />
                <span className="text-[14px]">Aktif</span>
              </div>
              <button onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[14px] transition-colors hover:border-ink-3/50">
                <Pencil size={15} /> Edit
              </button>
              <MoreMenu items={[{ label: 'Hapus Data Url', icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirmDelete(true) }]} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {METRICS.map((m) => (
              <motion.div key={m} whileHover={{ y: -2 }} className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
                <div className="flex items-center gap-2 text-[13px] text-ink-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${METRIC_TONES[m]}`}>{METRIC_ICONS[m]}</span>
                  {METRIC_LABELS[m]}
                </div>
                <Tip label={fmtNumber(data.totals[m])}>
                  <div className="mt-2 text-[22px] font-medium tracking-tight"><CountUp value={fmtCompact(data.totals[m]).replace(',', '.')} /></div>
                </Tip>
              </motion.div>
            ))}
            <motion.div whileHover={{ y: -2 }} className="rounded-2xl bg-ink px-4 py-3.5 text-canvas shadow-sm">
              <div className="text-[13px] opacity-70">Engagement rate</div>
              <div className="mt-2 text-[22px] font-medium tracking-tight"><CountUp value={er.toFixed(2)} />%</div>
              <div className="text-[11px] opacity-60">(likes+comments+shares+saves) / views</div>
            </motion.div>
          </div>
        </section>
      </FadeIn>

      {byPlatform.length > 0 && (
        <FadeIn delay={0.08}>
          <section className="rounded-3xl bg-shell p-5">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-[18px] font-medium">Per platform</h3>
              <RangeSelect value={METRIC_LABELS[chartMetric]} options={METRICS.map((m) => METRIC_LABELS[m])}
                onChange={(label) => setChartMetric(METRICS.find((m) => METRIC_LABELS[m] === label)!)} />
            </div>
            <div className="h-[220px] rounded-2xl bg-card p-3 shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPlatform} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-2)', fontSize: 13 }} />
                  <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={fmtCompact} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                  <Tooltip content={<ChartTip metric={chartMetric} />} cursor={{ fill: 'var(--shell)', radius: 10 }} />
                  <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={64} animationDuration={900} className="cursor-pointer">
                    {byPlatform.map((p) => <Cell key={p.platform} fill={PLATFORM_COLORS[p.platform]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </FadeIn>
      )}

      <FadeIn delay={0.11}><DataUrlHistoryCard dataUrlId={data.id} /></FadeIn>

      <FadeIn delay={0.14}>
        <section className="rounded-3xl bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h3 className="text-[18px] font-medium">Link postingan <span className="text-ink-3">({data.links.length})</span></h3>
            <div className="flex items-center gap-2">
              {data.links.some((l) => supportsComments(l.platform)) && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setCommentLinkId(undefined); setCommentsOpen(true); }}
                  className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[14px] transition-colors hover:border-ink-3/50 hover:bg-shell">
                  <MessageSquareText size={15} /> Komentar
                </motion.button>
              )}
              {syncableCount > 0 && (
                <Tip label={`Tarik analitik terbaru ${syncableCount} link (${SYNCABLE_PLATFORMS.map((p) => PLATFORM_LABELS[p]).join(', ')})`}>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => syncAll.mutate()} disabled={syncAll.isPending}
                    className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[14px] transition-colors hover:border-ink-3/50 hover:bg-shell disabled:cursor-wait disabled:opacity-70">
                    <RefreshCw size={15} className={syncAll.isPending ? 'animate-spin' : ''} />
                    {syncAll.isPending ? 'Menyinkronkan...' : 'Sinkron semua'}
                  </motion.button>
                </Tip>
              )}
              <motion.button whileTap={{ scale: 0.97 }} onClick={openAddLink}
                className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[14px] font-medium text-white transition-[filter] hover:brightness-110">
                <Plus size={16} /> Tambah link
              </motion.button>
            </div>
          </div>

          {data.links.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-shell text-ink-3"><Link2 size={20} /></span>
              <div><div className="font-medium">Belum ada link</div><div className="text-[14px] text-ink-2">Tambahkan link postingan untuk mulai memantau analitiknya.</div></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1300px] px-4 pb-2">
                <div className={`${linkGrid} px-2 py-3 font-mono text-[11px] uppercase tracking-wider text-ink-3`}>
                  <span>Platform</span><span>Link</span>
                  {METRICS.map((m) => <span key={m} className="text-right">{METRIC_LABELS[m]}</span>)}
                  <span className="text-right">ER</span><span>Sinkron</span><span />
                </div>
                <AnimatePresence initial={false}>
                  {pagedLinks.map((l) => (
                    <motion.div key={l.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}
                      className={`${linkGrid} group rounded-xl border-t border-line px-2 py-3 text-[14px] transition-colors hover:bg-shell/60`}>
                      <PlatformBadge platform={l.platform} />
                      <div className="flex min-w-0 items-center gap-1">
                        {l.meta?.cover && (
                          <img src={l.meta.cover} alt="" loading="lazy" referrerPolicy="no-referrer"
                            className="mr-1.5 h-10 w-10 shrink-0 rounded-lg bg-shell object-cover" />
                        )}
                        <div className="min-w-0">
                          <a href={l.url} target="_blank" rel="noopener noreferrer"
                            className="block truncate text-ink-2 underline-offset-2 transition-colors hover:text-accent hover:underline">
                            {l.url.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                          {l.meta && (
                            <Tip label={<span className="block max-w-[320px] whitespace-pre-wrap">{l.meta.text || '(tanpa teks)'}</span>}>
                              <div className="truncate text-[12px] text-ink-3">
                                <span className="font-medium text-ink-2">@{l.meta.author}</span>
                                {l.meta.authorVerified && <BadgeCheck size={12} className="mx-0.5 inline text-blue" />}
                                {l.meta.postedAt && <> · {fmtDate(l.meta.postedAt)}</>}
                                {l.meta.text && <> · {l.meta.text}</>}
                              </div>
                            </Tip>
                          )}
                        </div>
                        <Tip label="Salin link">
                          <button onClick={() => { navigator.clipboard.writeText(l.url); toast.success('Link disalin'); }} aria-label="Salin link"
                            className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-ink group-hover:opacity-100">
                            <Copy size={13} />
                          </button>
                        </Tip>
                        <Tip label="Buka di tab baru">
                          <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label="Buka link"
                            className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-ink group-hover:opacity-100">
                            <ExternalLink size={13} />
                          </a>
                        </Tip>
                      </div>
                      {METRICS.map((m) => (
                        <Tip key={m} label={fmtNumber(l[m])}>
                          <span className="text-right font-mono tabular-nums">{fmtCompact(l[m])}</span>
                        </Tip>
                      ))}
                      <span className="text-right tabular-nums text-ink-2">{fmtPercent(engagementRate(l))}</span>
                      {isAwaitingSync(l) && !syncAll.isPending && syncingId !== l.id ? (
                        <Tip label="Link baru — analitik sedang ditarik dari apidirect">
                          <span className="inline-flex items-center gap-1 text-[13px] text-blue">
                            <RefreshCw size={12} className="animate-spin" /> Menyinkron…
                          </span>
                        </Tip>
                      ) : l.lastSyncError ? (
                        <Tip label={<span className="block max-w-[260px]">Sinkron terakhir gagal: {l.lastSyncError}</span>}>
                          <span className="inline-flex items-center gap-1 text-[13px] text-accent">
                            <TriangleAlert size={13} /> Gagal
                          </span>
                        </Tip>
                      ) : (
                        <Tip label={l.lastSyncedAt ? fmtDateTime(l.lastSyncedAt) : 'Belum pernah'}>
                          <span className="text-[13px] text-ink-3">{l.lastSyncedAt ? fmtRelative(l.lastSyncedAt) : '–'}</span>
                        </Tip>
                      )}
                      <div className="flex justify-end gap-1">
                        {isSyncable(l.platform) && (
                          <Tip label="Sinkron dari apidirect">
                            <button
                              onClick={() => syncLink.mutate(l)}
                              disabled={syncingId === l.id || syncAll.isPending}
                              aria-label="Sinkron analitik"
                              className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-card hover:text-ink disabled:cursor-wait"
                            >
                              <RefreshCw size={15} className={syncingId === l.id || syncAll.isPending ? 'animate-spin' : ''} />
                            </button>
                          </Tip>
                        )}
                        {supportsComments(l.platform) && (
                          <Tip label="Lihat komentar">
                            <button onClick={() => { setCommentLinkId(l.id); setCommentsOpen(true); }}
                              aria-label="Komentar link" className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-card hover:text-ink">
                              <MessageSquareText size={15} />
                            </button>
                          </Tip>
                        )}
                        <Tip label="Riwayat analitik">
                          <button onClick={() => setHistoryLink(l)} aria-label="Riwayat link"
                            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-card hover:text-ink">
                            <ChartLine size={15} />
                          </button>
                        </Tip>
                        <Tip label="Edit manual">
                          <button onClick={() => { setEditingLink(l); setLinkOpen(true); }} aria-label="Edit link"
                            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-card hover:text-ink">
                            <Pencil size={15} />
                          </button>
                        </Tip>
                        <Tip label="Hapus link">
                          <button onClick={() => setLinkToDelete(l)} aria-label="Hapus link"
                            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-card hover:text-accent">
                            <Trash2 size={15} />
                          </button>
                        </Tip>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
          <Pagination page={currentLinkPage} pageSize={linkPageSize} total={linkCount} unit="link"
            onPageChange={setLinkPage} onPageSizeChange={(s) => { setLinkPageSize(s); setLinkPage(1); }} />
        </section>
      </FadeIn>

      <DataUrlFormDialog open={editOpen} onOpenChange={setEditOpen} dataUrl={data} />
      <BulkLinksDialog open={bulkOpen} onOpenChange={setBulkOpen} dataUrlId={data.id} existing={data.links.map((l) => l.url)} />
      <CommentsDialog dataUrlId={data.id} links={data.links} open={commentsOpen} onOpenChange={setCommentsOpen}
        linkId={commentLinkId} onLinkChange={setCommentLinkId} />
      <LinkHistoryDialog dataUrlId={data.id} link={historyLink} onClose={() => setHistoryLink(null)} />
      <LinkFormDialog open={linkOpen} onOpenChange={setLinkOpen} dataUrlId={data.id} link={editingLink} />

      <Confirm
        open={!!linkToDelete}
        onOpenChange={(o) => !o && setLinkToDelete(null)}
        icon={<Trash2 size={22} />}
        title="Hapus link ini?"
        description={<>Link <b className="break-all font-medium text-ink">{linkToDelete?.url}</b> dan data analitiknya akan dihapus.</>}
        confirmLabel="Hapus link"
        loading={delLink.isPending}
        onConfirm={() => linkToDelete && delLink.mutate(linkToDelete, { onSuccess: () => setLinkToDelete(null) })}
      />
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        icon={<Trash2 size={22} />}
        title="Hapus Data Url ini?"
        description={<><b className="font-medium text-ink">{data.title}</b> beserta {data.links.length} link akan dihapus permanen.</>}
        confirmLabel="Hapus"
        loading={delDataUrl.isPending}
        onConfirm={() => delDataUrl.mutate(data, { onSuccess: () => navigate('/data-url', { replace: true }) })}
      />
    </div>
  );
}
