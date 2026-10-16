/**
 * Short messages in a bar along the bottom of the screen, edge to edge (Yves, 16 October 2026:
 * the old centred pill turned into a cramped box when the text was long). One at a time; a new
 * one replaces the old. Tap the bar to close it. Keep the text to one short sentence.
 */
import { useSyncExternalStore } from 'react';

/** `ok` (a teal tick), `error` (a pink mark) or `info` (no mark). */
export type ToastKind = 'info' | 'ok' | 'error';
export interface Shown { id: number; text: string; kind: ToastKind; out: boolean }

let current: Shown | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
let next = 1;

const emit = () => listeners.forEach((l) => l());

/** Long enough to read: about 40 ms a character, between 2.6 and 6.5 seconds. */
const readTime = (text: string) => Math.min(6500, Math.max(2600, 2200 + text.length * 40));

export function toast(text: string, opts: number | { kind?: ToastKind; ms?: number } = {}) {
  const o = typeof opts === 'number' ? { ms: opts } : opts;
  current = { id: next++, text, kind: o.kind ?? 'info', out: false };
  emit();
  clearTimeout(timer);
  timer = setTimeout(hideToast, o.ms ?? readTime(text));
}

/** Something worked: saved, copied, sent. */
toast.ok = (text: string, ms?: number) => toast(text, { kind: 'ok', ms });
/** Something went wrong. Say what to do next. */
toast.error = (text: string, ms?: number) => toast(text, { kind: 'error', ms });

/** Slides the bar away. */
export function hideToast() {
  if (!current || current.out) return;
  current = { ...current, out: true };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 200);
}

export const useToast = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
