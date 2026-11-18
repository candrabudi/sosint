import {
  type AnalyticsGrowth, type AnalyticsKpis, type AnalyticsOverview, PLATFORM_LABELS, type Platform, type PlatformStats,
  type TimelineMetric,
} from '@sig/shared';
import { ArrowDownRight, ArrowUpRight, BadgeCheck, ExternalLink, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, type TooltipContentProps, XAxis, YAxis,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { fmtCompact, fmtDate, fmtNumber, fmtPercent, fmtRelative } from '../../lib/format';
import { PLATFORM_COLORS, PlatformDot } from '../data-urls/Platform';
import { CountUp } from '../motion';
import { Tip } from '../ui/tooltip';

// ---------- dasar ----------

export function Card({ title, aside, children, className = '' }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex h-full flex-col rounded-3xl bg-shell p-3 pt-4 ${className}`}>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 px-3 pb-3">
        <h3 className="text-[17px] font-medium">{title}</h3>
        {aside}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center rounded-2xl bg-card px-4 py-10 text-center text-[14px] text-ink-3 shadow-sm">{children}</div>;
}

/** Tombol segmen kecil (pemilih metrik / mode). */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-card p-1 shadow-sm">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-2.5 py-1 text-[13px] transition-colors ${value === o.value ? 'bg-ink text-canvas' : 'text-ink-2 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const axisTick = { fill: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };

// ---------- KPI ----------

function Delta({ now, prev, percentPoint }: { now: number; prev?: number; percentPoint?: boolean }) {
  if (prev === undefined) return null;
  if (prev === 0 && !percentPoint) {
    return <Tip label="Periode sebelumnya belum ada data"><span className="text-[12px] text-ink-3">{now > 0 ? 'baru' : '—'}</span></Tip>;
  }
  // ER dibandingkan dalam poin persen; metrik lain dalam % perubahan
  const diff = percentPoint ? now - prev : ((now - prev) / prev) * 100;
  if (Math.abs(diff) < 0.05) return <span className="text-[12px] text-ink-3">±0</span>;
  const up = diff > 0;
  return (
    <Tip label={`Periode sebelumnya: ${percentPoint ? fmtPercent(prev) : fmtNumber(Math.round(prev))}`}>
      <span className={`inline-flex items-center text-[12px] ${up ? 'text-pos' : 'text-accent'}`}>
        {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {up ? '+' : ''}{diff.toLocaleString('id-ID', { maximumFractionDigits: 1 })}{percentPoint ? ' pp' : '%'}
      </span>
    </Tip>
  );
}

export function KpiStrip({ kpis, previous, growth, previousGrowth }: {
  kpis: AnalyticsKpis; previous: AnalyticsKpis | null; growth: AnalyticsGrowth; previousGrowth: AnalyticsGrowth | null;
}) {
  const since = growth.trackingSince ? `riwayat sejak ${fmtDate(growth.trackingSince)}` : 'riwayat belum ada';
  const items: { label: string; value: string; sub: string; now: number; prev?: number; pp?: boolean; accent?: boolean }[] = [
    { label: 'Views bertambah', value: `+${fmtCompact(growth.views)}`, sub: `${growth.tracked} link dipantau · ${since}`, now: growth.views, prev: previousGrowth?.views, accent: true },
    { label: 'Engagement bertambah', value: `+${fmtCompact(growth.engagement)}`, sub: `+${fmtCompact(growth.likes)} like · +${fmtCompact(growth.comments)} komentar`, now: growth.engagement, prev: previousGrowth?.engagement, accent: true },
    { label: 'Total views', value: fmtCompact(kpis.views), sub: `postingan terbit di rentang ini`, now: kpis.views, prev: previous?.views },
    { label: 'Engagement rate', value: fmtPercent(kpis.er), sub: 'engagement ÷ views', now: kpis.er, prev: previous?.er, pp: true },
    { label: 'Postingan', value: fmtNumber(kpis.posts), sub: `${kpis.campaigns} Data Url · ${kpis.authors} akun`, now: kpis.posts, prev: previous?.posts },
    { label: 'Rata-rata views', value: fmtCompact(Math.round(kpis.avgViews)), sub: 'per postingan', now: kpis.avgViews, prev: previous?.avgViews },
  ];
  return (
    // gap-px di atas bg-line = garis pemisah rapi di semua breakpoint
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line shadow-sm sm:grid-cols-3 xl:grid-cols-6">
      {items.map((k, i) => (
        <motion.div key={k.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className="min-w-0 bg-card px-5 py-4">
          <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
            {k.accent && <span className="h-1.5 w-1.5 rounded-full bg-pos" />}{k.label}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[22px] font-medium tracking-tight"><CountUp value={k.value} /></span>
            <Delta now={k.now} prev={k.prev ?? undefined} percentPoint={k.pp} />
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-3">{k.sub}</div>
        </motion.div>
      ))}
    </section>
  );
}

/** Ringkasan status sinkron dalam satu chip (detail di tooltip). */
export function SyncChip({ sync }: { sync: AnalyticsOverview['sync'] }) {
  const total = sync.synced + sync.pending + sync.failed + sync.manual;
  if (!total) return null;
  const parts = [
    { n: sync.synced, color: 'var(--pos)', label: 'Tersinkron' },
    { n: sync.pending, color: 'var(--blue)', label: 'Menunggu' },
    { n: sync.failed, color: 'var(--accent)', label: 'Gagal' },
    { n: sync.manual, color: 'var(--ink-3)', label: 'Manual' },
  ];
  return (
    <Tip label={
      <span className="block space-y-0.5">
        {parts.map((p) => <span key={p.label} className="flex justify-between gap-6"><span>{p.label}</span><span>{p.n}</span></span>)}
        {sync.lastSyncedAt && <span className="block pt-1 opacity-70">Sinkron terakhir {fmtRelative(sync.lastSyncedAt)}</span>}
      </span>
    }>
      <span className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-card px-3 text-[13px] text-ink-2">
        <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-shell">
          {parts.map((p) => p.n > 0 && <span key={p.label} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} />)}
        </span>
        <span><b className="font-medium text-ink">{sync.synced}</b>/{total} tersinkron</span>
        {sync.failed > 0 && <span className="text-accent">· {sync.failed} gagal</span>}
      </span>
    </Tip>
  );
}

// ---------- Tren ----------

const METRIC_OPTS: { value: TimelineMetric; label: string }[] = [
  { value: 'views', label: 'Views' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'posts', label: 'Postingan' },
];
type Compare = 'prev' | 'platform';
type Scale = 'daily' | 'cumulative';

const dayFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const parseDay = (s: string) => new Date(`${s}T00:00:00`);

interface ChartSeries { key: string; label: string; color: string; dashed?: boolean }

function TrendTip({ active, payload, label, series, bucket }: TooltipContentProps<ValueType, NameType> & { series: ChartSeries[]; bucket: 'day' | 'week' }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Record<string, number>;
  return (
    <div className="min-w-[160px] rounded-lg bg-card px-3 py-2 text-[12px] shadow-md">
      <div className="mb-1 font-medium">{bucket === 'week' ? 'Minggu ' : ''}{dayFmt.format(parseDay(String(label)))}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="h-[3px] w-3 rounded-sm" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />{s.label}
          </span>
          <span className="ml-auto font-mono">{fmtNumber(row[s.key] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

type Basis = 'growth' | 'posted';

export function TrendChart({ data, bucket, hasPrev, hasHistory }: {
  data: AnalyticsOverview['timeline']; bucket: 'day' | 'week'; hasPrev: boolean; hasHistory: boolean;
}) {
  const [basis, setBasis] = useState<Basis>(hasHistory ? 'growth' : 'posted');
  const [metricSel, setMetric] = useState<TimelineMetric>('views');
  const [compare, setCompare] = useState<Compare>(hasPrev ? 'prev' : 'platform');
  const [scale, setScale] = useState<Scale>('cumulative');
  const mode: Compare = compare === 'prev' && !hasPrev ? 'platform' : compare;
  // "postingan" hanya bermakna untuk basis tanggal posting
  const metric: TimelineMetric = basis === 'growth' && metricSel === 'posts' ? 'views' : metricSel;

  const platforms = useMemo(
    () => [...new Set(data.flatMap((d) => Object.keys(basis === 'growth' ? d.gainedPlatforms : d.platforms) as Platform[]))],
    [data, basis],
  );

  const { rows, series } = useMemo(() => {
    const series: ChartSeries[] = mode === 'prev'
      ? [{ key: 'now', label: 'Periode ini', color: 'var(--accent)' }, { key: 'prev', label: 'Periode lalu', color: 'var(--ink-3)', dashed: true }]
      : platforms.map((p) => ({ key: p, label: PLATFORM_LABELS[p], color: PLATFORM_COLORS[p] }));
    const m = metric as 'views' | 'engagement' | 'posts';
    const acc: Record<string, number> = {};
    const rows = data.map((d) => {
      let raw: Record<string, number>;
      if (basis === 'growth') {
        const gm = m === 'posts' ? 'views' : m;
        raw = mode === 'prev'
          ? { now: d.gained[gm], prev: d.prevGained?.[gm] ?? 0 }
          : Object.fromEntries(platforms.map((p) => [p, d.gainedPlatforms[p]?.[gm] ?? 0]));
      } else {
        raw = mode === 'prev'
          ? { now: d[m], prev: d.prev?.[m] ?? 0 }
          : Object.fromEntries(platforms.map((p) => [p, d.platforms[p]?.[m] ?? 0]));
      }
      const out: Record<string, number | string> = { date: d.date };
      for (const s of series) {
        acc[s.key] = (scale === 'cumulative' ? acc[s.key] ?? 0 : 0) + raw[s.key];
        out[s.key] = acc[s.key];
      }
      return out;
    });
    return { rows, series };
  }, [data, metric, mode, scale, platforms, basis]);

  const empty = basis === 'growth'
    ? data.every((d) => !d.gained.views && !d.gained.engagement && !d.prevGained?.views)
    : data.every((d) => d.posts === 0) && !data.some((d) => d.prev?.posts);
  const metricLabel = METRIC_OPTS.find((x) => x.value === metric)!.label.toLowerCase();

  return (
    <Card
      title={<>{basis === 'growth' ? `Pertumbuhan ${metricLabel}` : `Tren ${metricLabel}`}
        <span className="ml-1.5 text-[13px] font-normal text-ink-3">
          {basis === 'growth' ? 'kenaikan dari riwayat sinkron' : 'per tanggal posting'} · {bucket === 'day' ? 'harian' : 'mingguan'}
        </span></>}
      aside={
        <div className="flex flex-wrap gap-2">
          <Segmented value={basis} onChange={setBasis}
            options={[{ value: 'growth', label: 'Pertumbuhan' }, { value: 'posted', label: 'Tanggal posting' }]} />
          <Segmented value={metric} onChange={setMetric}
            options={basis === 'growth' ? METRIC_OPTS.filter((x) => x.value !== 'posts') : METRIC_OPTS} />
          <Segmented value={mode} onChange={setCompare}
            options={[...(hasPrev ? [{ value: 'prev' as const, label: 'vs periode lalu' }] : []), { value: 'platform', label: 'Per platform' }]} />
          <Segmented value={scale} onChange={setScale} options={[{ value: 'cumulative', label: 'Kumulatif' }, { value: 'daily', label: 'Per hari' }]} />
        </div>
      }
    >
      {empty ? (
        <Empty>
          {basis === 'growth'
            ? 'Belum ada kenaikan tercatat di rentang ini. Riwayat bertambah setiap sinkron terjadwal berjalan.'
            : 'Belum ada postingan di rentang ini.'}
        </Empty>
      ) : (
        <div className="rounded-2xl bg-card px-2 pt-3 pb-1 shadow-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-1 text-[12px] text-ink-2">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="h-[3px] w-4 rounded-sm" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />{s.label}
              </span>
            ))}
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date" tickFormatter={(d) => dayFmt.format(parseDay(d))} minTickGap={28}
                  axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} dy={6} />
                <YAxis tickFormatter={(v) => fmtCompact(v)} axisLine={false} tickLine={false} width={44} allowDecimals={false} tick={axisTick} />
                <Tooltip content={(p) => <TrendTip {...p} series={series} bucket={bucket} />} cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 4' }} />
                {series.map((s) => (
                  <Line key={`${basis}-${mode}-${s.key}`} dataKey={s.key} type="monotone" stroke={s.color} strokeWidth={s.dashed ? 1.6 : 2.2}
                    strokeDasharray={s.dashed ? '5 5' : undefined} strokeOpacity={s.dashed ? 0.7 : 1} dot={false}
                    activeDot={{ r: 4, fill: 'var(--card)', stroke: s.color, strokeWidth: 2 }} animationDuration={700} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Paling naik ----------

export function TopGrowers({ data, hasHistory }: { data: AnalyticsOverview['topGrowers']; hasHistory: boolean }) {
  return (
    <Card title={<span className="flex items-center gap-2"><TrendingUp size={17} className="text-pos" />Paling naik</span>}
      aside={<span className="text-[13px] text-ink-3">kenaikan views di rentang ini</span>}>
      {data.length === 0 ? (
        <Empty>{hasHistory ? 'Belum ada kenaikan di rentang ini.' : 'Muncul setelah sinkron terjadwal mencatat riwayat.'}</Empty>
      ) : (
        <div className="flex-1 overflow-hidden rounded-2xl bg-card shadow-sm">
          {data.map((p, i) => (
            <div key={p.id} className={`group flex items-center gap-3 px-4 py-2.5 text-[14px] ${i ? 'border-t border-line' : ''}`}>
              <span className="w-4 shrink-0 text-center font-mono text-[12px] text-ink-3">{i + 1}</span>
              <span className="relative shrink-0">
                {p.cover
                  ? <img src={p.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg bg-shell object-cover" />
                  : <span className="block h-10 w-10 rounded-lg bg-shell" />}
                <PlatformDot platform={p.platform} size={16} className="absolute -right-1 -bottom-1" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.author ? `@${p.author}` : p.url.replace(/^https?:\/\/(www\.)?/, '')}</div>
                <div className="truncate text-[12px] text-ink-3">
                  <Link to={`/data-url/${p.dataUrlId}`} className="hover:text-accent">{p.campaign}</Link> · total {fmtCompact(p.views)} views
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Tip label={`+${fmtNumber(p.gainedViews)} views · +${fmtNumber(p.gainedEngagement)} engagement`}>
                  <div className="font-mono tabular-nums text-pos">+{fmtCompact(p.gainedViews)}</div>
                </Tip>
                <div className="text-[11px] text-ink-3">{p.gainedPct != null ? `+${p.gainedPct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : 'postingan baru'}</div>
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Buka postingan"
                className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-ink group-hover:opacity-100 focus-visible:opacity-100">
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------- Perbandingan platform ----------

type PlatformMetric = 'avgViews' | 'er' | 'avgEngagement' | 'share';
const PLATFORM_METRICS: { value: PlatformMetric; label: string; fmt: (n: number) => string }[] = [
  { value: 'avgViews', label: 'Avg views/post', fmt: (n) => fmtCompact(Math.round(n)) },
  { value: 'er', label: 'ER', fmt: fmtPercent },
  { value: 'avgEngagement', label: 'Avg engagement/post', fmt: (n) => fmtNumber(Math.round(n * 10) / 10) },
  { value: 'share', label: 'Porsi views', fmt: (n) => `${n.toFixed(1)}%` },
];

export function PlatformComparison({ data }: { data: PlatformStats[] }) {
  const [metric, setMetric] = useState<PlatformMetric>('avgViews');
  const m = PLATFORM_METRICS.find((x) => x.value === metric)!;
  const chart = [...data].sort((a, b) => b[metric] - a[metric]).map((p) => ({ ...p, label: PLATFORM_LABELS[p.platform] }));
  const best = (k: keyof PlatformStats) => data.reduce((a, p) => ((p[k] as number) > (a[k] as number) ? p : a), data[0])?.platform;
  const cols = 'grid grid-cols-[minmax(120px,1.4fr)_repeat(5,minmax(64px,1fr))] items-center gap-3';

  return (
    <Card title="Perbandingan platform"
      aside={<span className="text-[13px] text-ink-3">rata-rata per postingan agar adil antar jumlah post</span>}>
      {data.length === 0 ? <Empty>Belum ada data.</Empty> : (
        <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
          <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
            <div className="min-w-[560px] px-4">
              <div className={`${cols} py-3 font-mono text-[11px] uppercase tracking-wider text-ink-3`}>
                <span>Platform</span><span className="text-right">Post</span><span className="text-right">Views</span>
                <span className="text-right">Avg views</span><span className="text-right">Avg eng.</span><span className="text-right">ER</span>
              </div>
              {data.map((p) => (
                <div key={p.platform} className={`${cols} border-t border-line py-3 text-[14px]`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PlatformDot platform={p.platform} size={22} className="ring-0" />
                      <span className="truncate font-medium">{PLATFORM_LABELS[p.platform]}</span>
                    </div>
                    <div className="mt-1.5 ml-[30px] h-1 overflow-hidden rounded-full bg-shell">
                      <div className="h-full rounded-full" style={{ width: `${p.share}%`, background: PLATFORM_COLORS[p.platform] }} />
                    </div>
                  </div>
                  <span className="text-right tabular-nums text-ink-2">{p.posts}</span>
                  <Tip label={`${fmtNumber(p.views)} · ${p.share.toFixed(1)}% dari total`}><span className="text-right font-mono tabular-nums">{fmtCompact(p.views)}</span></Tip>
                  <Highlight on={best('avgViews') === p.platform}>{fmtCompact(Math.round(p.avgViews))}</Highlight>
                  <Highlight on={best('avgEngagement') === p.platform}>{fmtNumber(Math.round(p.avgEngagement * 10) / 10)}</Highlight>
                  <Highlight on={best('er') === p.platform}>{fmtPercent(p.er)}</Highlight>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-card p-3 shadow-sm">
            <select value={metric} onChange={(e) => setMetric(e.target.value as PlatformMetric)}
              className="self-start rounded-lg border border-line bg-card px-2 py-1 text-[13px] text-ink outline-none">
              {PLATFORM_METRICS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
            <div className="mt-2 min-h-[180px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap="28%">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={78} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-2)', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'var(--ink)', fillOpacity: 0.04, radius: 8 }} formatter={(v) => [m.fmt(Number(v)), m.label]}
                    animationDuration={180}
                    contentStyle={{ background: 'var(--card)', border: 'none', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px -12px rgb(0 0 0 / .45)' }}
                    labelStyle={{ color: 'var(--ink)', fontWeight: 500 }} itemStyle={{ color: 'var(--ink-2)' }} />
                  <Bar dataKey={metric} radius={[0, 6, 6, 0]} animationDuration={600}
                    label={{ position: 'right', fill: 'var(--ink-2)', fontSize: 12, formatter: (v: unknown) => m.fmt(Number(v)) }}>
                    {chart.map((p) => <Cell key={p.platform} fill={PLATFORM_COLORS[p.platform]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Highlight({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className={`text-right font-mono tabular-nums ${on ? 'font-medium text-pos' : ''}`}>
      {children}
    </span>
  );
}

// ---------- Postingan & akun ----------

export function TopPosts({ data }: { data: AnalyticsOverview['topPosts'] }) {
  return (
    <Card title="Postingan teratas" aside={<span className="text-[13px] text-ink-3">berdasarkan views</span>}>
      {data.length === 0 ? <Empty>Belum ada postingan.</Empty> : (
        <div className="flex-1 overflow-hidden rounded-2xl bg-card shadow-sm">
          {data.map((p, i) => (
            <div key={p.id} className={`group flex items-center gap-3 px-4 py-2.5 text-[14px] ${i ? 'border-t border-line' : ''}`}>
              <span className="w-4 shrink-0 text-center font-mono text-[12px] text-ink-3">{i + 1}</span>
              <span className="relative shrink-0">
                {p.cover
                  ? <img src={p.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg bg-shell object-cover" />
                  : <span className="block h-10 w-10 rounded-lg bg-shell" />}
                <PlatformDot platform={p.platform} size={16} className="absolute -right-1 -bottom-1" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="truncate font-medium">{p.author ? `@${p.author}` : p.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  {p.postedAt && <span className="shrink-0 text-[12px] text-ink-3">{fmtDate(p.postedAt)}</span>}
                </div>
                <div className="truncate text-[12px] text-ink-3">{p.text || p.campaign}</div>
              </div>
              <div className="w-16 shrink-0 text-right">
                <Tip label={`${fmtNumber(p.views)} views`}><div className="font-mono tabular-nums">{fmtCompact(p.views)}</div></Tip>
                <div className="text-[11px] text-ink-3">ER {fmtPercent(p.er)}</div>
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Buka postingan"
                className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-ink group-hover:opacity-100 focus-visible:opacity-100">
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TopAuthors({ data }: { data: AnalyticsOverview['topAuthors'] }) {
  const max = Math.max(1, ...data.map((a) => a.views));
  return (
    <Card title="Akun teratas" aside={<span className="text-[13px] text-ink-3">total views</span>}>
      {data.length === 0 ? <Empty>Data akun muncul setelah link disinkron.</Empty> : (
        <div className="flex-1 overflow-hidden rounded-2xl bg-card shadow-sm">
          {data.map((a, i) => (
            <div key={`${a.platform}:${a.author}`} className={`flex items-center gap-3 px-4 py-2.5 text-[14px] ${i ? 'border-t border-line' : ''}`}>
              <span className="relative shrink-0">
                {a.avatar
                  ? <img src={a.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full bg-shell object-cover" />
                  : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-[14px] font-medium uppercase text-ink-2">{a.author[0]}</span>}
                <PlatformDot platform={a.platform} size={16} className="absolute -right-1 -bottom-1" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate font-medium">
                  <span className="truncate">{a.name || a.author}</span>{a.verified && <BadgeCheck size={13} className="shrink-0 text-blue" />}
                </div>
                <div className="truncate text-[12px] text-ink-3">
                  @{a.author}{a.followers != null && <> · {fmtCompact(a.followers)} followers</>}
                  {a.followersGain != null && a.followersGain !== 0 && (
                    <span className={a.followersGain > 0 ? 'text-pos' : 'text-accent'}> ({a.followersGain > 0 ? '+' : ''}{fmtCompact(a.followersGain)})</span>
                  )} · {a.posts} post
                </div>
              </div>
              <div className="w-20 shrink-0 text-right">
                <div className="font-mono tabular-nums">{fmtCompact(a.views)}</div>
                {a.gainedViews > 0 && <div className="text-[11px] text-pos">+{fmtCompact(a.gainedViews)}</div>}
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-shell">
                  <div className="ml-auto h-full rounded-full" style={{ width: `${(a.views / max) * 100}%`, background: PLATFORM_COLORS[a.platform] }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------- daftar peringkat ----------

function RankList({ rows, empty }: { rows: { key: string; label: ReactNode; meta: string; value: number; href?: string }[]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex-1 overflow-hidden rounded-2xl bg-card shadow-sm">
      {rows.map((r, i) => {
        const body = (
          <>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
              <span className="text-[12px] text-ink-3">{r.meta}</span>
              <Tip label={`${fmtNumber(r.value)} views`}><span className="w-14 text-right font-mono tabular-nums">{fmtCompact(r.value)}</span></Tip>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-shell">
              <motion.div className="h-full rounded-full bg-blue" initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.6 }} />
            </div>
          </>
        );
        const cls = `block px-4 py-2.5 text-[14px] ${i ? 'border-t border-line' : ''}`;
        return r.href
          ? <Link key={r.key} to={r.href} className={`${cls} transition-colors hover:bg-shell/50`}>{body}</Link>
          : <div key={r.key} className={cls}>{body}</div>;
      })}
    </div>
  );
}

export function CampaignRanking({ data }: { data: AnalyticsOverview['campaigns'] }) {
  return (
    <Card title="Data Url teratas" aside={<Link to="/data-url" className="text-[13px] text-ink-3 hover:text-accent">Lihat semua</Link>}>
      <RankList empty="Belum ada Data Url."
        rows={data.slice(0, 6).map((c) => ({ key: c.id, label: c.title, meta: `${c.posts} post · ER ${fmtPercent(c.er)}`, value: c.views, href: `/data-url/${c.id}` }))} />
    </Card>
  );
}

export function TopHashtags({ data }: { data: AnalyticsOverview['topHashtags'] }) {
  return (
    <Card title="Hashtag teratas" aside={<span className="text-[13px] text-ink-3">views dari postingan yang memakai</span>}>
      <RankList empty="Belum ada hashtag dari postingan yang disinkron."
        rows={data.slice(0, 6).map((h) => ({ key: h.tag, label: <>#{h.tag}</>, meta: `${h.posts} post`, value: h.views }))} />
    </Card>
  );
}

const POLARITY: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positif', color: 'var(--pos)' },
  neutral: { label: 'Netral', color: 'var(--ink-3)' },
  negative: { label: 'Negatif', color: 'var(--accent)' },
};

export function Sentiment({ data }: { data: AnalyticsOverview['sentiment'] }) {
  const total = data.reduce((a, s) => a + s.posts, 0);
  if (!total) return null; // hanya sebagian provider yang mengirim sentimen
  return (
    <Card title="Sentimen konten" aside={<span className="text-[13px] text-ink-3">{total} post dianalisis</span>}>
      <div className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-shell">
          {data.map((s) => <div key={s.polarity} style={{ width: `${(s.posts / total) * 100}%`, background: POLARITY[s.polarity]?.color ?? 'var(--blue)' }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {data.map((s) => (
            <span key={s.polarity} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: POLARITY[s.polarity]?.color ?? 'var(--blue)' }} />
              {POLARITY[s.polarity]?.label ?? s.polarity}<span className="text-ink-3">{Math.round((s.posts / total) * 100)}%</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
