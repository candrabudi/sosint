import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@sig/db';
import {
  type AnalyticsGrowth, type AnalyticsKpis, type AnalyticsOverview, type AnalyticsQueryPayload, type AnalyticsRange,
  type GainValues, type GrowthValues, METRICS, type Platform, type PlatformStats, SYNCABLE_PLATFORMS, type TimelinePoint,
  type TimelineValues,
} from '@sig/shared';
import { type SQL, sql } from 'drizzle-orm';
import { DB } from '../db/db.module';

const DAY = 86_400_000;
const RANGE_DAYS: Record<Exclude<AnalyticsRange, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };
const TZ = 'Asia/Jakarta';
/** postingan yang snapshot pertamanya ≤ 7 hari setelah terbit dianggap dipantau sejak awal (titik awal = 0) */
const FRESH_POST_MS = 7 * DAY;

const er = (engagement: number, views: number) => (views > 0 ? (engagement / views) * 100 : 0);
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD

type Window = { from: Date; to: Date };
type Metrics5 = Omit<GrowthValues, 'engagement'>;

interface SnapRow extends Metrics5 { kind: 'b' | 'w'; link_id: string; day: string | null; captured_at: Date; followers: number | null }
interface LinkRow {
  id: string; data_url_id: string; campaign: string; platform: Platform; url: string;
  author: string | null; cover: string | null; views: number; posted_at: Date;
}

interface GrowthResult {
  totals: AnalyticsGrowth;
  daily: Map<string, { gained: GainValues; platforms: Partial<Record<Platform, GainValues>> }>;
  perLink: Map<string, { views: number; engagement: number; baseViews: number | null }>;
  /** `${platform}:${author}` → perubahan followers */
  followers: Map<string, number>;
  links: Map<string, LinkRow>;
}

/**
 * Semua query analitik memakai CTE `f` = link yang lolos filter.
 * posted_at = tanggal posting dari provider (meta.postedAt), fallback ke waktu link ditambahkan.
 * eng = likes + comments + shares + saves.
 *
 * Dua sudut pandang waktu:
 *  - "tanggal posting": performa postingan yang TERBIT di rentang (kpis, timeline.views, dst)
 *  - "pertumbuhan": kenaikan metrik yang TERJADI di rentang, dari riwayat snapshot (growth, timeline.gained)
 */
