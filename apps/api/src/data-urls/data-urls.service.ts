import {
  BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type Database, dataUrlLinks, dataUrls, linkComments, linkMetricSnapshots, users } from '@sig/db';
import type {
  CommentPage, CommentQueryPayload, CreateDataUrlPayload, DataUrlQueryPayload, LinkPayload, Platform, UpdateDataUrlInput,
  UpdateLinkInput,
} from '@sig/shared';
import {
  type BulkLinksResult, type DataUrlHistory, type DataUrlHistoryPoint, isSyncable, type LinkSnapshot, METRICS, type MetricTotals,
  parseUrlList, PLATFORM_LABELS, supportsComments, type SyncDataUrlResult,
  type SyncLinkResult,
} from '@sig/shared';
import { and, arrayContains, asc, desc, eq, exists, ilike, isNull, or, type SQL, sql } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { ApiDirectError, ApiDirectService } from '../integrations/apidirect.service';

function isUniqueViolation(err: any) {
  return err?.cause?.code === '23505' || err?.code === '23505';
}
const linkConflict = () => new ConflictException('Link ini sudah ada di Data Url tersebut');

// agregat per data url; ::float8 agar pg mengembalikan number, bukan string bigint
const sum = (col: (typeof dataUrlLinks)[(typeof METRICS)[number]]) => sql<number>`coalesce(sum(${col}), 0)::float8`;

const listColumns = {
  id: dataUrls.id,
  title: dataUrls.title,
  tags: dataUrls.tags,
  isActive: dataUrls.isActive,
  createdAt: dataUrls.createdAt,
  updatedAt: dataUrls.updatedAt,
  creatorId: users.id,
  creatorName: users.fullName,
  linkCount: sql<number>`count(${dataUrlLinks.id})::int`,
  platforms: sql<Platform[]>`coalesce(array_agg(distinct ${dataUrlLinks.platform}::text) filter (where ${dataUrlLinks.id} is not null), '{}')`,
  views: sum(dataUrlLinks.views),
  likes: sum(dataUrlLinks.likes),
  comments: sum(dataUrlLinks.comments),
  shares: sum(dataUrlLinks.shares),
  saves: sum(dataUrlLinks.saves),
};

