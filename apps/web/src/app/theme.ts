import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

/** The user's explicit choice; null means "follow the device setting". */
let override: Theme | null = null;

function darkQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;
}

function currentTheme(): Theme {
  return override ?? (darkQuery()?.matches ? 'dark' : 'light');
}

function apply(): void {
  document.documentElement.classList.toggle('dark', currentTheme() === 'dark');
  listeners.forEach((listener) => {
    listener();
  });
}

/** Applies the theme before first render and follows device changes while no override is set. */
export function initTheme(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    override = stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    override = null; // Storage blocked (e.g. private mode): follow the device.
  }
  apply();
  darkQuery()?.addEventListener('change', apply);
}

export function setTheme(theme: Theme): void {
  override = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded.
  }
  apply();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}
