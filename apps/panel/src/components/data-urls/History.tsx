import { type DataUrlLink, type Metric, METRICS } from '@sig/shared';
import { History as HistoryIcon, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useDataUrlHistory, useLinkHistory } from '../../lib/dataUrls';
import { fmtCompact, fmtDate, fmtDateTime, fmtNumber } from '../../lib/format';
import { Modal } from '../ui/dialog';
import { METRIC_LABELS } from './LinkFields';

const dayFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const axisTick = { fill: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };
const tipStyle = { background: 'var(--card)', border: 'none', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px -12px rgb(0 0 0 / .45)' };

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

const metricOpts = METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }));

/** Riwayat total harian satu Data Url: total kumulatif atau kenaikan per hari. */
export function DataUrlHistoryCard({ dataUrlId }: { dataUrlId: string }) {
  const { data, isLoading } = useDataUrlHistory(dataUrlId);
  const [metric, setMetric] = useState<Metric>('views');
  const [mode, setMode] = useState<'total' | 'gain'>('total');

  const rows = useMemo(() => (data?.points ?? []).map((p, i, arr) => ({
    date: p.date,
    total: p[metric],
    gain: i === 0 ? 0 : Math.max(0, p[metric] - arr[i - 1][metric]),
  })), [data, metric]);

  const last = rows[rows.length - 1];
  const first = rows[0];
  const gained = last && first ? last.total - first.total : 0;

  return (
    <section className="rounded-3xl bg-shell p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="flex items-center gap-2 text-[18px] font-medium"><HistoryIcon size={17} className="text-ink-3" />Riwayat</h3>
          <p className="text-[13px] text-ink-3">
            {data?.trackingSince
              ? <>Dicatat sejak {fmtDateTime(data.trackingSince)} · +{fmtNumber(gained)} {METRIC_LABELS[metric].toLowerCase()} sejak awal riwayat</>
              : 'Riwayat mulai tercatat setelah link disinkron.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented value={metric} options={metricOpts} onChange={setMetric} />
          <Segmented value={mode} onChange={setMode} options={[{ value: 'total', label: 'Total' }, { value: 'gain', label: 'Kenaikan/hari' }]} />
        </div>
      </div>
      <div className="h-[240px] rounded-2xl bg-card p-3 shadow-sm">
        {isLoading ? <div className="h-full animate-pulse rounded-xl bg-shell" /> : rows.length < 2 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-ink-3">
            {rows.length ? `Baru ada 1 titik data (${fmtDate(`${rows[0].date}T00:00:00+07:00`)}). Grafik muncul setelah sinkron berikutnya.` : 'Belum ada riwayat.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === 'total' ? (
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date" tickFormatter={(d) => dayFmt.format(new Date(`${d}T00:00:00`))} minTickGap={28} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                <YAxis tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={48} tick={axisTick} domain={['dataMin', 'auto']} />
                <Tooltip contentStyle={tipStyle} labelFormatter={(d) => fmtDate(`${d}T00:00:00+07:00`)} formatter={(v) => [fmtNumber(Number(v)), METRIC_LABELS[metric]]} cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 4' }} />
                <Area dataKey="total" type="monotone" stroke="var(--blue)" strokeWidth={2.2} fill="url(#hist-fill)" animationDuration={700} />
              </AreaChart>
            ) : (
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date" tickFormatter={(d) => dayFmt.format(new Date(`${d}T00:00:00`))} minTickGap={28} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                <YAxis tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={48} tick={axisTick} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} labelFormatter={(d) => fmtDate(`${d}T00:00:00+07:00`)} formatter={(v) => [`+${fmtNumber(Number(v))}`, METRIC_LABELS[metric]]} cursor={{ fill: 'var(--ink)', fillOpacity: 0.04, radius: 6 }} />
                <Bar dataKey="gain" fill="var(--pos)" radius={[6, 6, 2, 2]} maxBarSize={36} animationDuration={600} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

/** Dialog riwayat satu link: grafik setiap snapshot + tabel perubahan. */
export function LinkHistoryDialog({ dataUrlId, link, onClose }: { dataUrlId: string; link: DataUrlLink | null; onClose: () => void }) {
  const { data = [], isLoading } = useLinkHistory(dataUrlId, link?.id ?? null);
  const [metric, setMetric] = useState<Metric>('views');
  const rows = data.map((s, i) => ({
    t: new Date(s.capturedAt).getTime(), value: s[metric], source: s.source,
    delta: i ? s[metric] - data[i - 1][metric] : null, followers: s.authorFollowers,
  }));
  const gained = rows.length > 1 ? rows[rows.length - 1].value - rows[0].value : 0;

  return (
    <Modal open={!!link} onOpenChange={(o) => !o && onClose()} className="max-w-[720px]"
      title="Riwayat link" description={link?.url.replace(/^https?:\/\/(www\.)?/, '')}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented value={metric} options={metricOpts} onChange={setMetric} />
          {rows.length > 1 && (
            <span className="text-[13px] text-ink-2">
              <b className="font-medium text-pos">{gained >= 0 ? '+' : ''}{fmtNumber(gained)}</b> dalam {rows.length} titik data
            </span>
          )}
        </div>
        <div className="h-[220px] rounded-2xl bg-shell p-3">
          {isLoading ? <div className="h-full animate-pulse rounded-xl bg-card" /> : rows.length < 2 ? (
            <div className="flex h-full items-center justify-center text-center text-[14px] text-ink-3">
              {rows.length ? 'Baru ada 1 titik data. Grafik muncul setelah sinkron berikutnya.' : 'Belum ada riwayat untuk link ini.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="link-hist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => dayFmt.format(new Date(t))}
                  minTickGap={36} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                <YAxis tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={48} tick={axisTick} domain={['dataMin', 'auto']} />
                <Tooltip contentStyle={tipStyle} labelFormatter={(t) => `${timeFmt.format(new Date(Number(t)))} WIB`}
                  formatter={(v) => [fmtNumber(Number(v)), METRIC_LABELS[metric]]} cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 4' }} />
                <Area dataKey="value" type="monotone" stroke="var(--accent)" strokeWidth={2.2} fill="url(#link-hist)"
                  dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 4.5 }} animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {rows.length > 0 && (
          <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-line">
            <div className="sticky top-0 grid grid-cols-[1fr_100px_90px_100px] gap-3 bg-card px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
              <span>Waktu</span><span className="text-right">{METRIC_LABELS[metric]}</span><span className="text-right">Perubahan</span><span className="text-right">Followers</span>
            </div>
            {[...rows].reverse().map((r) => (
              <div key={r.t + r.source} className="grid grid-cols-[1fr_100px_90px_100px] gap-3 border-t border-line px-4 py-2 text-[13px]">
                <span className="flex items-center gap-1.5 text-ink-2">
                  {timeFmt.format(new Date(r.t))} WIB
                  {r.source === 'manual' && <span className="inline-flex items-center gap-1 rounded bg-shell px-1.5 text-[11px]"><Pencil size={10} />manual</span>}
                </span>
                <span className="text-right font-mono tabular-nums">{fmtNumber(r.value)}</span>
                <span className={`text-right font-mono tabular-nums ${r.delta == null ? 'text-ink-3' : r.delta > 0 ? 'text-pos' : r.delta < 0 ? 'text-accent' : 'text-ink-3'}`}>
                  {r.delta == null ? 'awal' : `${r.delta > 0 ? '+' : ''}${fmtNumber(r.delta)}`}
                </span>
                <span className="text-right font-mono tabular-nums text-ink-2">{r.followers != null ? fmtCompact(r.followers) : '–'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
