import { ChevronDown, Ellipsis } from 'lucide-react';
import { DropdownMenu as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from './cn';

const contentCls =
  'z-50 min-w-[150px] rounded-xl border border-line bg-card p-1 text-[14px] text-ink shadow-lg ' +
  'origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-[pop-in_140ms_ease-out]';
const itemCls =
  'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 outline-none ' +
  'data-[highlighted]:bg-shell data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect?: () => void;
}

/** Menu aksi generik (Radix DropdownMenu). */
export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: (MenuItem | 'separator')[]; align?: 'start' | 'end' }) {
  return (
    <D.Root>
      <D.Trigger asChild>{trigger}</D.Trigger>
      <D.Portal>
        <D.Content align={align} sideOffset={6} className={contentCls}>
          {items.map((it, i) =>
            it === 'separator' ? (
              <D.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <D.Item key={it.label} onSelect={it.onSelect} className={cn(itemCls, it.danger && 'text-accent')}>
                {it.icon && <span className="text-ink-3">{it.icon}</span>}
                {it.label}
              </D.Item>
            ),
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Tombol "···" yang membuka menu aksi. */
export function MoreMenu({ items }: { items: (MenuItem | 'separator')[] }) {
  return (
    <Menu
      align="start"
      items={items}
      trigger={
        <button className="rounded-md p-0.5 text-ink-3 transition-colors hover:bg-card hover:text-ink" aria-label="Menu">
          <Ellipsis size={18} />
        </button>
      }
    />
  );
}

/** Pemilih rentang waktu (7D, 3M, dst) — Radix RadioGroup di dalam DropdownMenu. */
export function RangeSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <D.Root>
      <D.Trigger asChild>
        <button className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-sm text-ink-3 transition-colors hover:bg-card hover:text-ink">
          {value} <ChevronDown size={14} />
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Content align="end" sideOffset={6} className={cn(contentCls, 'min-w-[110px]')}>
          <D.RadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <D.RadioItem key={o} value={o} className={cn(itemCls, 'justify-between')}>
                {o}
                <D.ItemIndicator>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                </D.ItemIndicator>
              </D.RadioItem>
            ))}
          </D.RadioGroup>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
