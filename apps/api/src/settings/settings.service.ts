import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appSettings, type Database, users } from '@sig/db';
import {
  APIDIRECT_DEFAULT_BASE_URL, type ApiDirectSettings, type SettingSource, type UpdateApiDirectSettingsPayload,
} from '@sig/shared';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { maskSecret, SecretBox } from './crypto';

const APIDIRECT_KEY = 'integration.apidirect';

interface StoredApiDirect {
  baseUrl?: string;
  /** terenkripsi (SecretBox) */
  apiKeyEnc?: string | null;
}

export interface ResolvedApiDirect {
  baseUrl: string;
  apiKey: string | null;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly box: SecretBox;
  private cache: { value: ResolvedApiDirect; at: number } | null = null;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    const secret = config.get<string>('SETTINGS_ENCRYPTION_KEY') || config.getOrThrow<string>('JWT_SECRET');
    if (!config.get('SETTINGS_ENCRYPTION_KEY')) {
      this.logger.warn('SETTINGS_ENCRYPTION_KEY kosong — memakai JWT_SECRET untuk enkripsi pengaturan');
    }
    this.box = new SecretBox(secret);
  }

  private async readRaw() {
    const [row] = await this.db
      .select({ value: appSettings.value, updatedAt: appSettings.updatedAt, userId: users.id, userName: users.fullName })
      .from(appSettings)
      .leftJoin(users, eq(users.id, appSettings.updatedBy))
      .where(eq(appSettings.key, APIDIRECT_KEY));
    return row ?? null;
  }

  private decryptKey(enc?: string | null): string | null {
    if (!enc) return null;
    try {
      return this.box.decrypt(enc);
    } catch {
      this.logger.error('Gagal mendekripsi API key apidirect — SETTINGS_ENCRYPTION_KEY berubah?');
      return null;
    }
  }

  /** Nilai efektif untuk dipakai integrasi: DB → .env → default. Di-cache 30 detik. */
  async getApiDirect(): Promise<ResolvedApiDirect> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.value;
    const stored = ((await this.readRaw())?.value ?? {}) as StoredApiDirect;
    const value = {
      baseUrl: stored.baseUrl || this.config.get<string>('APIDIRECT_BASE_URL') || APIDIRECT_DEFAULT_BASE_URL,
      apiKey: this.decryptKey(stored.apiKeyEnc) || this.config.get<string>('APIDIRECT_API_KEY') || null,
    };
    this.cache = { value, at: Date.now() };
    return value;
  }

  /** Bentuk aman untuk panel — API key hanya ditampilkan tersamar. */
  async getApiDirectPublic(): Promise<ApiDirectSettings> {
    const row = await this.readRaw();
    const stored = (row?.value ?? {}) as StoredApiDirect;
    const dbKey = this.decryptKey(stored.apiKeyEnc);
    const envKey = this.config.get<string>('APIDIRECT_API_KEY') || null;
    const envUrl = this.config.get<string>('APIDIRECT_BASE_URL') || null;
    const key = dbKey ?? envKey;

    const keySource: SettingSource = dbKey ? 'database' : envKey ? 'env' : 'none';
    const urlSource: SettingSource = stored.baseUrl ? 'database' : envUrl ? 'env' : 'default';

    return {
      baseUrl: stored.baseUrl || envUrl || APIDIRECT_DEFAULT_BASE_URL,
      baseUrlSource: urlSource,
      hasApiKey: !!key,
      apiKeyMasked: key ? maskSecret(key) : null,
      apiKeySource: keySource,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.userId ? { id: row.userId, fullName: row.userName! } : null,
    };
  }

  /** Baca pengaturan JSON biasa (tidak rahasia). */
  async getJson<T>(key: string): Promise<{ value: T | null; updatedAt: Date | null }> {
    const [row] = await this.db.select({ value: appSettings.value, updatedAt: appSettings.updatedAt })
      .from(appSettings).where(eq(appSettings.key, key));
    return { value: (row?.value as T) ?? null, updatedAt: row?.updatedAt ?? null };
  }

  /** Simpan pengaturan JSON biasa (upsert). */
  async setJson(key: string, value: object, actorId?: string | null) {
    const v = value as Record<string, unknown>;
    await this.db.insert(appSettings)
      .values({ key, value: v, updatedBy: actorId ?? null })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: v, updatedAt: new Date(), ...(actorId !== undefined && { updatedBy: actorId }) },
      });
  }

  async updateApiDirect(input: UpdateApiDirectSettingsPayload, actorId: string) {
    const current = ((await this.readRaw())?.value ?? {}) as StoredApiDirect;
    const next: StoredApiDirect = {
      baseUrl: input.baseUrl,
      apiKeyEnc:
        input.apiKey === undefined ? (current.apiKeyEnc ?? null) // tidak diubah
        : input.apiKey === null ? null // dihapus
        : this.box.encrypt(input.apiKey),
    };

    await this.db
      .insert(appSettings)
      .values({ key: APIDIRECT_KEY, value: next as Record<string, unknown>, updatedBy: actorId })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: next as Record<string, unknown>, updatedBy: actorId, updatedAt: new Date() },
      });

    this.cache = null;
    return this.getApiDirectPublic();
  }
}
