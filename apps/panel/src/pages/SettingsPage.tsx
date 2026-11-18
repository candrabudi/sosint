import { zodResolver } from '@hookform/resolvers/zod';
import {
  APIDIRECT_DEFAULT_BASE_URL, PLATFORM_LABELS, type SettingSource, SYNCABLE_PLATFORMS, type TestApiDirectResult,
} from '@sig/shared';
import {
  CircleCheck, CircleX, Eye, EyeOff, KeyRound, Loader2, Plug, RotateCcw, Save, ShieldCheck, Trash2, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Label, Tabs } from 'radix-ui';
import { type ReactNode, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PlatformDot } from '../components/data-urls/Platform';
import { FadeIn } from '../components/motion';
import { SyncScheduleCard } from '../components/settings/SyncScheduleCard';
import { Confirm } from '../components/ui/dialog';
import { Tip } from '../components/ui/tooltip';
import { fmtDateTime, fmtRelative } from '../lib/format';
import { useApiDirectSettings, useSaveApiDirectSettings, useTestApiDirect } from '../lib/settings';

const ENDPOINTS = [
  { platform: 'x', path: '/v1/twitter/tweet', param: 'tweet_id' },
  { platform: 'tiktok', path: '/v1/tiktok/video', param: 'url' },
  { platform: 'instagram', path: '/v1/instagram/post', param: 'url' },
] as const;

const formSchema = z.object({
  baseUrl: z.string().trim().min(1, 'Base URL wajib diisi').refine((v) => {
    try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; }
  }, 'Base URL harus berupa URL http(s) yang valid'),
  apiKey: z.string().trim().refine((v) => v === '' || v.length >= 8, 'API key terlalu pendek'),
});
type FormValues = z.infer<typeof formSchema>;

const inputCls = (err?: boolean) =>
  `h-11 w-full rounded-xl border bg-card px-3.5 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:ring-4 ${
    err ? 'border-accent focus:ring-accent/15' : 'border-line hover:border-ink-3/50 focus:border-ink-3 focus:ring-ink/5'
  }`;

function SourceBadge({ source }: { source: SettingSource }) {
  const map: Record<SettingSource, [string, string, string]> = {
    database: ['Pengaturan', 'bg-good-soft text-good', 'Disimpan dari halaman ini'],
    env: ['.env', 'bg-warn-soft text-warn', 'Diambil dari file .env server (cadangan)'],
    default: ['Default', 'bg-shell text-ink-2', 'Nilai bawaan'],
    none: ['Belum diatur', 'bg-accent-soft text-accent', 'Belum ada nilai'],
  };
  const [label, cls, tip] = map[source];
  return (
    <Tip label={tip}>
      <span className={`rounded-md px-1.5 py-px font-mono text-[10px] uppercase tracking-wide ${cls}`}>{label}</span>
    </Tip>
  );
}

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

