import { animate, motion, useInView } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/** Kartu muncul dari bawah, bisa diberi delay untuk efek berurutan. */
export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Angka yang menghitung naik dari 0. Menerima string berformat,
 * mis. "135,145", "$5.41", "+15%", "-$0.34" — prefix/suffix dipertahankan.
 */
export function CountUp({ value, duration = 1.2 }: { value: string; duration?: number }) {
  const match = value.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(match ? `${match[1]}0${match[3]}` : value);

  useEffect(() => {
    if (!match || !inView) return;
    const [, prefix, num, suffix] = match;
    const target = Number(num.replace(/,/g, ''));
    const decimals = num.includes('.') ? num.split('.')[1].length : 0;
    const useComma = num.includes(',');
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        const n = useComma
          ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : v.toFixed(decimals);
        setDisplay(`${prefix}${n}${suffix}`);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);

  return <span ref={ref} className="tabular-nums">{display}</span>;
}
