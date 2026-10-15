import { useToast } from '../lib/toast';

export function Toast() {
  const t = useToast();
  return (
    <div aria-live="polite" role="status">
      {t && <div key={t.id} className="toast">{t.text}</div>}
    </div>
  );
}
