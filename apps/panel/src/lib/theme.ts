import { useEffect, useState } from 'react';

function initialDark() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [dark, setDark] = useState(initialDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  return { dark, setDark };
}
