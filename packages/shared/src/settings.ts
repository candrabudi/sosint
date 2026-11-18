import { z } from 'zod';

export const APIDIRECT_DEFAULT_BASE_URL = 'https://apidirect.io';

const baseUrl = z
  .string()
  .trim()
  .min(1, 'Base URL wajib diisi')
  .max(500)
  .transform((v, ctx) => {
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      // simpan tanpa garis miring di akhir agar path bisa langsung disambung
      return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Base URL harus berupa URL http(s) yang valid' });
      return z.NEVER;
    }
  });

/**
 * Update pengaturan apidirect.
 * - apiKey tidak dikirim / undefined → key lama tetap dipakai
 * - apiKey: null → key dihapus
 */
export const updateApiDirectSettingsSchema = z.object({
  baseUrl,
  apiKey: z.string().trim().min(8, 'API key terlalu pendek').max(500).nullable().optional(),
});
export type UpdateApiDirectSettingsInput = z.input<typeof updateApiDirectSettingsSchema>;
export type UpdateApiDirectSettingsPayload = z.output<typeof updateApiDirectSettingsSchema>;

/** Tes koneksi — boleh pakai nilai di form yang belum disimpan. */
export const testApiDirectSchema = z.object({
  baseUrl: baseUrl.optional(),
  apiKey: z.string().trim().min(8, 'API key terlalu pendek').max(500).optional(),
});
export type TestApiDirectInput = z.input<typeof testApiDirectSchema>;

export type SettingSource = 'database' | 'env' | 'default' | 'none';

/** Pengaturan apidirect yang aman dikirim ke client (API key tidak pernah dikirim utuh). */
export interface ApiDirectSettings {
  baseUrl: string;
  baseUrlSource: SettingSource;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  apiKeySource: SettingSource;
  updatedAt: string | null;
  updatedBy: { id: string; fullName: string } | null;
}

export interface TestApiDirectResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  message: string;
}

// ---------- Sinkron terjadwal ----------

export const SYNC_INTERVAL_HOURS = [1, 3, 6, 12, 24] as const;
export type SyncIntervalHours = (typeof SYNC_INTERVAL_HOURS)[number];

export const syncScheduleSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().refine((v): v is SyncIntervalHours => (SYNC_INTERVAL_HOURS as readonly number[]).includes(v), 'Interval tidak valid'),
  /** hanya Data Url berstatus aktif */
  activeOnly: z.boolean(),
});
export type SyncScheduleInput = z.infer<typeof syncScheduleSchema>;

export const DEFAULT_SYNC_SCHEDULE: SyncScheduleInput = { enabled: true, intervalHours: 6, activeOnly: true };

export interface SyncRunSummary {
  startedAt: string;
  finishedAt: string;
  trigger: 'schedule' | 'manual';
  total: number;
  synced: number;
  failed: number;
}

export interface SyncScheduleSettings extends SyncScheduleInput {
  running: boolean;
  lastRun: SyncRunSummary | null;
  nextRunAt: string | null;
  /** link yang akan ikut sinkron terjadwal (platform didukung + filter aktif) */
  eligibleLinks: number;
  /** link yang komentarnya juga ditarik (+1 request per sinkron) */
  commentLinks: number;
  /** perkiraan request apidirect per hari = (eligibleLinks + commentLinks) × (24 / interval) */
  estimatedRequestsPerDay: number;
  updatedAt: string | null;
}
