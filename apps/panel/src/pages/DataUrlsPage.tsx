import { type DataUrl, DEFAULT_PAGE_SIZE, engagementRate, PLATFORM_LABELS, PLATFORMS, type Platform } from '@sig/shared';
import {
  ArrowRight, Eye, Heart, Link2, MessageCircle, Pencil, Plus, RotateCw, Search, Trash2, TriangleAlert, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ComponentProps, type ReactNode, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DataUrlFormDialog } from '../components/data-urls/DataUrlFormDialog';
import { PlatformDot, PlatformStack } from '../components/data-urls/Platform';
import { CountUp, FadeIn } from '../components/motion';
import { Confirm } from '../components/ui/dialog';
import { Menu, MoreMenu } from '../components/ui/dropdown';
import { Switch } from '../components/ui/switch';
import { Tip } from '../components/ui/tooltip';
import { Pagination } from '../components/ui/pagination';
import { useDataUrls, useDataUrlTags, useDeleteDataUrl, useUpdateDataUrl } from '../lib/dataUrls';
import { fmtCompact, fmtDateTime, fmtNumber, fmtPercent, fmtRelative } from '../lib/format';

type Status = 'all' | 'active' | 'inactive';

function StatCard({ label, value, icon, tone, suffix }: { label: string; value: string; icon: ReactNode; tone: string; suffix?: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[13px] text-ink-2">{label}</div>
        <div className="text-[22px] font-medium leading-tight tracking-tight">
          <CountUp value={value} duration={0.9} />{suffix}
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <Tip label={fmtNumber(value)}>
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <span className="text-ink-3">{icon}</span>{fmtCompact(value)}
      </span>
    </Tip>
  );
}

