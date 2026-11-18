import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  extractInstagramCode, extractTweetId, type MetricTotals, type Platform, PLATFORM_LABELS, type PostMeta, type TestApiDirectResult,
} from '@sig/shared';

/** GET /v1/twitter/tweet → { tweet } (hanya field yang dipakai) */
interface ApiDirectTweet {
  date?: string;
  author?: string;
  snippet?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  quotes?: number;
  bookmarks?: number;
  views?: number;
  author_followers?: number;
  author_verified?: boolean;
  lang?: string;
  is_reply?: boolean;
  is_quote?: boolean;
  hashtags?: string[];
  sentiment?: { dominant_emotion?: string; emotional_intensity?: number; polarity?: string } | null;
}

/** GET /v1/tiktok/video → { video } (hanya field yang dipakai) */
interface ApiDirectTikTok {
  title?: string;
  region?: string;
  date?: string;
  date_timestamp?: number;
  duration?: number;
  play_count?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  downloads?: number;
  saves?: number;
  is_ad?: boolean;
  cover?: string;
  author?: string;
  author_name?: string;
  author_avatar?: string;
  music_title?: string;
  music_author?: string;
  music_original?: boolean;
}

/** GET /v1/instagram/post → { post } (hanya field yang dipakai) */
interface ApiDirectInstagram {
  date?: string;
  date_timestamp?: number;
  author?: string;
  author_name?: string;
  author_verified?: boolean;
  snippet?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  reposts?: number;
  views?: number;
  is_video?: boolean;
  media_type?: string;
  hashtags?: string[];
  thumbnail_url?: string;
  video_duration?: number;
  carousel_media_count?: number;
  is_paid_partnership?: boolean;
  audio?: { title?: string; artist?: string; type?: string } | null;
}

/** GET /v1/twitter/tweet/comments → { comments } */
interface ApiDirectTweetComment {
  url?: string;
  date?: string;
  author?: string;
  snippet?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  quotes?: number;
  bookmarks?: number;
  views?: number;
  author_followers?: number;
  author_verified?: boolean;
  lang?: string;
  hashtags?: string[];
  user_mentions?: string[];
  sentiment?: { emotions?: Record<string, number>; dominant_emotion?: string; emotional_intensity?: number; polarity?: string } | null;
}

/** GET /v1/instagram/post/comments → { comments } */
interface ApiDirectInstagramComment {
  comment_id?: string;
  text?: string;
  author?: string;
  author_name?: string;
  author_id?: string;
  author_verified?: boolean;
  author_is_ai_generated_profile?: boolean;
  author_profile_pic_url?: string;
  likes?: number;
  reply_count?: number;
  is_pinned?: boolean;
  hashtags?: string[];
  mentions?: string[];
  date?: string;
  date_timestamp?: number;
  url?: string;
  gif_url?: string | null;
}

/** GET /v1/tiktok/video/comments → { comments } */
interface ApiDirectTikTokComment {
  comment_id?: string;
  video_id?: string;
  text?: string;
  images?: string[];
  likes?: number;
  date?: string;
  date_timestamp?: number;
  author?: string;
  author_name?: string;
  author_id?: string;
  author_avatar?: string;
  author_verified?: boolean;
  author_bio?: string;
  author_region?: string;
  reply_count?: number;
}

/** Komentar yang sudah dinormalisasi, siap di-upsert ke link_comments. */
export interface CommentInput {
  externalId: string;
  url: string | null;
  author: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorFollowers: number | null;
  authorVerified: boolean | null;
  text: string;
  postedAt: Date | null;
  likes: number;
  replies: number;
  shares: number;
  views: number;
  isPinned: boolean | null;
  lang: string | null;
  polarity: string | null;
  dominantEmotion: string | null;
  intensity: number | null;
  emotions: Record<string, number> | null;
  raw: Record<string, unknown>;
}

export class ApiDirectError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export interface PostStats {
  metrics: MetricTotals;
  meta: PostMeta;
}

/** angka non-negatif yang aman; selain itu 0 */
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** "2024-01-15 14:30:00" (diasumsikan UTC) → ISO; null bila tidak valid */
function parseDate(v?: string, unixSec?: number) {
  if (typeof unixSec === 'number' && unixSec > 0) return new Date(unixSec * 1000).toISOString();
  if (!v) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const hashtagsFrom = (text: string) => [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()))];

const baseMeta = (platform: Platform): Omit<PostMeta, 'author' | 'text' | 'raw'> => ({
  provider: 'apidirect', platform, authorName: null, authorFollowers: null, authorVerified: null, authorAvatar: null,
  postedAt: null, lang: null, region: null, hashtags: [], cover: null, durationSec: null, isAd: null,
  isReply: null, isQuote: null, music: null, sentiment: null,
});

