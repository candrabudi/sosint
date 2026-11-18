import { Tag, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, useState } from 'react';
import { cn } from './cn';

/** Input tag: Enter / koma untuk menambah, Backspace untuk menghapus tag terakhir. */
export function TagInput({
  value, onChange, placeholder = 'Ketik tag lalu Enter', max = 20, invalid, id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
  invalid?: boolean;
  id?: string;
}) {
  const [draft, setDraft] = useState('');

  function commit(raw = draft) {
    const next = raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!next.length) return;
    onChange([...new Set([...value, ...next])].slice(0, max));
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-card px-2.5 py-1.5 transition-[border-color,box-shadow] focus-within:ring-4',
        invalid ? 'border-accent focus-within:ring-accent/15' : 'border-line hover:border-ink-3/50 focus-within:border-ink-3 focus-within:ring-ink/5',
      )}
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
    >
      <Tag size={15} className="ml-1 text-ink-3" />
      <AnimatePresence initial={false}>
        {value.map((t) => (
          <motion.span
            key={t}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-soft py-0.5 pl-2 pr-1 text-[13px] text-blue"
          >
            #{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Hapus tag ${t}`}
              className="rounded p-0.5 transition-colors hover:bg-blue/15">
              <X size={12} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit()}
        disabled={value.length >= max}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent py-1 text-[14px] outline-none placeholder:text-ink-3"
      />
    </div>
  );
}
