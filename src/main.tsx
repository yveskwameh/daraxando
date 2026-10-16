import '@fontsource-variable/gabarito';
import '@fontsource-variable/onest';
import './styles/tokens.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyPrints } from './art/prints';
import { initAnalytics } from './lib/analytics';
import { markDevice } from './lib/device';
import { initInstall } from './lib/install';
import { initPress } from './lib/press';
import { registerPwa } from './lib/pwa';
import { initSound } from './lib/sound';

// Errors on real phones go to the server's logs (Cloudflare, Workers, daraxando, Logs), at most
// three a visit. Only the message, where it happened and the phone's browser: nothing personal.
// Room codes and sign-in links are left out of the address.
let reported = 0;
const report = (message: string, where = '') => {
  if (reported++ >= 3 || !import.meta.env.PROD) return;
  const body = JSON.stringify({ message: message.slice(0, 500), where: where.slice(0, 300), path: location.pathname.replace(/\/play\/.+/, '/play/:id').replace(/\/c\/.+/, '/c/:link'), ua: navigator.userAgent.slice(0, 200) });
  navigator.sendBeacon?.('/api/log', body);
};
addEventListener('error', (e) => report(String(e.message), `${e.filename}:${e.lineno}:${e.colno}`));
addEventListener('unhandledrejection', (e) => report(String((e.reason as Error)?.message ?? e.reason), String((e.reason as Error)?.stack ?? '').split('\n')[1] ?? ''));

markDevice();
applyPrints();
initSound();
initPress();
initInstall();
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) addEventListener('load', () => void registerPwa());