function FilterButton({ active, children, ...props }: { active: boolean; children: ReactNode } & ComponentProps<'button'>) {
  return (
    <button {...props} className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[14px] transition-colors hover:border-ink-3/50 ${
      active ? 'border-ink bg-shell text-ink' : 'border-line bg-card text-ink-2'
    }`}>
      {children}
    </button>
  );
}

export function DataUrlsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [platform, setPlatform] = useState<Platform | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // filter berubah → kembali ke halaman 1
  useEffect(() => setPage(1), [deferredSearch, platform, tag, status, pageSize]);

  const query = {
    search: deferredSearch || undefined,
    platform,
    tag,
    isActive: status === 'all' ? undefined : (status === 'active' ? 'true' : 'false') as 'true' | 'false',
    page,
    pageSize,
  };
  const { data: result, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useDataUrls(query);
  const data = result?.items ?? [];
  const { data: allTags = [] } = useDataUrlTags();

  // halaman jadi kosong (mis. setelah hapus item terakhir) → mundur ke halaman terakhir yang ada
  useEffect(() => {
    if (result && page > result.pageCount) setPage(result.pageCount);
  }, [result, page]);

  const update = useUpdateDataUrl();
  const del = useDeleteDataUrl();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DataUrl | null>(null);
  const [toDelete, setToDelete] = useState<DataUrl | null>(null);

  // ringkasan dihitung server untuk seluruh hasil filter, bukan hanya halaman aktif
  const stats = useMemo(() => {
    const s = result?.summary ?? { count: 0, links: 0, totals: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 } };
    return { ...s, er: engagementRate(s.totals) };
  }, [result]);

  const hasFilter = !!search || !!platform || !!tag || status !== 'all';
  const resetFilter = () => { setSearch(''); setPlatform(undefined); setTag(undefined); setStatus('all'); };

  const grid = 'grid grid-cols-[minmax(240px,2.2fr)_110px_70px_minmax(260px,1.6fr)_80px_120px_110px_84px] items-center gap-4';

  return (
    <div className="mt-3 space-y-4">
      <FadeIn>
        <section className="rounded-3xl bg-shell p-5">
          <div className="flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <h2 className="text-[22px] font-medium tracking-tight">Data Url</h2>
              <p className="mt-0.5 text-[14px] text-ink-2">Kumpulkan link postingan per kampanye dan pantau analitiknya.</p>
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_20px_-10px_var(--accent)] transition-[filter] hover:brightness-110">
              <Plus size={18} /> Tambah Data Url
            </motion.button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard label="Data Url" value={String(stats.count)} icon={<Link2 size={18} />} tone="bg-shell text-ink" suffix={` · ${stats.links} link`} />
            <StatCard label="Total views" value={fmtNumber(stats.totals.views).replace(/\./g, ',')} icon={<Eye size={18} />} tone="bg-blue-soft text-blue" />
            <StatCard label="Total likes" value={fmtNumber(stats.totals.likes).replace(/\./g, ',')} icon={<Heart size={18} />} tone="bg-accent-soft text-accent" />
            <StatCard label="Engagement rate" value={stats.er.toFixed(2)} suffix="%" icon={<MessageCircle size={18} />} tone="bg-good-soft text-good" />
          </div>
        </section>
      </FadeIn>

      <FadeIn delay={0.1}>
        <section className="rounded-3xl bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3 transition-[border-color,box-shadow] focus-within:border-ink-3 focus-within:ring-4 focus-within:ring-ink/5 sm:max-w-[320px]">
              <Search size={16} className="text-ink-3" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul..."
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
              {search && <button onClick={() => setSearch('')} aria-label="Hapus pencarian" className="rounded p-0.5 text-ink-3 hover:text-ink"><X size={14} /></button>}
            </label>

            <Menu align="start"
              items={[{ label: 'Semua platform', onSelect: () => setPlatform(undefined) },
                ...PLATFORMS.map((p) => ({ label: PLATFORM_LABELS[p], icon: <PlatformDot platform={p} size={18} className="ring-0" />, onSelect: () => setPlatform(p) }))]}
              trigger={<FilterButton active={!!platform}>
                <span className="text-ink-3">Platform:</span>
                {platform ? <><PlatformDot platform={platform} size={18} className="ring-0" /> {PLATFORM_LABELS[platform]}</> : 'Semua'}
              </FilterButton>} />

            <Menu align="start"
              items={[{ label: 'Semua tag', onSelect: () => setTag(undefined) }, ...allTags.map((t) => ({ label: `#${t}`, onSelect: () => setTag(t) }))]}
              trigger={<FilterButton active={!!tag}><span className="text-ink-3">Tag:</span> {tag ? `#${tag}` : 'Semua'}</FilterButton>} />

            <Menu align="start"
              items={[{ label: 'Semua', onSelect: () => setStatus('all') }, { label: 'Aktif', onSelect: () => setStatus('active') }, { label: 'Nonaktif', onSelect: () => setStatus('inactive') }]}
              trigger={<FilterButton active={status !== 'all'}>
                <span className="text-ink-3">Status:</span> {{ all: 'Semua', active: 'Aktif', inactive: 'Nonaktif' }[status]}
              </FilterButton>} />

            {hasFilter && (
              <button onClick={resetFilter} className="h-10 rounded-xl px-3 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">Reset filter</button>
            )}
            <Tip label="Muat ulang">
              <button onClick={() => refetch()} aria-label="Muat ulang"
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-shell hover:text-ink">
                <RotateCw size={16} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </Tip>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1180px] px-4 pb-2">
              <div className={`${grid} px-2 py-3 font-mono text-[11px] uppercase tracking-wider text-ink-3`}>
                <span>Judul & tag</span><span>Platform</span><span>Link</span><span>Analitik</span><span>ER</span><span>Status</span><span>Diperbarui</span><span />
              </div>

              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`${grid} border-t border-line px-2 py-4`}>
                  <div className="space-y-2"><div className="h-3 w-48 rounded bg-shell" /><div className="h-2.5 w-28 rounded bg-shell" /></div>
                  {Array.from({ length: 6 }).map((__, j) => <div key={j} className="h-3 w-14 rounded bg-shell" />)}
                  <span />
                </div>
              ))}

              {isError && (
                <div className="flex flex-col items-center gap-3 border-t border-line py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><TriangleAlert size={22} /></span>
                  <div><div className="font-medium">Gagal memuat Data Url</div><div className="text-[14px] text-ink-2">{error.message}</div></div>
                  <button onClick={() => refetch()} className="rounded-xl border border-line px-4 py-2 text-[14px] transition-colors hover:bg-shell">Coba lagi</button>
                </div>
              )}

              {!isLoading && !isError && data.length === 0 && (
                <div className="flex flex-col items-center gap-3 border-t border-line py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-shell text-ink-3"><Link2 size={20} /></span>
                  <div>
                    <div className="font-medium">{hasFilter ? 'Tidak ada Data Url yang cocok' : 'Belum ada Data Url'}</div>
                    <div className="text-[14px] text-ink-2">{hasFilter ? 'Coba ubah kata kunci atau filter.' : 'Mulai dengan menambahkan kampanye pertama.'}</div>
                  </div>
                  {!hasFilter && (
                    <button onClick={() => { setEditing(null); setFormOpen(true); }}
                      className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white hover:brightness-110">
                      <Plus size={16} /> Tambah Data Url
                    </button>
                  )}
                </div>
              )}

              <AnimatePresence initial={false}>
                {data.map((d) => (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: d.isActive ? 1 : 0.6, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/data-url/${d.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/data-url/${d.id}`)}
                    className={`${grid} group cursor-pointer rounded-xl border-t border-line px-2 py-3.5 text-[14px] outline-none transition-colors hover:bg-shell/60 focus-visible:bg-shell/60`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium transition-colors group-hover:text-accent">{d.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.tags.length ? d.tags.slice(0, 4).map((t) => (
                          <button key={t} onClick={(e) => { e.stopPropagation(); setTag(t); }}
                            className="rounded-md bg-blue-soft px-1.5 py-px text-[12px] text-blue transition-colors hover:bg-blue/20">
                            #{t}
                          </button>
                        )) : <span className="text-[12px] text-ink-3">Tanpa tag</span>}
                        {d.tags.length > 4 && <span className="text-[12px] text-ink-3">+{d.tags.length - 4}</span>}
                      </div>
                    </div>
                    <PlatformStack platforms={d.platforms} />
                    <span className="tabular-nums">{d.linkCount}</span>
                    <div className="flex gap-4 text-ink-2">
                      <Metric icon={<Eye size={14} />} value={d.totals.views} />
                      <Metric icon={<Heart size={14} />} value={d.totals.likes} />
                      <Metric icon={<MessageCircle size={14} />} value={d.totals.comments} />
                    </div>
                    <span className="tabular-nums text-ink-2">{fmtPercent(engagementRate(d.totals))}</span>
                    <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={d.isActive} label={d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        onCheckedChange={(v) => update.mutate({ id: d.id, isActive: v })} />
                      <span className={`text-[13px] ${d.isActive ? 'text-pos' : 'text-ink-3'}`}>{d.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </span>
                    <Tip label={fmtDateTime(d.updatedAt)}><span className="text-ink-2">{fmtRelative(d.updatedAt)}</span></Tip>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tip label="Lihat detail">
                        <button onClick={() => navigate(`/data-url/${d.id}`)} aria-label="Detail"
                          className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-card hover:text-ink">
                          <ArrowRight size={16} />
                        </button>
                      </Tip>
                      <MoreMenu items={[
                        { label: 'Edit', icon: <Pencil size={14} />, onSelect: () => { setEditing(d); setFormOpen(true); } },
                        'separator',
                        { label: 'Hapus', icon: <Trash2 size={14} />, danger: true, onSelect: () => setToDelete(d) },
                      ]} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {result && (
            <Pagination page={page} pageSize={pageSize} total={result.total} unit="Data Url" loading={isPlaceholderData}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </section>
      </FadeIn>

      <DataUrlFormDialog open={formOpen} onOpenChange={setFormOpen} dataUrl={editing}
        onCreated={(id) => navigate(`/data-url/${id}`)} />

      <Confirm
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        icon={<Trash2 size={22} />}
        title="Hapus Data Url ini?"
        description={<><b className="font-medium text-ink">{toDelete?.title}</b> beserta {toDelete?.linkCount} link dan seluruh data analitiknya akan dihapus permanen.</>}
        confirmLabel="Hapus"
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  );
}
