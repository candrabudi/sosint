import { PLATFORM_LABELS, type Platform } from '@sig/shared';
import { useId } from 'react';
import { cn } from '../ui/cn';

export const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: '#e1306c',
  tiktok: '#25c9c4', // cyan TikTok: tetap terlihat di light & dark
  x: '#8b95a7',
  facebook: '#1877f2',
  youtube: '#e5322d',
  threads: '#a47bd6',
  linkedin: '#0a66c2',
  other: '#9a9da3',
};

const SHORT: Record<Platform, string> = {
  instagram: 'IG', tiktok: 'TT', x: 'X', facebook: 'FB', youtube: 'YT', threads: 'TH', linkedin: 'IN', other: '··',
};

const TIKTOK_PATH = 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';
const X_PATH = 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z';

/** Logo resmi (SVG) untuk platform utama; null = pakai lingkaran singkatan. */
function PlatformLogo({ platform }: { platform: Platform }) {
  const id = useId();
  if (platform === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={id} cx="30%" cy="107%" r="150%">
            <stop offset="0" stopColor="#fdf497" /><stop offset=".05" stopColor="#fdf497" />
            <stop offset=".45" stopColor="#fd5949" /><stop offset=".6" stopColor="#d6249f" /><stop offset=".9" stopColor="#285aeb" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill={`url(#${id})`} />
        <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16.3" cy="7.7" r="1.05" fill="#fff" />
      </svg>
    );
  }
  if (platform === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#000" />
        <g transform="translate(5 4.4) scale(0.62)">
          <path d={TIKTOK_PATH} fill="#25f4ee" transform="translate(-0.9 -0.9)" />
          <path d={TIKTOK_PATH} fill="#fe2c55" transform="translate(0.9 0.9)" />
          <path d={TIKTOK_PATH} fill="#fff" />
        </g>
      </svg>
    );
  }
  if (platform === 'x') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#000" />
        <path d={X_PATH} fill="#fff" transform="translate(5.5 5.5) scale(0.54)" />
      </svg>
    );
  }
  return null;
}

const HAS_LOGO: Platform[] = ['instagram', 'tiktok', 'x'];

/** Ikon platform: logo resmi untuk IG/TikTok/X, lingkaran singkatan berwarna untuk lainnya. */
export function PlatformDot({ platform, size = 26, className }: { platform: Platform; size?: number; className?: string }) {
  if (HAS_LOGO.includes(platform)) {
    return (
      <span title={PLATFORM_LABELS[platform]} role="img" aria-label={PLATFORM_LABELS[platform]}
        // ring-card memisahkan ikon saat ditumpuk; outline tipis agar tile hitam tetap terlihat di dark mode
        className={cn('inline-flex shrink-0 overflow-hidden rounded-[28%] ring-2 ring-card outline outline-1 -outline-offset-1 outline-white/10', className)}
        style={{ width: size, height: size }}>
        <PlatformLogo platform={platform} />
      </span>
    );
  }
  return (
    <span
      title={PLATFORM_LABELS[platform]}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium text-white ring-2 ring-card', className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: PLATFORM_COLORS[platform] }}
    >
      {SHORT[platform]}
    </span>
  );
}

/** Tumpukan platform yang dipakai sebuah Data Url. */
export function PlatformStack({ platforms }: { platforms: Platform[] }) {
  if (!platforms.length) return <span className="text-[13px] text-ink-3">–</span>;
  return (
    <span className="flex -space-x-1.5">
      {platforms.map((p) => <PlatformDot key={p} platform={p} />)}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-shell py-0.5 pl-0.5 pr-2.5 text-[13px]">
      <PlatformDot platform={platform} size={20} className="ring-0" />
      {PLATFORM_LABELS[platform]}
    </span>
  );
}