/** Klien apidirect.io untuk menarik analitik postingan. */
@Injectable()
export class ApiDirectService {
  private readonly logger = new Logger(ApiDirectService.name);

  constructor(private readonly settings: SettingsService) {}

  /** true bila API key sudah diatur (di Pengaturan atau .env). */
  async isConfigured() {
    return !!(await this.settings.getApiDirect()).apiKey;
  }

  /**
   * Tes koneksi & validitas API key dengan mengambil satu tweet publik.
   * Boleh memakai nilai override (dari form yang belum disimpan). Memakai 1 request kuota.
   */
  async testConnection(override: { baseUrl?: string; apiKey?: string } = {}): Promise<TestApiDirectResult> {
    const started = Date.now();
    try {
      // tweet publik pertama di Twitter — stabil untuk uji koneksi
      await this.request('/v1/twitter/tweet', { tweet_id: '20' }, 'tweet', override);
      return { ok: true, status: 200, latencyMs: Date.now() - started, message: 'Terhubung — API key valid' };
    } catch (err) {
      const e = err instanceof ApiDirectError ? err : new ApiDirectError('Error tidak terduga');
      // 404 = koneksi & key OK, hanya tweet uji tidak tersedia
      if (e.status === 404) return { ok: true, status: 404, latencyMs: Date.now() - started, message: 'Terhubung — API key diterima' };
      return { ok: false, status: e.status ?? null, latencyMs: Date.now() - started, message: e.message };
    }
  }

  /** Ambil statistik postingan sesuai platform-nya. */
  getStats(platform: Platform, url: string): Promise<PostStats> {
    switch (platform) {
      case 'x': {
        const id = extractTweetId(url);
        if (!id) throw new ApiDirectError('URL tidak berisi ID tweet (format: x.com/user/status/123...)');
        return this.getTweet(id);
      }
      case 'tiktok':
        return this.getTikTok(url);
      case 'instagram':
        return this.getInstagram(url);
      default:
        throw new ApiDirectError(`Sinkron otomatis belum tersedia untuk ${PLATFORM_LABELS[platform]}`);
    }
  }

  async getTweet(tweetId: string): Promise<PostStats> {
    const json = await this.request<{ tweet?: ApiDirectTweet }>('/v1/twitter/tweet', { tweet_id: tweetId }, 'tweet');
    const t = json.tweet;
    if (!t) throw new ApiDirectError('Respons apidirect tidak berisi data tweet');

    const raw = {
      views: n(t.views), likes: n(t.likes), replies: n(t.replies),
      retweets: n(t.retweets), quotes: n(t.quotes), bookmarks: n(t.bookmarks),
    };
    return {
      metrics: { views: raw.views, likes: raw.likes, comments: raw.replies, shares: raw.retweets + raw.quotes, saves: raw.bookmarks },
      meta: {
        ...baseMeta('x'),
        author: t.author ?? '',
        authorFollowers: n(t.author_followers),
        authorVerified: !!t.author_verified,
        text: t.snippet ?? '',
        postedAt: parseDate(t.date),
        lang: t.lang ?? null,
        hashtags: Array.isArray(t.hashtags) ? t.hashtags : [],
        isReply: !!t.is_reply,
        isQuote: !!t.is_quote,
        sentiment: t.sentiment
          ? { polarity: t.sentiment.polarity ?? null, dominantEmotion: t.sentiment.dominant_emotion ?? null, intensity: t.sentiment.emotional_intensity ?? null }
          : null,
        raw,
      },
    };
  }

  async getTikTok(url: string): Promise<PostStats> {
    const json = await this.request<{ video?: ApiDirectTikTok }>('/v1/tiktok/video', { url }, 'video');
    const v = json.video;
    if (!v) throw new ApiDirectError('Respons apidirect tidak berisi data video');

    const raw = {
      plays: n(v.play_count), likes: n(v.likes), comments: n(v.comments),
      shares: n(v.shares), saves: n(v.saves), downloads: n(v.downloads),
    };
    const text = v.title ?? '';
    return {
      metrics: { views: raw.plays, likes: raw.likes, comments: raw.comments, shares: raw.shares, saves: raw.saves },
      meta: {
        ...baseMeta('tiktok'),
        author: v.author ?? '',
        authorName: v.author_name ?? null,
        authorAvatar: v.author_avatar ?? null,
        text,
        postedAt: parseDate(v.date, v.date_timestamp),
        region: v.region ?? null,
        hashtags: hashtagsFrom(text),
        cover: v.cover ?? null,
        durationSec: typeof v.duration === 'number' ? v.duration : null,
        isAd: typeof v.is_ad === 'boolean' ? v.is_ad : null,
        music: v.music_title ? { title: v.music_title, author: v.music_author ?? '', original: !!v.music_original } : null,
        raw,
      },
    };
  }

