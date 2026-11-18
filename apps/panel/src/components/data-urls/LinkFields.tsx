import { detectPlatform, METRICS, type Metric, PLATFORM_LABELS, PLATFORMS, type Platform } from '@sig/shared';
import { ChevronDown, Link2 } from 'lucide-react';
import { DropdownMenu as D } from 'radix-ui';
import type { FieldErrors, UseFormReturn } from 'react-hook-form';
import { Tip } from '../ui/tooltip';
import { PlatformDot } from './Platform';

export const METRIC_LABELS: Record<Metric, string> = {
  views: 'Views', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves',
};

export const inputCls = (err?: boolean) =>
  `h-11 w-full rounded-xl border bg-card px-3.5 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:ring-4 ${
    err ? 'border-accent focus:ring-accent/15' : 'border-line hover:border-ink-3/50 focus:border-ink-3 focus:ring-ink/5'
  }`;

/** Pemilih platform (Radix DropdownMenu). */
export function PlatformSelect({ value, onChange }: { value: Platform; onChange: (p: Platform) => void }) {
  return (
    <D.Root>
      <D.Trigger asChild>
        <button type="button"
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-card pl-1.5 pr-2.5 text-[14px] transition-colors hover:border-ink-3/50">
          <PlatformDot platform={value} size={28} className="ring-0" />
          <span className="w-[72px] truncate text-left">{PLATFORM_LABELS[value]}</span>
          <ChevronDown size={14} className="text-ink-3" />
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Content align="start" sideOffset={6}
          className="z-[60] max-h-[300px] min-w-[180px] overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-lg data-[state=open]:animate-[pop-in_140ms_ease-out]">
          <D.RadioGroup value={value} onValueChange={(v) => onChange(v as Platform)}>
            {PLATFORMS.map((p) => (
              <D.RadioItem key={p} value={p}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] outline-none data-[highlighted]:bg-shell data-[state=checked]:font-medium">
                <PlatformDot platform={p} size={22} className="ring-0" />
                {PLATFORM_LABELS[p]}
              </D.RadioItem>
            ))}
          </D.RadioGroup>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * Field satu link (platform + URL + metrik). `prefix` = "" untuk form tunggal,
 * atau "links.0." untuk field array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LinkFields({ form, prefix = '', errors }: { form: UseFormReturn<any, any, any>; prefix?: string; errors?: FieldErrors<any> }) {
  const { register, watch, setValue } = form;
  const platform = watch(`${prefix}platform`) as Platform;
  const err = (k: string) => (errors?.[k] as { message?: string } | undefined)?.message;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* platform otomatis dari URL — tidak perlu dipilih manual */}
        <Tip label={`Terdeteksi: ${PLATFORM_LABELS[platform ?? 'other']}`}>
          <span><PlatformDot platform={platform ?? 'other'} size={40} className="ring-0" /></span>
        </Tip>
        <div className="relative flex-1">
          <Link2 size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            placeholder="https://instagram.com/p/..."
            className={`${inputCls(!!err('url'))} pl-9`}
            {...register(`${prefix}url`, {
              // auto-deteksi platform dari URL
              onChange: (e) => {
                const p = detectPlatform(e.target.value);
                setValue(`${prefix}platform`, p ?? 'other', { shouldDirty: true });
              },
            })}
          />
        </div>
      </div>
      {err('url') && <p className="-mt-1.5 text-[13px] text-accent">{err('url')}</p>}

      <div className="grid grid-cols-5 gap-2">
        {METRICS.map((m) => (
          <label key={m} className="block">
            <span className="mb-1 block text-[12px] text-ink-3">{METRIC_LABELS[m]}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={`${inputCls(!!err(m))} h-10 px-2.5 text-right font-mono tabular-nums`}
              {...register(`${prefix}${m}`, { setValueAs: (v) => (v === '' || v === null ? 0 : Number(v)) })}
            />
          </label>
        ))}
      </div>
      {METRICS.map((m) => err(m) && <p key={m} className="text-[13px] text-accent">{METRIC_LABELS[m]}: {err(m)}</p>)}
    </div>
  );
}
