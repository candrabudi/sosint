import { z } from 'zod';
import { type Paginated, paginationShape } from './pagination';

export const PLATFORMS = ['instagram', 'tiktok', 'x', 'facebook', 'youtube', 'threads', 'linkedin', 'other'] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  facebook: 'Facebook',
  youtube: 'YouTube',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  other: 'Lainnya',
};

const HOSTS: [RegExp, Platform][] = [
  [/(^|\.)(instagram\.com|instagr\.am)$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(x|twitter)\.com$/, 'x'],
  [/(^|\.)(facebook|fb)\.(com|watch)$/, 'facebook'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
];

/** Tebak platform dari URL, mis. instagram.com/p/... → "instagram". */
export function detectPlatform(url: string): Platform | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? 'other';
  } catch {
    return null;
  }
}

// parameter tracking yang dibuang agar link yang sama tidak dianggap berbeda
const TRACKING_PARAMS = /^(utm_.+|igsh|igshid|dmpr|si|fbclid|gclid|feature|is_from_webapp|sender_device|ref|ref_src|s|t)$/i;

/**
 * Rapikan URL: tambah https:// bila tidak ada, hapus www., #hash, parameter tracking,
 * dan garis miring di akhir. Mengembalikan null bila bukan URL http(s) yang valid.
 */
export function normalizeUrl(raw: string): string | null {
  let s = raw.trim().replace(/[)\]>.,;'"]+$/, '');
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export interface ParsedUrl {
  url: string;
  platform: Platform;
}

/** Pecah teks berisi banyak link (dipisah baris/spasi/koma) → link valid + yang tidak valid + jumlah duplikat. */
export function parseUrlList(text: string, existing: string[] = []) {
  const seen = new Set(existing.map((u) => normalizeUrl(u) ?? u));
  const valid: ParsedUrl[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const url = normalizeUrl(token);
    if (!url) { invalid.push(token); continue; }
    if (seen.has(url)) { duplicates++; continue; }
    seen.add(url);
    valid.push({ url, platform: detectPlatform(url) ?? 'other' });
  }
  return { valid, invalid, duplicates };
}

export const METRICS = ['views', 'likes', 'comments', 'shares', 'saves'] as const;
export type Metric = (typeof METRICS)[number];

const metric = z.coerce.number().int('Harus bilangan bulat').min(0, 'Tidak boleh negatif').max(Number.MAX_SAFE_INTEGER);

const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(40, 'Tag maksimal 40 karakter'))
  .max(20, 'Maksimal 20 tag')
  .transform((t) => [...new Set(t)]);

// ---------- Link ----------
/** URL dinormalisasi; gagal validasi bila bukan link http(s) */
const urlField = z
  .string()
  .trim()
  .min(1, 'URL wajib diisi')
  .max(2048, 'URL terlalu panjang')
  .transform((v, ctx) => {
    const url = normalizeUrl(v);
    if (!url) {
      ctx.addIssue({ code: 'custom', message: 'URL tidak valid' });
      return z.NEVER;
    }
    return url;
  });

/** platform opsional — bila kosong, dideteksi otomatis dari URL */
export const linkInputSchema = z
  .object({
    platform: platformSchema.optional(),
    url: urlField,
    views: metric.default(0),
    likes: metric.default(0),
    comments: metric.default(0),
    shares: metric.default(0),
    saves: metric.default(0),
  })
  .transform(({ platform, ...l }) => ({ ...l, platform: platform ?? detectPlatform(l.url) ?? 'other' }));
export type LinkInput = z.input<typeof linkInputSchema>;
export type LinkPayload = z.output<typeof linkInputSchema>;

/** Tambah banyak link sekaligus; platform dideteksi dari masing-masing URL. */
export const bulkLinksSchema = z.object({
  urls: z.array(z.string()).min(1, 'Minimal 1 link').max(200, 'Maksimal 200 link sekaligus'),
});
export type BulkLinksInput = z.infer<typeof bulkLinksSchema>;
export interface BulkLinksResult {
  added: number;
  skipped: number;
  invalid: string[];
  /** jumlah link yang sedang disinkron otomatis di background */
  syncQueued: number;
}

export const updateLinkSchema = z
  .object({
    platform: platformSchema.optional(),
    url: urlField.optional(),
    views: metric.optional(),
    likes: metric.optional(),
    comments: metric.optional(),
    shares: metric.optional(),
    saves: metric.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Minimal satu field harus diisi');
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;

// ---------- Data URL ----------
export const createDataUrlSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200, 'Maksimal 200 karakter'),
  tags: tags.default([]),
  isActive: z.boolean().default(true),
  links: z.array(linkInputSchema).max(100, 'Maksimal 100 link').default([]),
});
export type CreateDataUrlInput = z.input<typeof createDataUrlSchema>;
export type CreateDataUrlPayload = z.output<typeof createDataUrlSchema>;

export const updateDataUrlSchema = z
  .object({
    title: z.string().trim().min(1, 'Judul wajib diisi').max(200).optional(),
    tags: tags.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Minimal satu field harus diisi');
export type UpdateDataUrlInput = z.infer<typeof updateDataUrlSchema>;

export const dataUrlQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  tag: z.string().trim().toLowerCase().optional(),
  platform: platformSchema.optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ...paginationShape,
});
export type DataUrlQuery = z.input<typeof dataUrlQuerySchema>;
export type DataUrlQueryPayload = z.output<typeof dataUrlQuerySchema>;

// ---------- Response ----------
export type MetricTotals = Record<Metric, number>;

