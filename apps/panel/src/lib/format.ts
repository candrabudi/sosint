const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('id-ID');

/** 12500 → "12,5 rb", 3400000 → "3,4 jt" */
export const fmtCompact = (n: number) => compact.format(n);
export const fmtNumber = (n: number) => full.format(n);
export const fmtPercent = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;

const tz = 'Asia/Jakarta';
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso)) + ' WIB';

const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
export function fmtRelative(iso: string) {
  let v = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]];
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return '';
}
