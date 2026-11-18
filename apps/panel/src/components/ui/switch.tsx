import { Switch as S } from 'radix-ui';
import { cn } from './cn';

/** Toggle on/off (Radix Switch). */
export function Switch({
  checked, onCheckedChange, disabled, id, label, className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full bg-line transition-colors',
        'data-[state=checked]:bg-pos disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pos/20',
        className,
      )}
    >
      <S.Thumb className="block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}