@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private cte(q: AnalyticsQueryPayload, window?: Window): SQL {
    const conds: SQL[] = [sql`true`];
    if (q.platform) conds.push(sql`platform::text = ${q.platform}`);
    if (q.dataUrlId) conds.push(sql`data_url_id = ${q.dataUrlId}`);
    if (window) conds.push(sql`posted_at >= ${window.from.toISOString()}::timestamptz and posted_at < ${window.to.toISOString()}::timestamptz`);
    return sql`
      with base as (
        select l.*, d.title as campaign,
          coalesce(
            case when l.meta->>'postedAt' ~ '^\\d{4}-\\d{2}-\\d{2}' then (l.meta->>'postedAt')::timestamptz end,
            l.created_at
          ) as posted_at,
          (l.likes + l.comments + l.shares + l.saves)::float8 as eng
        from data_url_links l
        join data_urls d on d.id = l.data_url_id
      ),
      f as (select * from base where ${sql.join(conds, sql` and `)})
    `;
  }

  private async rows<T>(query: SQL): Promise<T[]> {
    const res = await this.db.execute(query);
    return res.rows as T[];
  }

  private async kpis(cte: SQL): Promise<AnalyticsKpis> {
    const [r] = await this.rows<Omit<AnalyticsKpis, 'er' | 'avgViews'>>(sql`${cte}
      select
        count(*)::int as posts,
        count(distinct data_url_id)::int as campaigns,
        count(distinct meta->>'author')::int as authors,
        coalesce(sum(views), 0)::float8 as views,
        coalesce(sum(likes), 0)::float8 as likes,
        coalesce(sum(comments), 0)::float8 as comments,
        coalesce(sum(shares), 0)::float8 as shares,
        coalesce(sum(saves), 0)::float8 as saves,
        coalesce(sum(eng), 0)::float8 as engagement
      from f`);
    return { ...r, er: er(r.engagement, r.views), avgViews: r.posts ? r.views / r.posts : 0 };
  }

  /** Total per hari posting (zona Jakarta) beserta rincian per platform. */
  private async dailyByPlatform(cte: SQL): Promise<Map<string, TimelinePoint>> {
    const rows = await this.rows<TimelineValues & { date: string; platform: Platform }>(sql`${cte}
      select to_char(date_trunc('day', posted_at at time zone ${TZ}), 'YYYY-MM-DD') as date, platform,
        count(*)::int as posts, coalesce(sum(views), 0)::float8 as views, coalesce(sum(eng), 0)::float8 as engagement
      from f group by 1, 2`);
    const map = new Map<string, TimelinePoint>();
    for (const { date, platform, ...v } of rows) {
      let pt = map.get(date);
      if (!pt) map.set(date, (pt = emptyPoint(date)));
      add(pt, v);
      pt.platforms[platform] = v;
    }
    return map;
  }

  /**
   * Pertumbuhan dari riwayat snapshot dalam [from, to].
   * Titik awal tiap link = snapshot terakhir sebelum `from`. Bila tidak ada:
   *  - postingan baru (terbit di rentang / mulai dipantau ≤ 7 hari setelah terbit) → mulai dari 0
   *  - selain itu snapshot pertama di rentang dipakai sebagai titik awal (riwayat sebelumnya tidak diketahui)
   * Penurunan (koreksi provider / postingan dihapus) tidak dihitung sebagai pertumbuhan negatif.
   */
  private async growth(q: AnalyticsQueryPayload, window: Window | null, trackingSince: Date | null): Promise<GrowthResult> {
    const f = this.cte(q); // pertumbuhan tidak dibatasi tanggal posting: postingan lama yang naik tetap terhitung
    const to = (window?.to ?? new Date()).toISOString();
    const from = window?.from.toISOString() ?? null;

    const [snaps, links] = await Promise.all([
      this.rows<SnapRow>(sql`${f},
        snap as (
          select s.link_id, s.captured_at, s.views::float8 as views, s.likes::float8 as likes, s.comments::float8 as comments,
            s.shares::float8 as shares, s.saves::float8 as saves, s.author_followers::float8 as followers
          from link_metric_snapshots s join f on f.id = s.link_id
          where s.captured_at <= ${to}::timestamptz
        ),
        b as (
          select distinct on (link_id) * from snap
          where ${from}::timestamptz is not null and captured_at < ${from}::timestamptz
          order by link_id, captured_at desc
        ),
        w as (
          select distinct on (link_id, day) *, to_char((captured_at at time zone ${TZ})::date, 'YYYY-MM-DD') as day from snap
          where captured_at >= coalesce(${from}::timestamptz, '-infinity'::timestamptz)
          order by link_id, day, captured_at desc
        )
        select 'b' as kind, link_id, null as day, captured_at, views, likes, comments, shares, saves, followers from b
        union all
        select 'w', link_id, day, captured_at, views, likes, comments, shares, saves, followers from w
        order by link_id, kind, day`),
      this.rows<LinkRow>(sql`${f}
        select id, data_url_id, campaign, platform, url, nullif(meta->>'author', '') as author,
          nullif(meta->>'cover', '') as cover, views::float8 as views, posted_at from f`),
    ]);

    const linkMap = new Map(links.map((l) => [l.id, l]));
    const bySnapLink = new Map<string, SnapRow[]>();
    for (const s of snaps) bySnapLink.set(s.link_id, [...(bySnapLink.get(s.link_id) ?? []), s]);

    const totals: AnalyticsGrowth = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement: 0, tracked: 0, trackingSince: trackingSince?.toISOString() ?? null };
    const daily: GrowthResult['daily'] = new Map();
    const perLink: GrowthResult['perLink'] = new Map();
    const followers: GrowthResult['followers'] = new Map();

    for (const [linkId, rows] of bySnapLink) {
      const link = linkMap.get(linkId);
      if (!link) continue;
      totals.tracked++;
      const baseRow = rows.find((r) => r.kind === 'b');
      const days = rows.filter((r) => r.kind === 'w');
      const postedAt = new Date(link.posted_at).getTime();
      const firstCapture = days[0] ? new Date(days[0].captured_at).getTime() : null;

      let prev: Metrics5 | null = baseRow ?? null;
      if (!prev) {
        const fresh = (window && postedAt >= window.from.getTime())
          || (firstCapture !== null && firstCapture - postedAt <= FRESH_POST_MS);
        if (fresh) prev = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
      }
      const baseViews = baseRow ? baseRow.views : prev ? 0 : days[0]?.views ?? null;

      const lg = { views: 0, engagement: 0, baseViews };
      for (const d of days) {
        if (!prev) { prev = d; continue; }
        const gain = Object.fromEntries(METRICS.map((m) => [m, Math.max(0, d[m] - prev![m])])) as Metrics5;
        const engGain = gain.likes + gain.comments + gain.shares + gain.saves;
        for (const m of METRICS) totals[m] += gain[m];
        totals.engagement += engGain;
        lg.views += gain.views;
        lg.engagement += engGain;
        if (gain.views || engGain) {
          let day = daily.get(d.day!);
          if (!day) daily.set(d.day!, (day = { gained: { views: 0, engagement: 0 }, platforms: {} }));
          day.gained.views += gain.views; day.gained.engagement += engGain;
          const p = (day.platforms[link.platform] ??= { views: 0, engagement: 0 });
          p.views += gain.views; p.engagement += engGain;
        }
        prev = d;
      }
      perLink.set(linkId, lg);

      // followers: selisih angka pertama & terakhir yang diketahui di rentang (termasuk titik awal)
      const fol = rows.map((r) => r.followers).filter((v): v is number => v != null);
      if (link.author && fol.length >= 2) {
        const key = `${link.platform}:${link.author}`;
        followers.set(key, Math.max(followers.get(key) ?? -Infinity, fol[fol.length - 1] - fol[0]));
      }
    }
    return { totals, daily, perLink, followers, links: linkMap };
  }

  async overview(q: AnalyticsQueryPayload): Promise<AnalyticsOverview> {
    const now = new Date();
    const days = q.range === 'all' ? null : RANGE_DAYS[q.range];
    const window = days ? { from: new Date(now.getTime() - days * DAY), to: now } : undefined;
    const prevWindow = window && days ? { from: new Date(window.from.getTime() - days * DAY), to: window.from } : undefined;
    const f = this.cte(q, window);
    const syncable = sql.join(SYNCABLE_PLATFORMS.map((p) => sql`${p}`), sql`, `);

    const [{ since }] = await this.rows<{ since: Date | null }>(sql`select min(captured_at) as since from link_metric_snapshots`);
    const trackingSince = since ? new Date(since) : null;

    const [kpis, previous, [sync], byPlatform, daily, prevDaily, topPosts, topAuthors, topHashtags, campaigns, sentiment, growth, prevGrowth] = await Promise.all([
      this.kpis(f),
      prevWindow ? this.kpis(this.cte(q, prevWindow)) : Promise.resolve(null),
      this.rows<AnalyticsOverview['sync']>(sql`${f}
        select
          count(*) filter (where last_synced_at is not null and last_sync_error is null)::int as synced,
          count(*) filter (where last_sync_error is not null)::int as failed,
          count(*) filter (where platform::text in (${syncable}) and last_synced_at is null and last_sync_error is null)::int as pending,
          count(*) filter (where platform::text not in (${syncable}))::int as manual,
          max(last_synced_at) as "lastSyncedAt"
        from f`),
      this.rows<Omit<PlatformStats, 'er' | 'avgViews' | 'avgEngagement' | 'share'>>(sql`${f}
        select platform, count(*)::int as posts,
          coalesce(sum(views), 0)::float8 as views, coalesce(sum(likes), 0)::float8 as likes,
          coalesce(sum(comments), 0)::float8 as comments, coalesce(sum(shares), 0)::float8 as shares,
          coalesce(sum(saves), 0)::float8 as saves, coalesce(sum(eng), 0)::float8 as engagement
        from f group by platform order by views desc, posts desc`),
      this.dailyByPlatform(f),
      prevWindow ? this.dailyByPlatform(this.cte(q, prevWindow)) : Promise.resolve(null),
      this.rows<Omit<AnalyticsOverview['topPosts'][number], 'er'>>(sql`${f}
        select id, data_url_id as "dataUrlId", campaign, platform, url,
          meta->>'author' as author, meta->>'text' as text, nullif(meta->>'cover', '') as cover,
          case when meta->>'postedAt' is not null then posted_at end as "postedAt",
          views::float8 as views, eng as engagement
        from f order by views desc, eng desc limit 8`),
      this.rows<Omit<AnalyticsOverview['topAuthors'][number], 'followersGain' | 'gainedViews'>>(sql`${f}
        select meta->>'author' as author, platform,
          nullif(max(meta->>'authorName'), '') as name, nullif(max(meta->>'authorAvatar'), '') as avatar,
          max(case when jsonb_typeof(meta->'authorFollowers') = 'number' then (meta->>'authorFollowers')::float8 end) as followers,
          coalesce(bool_or((meta->>'authorVerified')::boolean), false) as verified,
          count(*)::int as posts, coalesce(sum(views), 0)::float8 as views, coalesce(sum(eng), 0)::float8 as engagement
        from f where meta->>'author' is not null
        group by 1, 2 order by views desc limit 8`),
      this.rows<AnalyticsOverview['topHashtags'][number]>(sql`${f}
        select lower(h.tag) as tag, count(*)::int as posts, coalesce(sum(f.views), 0)::float8 as views
        from f cross join lateral jsonb_array_elements_text(
          case when jsonb_typeof(f.meta->'hashtags') = 'array' then f.meta->'hashtags' else '[]'::jsonb end
        ) as h(tag)
        group by 1 order by views desc, posts desc limit 12`),
      this.rows<Omit<AnalyticsOverview['campaigns'][number], 'er'>>(sql`${f}
        select data_url_id as id, campaign as title, count(*)::int as posts,
          coalesce(sum(views), 0)::float8 as views, coalesce(sum(eng), 0)::float8 as engagement
        from f group by 1, 2 order by views desc limit 6`),
      this.rows<AnalyticsOverview['sentiment'][number]>(sql`${f}
        select lower(meta->'sentiment'->>'polarity') as polarity, count(*)::int as posts
        from f where meta->'sentiment'->>'polarity' is not null
        group by 1 order by posts desc`),
      this.growth(q, window ?? null, trackingSince),
      prevWindow ? this.growth(q, prevWindow, trackingSince) : Promise.resolve(null),
    ]);

    // ---------- timeline: tanggal posting + pertumbuhan, harian tanpa celah ----------
    const allDays = [...daily.keys(), ...growth.daily.keys()].sort();
    const start = window?.from ?? (allDays[0] ? new Date(`${allDays[0]}T00:00:00+07:00`) : now);
    let points = fillGaps(daily, start, now).map((p) => {
      const g = growth.daily.get(p.date);
      return g ? { ...p, gained: { ...g.gained }, gainedPlatforms: structuredClone(g.platforms) } : p;
    });
    if (prevDaily && prevWindow && prevGrowth) {
      // sejajarkan periode sebelumnya per posisi hari (hari ke-1 vs hari ke-1, dst)
      const prevPoints = fillGaps(prevDaily, prevWindow.from, prevWindow.to);
      const offset = prevPoints.length - points.length;
      points = points.map((p, i) => {
        const pp = prevPoints[i + offset];
        const pg = pp ? prevGrowth.daily.get(pp.date)?.gained : undefined;
        return {
          ...p,
          prev: pp ? { posts: pp.posts, views: pp.views, engagement: pp.engagement } : ZERO(),
          prevGained: pg ? { ...pg } : { views: 0, engagement: 0 },
        };
      });
    }
    const bucket: 'day' | 'week' = points.length > 120 ? 'week' : 'day';
    const totalViews = byPlatform.reduce((a, p) => a + p.views, 0);

    // ---------- postingan dengan kenaikan terbesar ----------
    const topGrowers = [...growth.perLink.entries()]
      .filter(([, g]) => g.views > 0 || g.engagement > 0)
      .sort((a, b) => b[1].views - a[1].views || b[1].engagement - a[1].engagement)
      .slice(0, 8)
      .map(([id, g]) => {
        const l = growth.links.get(id)!;
        return {
          id, dataUrlId: l.data_url_id, campaign: l.campaign, platform: l.platform, url: l.url, author: l.author, cover: l.cover,
          views: l.views, gainedViews: g.views, gainedEngagement: g.engagement,
          gainedPct: g.baseViews ? (g.views / g.baseViews) * 100 : null,
        };
      });

    // kenaikan views per akun
    const authorGain = new Map<string, number>();
    for (const [id, g] of growth.perLink) {
      const l = growth.links.get(id);
      if (l?.author) authorGain.set(`${l.platform}:${l.author}`, (authorGain.get(`${l.platform}:${l.author}`) ?? 0) + g.views);
    }

    return {
      range: q.range,
      kpis,
      previous,
      growth: growth.totals,
      previousGrowth: prevGrowth?.totals ?? null,
      topGrowers,
      sync: { ...sync, lastSyncedAt: sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toISOString() : null },
      byPlatform: byPlatform.map((p) => ({
        ...p,
        er: er(p.engagement, p.views),
        avgViews: p.posts ? p.views / p.posts : 0,
        avgEngagement: p.posts ? p.engagement / p.posts : 0,
        share: totalViews ? (p.views / totalViews) * 100 : 0,
      })),
      timeline: bucket === 'week' ? toWeeks(points) : points,
      bucket,
      topPosts: topPosts.map((p) => ({ ...p, postedAt: p.postedAt ? new Date(p.postedAt).toISOString() : null, er: er(p.engagement, p.views) })),
      topAuthors: topAuthors.map((a) => {
        const key = `${a.platform}:${a.author}`;
        return { ...a, followersGain: growth.followers.get(key) ?? null, gainedViews: authorGain.get(key) ?? 0 };
      }),
      topHashtags,
      campaigns: campaigns.map((c) => ({ ...c, er: er(c.engagement, c.views) })),
      sentiment,
    };
  }
}

