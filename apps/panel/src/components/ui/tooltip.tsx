import { Tooltip as T } from 'radix-ui';
import type { ReactNode } from 'react';

export const TooltipProvider = T.Provider;

/** Tooltip kecil (Radix) untuk tombol ikon. */
export function Tip({ label, children, side = 'bottom' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md bg-ink px-2 py-1 text-[12px] text-canvas shadow-md data-[state=delayed-open]:animate-[tip-in_120ms_ease-out]"
        >
          {label}
          <T.Arrow className="fill-ink" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
