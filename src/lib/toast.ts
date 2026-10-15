/** Short messages at the bottom of the screen. One at a time; a new one replaces the old. */
import { useSyncExternalStore } from 'react';

let current: { id: number; text: string } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
let next = 1;

const emit = () => listeners.forEach((l) => l());

export function toast(text: string, ms = 2600) {
  current = { id: next++, text };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, ms);
}

export const useToast = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
