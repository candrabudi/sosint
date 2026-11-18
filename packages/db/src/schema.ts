import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, doublePrecision, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** angka analitik bisa sangat besar (views jutaan+) → bigint, dibaca sebagai number */
const metric = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);

export const userRole = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    // simpan hash (bcrypt), JANGAN plain text
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('users_role_idx').on(t.role), index('users_is_active_idx').on(t.isActive)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

// ---------- Data URL ----------

export const platform = pgEnum('platform', ['instagram', 'tiktok', 'x', 'facebook', 'youtube', 'threads', 'linkedin', 'other']);

/** Grup / kampanye yang berisi banyak link postingan. */
export const dataUrls = pgTable(
  'data_urls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('data_urls_tags_gin_idx').using('gin', t.tags),
    index('data_urls_is_active_idx').on(t.isActive),
  ],
);

/** Link postingan per platform beserta snapshot analitik terbarunya. */
export const dataUrlLinks = pgTable(
  'data_url_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataUrlId: uuid('data_url_id')
      .notNull()
      .references(() => dataUrls.id, { onDelete: 'cascade' }),
    platform: platform('platform').notNull(),
    url: text('url').notNull(),
    views: metric('views'),
    likes: metric('likes'),
    comments: metric('comments'),
    shares: metric('shares'),
    saves: metric('saves'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    /** info tambahan dari provider (author, isi, tanggal posting, sentimen, dll) */
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    /** pesan error sinkron terakhir; null = sukses */
    lastSyncError: text('last_sync_error'),
    /** komentar terakhir berhasil ditarik; null = belum pernah / platform belum didukung */
    commentsSyncedAt: timestamp('comments_synced_at', { withTimezone: true }),
    commentsSyncError: text('comments_sync_error'),
    ...timestamps,
  },
  (t) => [
    index('data_url_links_data_url_id_idx').on(t.dataUrlId),
    index('data_url_links_platform_idx').on(t.platform),
    unique('data_url_links_data_url_id_url_unique').on(t.dataUrlId, t.url),
    check('data_url_links_metrics_non_negative',
      sql`${t.views} >= 0 and ${t.likes} >= 0 and ${t.comments} >= 0 and ${t.shares} >= 0 and ${t.saves} >= 0`),
  ],
);

export const snapshotSource = pgEnum('snapshot_source', ['sync', 'manual']);

/**
 * Riwayat metrik per link: satu baris setiap kali angka diambil (sinkron) atau diedit manual.
 * `data_url_links` tetap menyimpan angka terbaru; tabel ini untuk analitik pertumbuhan.
 */
export const linkMetricSnapshots = pgTable(
  'link_metric_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkId: uuid('link_id')
      .notNull()
      .references(() => dataUrlLinks.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    views: metric('views'),
    likes: metric('likes'),
    comments: metric('comments'),
    shares: metric('shares'),
    saves: metric('saves'),
    /** followers akun pemilik postingan saat diambil (bila provider mengirim) */
    authorFollowers: bigint('author_followers', { mode: 'number' }),
    source: snapshotSource('source').notNull().default('sync'),
  },
  (t) => [
    index('link_metric_snapshots_link_captured_idx').on(t.linkId, t.capturedAt),
    index('link_metric_snapshots_captured_idx').on(t.capturedAt),
  ],
);

/**
 * Komentar/balasan sebuah postingan, ditarik setiap sinkron.
 * Unik per (link, external_id) → sinkron berikutnya memperbarui angka & sentimen, bukan menduplikasi.
 */
export const linkComments = pgTable(
  'link_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkId: uuid('link_id')
      .notNull()
      .references(() => dataUrlLinks.id, { onDelete: 'cascade' }),
    /** id stabil dari provider (URL komentar; fallback author+tanggal) */
    externalId: text('external_id').notNull(),
    url: text('url'),
    author: varchar('author', { length: 200 }).notNull(),
    authorName: varchar('author_name', { length: 200 }),
    authorAvatar: text('author_avatar'),
    authorFollowers: bigint('author_followers', { mode: 'number' }),
    authorVerified: boolean('author_verified'),
    text: text('text').notNull().default(''),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    likes: metric('likes'),
    replies: metric('replies'),
    shares: metric('shares'),
    views: metric('views'),
    isPinned: boolean('is_pinned'),
    lang: varchar('lang', { length: 16 }),
    polarity: varchar('polarity', { length: 16 }),
    dominantEmotion: varchar('dominant_emotion', { length: 32 }),
    intensity: doublePrecision('intensity'),
    emotions: jsonb('emotions').$type<Record<string, number>>(),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    unique('link_comments_link_external_unique').on(t.linkId, t.externalId),
    index('link_comments_link_posted_idx').on(t.linkId, t.postedAt),
    index('link_comments_polarity_idx').on(t.polarity),
  ],
);

export type DataUrlRow = typeof dataUrls.$inferSelect;
export type LinkCommentRow = typeof linkComments.$inferSelect;
export type LinkMetricSnapshotRow = typeof linkMetricSnapshots.$inferSelect;
export type DataUrlLinkRow = typeof dataUrlLinks.$inferSelect;

// ---------- Pengaturan aplikasi ----------

/** Key-value pengaturan (mis. "integration.apidirect"). Nilai rahasia disimpan terenkripsi di dalam value. */
export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

export type AppSettingRow = typeof appSettings.$inferSelect;