function ApiDirectCard() {
  const { data, isLoading } = useApiDirectSettings();
  const save = useSaveApiDirectSettings();
  const test = useTestApiDirect();
  const [editingKey, setEditingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [testResult, setTestResult] = useState<TestApiDirectResult | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { baseUrl: '', apiKey: '' },
  });

  useEffect(() => {
    if (!data) return;
    reset({ baseUrl: data.baseUrl, apiKey: '' });
    setEditingKey(!data.hasApiKey);
  }, [data, reset]);

  const baseUrl = watch('baseUrl').replace(/\/+$/, '');
  const apiKey = watch('apiKey');

  const onSave = handleSubmit((v) =>
    save.mutate(
      { baseUrl: v.baseUrl, ...(v.apiKey ? { apiKey: v.apiKey } : {}) },
      {
        onSuccess: () => {
          toast.success('Pengaturan apidirect disimpan');
          setShowKey(false);
          setTestResult(null);
        },
      },
    ),
  );

  const onTest = handleSubmit((v) => {
    setTestResult(null);
    test.mutate(
      { baseUrl: v.baseUrl, ...(v.apiKey ? { apiKey: v.apiKey } : {}) },
      { onSuccess: setTestResult, onError: (e) => setTestResult({ ok: false, status: null, latencyMs: 0, message: e.message }) },
    );
  });

  if (isLoading || !data) {
    return <div className="h-[520px] animate-pulse rounded-3xl bg-shell" />;
  }

  const canTest = data.hasApiKey || apiKey.length >= 8;

  return (
    <section className="rounded-3xl bg-card shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-5">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-canvas"><Zap size={22} /></span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-medium">apidirect.io</h3>
              {data.hasApiKey ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[12px] text-good">
                  <span className="h-1.5 w-1.5 rounded-full bg-good" /> Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-shell px-2 py-0.5 text-[12px] text-ink-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-3" /> Belum diatur
                </span>
              )}
            </div>
            <p className="mt-1 max-w-[520px] text-[14px] text-ink-2">
              Menarik analitik postingan (views, likes, comments, shares, saves) secara otomatis untuk menu Data Url.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SYNCABLE_PLATFORMS.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-shell py-0.5 pl-0.5 pr-2.5 text-[12px]">
                  <PlatformDot platform={p} size={18} className="ring-0" /> {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          </div>
        </div>
        {data.updatedAt && (
          <Tip label={fmtDateTime(data.updatedAt)}>
            <span className="text-[13px] text-ink-3">
              Diperbarui {fmtRelative(data.updatedAt)}{data.updatedBy && ` oleh ${data.updatedBy.fullName}`}
            </span>
          </Tip>
        )}
      </div>

      <form onSubmit={onSave} noValidate className="px-6">
        {/* base url */}
        <Row
          label={<span className="flex items-center gap-2">Base URL <SourceBadge source={data.baseUrlSource} /></span>}
          hint="Alamat awal API. Path endpoint otomatis disambungkan di belakangnya."
        >
          <div className="flex gap-2">
            <input id="baseUrl" spellCheck={false} placeholder={APIDIRECT_DEFAULT_BASE_URL}
              className={`${inputCls(!!errors.baseUrl)} font-mono`} {...register('baseUrl')} />
            <Tip label="Kembalikan ke default">
              <button type="button" aria-label="Kembalikan ke default"
                onClick={() => setValue('baseUrl', APIDIRECT_DEFAULT_BASE_URL, { shouldDirty: true, shouldValidate: true })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-shell hover:text-ink">
                <RotateCcw size={16} />
              </button>
            </Tip>
          </div>
          {errors.baseUrl && <p className="mt-1.5 text-[13px] text-accent">{errors.baseUrl.message}</p>}

          <div className="mt-3 space-y-1 rounded-xl bg-shell/60 p-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">Endpoint yang dipakai</div>
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="flex min-w-0 items-center gap-2 text-[12px]">
                <PlatformDot platform={e.platform} size={18} className="ring-0" />
                <span className="rounded bg-card px-1 font-mono text-[10px] text-ink-3">GET</span>
                <code className="truncate font-mono text-ink-2">
                  {baseUrl || APIDIRECT_DEFAULT_BASE_URL}<b className="font-medium text-ink">{e.path}</b>?{e.param}=…
                </code>
              </div>
            ))}
          </div>
        </Row>

        {/* api key */}
        <Row
          label={<span className="flex items-center gap-2">API key <SourceBadge source={data.apiKeySource} /></span>}
          hint={<>Dikirim sebagai header <code className="font-mono text-ink-2">X-API-Key</code>. Disimpan terenkripsi (AES-256) dan tidak pernah ditampilkan utuh.</>}
        >
          <AnimatePresence mode="wait" initial={false}>
            {data.hasApiKey && !editingKey ? (
              <motion.div key="masked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2">
                <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-shell/50 px-3.5">
                  <KeyRound size={16} className="text-ink-3" />
                  <span className="font-mono text-[14px] tracking-wider text-ink-2">{data.apiKeyMasked}</span>
                  <ShieldCheck size={15} className="ml-auto text-good" />
                </div>
                <button type="button" onClick={() => setEditingKey(true)}
                  className="h-11 rounded-xl border border-line px-4 text-[14px] transition-colors hover:bg-shell">
                  Ganti key
                </button>
                {data.apiKeySource === 'database' && (
                  <Tip label="Hapus API key">
                    <button type="button" onClick={() => setConfirmRemove(true)} aria-label="Hapus API key"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-3 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent">
                      <Trash2 size={16} />
                    </button>
                  </Tip>
                )}
              </motion.div>
            ) : (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                    <input
                      id="apiKey"
                      type={showKey ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={data.hasApiKey ? 'Masukkan API key baru' : 'Tempel API key apidirect'}
                      className={`${inputCls(!!errors.apiKey)} pl-10 pr-11 font-mono`}
                      {...register('apiKey')}
                    />
                    <button type="button" onClick={() => setShowKey((s) => !s)} aria-label={showKey ? 'Sembunyikan' : 'Tampilkan'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 transition-colors hover:text-ink">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {data.hasApiKey && (
                    <button type="button" onClick={() => { setEditingKey(false); setValue('apiKey', '', { shouldDirty: false }); }}
                      className="h-11 rounded-xl px-3 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
                      Batal
                    </button>
                  )}
                </div>
                {errors.apiKey && <p className="mt-1.5 text-[13px] text-accent">{errors.apiKey.message}</p>}
                {data.apiKeySource === 'env' && (
                  <p className="mt-1.5 text-[12px] text-ink-3">Key yang diisi di sini akan menggantikan nilai dari .env.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Row>

        {/* test result */}
        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-[14px] ${
                testResult.ok ? 'bg-good-soft text-good' : 'bg-accent-soft text-accent'
              }`}>
                {testResult.ok ? <CircleCheck size={19} className="mt-px shrink-0" /> : <CircleX size={19} className="mt-px shrink-0" />}
                <div className="flex-1">
                  <div className="font-medium">{testResult.message}</div>
                  <div className="mt-0.5 font-mono text-[12px] opacity-80">
                    {testResult.status ? `HTTP ${testResult.status}` : 'Tanpa respons'} · {testResult.latencyMs} ms
                  </div>
                </div>
                <button type="button" onClick={() => setTestResult(null)} className="rounded-md px-1.5 text-[12px] opacity-70 hover:opacity-100">
                  Tutup
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-5">
          <Tip label={canTest ? 'Memakai 1 request kuota apidirect' : 'Isi API key terlebih dahulu'}>
            <span>
              <button type="button" onClick={onTest} disabled={!canTest || test.isPending}
                className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[14px] transition-colors hover:border-ink-3/50 hover:bg-shell disabled:opacity-50">
                {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
                {test.isPending ? 'Menguji...' : 'Tes koneksi'}
              </button>
            </span>
          </Tip>
          <div className="flex gap-2">
            {isDirty && (
              <button type="button" onClick={() => { reset({ baseUrl: data.baseUrl, apiKey: '' }); setEditingKey(!data.hasApiKey); }}
                className="rounded-xl px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
                Batalkan perubahan
              </button>
            )}
            <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={!isDirty || save.isPending}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-50">
              {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan
            </motion.button>
          </div>
        </div>
      </form>

      <Confirm
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        icon={<Trash2 size={22} />}
        title="Hapus API key apidirect?"
        description="Sinkron analitik otomatis akan berhenti sampai API key baru diisi."
        confirmLabel="Hapus key"
        loading={save.isPending}
        onConfirm={() =>
          save.mutate({ baseUrl: data.baseUrl, apiKey: null }, {
            onSuccess: () => { setConfirmRemove(false); toast.success('API key dihapus'); },
          })
        }
      />
    </section>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState('integrations');
  return (
    <div className="mt-3 space-y-4">
      <FadeIn>
        <section className="rounded-3xl bg-shell p-5">
          <h2 className="px-1 text-[22px] font-medium tracking-tight">Pengaturan</h2>
          <p className="mt-0.5 px-1 text-[14px] text-ink-2">Konfigurasi integrasi dan sistem. Hanya dapat diakses admin.</p>
          <Tabs.Root value={tab} onValueChange={setTab} className="mt-4">
            <Tabs.List className="inline-flex rounded-xl bg-card p-1 shadow-sm" aria-label="Kategori pengaturan">
              {[['integrations', 'Integrasi'], ['sync', 'Sinkron & riwayat']].map(([v, label]) => (
                <Tabs.Trigger key={v} value={v}
                  className="relative rounded-lg px-4 py-1.5 text-[14px] text-ink-2 outline-none transition-colors hover:text-ink data-[state=active]:text-ink">
                  {tab === v && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-lg bg-shell" />}
                  <span className="relative">{label}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </section>
      </FadeIn>
      <FadeIn delay={0.08}>
        {tab === 'integrations' ? <ApiDirectCard /> : <SyncScheduleCard />}
      </FadeIn>
    </div>
  );
}