interface ListRow {
  id: string;
  title: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  creatorId: string | null;
  creatorName: string | null;
  linkCount: number;
  platforms: Platform[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

function toDto({ creatorId, creatorName, views, likes, comments, shares, saves, ...r }: ListRow) {
  return {
    ...r,
    createdBy: creatorId ? { id: creatorId, fullName: creatorName! } : null,
    totals: { views, likes, comments, shares, saves },
  };
}

@Injectable()
export class DataUrlsService {
  private readonly logger = new Logger(DataUrlsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly apidirect: ApiDirectService,
  ) {}

  private baseQuery(where?: SQL) {
    return this.db
      .select(listColumns)
      .from(dataUrls)
      .leftJoin(dataUrlLinks, eq(dataUrlLinks.dataUrlId, dataUrls.id))
      .leftJoin(users, eq(users.id, dataUrls.createdBy))
      .where(where)
      .groupBy(dataUrls.id, users.id);
  }

  async findAll(q: DataUrlQueryPayload) {
    const filters: SQL[] = [];
    if (q.search) filters.push(ilike(dataUrls.title, `%${q.search.replace(/[%_]/g, '\\$&')}%`));
    if (q.tag) filters.push(arrayContains(dataUrls.tags, [q.tag]));
    if (q.isActive !== undefined) filters.push(eq(dataUrls.isActive, q.isActive));
    if (q.platform) {
      filters.push(exists(
        this.db.select({ x: sql`1` }).from(dataUrlLinks)
          .where(and(eq(dataUrlLinks.dataUrlId, dataUrls.id), eq(dataUrlLinks.platform, q.platform))),
      ));
    }
    const where = filters.length ? and(...filters) : undefined;
    const { page, pageSize } = q;

    const [rows, [agg]] = await Promise.all([
      this.baseQuery(where)
        .orderBy(desc(dataUrls.createdAt), desc(dataUrls.id)) // id sebagai tie-breaker agar urutan halaman stabil
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      // ringkasan untuk SELURUH hasil filter, bukan hanya halaman ini
      this.db
        .select({
          count: sql<number>`count(distinct ${dataUrls.id})::int`,
          links: sql<number>`count(${dataUrlLinks.id})::int`,
          views: sum(dataUrlLinks.views),
          likes: sum(dataUrlLinks.likes),
          comments: sum(dataUrlLinks.comments),
          shares: sum(dataUrlLinks.shares),
          saves: sum(dataUrlLinks.saves),
        })
        .from(dataUrls)
        .leftJoin(dataUrlLinks, eq(dataUrlLinks.dataUrlId, dataUrls.id))
        .where(where),
    ]);

    const { count, links, ...totals } = agg;
    return {
      items: rows.map(toDto),
      total: count,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(count / pageSize)),
      summary: { count, links, totals },
    };
  }

  /** Semua tag unik (untuk filter), terurut. */
  async findTags() {
    const rows = await this.db.selectDistinct({ tag: sql<string>`unnest(${dataUrls.tags})` }).from(dataUrls);
    return rows.map((r) => r.tag).sort((a, b) => a.localeCompare(b));
  }

  async findOne(id: string) {
    const [row] = await this.baseQuery(eq(dataUrls.id, id));
    if (!row) throw new NotFoundException('Data Url tidak ditemukan');
    const links = await this.db.select().from(dataUrlLinks)
      .where(eq(dataUrlLinks.dataUrlId, id))
      .orderBy(asc(dataUrlLinks.createdAt));
    return { ...toDto(row), links };
  }

  async create({ links, ...input }: CreateDataUrlPayload, actorId: string) {
    const result = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(dataUrls).values({ ...input, createdBy: actorId }).returning({ id: dataUrls.id });
      // URL sudah dinormalisasi oleh schema → buang duplikat sebelum insert
      const unique = [...new Map(links.map((l) => [l.url, l])).values()];
      // last_synced_at sengaja dibiarkan null: belum pernah ditarik dari provider
      const inserted = unique.length
        ? await tx.insert(dataUrlLinks).values(unique.map((l) => ({ ...l, dataUrlId: created.id })))
          .returning({ id: dataUrlLinks.id, url: dataUrlLinks.url, platform: dataUrlLinks.platform })
        : [];
      return { id: created.id, inserted };
    }).catch((err) => {
      if (isUniqueViolation(err)) throw new ConflictException('Ada link yang duplikat');
      throw err;
    });
    this.syncInBackground(result.id, result.inserted);
    return this.findOne(result.id);
  }

  async update(id: string, input: UpdateDataUrlInput) {
    const [row] = await this.db.update(dataUrls).set(input).where(eq(dataUrls.id, id)).returning({ id: dataUrls.id });
    if (!row) throw new NotFoundException('Data Url tidak ditemukan');
    return this.findOne(id);
  }

  async remove(id: string) {
    // link ikut terhapus (ON DELETE CASCADE)
    const [row] = await this.db.delete(dataUrls).where(eq(dataUrls.id, id)).returning({ id: dataUrls.id });
    if (!row) throw new NotFoundException('Data Url tidak ditemukan');
    return { id: row.id, deleted: true };
  }

  // ---------- links ----------

  async addLink(dataUrlId: string, input: LinkPayload) {
    await this.ensureExists(dataUrlId);
    try {
      const [link] = await this.db.insert(dataUrlLinks).values({ ...input, dataUrlId }).returning();
      await this.touch(dataUrlId);
      this.syncInBackground(dataUrlId, [link]);
      return link;
    } catch (err) {
      if (isUniqueViolation(err)) throw linkConflict();
      throw err;
    }
  }

  /** Tambah banyak link sekaligus; platform dideteksi otomatis, link yang sudah ada dilewati. */
  async addLinksBulk(dataUrlId: string, rawUrls: string[]): Promise<BulkLinksResult> {
    await this.ensureExists(dataUrlId);
    const { valid, invalid, duplicates } = parseUrlList(rawUrls.join('\n'));
    if (!valid.length) return { added: 0, skipped: duplicates, invalid, syncQueued: 0 };

    const inserted = await this.db.insert(dataUrlLinks)
      .values(valid.map((v) => ({ ...v, dataUrlId })))
      .onConflictDoNothing({ target: [dataUrlLinks.dataUrlId, dataUrlLinks.url] })
      .returning({ id: dataUrlLinks.id, url: dataUrlLinks.url, platform: dataUrlLinks.platform });
    if (inserted.length) await this.touch(dataUrlId);
    const queued = this.syncInBackground(dataUrlId, inserted);

    return { added: inserted.length, skipped: duplicates + (valid.length - inserted.length), invalid, syncQueued: queued };
  }

  async updateLink(dataUrlId: string, linkId: string, input: UpdateLinkInput) {
    const metricsChanged = METRICS.some((m) => input[m] !== undefined);
    try {
      const [link] = await this.db.update(dataUrlLinks)
        .set({ ...input, ...(metricsChanged && { lastSyncedAt: new Date() }) })
        .where(and(eq(dataUrlLinks.id, linkId), eq(dataUrlLinks.dataUrlId, dataUrlId)))
        .returning();
      if (!link) throw new NotFoundException('Link tidak ditemukan');
      if (metricsChanged) {
        // edit manual juga tercatat di riwayat (ditandai source=manual)
        const { views, likes, comments, shares, saves } = link;
        await this.db.insert(linkMetricSnapshots).values({
          linkId, capturedAt: link.lastSyncedAt ?? new Date(), views, likes, comments, shares, saves, source: 'manual',
        });
      }
      await this.touch(dataUrlId);
      return link;
    } catch (err) {
      if (isUniqueViolation(err)) throw linkConflict();
      throw err;
    }
  }

  // ---------- sinkron analitik ----------

  /** Tarik analitik terbaru satu link dari provider (apidirect: X, TikTok, Instagram). */
  async syncLink(dataUrlId: string, linkId: string) {
    const [link] = await this.db.select().from(dataUrlLinks)
      .where(and(eq(dataUrlLinks.id, linkId), eq(dataUrlLinks.dataUrlId, dataUrlId)));
    if (!link) throw new NotFoundException('Link tidak ditemukan');
    if (!isSyncable(link.platform)) {
      throw new BadRequestException(`Sinkron otomatis belum tersedia untuk ${PLATFORM_LABELS[link.platform]}`);
    }
    if (!(await this.apidirect.isConfigured())) throw new ServiceUnavailableException('API key apidirect belum diatur (menu Pengaturan → Integrasi)');

    const result = await this.pullAndSave(link.id, link.url, link.platform);
    if (!result.ok) throw new BadGatewayException(result.error);
    await this.touch(dataUrlId);
    const [updated] = await this.db.select().from(dataUrlLinks).where(eq(dataUrlLinks.id, linkId));
    return updated;
  }

  /** Sinkron semua link yang didukung dalam satu Data Url (maks. 3 request paralel). */
  async syncAll(dataUrlId: string): Promise<SyncDataUrlResult> {
    await this.ensureExists(dataUrlId);
    if (!(await this.apidirect.isConfigured())) throw new ServiceUnavailableException('API key apidirect belum diatur (menu Pengaturan → Integrasi)');

    const links = await this.db.select({ id: dataUrlLinks.id, url: dataUrlLinks.url, platform: dataUrlLinks.platform })
      .from(dataUrlLinks).where(eq(dataUrlLinks.dataUrlId, dataUrlId));
    const targets = links.filter((l) => isSyncable(l.platform));

    const results = await this.runSync(targets);

    if (results.some((r) => r.ok)) await this.touch(dataUrlId);
    const synced = results.filter((r) => r.ok).length;
    return { synced, failed: results.length - synced, skipped: links.length - targets.length, results };
  }

  /**
   * Sinkron link baru di background (tidak menahan response). Hanya platform yang didukung
   * dan bila API key sudah diatur. Mengembalikan jumlah link yang diantrikan.
   */
  private syncInBackground(dataUrlId: string, links: { id: string; url: string; platform: Platform }[]): number {
    const targets = links.filter((l) => isSyncable(l.platform));
    if (!targets.length) return 0;
    void (async () => {
      if (!(await this.apidirect.isConfigured())) return;
      await this.runSync(targets);
      await this.touch(dataUrlId);
    })().catch((err) => this.logger.error(`auto-sync ${dataUrlId} gagal`, err as Error));
    return targets.length;
  }

  /** Jalankan sinkron dengan maks. 3 request paralel. */
  async runSync(targets: { id: string; url: string; platform: Platform }[]) {
    const results: SyncLinkResult[] = [];
    const queue = [...targets];
    const worker = async () => {
      for (let l = queue.shift(); l; l = queue.shift()) results.push(await this.pullAndSave(l.id, l.url, l.platform));
    };
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
    return results;
  }

  /** Panggil provider lalu simpan metrik + meta; error disimpan di last_sync_error, tidak melempar. */
  private async pullAndSave(linkId: string, url: string, platform: Platform): Promise<SyncLinkResult> {
    try {
      const { metrics, meta } = await this.apidirect.getStats(platform, url);
      const now = new Date();
      await this.db.transaction(async (tx) => {
        await tx.update(dataUrlLinks)
          .set({ ...metrics, meta: meta as unknown as Record<string, unknown>, lastSyncedAt: now, lastSyncError: null })
          .where(eq(dataUrlLinks.id, linkId));
        // riwayat: setiap sinkron sukses = satu titik baru
        await tx.insert(linkMetricSnapshots).values({
          linkId, capturedAt: now, ...metrics, authorFollowers: meta.authorFollowers ?? null, source: 'sync',
        });
      });
      // komentar wajib ikut ditarik; gagal di sini tidak menggagalkan sinkron statistik
      if (supportsComments(platform)) await this.pullComments(linkId, url, platform);
      return { linkId, ok: true };
    } catch (err) {
      const error = err instanceof ApiDirectError ? err.message : 'Gagal sinkron (error tidak terduga)';
      if (!(err instanceof ApiDirectError)) this.logger.error(`sync ${linkId} gagal`, err as Error);
      await this.db.update(dataUrlLinks).set({ lastSyncError: error }).where(eq(dataUrlLinks.id, linkId));
      return { linkId, ok: false, error };
    }
  }

  /** Tarik komentar lalu upsert (komentar yang sudah ada diperbarui angka & sentimennya). */
  private async pullComments(linkId: string, url: string, platform: Platform) {
    try {
      const comments = await this.apidirect.getComments(platform, url);
      // provider bisa mengirim duplikat dalam satu respons → unik per externalId
      const unique = [...new Map(comments.map((c) => [c.externalId, c])).values()];
      const now = new Date();
      if (unique.length) {
        await this.db.insert(linkComments)
          .values(unique.map((c) => ({ ...c, linkId })))
          .onConflictDoUpdate({
            target: [linkComments.linkId, linkComments.externalId],
            set: {
              text: sql`excluded.text`, likes: sql`excluded.likes`, replies: sql`excluded.replies`, shares: sql`excluded.shares`,
              views: sql`excluded.views`, authorName: sql`coalesce(excluded.author_name, ${linkComments.authorName})`,
              authorAvatar: sql`coalesce(excluded.author_avatar, ${linkComments.authorAvatar})`,
              authorFollowers: sql`coalesce(excluded.author_followers, ${linkComments.authorFollowers})`,
              authorVerified: sql`coalesce(excluded.author_verified, ${linkComments.authorVerified})`,
              isPinned: sql`excluded.is_pinned`,
              polarity: sql`coalesce(excluded.polarity, ${linkComments.polarity})`,
              dominantEmotion: sql`coalesce(excluded.dominant_emotion, ${linkComments.dominantEmotion})`,
              intensity: sql`coalesce(excluded.intensity, ${linkComments.intensity})`,
              emotions: sql`coalesce(excluded.emotions, ${linkComments.emotions})`,
              raw: sql`excluded.raw`, updatedAt: now,
            },
          });
      }
      await this.db.update(dataUrlLinks).set({ commentsSyncedAt: now, commentsSyncError: null }).where(eq(dataUrlLinks.id, linkId));
    } catch (err) {
      const error = err instanceof ApiDirectError ? err.message : 'Gagal menarik komentar';
      if (!(err instanceof ApiDirectError)) this.logger.error(`komentar ${linkId} gagal`, err as Error);
      await this.db.update(dataUrlLinks).set({ commentsSyncError: error }).where(eq(dataUrlLinks.id, linkId));
    }
  }

  /** Daftar komentar satu Data Url (ber-halaman) + ringkasan sentimen untuk filter yang sama (tanpa filter polarity). */
  async listComments(dataUrlId: string, q: CommentQueryPayload): Promise<CommentPage> {
    await this.ensureExists(dataUrlId);
    const base: SQL[] = [eq(dataUrlLinks.dataUrlId, dataUrlId)];
    if (q.linkId) base.push(eq(linkComments.linkId, q.linkId));
    if (q.platform) base.push(eq(dataUrlLinks.platform, q.platform));
    if (q.search) {
      const s = `%${q.search.replace(/[%_]/g, '\\$&')}%`;
      base.push(or(ilike(linkComments.text, s), ilike(linkComments.author, s))!);
    }
    const filters = [...base];
    if (q.polarity === 'none') filters.push(isNull(linkComments.polarity));
    else if (q.polarity) filters.push(eq(linkComments.polarity, q.polarity));

    const order = q.sort === 'likes' ? [desc(linkComments.likes), desc(linkComments.postedAt)]
      : q.sort === 'replies' ? [desc(linkComments.replies), desc(linkComments.postedAt)]
      : [sql`${linkComments.postedAt} desc nulls last`, desc(linkComments.firstSeenAt)];

    const from = () => this.db.select().from(linkComments).innerJoin(dataUrlLinks, eq(dataUrlLinks.id, linkComments.linkId));
    const [rows, [{ total }], [sum], emotions] = await Promise.all([
      from().where(and(...filters)).orderBy(...order, desc(linkComments.id))
        .limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ total: sql<number>`count(*)::int` }).from(linkComments)
        .innerJoin(dataUrlLinks, eq(dataUrlLinks.id, linkComments.linkId)).where(and(...filters)),
      this.db.select({
        all: sql<number>`count(*)::int`,
        positive: sql<number>`count(*) filter (where ${linkComments.polarity} = 'positive')::int`,
        neutral: sql<number>`count(*) filter (where ${linkComments.polarity} = 'neutral')::int`,
        negative: sql<number>`count(*) filter (where ${linkComments.polarity} = 'negative')::int`,
        none: sql<number>`count(*) filter (where ${linkComments.polarity} is null)::int`,
        new24h: sql<number>`count(*) filter (where ${linkComments.firstSeenAt} > now() - interval '24 hours')::int`,
      }).from(linkComments).innerJoin(dataUrlLinks, eq(dataUrlLinks.id, linkComments.linkId)).where(and(...base)),
      this.db.select({ emotion: linkComments.dominantEmotion, comments: sql<number>`count(*)::int` }).from(linkComments)
        .innerJoin(dataUrlLinks, eq(dataUrlLinks.id, linkComments.linkId))
        .where(and(...base, sql`${linkComments.dominantEmotion} is not null`))
        .groupBy(linkComments.dominantEmotion).orderBy(sql`count(*) desc`).limit(6),
    ]);

    return {
      items: rows.map(({ link_comments: c, data_url_links: l }) => ({
        id: c.id, linkId: c.linkId, platform: l.platform, postUrl: l.url, url: c.url, author: c.author,
        authorName: c.authorName, authorAvatar: c.authorAvatar, authorFollowers: c.authorFollowers, authorVerified: c.authorVerified,
        text: c.text, postedAt: c.postedAt?.toISOString() ?? null, likes: c.likes, replies: c.replies, shares: c.shares, views: c.views,
        isPinned: c.isPinned, lang: c.lang, polarity: c.polarity, dominantEmotion: c.dominantEmotion, intensity: c.intensity,
        firstSeenAt: c.firstSeenAt.toISOString(),
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
      summary: {
        total: sum.all,
        polarity: { positive: sum.positive, neutral: sum.neutral, negative: sum.negative, none: sum.none },
        emotions: emotions.map((e) => ({ emotion: e.emotion!, comments: e.comments })),
        new24h: sum.new24h,
      },
    };
  }

  async removeLink(dataUrlId: string, linkId: string) {
    const [row] = await this.db.delete(dataUrlLinks)
      .where(and(eq(dataUrlLinks.id, linkId), eq(dataUrlLinks.dataUrlId, dataUrlId)))
      .returning({ id: dataUrlLinks.id });
    if (!row) throw new NotFoundException('Link tidak ditemukan');
    await this.touch(dataUrlId);
    return { id: row.id, deleted: true };
  }

  // ---------- riwayat ----------

  /** Semua snapshot satu link (terlama → terbaru), maks. 2000 titik terakhir. */
  async linkHistory(dataUrlId: string, linkId: string): Promise<LinkSnapshot[]> {
    const [link] = await this.db.select({ id: dataUrlLinks.id }).from(dataUrlLinks)
      .where(and(eq(dataUrlLinks.id, linkId), eq(dataUrlLinks.dataUrlId, dataUrlId)));
    if (!link) throw new NotFoundException('Link tidak ditemukan');
    const rows = await this.db.select({
      capturedAt: linkMetricSnapshots.capturedAt, views: linkMetricSnapshots.views, likes: linkMetricSnapshots.likes,
      comments: linkMetricSnapshots.comments, shares: linkMetricSnapshots.shares, saves: linkMetricSnapshots.saves,
      authorFollowers: linkMetricSnapshots.authorFollowers, source: linkMetricSnapshots.source,
    }).from(linkMetricSnapshots).where(eq(linkMetricSnapshots.linkId, linkId))
      .orderBy(desc(linkMetricSnapshots.capturedAt)).limit(2000);
    return rows.reverse().map((r) => ({ ...r, capturedAt: r.capturedAt.toISOString() }));
  }

  /**
   * Total harian satu Data Url: angka terakhir tiap link per akhir hari (WIB),
   * dibawa ke hari berikutnya bila hari itu tidak disinkron. Maks. 365 hari terakhir.
   */
  async dataUrlHistory(id: string): Promise<DataUrlHistory> {
    await this.ensureExists(id);
    const res = await this.db.execute(sql`
      select distinct on (s.link_id, day)
        s.link_id, to_char((s.captured_at at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as day,
        s.views::float8 as views, s.likes::float8 as likes, s.comments::float8 as comments,
        s.shares::float8 as shares, s.saves::float8 as saves, s.captured_at
      from link_metric_snapshots s
      join data_url_links l on l.id = s.link_id
      where l.data_url_id = ${id}
      order by s.link_id, day, s.captured_at desc`);
    type Row = MetricTotals & { link_id: string; day: string; captured_at: Date };
    const rows = res.rows as Row[];
    if (!rows.length) return { points: [], trackingSince: null };

    const trackingSince = new Date(Math.min(...rows.map((r) => new Date(r.captured_at).getTime()))).toISOString();
    const byDay = new Map<string, Row[]>();
    for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);

    const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
    const today = dayKey(new Date());
    let day = [...byDay.keys()].sort()[0];
    const minDay = dayKey(new Date(Date.now() - 365 * 86_400_000));
    const latest = new Map<string, MetricTotals>(); // nilai terakhir tiap link (carry-forward)
    const points: DataUrlHistoryPoint[] = [];
    for (let guard = 0; day <= today && guard < 2000; guard++) {
      for (const r of byDay.get(day) ?? []) {
        latest.set(r.link_id, { views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves });
      }
      if (day >= minDay) {
        const t = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
        for (const v of latest.values()) for (const m of METRICS) t[m] += v[m];
        points.push({ date: day, links: latest.size, ...t });
      }
      const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      day = next.toISOString().slice(0, 10);
    }
    return { points, trackingSince };
  }

  private async ensureExists(id: string) {
    const [row] = await this.db.select({ id: dataUrls.id }).from(dataUrls).where(eq(dataUrls.id, id));
    if (!row) throw new NotFoundException('Data Url tidak ditemukan');
  }

  /** perubahan link juga memperbarui updated_at induknya */
  private touch(id: string) {
    return this.db.update(dataUrls).set({ updatedAt: new Date() }).where(eq(dataUrls.id, id));
  }
}
