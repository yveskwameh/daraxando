// Small pieces every screen uses: the address bar router, loading data, messages, sheets and buttons.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/* ---------- the address: /, /section/players, /players, /players/<id>, /reviews, /log ---------- */

const listeners = new Set<() => void>();
export function go(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname + location.search) return;
  if (opts.replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  scrollTo(0, 0);
  listeners.forEach((fn) => fn());
}
/** The current path. Screens that read the query (?q=) re-render when it changes too. */
export function usePath() {
  const [here, setHere] = useState(location.pathname + location.search);
  const path = here.split('?')[0];
  useEffect(() => {
    const update = () => setHere(location.pathname + location.search);
    listeners.add(update);
    addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      removeEventListener('popstate', update);
    };
  }, []);
  return path;
}
/** Back if the dashboard opened this screen, otherwise to `fallback`. */
export function back(fallback: string) {
  if (history.state === null && history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
  else go(fallback);
}

/** True while the screen matches `query`, for layouts that change shape (a table on a computer, rows on a phone). */
export function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const update = () => setOn(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return on;
}

/* ---------- loading data ---------- */

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; reload: () => void; at: number | null }

/** Loads `fn` whenever `key` changes. Keeps the last data on screen while a reload runs. */
export function useLoad<T>(key: string | null, fn: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null; loading: boolean; at: number | null }>({ key: null, data: null, error: null, loading: !!key, at: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!key) return;
    let live = true;
    setState((s) => ({ ...s, key, loading: true, error: null, data: s.key === key ? s.data : null }));
    fnRef.current().then(
      (data) => live && setState({ key, data, error: null, loading: false, at: Date.now() }),
      (err: unknown) => live && setState((s) => ({ ...s, key, error: err instanceof Error ? err.message : 'Something went wrong.', loading: false })),
    );
    return () => { live = false; };
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, loading: state.loading || state.key !== key, reload, at: state.at };
}

/* ---------- messages along the bottom, like the game's toasts ---------- */

type ToastMsg = { id: number; text: string; kind: 'ok' | 'error' | 'note' };
let pushToast: (t: Omit<ToastMsg, 'id'>) => void = () => {};
export const toast = Object.assign((text: string) => pushToast({ text, kind: 'note' }), {
  ok: (text: string) => pushToast({ text, kind: 'ok' }),
  error: (text: string) => pushToast({ text, kind: 'error' }),
});
export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    let n = 0;
    pushToast = (t) => {
      const id = ++n;
      setList((l) => [...l.slice(-1), { ...t, id }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), t.kind === 'error' ? 6000 : 3500);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <p key={t.id} className={`toast ${t.kind}`}>{t.text}</p>
      ))}
    </div>
  );
}

/* ---------- sheets: a panel that slides up, for every change you make ---------- */

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {open && (
        <div className="sheet-in">
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="x-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- buttons, fields and states ---------- */

type BtnProps = { children: ReactNode; onClick?: () => void; kind?: 'main' | 'ghost' | 'danger' | 'cream'; size?: 'sm'; busy?: boolean; disabled?: boolean; type?: 'button' | 'submit'; block?: boolean; label?: string };
export function Button({ children, onClick, kind = 'main', size, busy, disabled, type = 'button', block, label }: BtnProps) {
  return (
    <button
      type={type}
      className={`btn ${kind}${size ? ` ${size}` : ''}${block ? ' block' : ''}`}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={label}
    >
      {busy ? <span className="spin" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="spin" aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}

/** Grey shapes where the content will be, so the page doesn't jump when it arrives. */
export function Skeleton({ rows = 6, kind = 'rows', label = 'Loading' }: { rows?: number; kind?: 'rows' | 'cards' | 'table' | 'block'; label?: string }) {
  return (
    <div className={`skel ${kind}`} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <i key={i} aria-hidden="true" />)}
    </div>
  );
}

export function Problem({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="state problem" role="alert">
      <p>{text}</p>
      {onRetry && <Button kind="ghost" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="state empty">
      <p className="state-title">{title}</p>
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

/* ---------- icons, drawn here so the dashboard needs no image files ---------- */

const PATHS: Record<string, string> = {
  x: 'M6 6l12 12M18 6L6 18',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  today: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  players: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M19 14a7 7 0 0 1 3 7',
  reviews: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM8.5 12l2.5 2.5 4.5-5',
  growth: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  log: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  send: 'M4 12l16-8-6 16-3-7-7-1z',
  open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  alert: 'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  minus: 'M6 12h12',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  controls: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
};
export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

/** Copies text, and says so. */
export async function copyText(text: string, what = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.ok(`${what}.`);
  } catch {
    toast.error("Couldn't copy. Select it and copy by hand.");
  }
}
