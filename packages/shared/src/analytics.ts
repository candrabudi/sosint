import { z } from 'zod';
import { type MetricTotals, type Platform, platformSchema } from './data-url';

export const ANALYTICS_RANGES = ['7d', '30d', '90d', 'all'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': '7 hari', '30d': '30 hari', '90d': '90 hari', all: 'Semua',
};

/**
 * Filter analitik. Rentang waktu memakai TANGGAL POSTING (meta.postedAt dari provider),
 * fallback ke waktu link ditambahkan bila postingan belum pernah disinkron.
 */
export const analyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES).default('all'),
  platform: platformSchema.optional(),
  dataUrlId: z.uuid().optional(),
});
export type AnalyticsQuery = z.input<typeof analyticsQuerySchema>;
export type AnalyticsQueryPayload = z.output<typeof analyticsQuerySchema>;

export interface AnalyticsKpis extends MetricTotals {
  posts: number;
  campaigns: number;
  authors: number;
  engagement: number;
  /** engagement / views × 100 */
  er: number;
  avgViews: number;
}

export interface TimelineValues { posts: number; views: number; engagement: number }
export type TimelineMetric = keyof TimelineValues;

export interface TimelinePoint extends TimelineValues {
  date: string;
  /** rincian per platform pada tanggal ini (hanya platform yang punya postingan) */
  platforms: Partial<Record<Platform, TimelineValues>>;
  /** nilai pada posisi yang sama di periode sebelumnya; null untuk range "all" */
  prev: TimelineValues | null;
  /** kenaikan pada tanggal ini (berdasarkan waktu sinkron, bukan tanggal posting) */
  gained: GainValues;
  gainedPlatforms: Partial<Record<Platform, GainValues>>;
  /** kenaikan pada posisi yang sama di periode sebelumnya */
  prevGained: GainValues | null;
}

export interface GainValues { views: number; engagement: number }

export interface PlatformStats extends MetricTotals {
  platform: Platform;
  posts: number;
  engagement: number;
  er: number;
  avgViews: number;
  avgEngagement: number;
  /** porsi views dari total, 0–100 */
  share: number;
}

/** Kenaikan metrik dalam rentang (dari riwayat snapshot). */
export interface GrowthValues { views: number; likes: number; comments: number; shares: number; saves: number; engagement: number }

export interface AnalyticsGrowth extends GrowthValues {
  /** link yang punya riwayat di rentang ini */
  tracked: number;
  /** snapshot pertama yang pernah tercatat (awal riwayat) */
  trackingSince: string | null;
}

export interface AnalyticsOverview {
  /** pertumbuhan dalam rentang; dihitung dari snapshot */
  growth: AnalyticsGrowth;
  /** pertumbuhan periode sebelumnya; null untuk range "all" */
  previousGrowth: AnalyticsGrowth | null;
  /** postingan dengan kenaikan views terbesar di rentang ini */
  topGrowers: {
    id: string; dataUrlId: string; campaign: string; platform: Platform; url: string; author: string | null;
    cover: string | null; views: number; gainedViews: number; gainedEngagement: number;
    /** kenaikan relatif terhadap angka awal rentang; null bila postingan baru */
    gainedPct: number | null;
  }[];
  range: AnalyticsRange;
  kpis: AnalyticsKpis;
  /** periode sebelumnya dengan panjang sama; null untuk range "all" */
  previous: AnalyticsKpis | null;
  sync: { synced: number; pending: number; failed: number; manual: number; lastSyncedAt: string | null };
  byPlatform: PlatformStats[];
  timeline: TimelinePoint[];
  /** bucket timeline: harian atau mingguan */
  bucket: 'day' | 'week';
  topPosts: {
    id: string; dataUrlId: string; campaign: string; platform: Platform; url: string;
    author: string | null; text: string | null; cover: string | null; postedAt: string | null;
    views: number; engagement: number; er: number;
  }[];
  topAuthors: {
    author: string; platform: Platform; name: string | null; avatar: string | null; followers: number | null;
    verified: boolean; posts: number; views: number; engagement: number;
    /** perubahan followers dalam rentang (dari riwayat); null bila belum cukup data */
    followersGain: number | null;
    gainedViews: number;
  }[];
  topHashtags: { tag: string; posts: number; views: number }[];
  campaigns: { id: string; title: string; posts: number; views: number; engagement: number; er: number }[];
  sentiment: { polarity: string; posts: number }[];
}