export interface DataUrlLink extends MetricTotals {
  id: string;
  dataUrlId: string;
  platform: Platform;
  url: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  commentsSyncedAt: string | null;
  commentsSyncError: string | null;
  meta: PostMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataUrl {
  id: string;
  title: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string } | null;
  linkCount: number;
  platforms: Platform[];
  totals: MetricTotals;
}

/** Ringkasan seluruh hasil filter (bukan hanya halaman aktif). */
export interface DataUrlListSummary {
  count: number;
  links: number;
  totals: MetricTotals;
}

export interface DataUrlPage extends Paginated<DataUrl> {
  summary: DataUrlListSummary;
}

export interface DataUrlDetail extends DataUrl {
  links: DataUrlLink[];
}

/** (likes + comments + shares + saves) / views × 100 */
export function engagementRate(m: MetricTotals) {
  return m.views > 0 ? ((m.likes + m.comments + m.shares + m.saves) / m.views) * 100 : 0;
}

// ---------- Sinkron analitik ----------

/** Platform yang analitiknya bisa ditarik otomatis. */
export const SYNCABLE_PLATFORMS: readonly Platform[] = ['x', 'tiktok', 'instagram'];
export const isSyncable = (p: Platform) => SYNCABLE_PLATFORMS.includes(p);

/** Ambil ID tweet dari URL x.com / twitter.com, mis. .../status/1631781099415257088 */
export function extractTweetId(url: string): string | null {
  const m = /\/status(?:es)?\/(\d{5,25})/.exec(url);
  return m ? m[1] : null;
}

/** Info postingan dari provider — field umum untuk semua platform + ekstra per platform. */
export interface PostMeta {
  provider: 'apidirect';
  platform: Platform;
  /** username, mis. "tiktok" / "elonmusk" */
  author: string;
  /** nama tampilan, mis. "TikTok" */
  authorName: string | null;
  authorFollowers: number | null;
  authorVerified: boolean | null;
  authorAvatar: string | null;
  /** isi tweet / caption video */
  text: string;
  postedAt: string | null;
  lang: string | null;
  region: string | null;
  hashtags: string[];
  /** thumbnail (video) */
  cover: string | null;
  /** durasi video (detik) */
  durationSec: number | null;
  isAd: boolean | null;
  isReply: boolean | null;
  isQuote: boolean | null;
  music: { title: string; author: string; original: boolean } | null;
  sentiment: { polarity: string | null; dominantEmotion: string | null; intensity: number | null } | null;
  /** angka asli dari provider sebelum dipetakan ke kolom standar */
  raw: Record<string, number>;
}

export interface SyncLinkResult {
  linkId: string;
  ok: boolean;
  error?: string;
}

export interface SyncDataUrlResult {
  synced: number;
  failed: number;
  skipped: number;
  results: SyncLinkResult[];
}

// ---------- Riwayat metrik ----------

export interface LinkSnapshot extends MetricTotals {
  capturedAt: string;
  authorFollowers: number | null;
  source: 'sync' | 'manual';
}

/** Total harian sebuah Data Url (angka terakhir tiap link per akhir hari, dibawa ke hari berikutnya bila tidak disinkron). */
export interface DataUrlHistoryPoint extends MetricTotals {
  date: string;
  /** link yang sudah punya data pada tanggal ini */
  links: number;
}

export interface DataUrlHistory {
  points: DataUrlHistoryPoint[];
  /** snapshot pertama; null = belum ada riwayat */
  trackingSince: string | null;
}

// ---------- Komentar ----------

/** Platform yang komentarnya ikut ditarik setiap sinkron. */
export const COMMENT_PLATFORMS: readonly Platform[] = ['x', 'tiktok', 'instagram'];
export const supportsComments = (p: Platform) => COMMENT_PLATFORMS.includes(p);

/** Ambil shortcode postingan Instagram dari URL /p/, /reel/, /reels/, /tv/ */
export function extractInstagramCode(url: string): string | null {
  const m = /instagram\.com\/(?:[^/]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]{5,})/.exec(url);
  return m ? m[1] : null;
}

export const COMMENT_POLARITIES = ['positive', 'neutral', 'negative'] as const;
export type CommentPolarity = (typeof COMMENT_POLARITIES)[number];

export const commentQuerySchema = z.object({
  linkId: z.uuid().optional(),
  platform: platformSchema.optional(),
  /** "none" = komentar tanpa data sentimen */
  polarity: z.enum([...COMMENT_POLARITIES, 'none']).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['recent', 'likes', 'replies']).default('recent'),
  ...paginationShape,
});
export type CommentQuery = z.input<typeof commentQuerySchema>;
export type CommentQueryPayload = z.output<typeof commentQuerySchema>;

export interface LinkComment {
  id: string;
  linkId: string;
  platform: Platform;
  /** URL postingan induk */
  postUrl: string;
  url: string | null;
  author: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorFollowers: number | null;
  authorVerified: boolean | null;
  text: string;
  postedAt: string | null;
  likes: number;
  replies: number;
  shares: number;
  views: number;
  isPinned: boolean | null;
  lang: string | null;
  polarity: string | null;
  dominantEmotion: string | null;
  intensity: number | null;
  firstSeenAt: string;
}

export interface CommentSummary {
  total: number;
  polarity: Record<CommentPolarity | 'none', number>;
  /** emosi dominan terbanyak */
  emotions: { emotion: string; comments: number }[];
  /** komentar baru (pertama kali terlihat) dalam 24 jam terakhir */
  new24h: number;
}

export interface CommentPage extends Paginated<LinkComment> {
  summary: CommentSummary;
}