  async getInstagram(url: string): Promise<PostStats> {
    const json = await this.request<{ post?: ApiDirectInstagram }>('/v1/instagram/post', { url }, 'post');
    const p = json.post;
    if (!p) throw new ApiDirectError('Respons apidirect tidak berisi data postingan');

    const raw = {
      views: n(p.views), likes: n(p.likes), comments: n(p.comments),
      shares: n(p.shares), reposts: n(p.reposts), carouselCount: n(p.carousel_media_count),
    };
    const text = p.snippet ?? '';
    return {
      // Instagram tidak mengembalikan jumlah saves → tetap 0
      metrics: { views: raw.views, likes: raw.likes, comments: raw.comments, shares: raw.shares + raw.reposts, saves: 0 },
      meta: {
        ...baseMeta('instagram'),
        author: p.author ?? '',
        authorName: p.author_name ?? null,
        authorVerified: typeof p.author_verified === 'boolean' ? p.author_verified : null,
        text,
        postedAt: parseDate(p.date, p.date_timestamp),
        hashtags: Array.isArray(p.hashtags) && p.hashtags.length
          ? p.hashtags.map((h) => h.replace(/^#/, '').toLowerCase())
          : hashtagsFrom(text),
        cover: p.thumbnail_url ?? null,
        durationSec: typeof p.video_duration === 'number' ? Math.round(p.video_duration) : null,
        isAd: typeof p.is_paid_partnership === 'boolean' ? p.is_paid_partnership : null,
        music: p.audio?.title ? { title: p.audio.title, author: p.audio.artist ?? '', original: p.audio.type !== 'music' } : null,
        raw,
      },
    };
  }

  // ---------- komentar ----------

  /** Ambil komentar postingan (1 halaman per sinkron agar hemat kuota). */
  getComments(platform: Platform, url: string, pages = 1): Promise<CommentInput[]> {
    switch (platform) {
      case 'x': {
        const id = extractTweetId(url);
        if (!id) throw new ApiDirectError('URL tidak berisi ID tweet');
        return this.getTweetComments(id, pages);
      }
      case 'tiktok':
        return this.getTikTokComments(url, pages);
      case 'instagram': {
        const code = extractInstagramCode(url);
        if (!code) throw new ApiDirectError('URL tidak berisi kode postingan Instagram (format: instagram.com/p/KODE)');
        return this.getInstagramComments(code, pages);
      }
      default:
        throw new ApiDirectError(`Komentar belum tersedia untuk ${PLATFORM_LABELS[platform]}`);
    }
  }

  private async getTweetComments(tweetId: string, pages: number): Promise<CommentInput[]> {
    const json = await this.request<{ comments?: ApiDirectTweetComment[] }>(
      '/v1/twitter/tweet/comments', { tweet_id: tweetId, pages: String(pages) }, 'tweet',
    );
    return (json.comments ?? []).filter((c) => c.author).map((c) => {
      const postedAt = parseDate(c.date);
      return {
        externalId: c.url || `x:${c.author}:${c.date ?? ''}:${(c.snippet ?? '').slice(0, 40)}`,
        url: c.url ?? null,
        author: c.author!,
        authorName: null,
        authorAvatar: null,
        authorFollowers: typeof c.author_followers === 'number' ? n(c.author_followers) : null,
        authorVerified: typeof c.author_verified === 'boolean' ? c.author_verified : null,
        text: c.snippet ?? '',
        postedAt: postedAt ? new Date(postedAt) : null,
        likes: n(c.likes),
        replies: n(c.replies),
        shares: n(c.retweets) + n(c.quotes),
        views: n(c.views),
        isPinned: null,
        lang: c.lang ?? null,
        polarity: c.sentiment?.polarity?.toLowerCase() ?? null,
        dominantEmotion: c.sentiment?.dominant_emotion?.toLowerCase() ?? null,
        intensity: typeof c.sentiment?.emotional_intensity === 'number' ? c.sentiment.emotional_intensity : null,
        emotions: c.sentiment?.emotions ?? null,
        raw: { bookmarks: n(c.bookmarks), hashtags: c.hashtags ?? [], mentions: c.user_mentions ?? [] },
      };
    });
  }

  private async getTikTokComments(url: string, pages: number): Promise<CommentInput[]> {
    const json = await this.request<{ comments?: ApiDirectTikTokComment[] }>(
      '/v1/tiktok/video/comments', { url, pages: String(pages) }, 'video',
    );
    return (json.comments ?? []).filter((c) => c.author).map((c) => {
      const postedAt = parseDate(c.date, c.date_timestamp);
      return {
        externalId: c.comment_id || `tt:${c.author}:${c.date_timestamp ?? c.date ?? ''}`,
        url: c.comment_id && c.video_id ? `https://www.tiktok.com/@${c.author}/video/${c.video_id}?comment_id=${c.comment_id}` : null,
        author: c.author!,
        authorName: c.author_name || null,
        authorAvatar: c.author_avatar || null,
        authorFollowers: null,
        authorVerified: typeof c.author_verified === 'boolean' ? c.author_verified : null,
        text: c.text ?? '',
        postedAt: postedAt ? new Date(postedAt) : null,
        likes: n(c.likes),
        replies: n(c.reply_count),
        shares: 0,
        views: 0,
        isPinned: null,
        lang: null,
        // TikTok tidak mengirim sentimen
        polarity: null,
        dominantEmotion: null,
        intensity: null,
        emotions: null,
        raw: { authorId: c.author_id ?? null, authorRegion: c.author_region ?? null, authorBio: c.author_bio ?? null, images: c.images ?? [] },
      };
    });
  }

  private async getInstagramComments(code: string, pages: number): Promise<CommentInput[]> {
    const json = await this.request<{ comments?: ApiDirectInstagramComment[] }>(
      '/v1/instagram/post/comments', { code, pages: String(pages) }, 'post',
    );
    return (json.comments ?? []).filter((c) => c.author).map((c) => {
      const postedAt = parseDate(c.date, c.date_timestamp);
      return {
        externalId: c.comment_id || c.url || `ig:${c.author}:${c.date_timestamp ?? c.date ?? ''}`,
        url: c.url ?? null,
        author: c.author!,
        authorName: c.author_name || null,
        authorAvatar: c.author_profile_pic_url || null,
        authorFollowers: null,
        authorVerified: typeof c.author_verified === 'boolean' ? c.author_verified : null,
        text: c.text ?? '',
        postedAt: postedAt ? new Date(postedAt) : null,
        likes: n(c.likes),
        replies: n(c.reply_count),
        shares: 0,
        views: 0,
        isPinned: typeof c.is_pinned === 'boolean' ? c.is_pinned : null,
        lang: null,
        // Instagram tidak mengirim sentimen
        polarity: null,
        dominantEmotion: null,
        intensity: null,
        emotions: null,
        raw: {
          authorId: c.author_id ?? null, hashtags: c.hashtags ?? [], mentions: c.mentions ?? [], gifUrl: c.gif_url ?? null,
          aiProfile: c.author_is_ai_generated_profile ?? null,
        },
      };
    });
  }

  /** GET ke apidirect dengan API key, timeout 15 detik, dan pesan error yang ramah. */
  private async request<T>(
    path: string,
    params: Record<string, string>,
    what: 'tweet' | 'video' | 'post',
    override: { baseUrl?: string; apiKey?: string } = {},
  ): Promise<T> {
    const saved = await this.settings.getApiDirect();
    const apiKey = override.apiKey || saved.apiKey;
    if (!apiKey) throw new ApiDirectError('API key apidirect belum diatur (menu Pengaturan → Integrasi)');

    const base = (override.baseUrl || saved.baseUrl).replace(/\/+$/, '');
    const url = `${base}${path}?${new URLSearchParams(params)}`;

    let res: Response;
    try {
      res = await fetch(url, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    } catch (err) {
      const timeout = err instanceof Error && err.name === 'TimeoutError';
      throw new ApiDirectError(timeout ? 'apidirect tidak merespons (timeout 15 detik)' : 'Gagal terhubung ke apidirect');
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`apidirect ${res.status} ${path}: ${body.slice(0, 200)}`);
      const label = { tweet: 'Tweet', video: 'Video', post: 'Postingan' }[what];
      const message =
        res.status === 401 || res.status === 403 ? 'API key apidirect tidak valid atau tidak punya akses'
        : res.status === 404 ? `${label} tidak ditemukan (mungkin dihapus atau akun private)`
        : res.status === 402 ? 'Kuota/kredit apidirect habis'
        : res.status === 429 ? 'Terlalu banyak request ke apidirect, coba lagi nanti'
        : `apidirect error ${res.status}`;
      throw new ApiDirectError(message, res.status);
    }

    const json = (await res.json().catch(() => null)) as T | null;
    if (!json) throw new ApiDirectError('Respons apidirect bukan JSON yang valid');
    return json;
  }
}
