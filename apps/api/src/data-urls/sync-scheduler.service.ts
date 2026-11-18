import { ConflictException, Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { type Database, dataUrlLinks, dataUrls } from '@sig/db';
import {
  COMMENT_PLATFORMS, DEFAULT_SYNC_SCHEDULE, type SyncRunSummary, type SyncScheduleInput, type SyncScheduleSettings, SYNCABLE_PLATFORMS,
} from '@sig/shared';
import { and, eq, inArray, isNull, lt, or, type SQL, sql } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { ApiDirectService } from '../integrations/apidirect.service';
import { SettingsService } from '../settings/settings.service';
import { DataUrlsService } from './data-urls.service';

const CONFIG_KEY = 'sync.schedule';
const STATE_KEY = 'sync.schedule.state';
const TICK_MS = 5 * 60_000; // cek jadwal tiap 5 menit
const HOUR = 3_600_000;

interface ScheduleState { lastRun: SyncRunSummary | null }

/**
 * Sinkron otomatis terjadwal → setiap sinkron menambah snapshot riwayat.
 * Tanpa dependensi tambahan: interval internal mengecek apakah jadwal sudah jatuh tempo.
 */
@Injectable()
export class SyncSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly apidirect: ApiDirectService,
    private readonly dataUrls: DataUrlsService,
  ) {}

  onApplicationBootstrap() {
    // cek pertama 1 menit setelah start, lalu berkala
    this.timer = setTimeout(() => this.tick(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private async tick() {
    try {
      const config = await this.getConfig();
      const { lastRun } = await this.getState();
      const due = !lastRun || Date.now() - new Date(lastRun.startedAt).getTime() >= config.intervalHours * HOUR - TICK_MS / 2;
      if (config.enabled && due && !this.running && (await this.apidirect.isConfigured())) await this.run('schedule');
    } catch (err) {
      this.logger.error('tick sinkron terjadwal gagal', err as Error);
    } finally {
      this.timer = setTimeout(() => this.tick(), TICK_MS);
    }
  }

  async getConfig(): Promise<SyncScheduleInput> {
    const { value } = await this.settings.getJson<SyncScheduleInput>(CONFIG_KEY);
    return { ...DEFAULT_SYNC_SCHEDULE, ...value };
  }

  private async getState(): Promise<ScheduleState> {
    const { value } = await this.settings.getJson<ScheduleState>(STATE_KEY);
    return { lastRun: value?.lastRun ?? null };
  }

  /** Filter link yang ikut sinkron terjadwal. */
  private eligibleWhere(config: SyncScheduleInput): SQL {
    return and(
      inArray(dataUrlLinks.platform, [...SYNCABLE_PLATFORMS]),
      config.activeOnly ? eq(dataUrls.isActive, true) : undefined,
    )!;
  }

  private async countEligible(config: SyncScheduleInput) {
    const [r] = await this.db.select({
      n: sql<number>`count(*)::int`,
      // link yang komentarnya juga ditarik → 2 request per sinkron
      c: sql<number>`count(*) filter (where ${dataUrlLinks.platform}::text in (${sql.join(COMMENT_PLATFORMS.map((p) => sql`${p}`), sql`, `)}))::int`,
    })
      .from(dataUrlLinks).innerJoin(dataUrls, eq(dataUrls.id, dataUrlLinks.dataUrlId))
      .where(this.eligibleWhere(config));
    return r;
  }

  async getPublic(): Promise<SyncScheduleSettings> {
    const [config, { lastRun }, { updatedAt }] = await Promise.all([
      this.getConfig(), this.getState(), this.settings.getJson(CONFIG_KEY),
    ]);
    const { n: eligibleLinks, c: commentLinks } = await this.countEligible(config);
    const nextRunAt = !config.enabled ? null
      : lastRun ? new Date(new Date(lastRun.startedAt).getTime() + config.intervalHours * HOUR).toISOString()
      : new Date(Date.now() + TICK_MS).toISOString();
    return {
      ...config,
      running: this.running,
      lastRun,
      nextRunAt,
      eligibleLinks,
      commentLinks,
      estimatedRequestsPerDay: Math.round((eligibleLinks + commentLinks) * (24 / config.intervalHours)),
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }

  async update(input: SyncScheduleInput, actorId: string) {
    await this.settings.setJson(CONFIG_KEY, input, actorId);
    return this.getPublic();
  }

  /** Jalankan sekarang dari panel (tidak menunggu jadwal). Berjalan di background. */
  async runNow() {
    if (this.running) throw new ConflictException('Sinkron terjadwal sedang berjalan');
    if (!(await this.apidirect.isConfigured())) throw new ConflictException('API key apidirect belum diatur');
    void this.run('manual').catch((err) => this.logger.error('sinkron manual gagal', err as Error));
    return { started: true };
  }

  private async run(trigger: SyncRunSummary['trigger']) {
    // lease di app_settings: hanya satu instance API yang menjalankan sinkron pada satu waktu.
    // Lease kedaluwarsa sendiri (60 menit) bila proses mati di tengah jalan.
    const lease = await this.db.execute(sql`
      insert into app_settings (key, value) values (${STATE_KEY}, jsonb_build_object('leaseUntil', now() + interval '60 minutes'))
      on conflict (key) do update set value = app_settings.value || jsonb_build_object('leaseUntil', now() + interval '60 minutes')
      where app_settings.value->>'leaseUntil' is null or (app_settings.value->>'leaseUntil')::timestamptz < now()
      returning key`);
    if (!lease.rows.length) return;
    this.running = true;
    const startedAt = new Date();
    try {
      const config = await this.getConfig();
      // hemat kuota: lewati link yang baru disinkron (< setengah interval yang lalu)
      const fresh = new Date(Date.now() - (config.intervalHours * HOUR) / 2);
      const targets = await this.db
        .select({ id: dataUrlLinks.id, url: dataUrlLinks.url, platform: dataUrlLinks.platform, dataUrlId: dataUrlLinks.dataUrlId })
        .from(dataUrlLinks).innerJoin(dataUrls, eq(dataUrls.id, dataUrlLinks.dataUrlId))
        .where(and(this.eligibleWhere(config), or(isNull(dataUrlLinks.lastSyncedAt), lt(dataUrlLinks.lastSyncedAt, fresh))));

      this.logger.log(`sinkron ${trigger}: ${targets.length} link`);
      const results = await this.dataUrls.runSync(targets);
      const touched = [...new Set(targets.map((t) => t.dataUrlId))];
      if (touched.length) await this.db.update(dataUrls).set({ updatedAt: new Date() }).where(inArray(dataUrls.id, touched));

      const synced = results.filter((r) => r.ok).length;
      const summary: SyncRunSummary = {
        startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), trigger,
        total: results.length, synced, failed: results.length - synced,
      };
      await this.settings.setJson(STATE_KEY, { lastRun: summary });
      this.logger.log(`sinkron ${trigger} selesai: ${synced}/${results.length} sukses`);
    } finally {
      this.running = false;
      await this.db.execute(sql`update app_settings set value = value - 'leaseUntil' where key = ${STATE_KEY}`);
    }
  }
}
