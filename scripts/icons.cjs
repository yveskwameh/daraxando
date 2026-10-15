/**
 * Renders the app icons from the Sticker logo: "Dara" with the fuchsia X&O sticker pressed
 * right up against it. Run with `node scripts/icons.cjs` (needs Playwright's Chromium).
 * Writes PNGs to public/icons/.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const font = (pkg, file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'node_modules/@fontsource-variable', pkg, 'files', file)).toString('base64');
const faces = `@font-face{font-family:'G';src:url(${font('gabarito', 'gabarito-latin-wght-normal.woff2')});font-weight:400 900}`;

// The design, on a 120 by 120 grid. `pad` shrinks it toward the centre for maskable icons.
const art = (pad = 0, rounded = true) => {
  const s = (120 - pad * 2) / 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><clipPath id="c"><rect width="120" height="120" rx="${rounded ? 27 : 0}"/></clipPath></defs>
  <rect width="120" height="120" rx="${rounded ? 27 : 0}" fill="#3d27db"/>
  <path d="M-4 124 124 -4" stroke="#4a35e3" stroke-width="13" clip-path="url(#c)"/>
  <g transform="translate(${pad} ${pad}) scale(${s})">
    <text x="60" y="51" text-anchor="middle" font-family="G" font-weight="900" font-size="38" letter-spacing="-1" fill="#fff">Dara</text>
    <g transform="rotate(-5 60 77)">
      <rect x="17" y="56" width="86" height="42" rx="21" fill="#dc0fa1" stroke="#fff4e0" stroke-width="4"/>
      <text x="60" y="78" text-anchor="middle" dominant-baseline="central" font-family="G" font-weight="900" font-size="30" fill="#fff">X&amp;O</text>
    </g>
  </g>
</svg>`;
};

// Tiny sizes can't fit the word, so the favicon is the sticker alone.
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="27" fill="#3d27db"/>
  <g transform="rotate(-6 60 60)">
    <rect x="6" y="30" width="108" height="60" rx="30" fill="#dc0fa1" stroke="#fff4e0" stroke-width="6"/>
    <text x="60" y="61" text-anchor="middle" dominant-baseline="central" font-family="G" font-weight="900" font-size="44" fill="#fff">X&amp;O</text>
  </g>
</svg>`;

const jobs = [
  ['icon-192.png', 192, art()],
  ['icon-512.png', 512, art()],
  ['icon-maskable-512.png', 512, art(14, false)],
  ['apple-touch-icon.png', 180, art(6, false)],
  ['favicon-48.png', 48, mark],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, svg] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>${faces}html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, 'public/icons', name), omitBackground: true });
    console.log('wrote', name);
  }
  await browser.close();
})();