const ZERO = (): TimelineValues => ({ posts: 0, views: 0, engagement: 0 });
const add = (a: TimelineValues, b: TimelineValues) => { a.posts += b.posts; a.views += b.views; a.engagement += b.engagement; };
const addGain = (a: GainValues, b: GainValues) => { a.views += b.views; a.engagement += b.engagement; };
const emptyPoint = (date: string): TimelinePoint => ({
  date, ...ZERO(), platforms: {}, prev: null, gained: { views: 0, engagement: 0 }, gainedPlatforms: {}, prevGained: null,
});

/** Gabungkan titik harian jadi mingguan (minggu dimulai Senin), tanggal = hari Senin. */
function toWeeks(daily: TimelinePoint[]) {
  const out: TimelinePoint[] = [];
  for (const d of daily) {
    const dt = new Date(`${d.date}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    const key = dt.toISOString().slice(0, 10);
    let last = out[out.length - 1];
    if (last?.date !== key) {
      out.push((last = { ...emptyPoint(key), prev: d.prev && ZERO(), prevGained: d.prevGained && { views: 0, engagement: 0 } }));
    }
    add(last, d);
    addGain(last.gained, d.gained);
    if (last.prev && d.prev) add(last.prev, d.prev);
    if (last.prevGained && d.prevGained) addGain(last.prevGained, d.prevGained);
    for (const [p, v] of Object.entries(d.platforms) as [Platform, TimelineValues][]) add((last.platforms[p] ??= ZERO()), v);
    for (const [p, v] of Object.entries(d.gainedPlatforms) as [Platform, GainValues][]) addGain((last.gainedPlatforms[p] ??= { views: 0, engagement: 0 }), v);
  }
  return out;
}

/** Isi hari kosong dengan 0 agar grafik tidak "melompat". Tanggal dihitung di zona Asia/Jakarta. */
function fillGaps(daily: Map<string, TimelinePoint>, from: Date, to: Date) {
  const out: TimelinePoint[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const k = dayKey(new Date(t));
    if (!out.length || out[out.length - 1].date !== k) out.push(daily.get(k) ?? emptyPoint(k));
  }
  // pastikan hari terakhir (hari ini) ikut, walau loop berhenti sebelum melewati tengah malam
  const last = dayKey(to);
  if (out[out.length - 1]?.date !== last) out.push(daily.get(last) ?? emptyPoint(last));
  return out;
}
