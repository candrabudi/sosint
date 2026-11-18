import { PAGE_SIZES } from '@sig/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Menu } from './dropdown';

/** Nomor halaman dengan elipsis: 1 … 4 5 [6] 7 8 … 20 */
function pageItems(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
  return [
    1,
    ...(start > 2 ? ['…' as const] : []),
    ...Array.from({ length: end - start + 1 }, (_, i) => start + i),
    ...(end < pageCount - 1 ? ['…' as const] : []),
    pageCount,
  ];
}

export interface PaginationProps {
  /** 1-based */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** satuan untuk label, mis. "user", "link" */
  unit?: string;
  /** tampilkan indikator saat halaman berikutnya sedang dimuat */
  loading?: boolean;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, unit = 'data', loading }: PaginationProps) {
  if (total <= 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = 'rounded-lg p-2 transition-colors hover:bg-shell hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3.5 text-[14px] text-ink-2 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <span>
          Menampilkan <b className="font-medium text-ink">{from}–{to}</b> dari <b className="font-medium text-ink">{total}</b> {unit}
        </span>
        {onPageSizeChange && (
          <Menu
            align="start"
            items={PAGE_SIZES.map((s) => ({ label: `${s} / halaman`, onSelect: () => onPageSizeChange(s) }))}
            trigger={
              <button className="h-8 rounded-lg border border-line px-2.5 text-[13px] transition-colors hover:border-ink-3/50 hover:text-ink">
                {pageSize} / halaman
              </button>
            }
          />
        )}
      </div>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Sebelumnya" className={btn}>
            <ChevronLeft size={16} />
          </button>
          {pageItems(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-ink-3">…</span>
            ) : (
              <button key={p} onClick={() => onPageChange(p)} aria-current={p === page ? 'page' : undefined}
                className={`h-8 min-w-8 rounded-lg px-2 tabular-nums transition-colors ${p === page ? 'bg-ink text-canvas' : 'hover:bg-shell hover:text-ink'}`}>
                {p}
              </button>
            ),
          )}
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Berikutnya" className={btn}>
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
