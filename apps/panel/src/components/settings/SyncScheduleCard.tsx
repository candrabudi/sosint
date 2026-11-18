import { SYNC_INTERVAL_HOURS, type SyncIntervalHours, type SyncScheduleInput } from '@sig/shared';
import { CalendarClock, CircleAlert, CircleCheck, History, Loader2, Play, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useEffect, useState } from 'react';
import { fmtDateTime, fmtNumber, fmtRelative } from '../../lib/format';
import { useRunSyncNow, useSaveSyncSchedule, useSyncSchedule } from '../../lib/settings';
import { Switch } from '../ui/switch';
import { Tip } from '../ui/tooltip';

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-5 md:grid-cols-[260px_1fr] md:gap-8">
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        {hint && <div className="mt-1 text-[13px] leading-relaxed text-ink-3">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const intervalLabel = (h: number) => (h === 24 ? '1× sehari' : `Tiap ${h} jam`);

export function SyncScheduleCard() {
  const { data, isLoading } = useSyncSchedule();
  const save = useSaveSyncSchedule();
  const run = useRunSyncNow();
  const [form, setForm] = useState<SyncScheduleInput | null>(null);

  useEffect(() => {
    if (data) setForm({ enabled: data.enabled, intervalHours: data.intervalHours, activeOnly: data.activeOnly });
  }, [data]);

  if (isLoading || !data || !form) return <div className="h-[420px] animate-pulse rounded-3xl bg-shell" />;

  const dirty = form.enabled !== data.enabled || form.intervalHours !== data.intervalHours || form.activeOnly !== data.activeOnly;
  // perkiraan untuk nilai di form (jumlah link mengikuti filter yang tersimpan)
  const estimate = Math.round((data.eligibleLinks + data.commentLinks) * (24 / form.intervalHours));
  const last = data.lastRun;

  return (
    <section className="rounded-3xl bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-5">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-soft text-blue"><CalendarClock size={22} /></span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-medium">Sinkron terjadwal & riwayat</h3>
              {data.running ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-soft px-2 py-0.5 text-[12px] text-blue">
                  <Loader2 size={11} className="animate-spin" /> Berjalan
                </span>
              ) : data.enabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[12px] text-good">
                  <span className="h-1.5 w-1.5 rounded-full bg-good" /> Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-shell px-2 py-0.5 text-[12px] text-ink-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-3" /> Nonaktif
                </span>
              )}
            </div>
            <p className="mt-1 max-w-[560px] text-[14px] text-ink-2">
              Menarik ulang analitik semua link secara berkala. Setiap sinkron menyimpan satu titik riwayat, jadi grafik pertumbuhan dan
              perbandingan antar periode bisa dihitung.
            </p>
          </div>
        </div>
        <Tip label="Jalankan sinkron sekarang tanpa menunggu jadwal">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => run.mutate()} disabled={data.running || run.isPending}
            className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[14px] transition-colors hover:bg-shell disabled:opacity-60">
            {data.running || run.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {data.running ? 'Sedang berjalan…' : 'Jalankan sekarang'}
          </motion.button>
        </Tip>
      </div>

      {/* status */}
      <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
        <div className="bg-card px-6 py-4">
          <div className="text-[13px] text-ink-3">Sinkron terakhir</div>
          {last ? (
            <>
              <Tip label={fmtDateTime(last.finishedAt)}><div className="mt-0.5 text-[15px] font-medium">{fmtRelative(last.finishedAt)}</div></Tip>
              <div className="mt-0.5 flex items-center gap-1.5 text-[13px]">
                {last.failed ? <CircleAlert size={13} className="text-accent" /> : <CircleCheck size={13} className="text-pos" />}
                <span className="text-ink-2">{last.synced}/{last.total} sukses · {last.trigger === 'manual' ? 'manual' : 'terjadwal'}</span>
              </div>
            </>
          ) : <div className="mt-0.5 text-[15px] text-ink-3">Belum pernah</div>}
        </div>
        <div className="bg-card px-6 py-4">
          <div className="text-[13px] text-ink-3">Berikutnya</div>
          <div className="mt-0.5 text-[15px] font-medium">
            {data.enabled && data.nextRunAt ? (new Date(data.nextRunAt) <= new Date() ? 'Sebentar lagi' : fmtDateTime(data.nextRunAt)) : '—'}
          </div>
          <div className="mt-0.5 text-[13px] text-ink-2">{intervalLabel(data.intervalHours)}</div>
        </div>
        <div className="bg-card px-6 py-4">
          <div className="text-[13px] text-ink-3">Perkiraan request apidirect</div>
          <div className="mt-0.5 text-[15px] font-medium">±{fmtNumber(estimate)} / hari</div>
          <div className="mt-0.5 text-[13px] text-ink-2">{data.eligibleLinks} link (+{data.commentLinks} komentar) × {24 / form.intervalHours} kali</div>
        </div>
      </div>

      <div className="px-6">
        <Row label="Aktifkan jadwal" hint="Bila dimatikan, riwayat hanya bertambah saat sinkron manual.">
          <label className="inline-flex items-center gap-3">
            <Switch checked={form.enabled} label="Aktifkan jadwal" onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            <span className="text-[14px] text-ink-2">{form.enabled ? 'Aktif' : 'Nonaktif'}</span>
          </label>
        </Row>
        <Row label="Interval" hint="Makin sering = grafik makin detail, tapi kuota apidirect lebih cepat terpakai. Link yang baru disinkron dilewati agar hemat.">
          <div className="flex flex-wrap gap-1.5">
            {SYNC_INTERVAL_HOURS.map((h) => (
              <button key={h} type="button" onClick={() => setForm({ ...form, intervalHours: h as SyncIntervalHours })}
                className={`rounded-xl border px-3.5 py-2 text-[14px] transition-colors ${
                  form.intervalHours === h ? 'border-ink bg-shell text-ink' : 'border-line text-ink-2 hover:border-ink-3/50'
                }`}>
                {intervalLabel(h)}{h === 6 && <span className="ml-1.5 text-[11px] text-ink-3">disarankan</span>}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Cakupan" hint="Data Url nonaktif (kampanye selesai) tidak perlu dipantau terus.">
          <label className="inline-flex items-center gap-3">
            <Switch checked={form.activeOnly} label="Hanya Data Url aktif" onCheckedChange={(v) => setForm({ ...form, activeOnly: v })} />
            <span className="text-[14px] text-ink-2">{form.activeOnly ? 'Hanya Data Url aktif' : 'Semua Data Url'}</span>
          </label>
        </Row>
        <Row label={<span className="flex items-center gap-1.5"><History size={14} />Penyimpanan riwayat</span>}
          hint="Semua titik riwayat disimpan. Menghapus link/Data Url ikut menghapus riwayatnya.">
          <p className="text-[14px] text-ink-2">
            Riwayat tidak bisa diisi mundur, karena provider hanya memberi angka terkini. Grafik pertumbuhan makin berguna setelah beberapa hari berjalan.
          </p>
        </Row>
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        {dirty && (
          <button type="button" onClick={() => setForm({ enabled: data.enabled, intervalHours: data.intervalHours, activeOnly: data.activeOnly })}
            className="rounded-xl px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
            Batalkan perubahan
          </button>
        )}
        <motion.button whileTap={{ scale: 0.98 }} disabled={!dirty || save.isPending} onClick={() => save.mutate(form)}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-50">
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan
        </motion.button>
      </div>
    </section>
  );
}
