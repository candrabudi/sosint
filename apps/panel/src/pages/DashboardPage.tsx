import { ANALYTICS_RANGE_LABELS, ANALYTICS_RANGES, type AnalyticsRange, PLATFORM_LABELS, PLATFORMS, type Platform } from '@sig/shared';
import { Link2, Plus, RotateCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  CampaignRanking, KpiStrip, PlatformComparison, Sentiment, SyncChip, TopAuthors, TopGrowers, TopHashtags, TopPosts, TrendChart,
} from '../components/dashboard/widgets';
import { PlatformDot } from '../components/data-urls/Platform';
import { FadeIn } from '../components/motion';
import { Menu } from '../components/ui/dropdown';
import { Tip } from '../components/ui/tooltip';
import { useAnalyticsOverview } from '../lib/analytics';
import { useDataUrls } from '../lib/dataUrls';

const filterBtn = (active: boolean) =>
  `flex h-10 max-w-[260px] items-center gap-1.5 truncate rounded-xl border px-3 text-[14px] transition-colors hover:border-ink-3/50 ${
    active ? 'border-ink bg-card text-ink' : 'border-line bg-card text-ink-2'
  }`;

export function DashboardPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [platform, setPlatform] = useState<Platform | undefined>();
  const [dataUrlId, setDataUrlId] = useState<string | undefined>();

  const { data, isLoading, isError, error, refetch, isFetching } = useAnalyticsOverview({ range, platform, dataUrlId });
  // pilihan filter Data Url (maks. 100 terbaru)
  const { data: campaigns } = useDataUrls({ page: 1, pageSize: 100 });
  const campaign = campaigns?.items.find((c) => c.id === dataUrlId);
  const hasFilter = !!platform || !!dataUrlId;

  return (
    <div className="mt-3 space-y-4">
      {/* filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-shell p-1">
          {ANALYTICS_RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-[14px] transition-colors ${range === r ? 'bg-card text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
              {ANALYTICS_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <Menu align="start"
          items={[{ label: 'Semua platform', onSelect: () => setPlatform(undefined) },
            ...PLATFORMS.map((p) => ({ label: PLATFORM_LABELS[p], icon: <PlatformDot platform={p} size={18} className="ring-0" />, onSelect: () => setPlatform(p) }))]}
          trigger={<button className={filterBtn(!!platform)}>
            <span className="text-ink-3">Platform:</span>
            {platform ? <><PlatformDot platform={platform} size={18} className="ring-0" /> {PLATFORM_LABELS[platform]}</> : 'Semua'}
          </button>} />
        <Menu align="start"
          items={[{ label: 'Semua Data Url', onSelect: () => setDataUrlId(undefined) },
            ...(campaigns?.items ?? []).map((c) => ({ label: c.title, onSelect: () => setDataUrlId(c.id) }))]}
          trigger={<button className={filterBtn(!!dataUrlId)}>
            <span className="text-ink-3">Data Url:</span><span className="truncate">{campaign?.title ?? 'Semua'}</span>
          </button>} />
        {hasFilter && (
          <button onClick={() => { setPlatform(undefined); setDataUrlId(undefined); }}
            className="h-10 rounded-xl px-3 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">Reset filter</button>
        )}
        <span className="ml-auto" />
        {data && <SyncChip sync={data.sync} />}
        <Tip label="Muat ulang">
          <button onClick={() => refetch()} aria-label="Muat ulang"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-shell hover:text-ink ">
            <RotateCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </Tip>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-3xl bg-shell" />
          <div className="h-80 animate-pulse rounded-3xl bg-shell" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-shell py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><TriangleAlert size={22} /></span>
          <div><div className="font-medium">Gagal memuat analitik</div><div className="text-[14px] text-ink-2">{error.message}</div></div>
          <button onClick={() => refetch()} className="rounded-xl border border-line px-4 py-2 text-[14px] transition-colors hover:bg-card">Coba lagi</button>
        </div>
      )}

      {data && data.kpis.posts === 0 && !hasFilter && range === 'all' && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-shell py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-ink-3"><Link2 size={20} /></span>
          <div>
            <div className="font-medium">Belum ada data untuk dianalisis</div>
            <div className="text-[14px] text-ink-2">Tambahkan Data Url berisi link postingan, analitiknya akan muncul di sini.</div>
          </div>
          <Link to="/data-url" className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white hover:brightness-110">
            <Plus size={16} /> Tambah Data Url
          </Link>
        </div>
      )}

      {data && !(data.kpis.posts === 0 && !hasFilter && range === 'all') && (
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
          <FadeIn><KpiStrip kpis={data.kpis} previous={data.previous} growth={data.growth} previousGrowth={data.previousGrowth} /></FadeIn>
          <FadeIn delay={0.06}>
            <TrendChart data={data.timeline} bucket={data.bucket} hasPrev={!!data.previous} hasHistory={!!data.growth.trackingSince} />
          </FadeIn>
          <FadeIn delay={0.1}><PlatformComparison data={data.byPlatform} /></FadeIn>
          <div className="grid gap-4 lg:grid-cols-2">
            <FadeIn delay={0.14} className="h-full"><TopGrowers data={data.topGrowers} hasHistory={!!data.growth.trackingSince} /></FadeIn>
            <FadeIn delay={0.16} className="h-full"><TopPosts data={data.topPosts} /></FadeIn>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FadeIn delay={0.18} className="h-full"><TopAuthors data={data.topAuthors} /></FadeIn>
            <div className="flex flex-col gap-4">
              <FadeIn delay={0.2}><CampaignRanking data={data.campaigns} /></FadeIn>
              <FadeIn delay={0.22} className="flex-1"><TopHashtags data={data.topHashtags} /></FadeIn>
            </div>
          </div>
          <FadeIn delay={0.24}><Sentiment data={data.sentiment} /></FadeIn>
        </div>
      )}
    </div>
  );
}
