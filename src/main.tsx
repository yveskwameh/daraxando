import '@fontsource-variable/gabarito';
import '@fontsource-variable/onest';
import './styles/tokens.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyPrints } from './art/prints';
import { markDevice } from './lib/device';
import { initInstall } from './lib/install';
import { initPress } from './lib/press';
import { registerPwa } from './lib/pwa';
import { initSound } from './lib/sound';

markDevice();
applyPrints();
initSound();
initPress();
initInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) addEventListener('load', () => void registerPwa());
