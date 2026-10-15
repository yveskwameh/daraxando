/**
 * Original Ankara-inspired prints, drawn from simple shapes as tiny repeating SVG tiles.
 * Nothing is traced from a real fabric (see docs/CULTURE.md). A print becomes a CSS
 * background: `background: printBg('ripple')`.
 *
 * On buttons the same tiles are drawn tone-on-tone (TONE), so white text keeps its contrast.
 */

export interface Palette { bg: string | null; a: string; b: string; c: string }

export const PALETTES: Record<string, Palette> = {
  line: { bg: '#3d27db', a: '#ffc921', b: '#ff4fb8', c: '#fff4e0' },
  ripple: { bg: '#dc0fa1', a: '#fff4e0', b: '#ffc921', c: '#3d27db' },
  anger: { bg: null, a: '#0b0a2a', b: '#0b0a2a', c: '#fff4e0' },
  etu: { bg: '#1e1580', a: '#fff4e0', b: '#fff4e0', c: '#fff4e0' },
  swift: { bg: '#3d27db', a: '#fff4e0', b: '#ff4fb8', c: '#ffc921' },
  fan: { bg: '#ffc921', a: '#dc0fa1', b: '#3d27db', c: '#0b0a2a' },
  spiral: { bg: '#17164a', a: '#ff4fb8', b: '#ffc921', c: '#9b8fff' },
  shards: { bg: '#dc0fa1', a: '#3d27db', b: '#ffc921', c: '#fff4e0' },
  shell: { bg: '#35d6c0', a: '#0b0a2a', b: '#ff4fb8', c: '#fff4e0' },
  cowrie: { bg: '#a30a78', a: '#fff4e0', b: '#ffc921', c: '#a30a78' },
  adire: { bg: '#2a1aa6', a: '#c9c3ff', b: '#fff4e0', c: '#c9c3ff' },
  okra: { bg: '#3ccf7a', a: '#0b0a2a', b: '#fff4e0', c: '#ffc921' },
  danfo: { bg: '#ffc921', a: '#0b0a2a', b: '#0b0a2a', c: '#fff4e0' },
  eyes: { bg: '#17164a', a: '#ff4fb8', b: '#fff4e0', c: '#3d27db' },
  family: { bg: '#ff8a1f', a: '#fff4e0', b: '#3d27db', c: '#ffc921' },
  gold: { bg: '#0b0a2a', a: '#ffc921', b: '#ff4fb8', c: '#ffc921' },
};

/** Dark, see-through ink for prints on coloured buttons. */
export const TONE: Palette = { bg: null, a: 'rgba(11,10,42,.26)', b: 'rgba(11,10,42,.26)', c: 'rgba(11,10,42,.26)' };
/** Barely there, for the background behind the app on big screens. */
export const FAINT: Palette = { bg: null, a: 'rgba(155,143,255,.07)', b: 'rgba(155,143,255,.05)', c: 'rgba(255,79,184,.05)' };
/** Light ink for the teal Baba Ayo button, which has dark text. */
export const LIGHT: Palette = { bg: null, a: 'rgba(255,255,255,.3)', b: 'rgba(255,255,255,.22)', c: 'rgba(255,255,255,.3)' };
/** For the quiet third button. */
export const GHOST: Palette = { bg: null, a: 'rgba(155,143,255,.12)', b: 'rgba(155,143,255,.06)', c: 'rgba(155,143,255,.1)' };

function tile(id: string, p: Palette) {
  let w = 44;
  let h = 44;
  let g = '';
  const ring = (x: number, y: number, c: string) =>
    `<g fill='none' stroke='${c}' stroke-width='3'><circle cx='${x}' cy='${y}' r='15'/><circle cx='${x}' cy='${y}' r='9.5'/></g><circle cx='${x}' cy='${y}' r='4' fill='${c}'/>`;
  const hex = (cx: number, cy: number, r: number) => {
    const k = r * 0.866;
    return `M${cx + r} ${cy}L${cx + r / 2} ${cy + k}L${cx - r / 2} ${cy + k}L${cx - r} ${cy}L${cx - r / 2} ${cy - k}L${cx + r / 2} ${cy - k}Z`;
  };
  const corners = (s: number, r: number, c: string) =>
    [[0, 0], [s, 0], [0, s], [s, s]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${c}'/>`).join('');

  switch (id) {
    case 'ripple':
      g = ring(22, 22, p.a) + [[0, 0], [44, 0], [0, 44], [44, 44]].map(([x, y]) => ring(x, y, p.b)).join('');
      break;
    case 'swift':
      w = h = 56;
      g = `<g transform='rotate(-30 28 28)'><ellipse cx='28' cy='28' rx='22' ry='13' fill='none' stroke='${p.a}' stroke-width='3'/><path d='M16 32 28 21l12 11h-6l-6-5.5-6 5.5z' fill='${p.b}'/></g>`
        + corners(56, 5, p.c) + [[28, 0], [0, 28], [56, 28], [28, 56]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.5' fill='${p.a}'/>`).join('');
      break;
    case 'fan':
      w = h = 52;
      g = [20, 110, 200, 290].map((a) => `<ellipse cx='26' cy='13' rx='6.5' ry='11' fill='${p.a}' transform='rotate(${a} 26 26)'/>`).join('')
        + `<circle cx='26' cy='26' r='5' fill='${p.c}'/>` + corners(52, 7, p.b);
      break;
    case 'spiral':
      w = h = 60;
      for (let i = 0; i < 15; i++) {
        const a = i * 0.95;
        const r = 2 + i * 1.7;
        const d = 1.3 + i * 0.14;
        g += `<circle cx='${(30 + r * Math.cos(a)).toFixed(1)}' cy='${(30 + r * Math.sin(a)).toFixed(1)}' r='${d.toFixed(2)}' fill='${p.a}'/>`;
      }
      g += corners(60, 4, p.b);
      break;
    case 'shards': {
      w = h = 48;
      const tri = (ox: number, oy: number) => {
        const pts = [[0, 0], [12, 0], [24, 0], [24, 12], [24, 24], [12, 24], [0, 24], [0, 12]];
        let s = '';
        for (let i = 0; i < 8; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[(i + 1) % 8];
          s += `<path d='M${ox + 12} ${oy + 12}L${ox + x1} ${oy + y1}L${ox + x2} ${oy + y2}Z' fill='${i % 2 ? p.a : p.b}'/>`;
        }
        return s;
      };
      const leaf = (ox: number, oy: number) =>
        `<path d='M${ox + 4} ${oy + 20}Q${ox + 4} ${oy + 4} ${ox + 20} ${oy + 4}Q${ox + 20} ${oy + 20} ${ox + 4} ${oy + 20}Z' fill='${p.c}'/><path d='M${ox + 5} ${oy + 19}L${ox + 19} ${oy + 5}' stroke='${p.a}' stroke-width='1.6'/>`;
      g = tri(0, 0) + tri(24, 24) + leaf(24, 0) + leaf(0, 24);
      break;
    }
    case 'shell': {
      const r = 12;
      const k = r * 0.866;
      w = 36;
      h = +(2 * k).toFixed(2);
      const cs = [[0, 0], [36, 0], [0, h], [36, h], [18, k]];
      g = `<path d='${cs.map(([x, y]) => hex(x, y, r)).join('')}' fill='none' stroke='${p.a}' stroke-width='2.5'/>`
        + cs.map(([x, y], i) => `<path d='${hex(x, y, 5)}' fill='${i === 4 ? p.b : p.c}'/>`).join('');
      break;
    }
    case 'anger':
      w = h = 24;
      g = `<rect width='24' height='12' fill='${p.a}'/><rect y='12' width='24' height='12' fill='${p.c}'/>`;
      break;
    case 'etu':
      w = h = 10;
      g = `<path d='M5 0v10' stroke='${p.c}' stroke-width='1' opacity='.55'/>`;
      break;
    case 'adire':
      w = h = 40;
      g = `<rect x='1' y='1' width='38' height='38' fill='none' stroke='${p.a}' stroke-width='2'/><circle cx='20' cy='20' r='9' fill='none' stroke='${p.a}' stroke-width='2.5'/><circle cx='20' cy='20' r='3' fill='${p.b}'/>`
        + [[8, 8], [32, 8], [8, 32], [32, 32]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.2' fill='${p.a}'/>`).join('');
      break;
    case 'cowrie': {
      w = h = 48;
      const shell = (x: number, y: number, r: number) =>
        `<g transform='rotate(${r} ${x} ${y})'><ellipse cx='${x}' cy='${y}' rx='7.5' ry='11' fill='${p.a}'/><path d='M${x} ${y - 7}l-1.6 2.3 1.6 2.3-1.6 2.3 1.6 2.3-1.6 2.3 1.6 2.3' stroke='${p.c}' stroke-width='1.6' fill='none'/></g>`;
      g = shell(12, 12, 30) + shell(36, 36, -30) + `<circle cx='36' cy='12' r='3' fill='${p.b}'/><circle cx='12' cy='36' r='3' fill='${p.b}'/>`;
      break;
    }
    case 'okra': {
      w = h = 50;
      const pent = (cx: number, cy: number, r: number) =>
        Array.from({ length: 5 }, (_, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join('L');
      g = `<path d='M${pent(25, 25, 13)}Z' fill='${p.b}' stroke='${p.a}' stroke-width='2.5' stroke-linejoin='round'/>`
        + Array.from({ length: 5 }, (_, i) => {
          const a = -Math.PI / 2 + Math.PI / 5 + (i * 2 * Math.PI) / 5;
          return `<circle cx='${(25 + 6.5 * Math.cos(a)).toFixed(1)}' cy='${(25 + 6.5 * Math.sin(a)).toFixed(1)}' r='2.3' fill='${p.a}'/>`;
        }).join('')
        + corners(50, 4, p.c);
      break;
    }
    case 'danfo':
      w = h = 40;
      g = `<rect y='14' width='40' height='10' fill='${p.a}'/><path d='M4 32h8M18 32h8M32 32h8' stroke='${p.b}' stroke-width='3' stroke-linecap='round'/><rect x='6' y='3' width='9' height='6' rx='1.5' fill='${p.c}' opacity='.7'/><rect x='24' y='3' width='9' height='6' rx='1.5' fill='${p.c}' opacity='.7'/>`;
      break;
    case 'eyes':
      w = h = 56;
      g = `<path d='M6 28Q28 8 50 28Q28 48 6 28Z' fill='${p.a}'/><circle cx='28' cy='28' r='8' fill='${p.b}'/><circle cx='28' cy='28' r='3.6' fill='${p.c}'/>` + corners(56, 4, p.b);
      break;
    case 'family':
      w = h = 56;
      g = `<circle cx='20' cy='24' r='10' fill='${p.a}'/><path d='M28 22l7 2-7 3z' fill='${p.c}'/><path d='M14 14q3-5 6-1 3-4 6 1' stroke='${p.b}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='22' cy='21' r='1.8' fill='${p.b}'/>`
        + [[40, 40], [48, 30], [32, 48]].map(([x, y]) => `<ellipse cx='${x}' cy='${y}' rx='4.5' ry='6' fill='${p.a}'/>`).join('');
      break;
    case 'gold':
      g = `<g fill='none' stroke='${p.a}' stroke-width='2.5'><circle cx='22' cy='22' r='16'/><circle cx='22' cy='22' r='7'/></g><circle cx='22' cy='22' r='11.5' fill='none' stroke='${p.b}' stroke-width='2' stroke-dasharray='2 3'/><circle cx='22' cy='22' r='3' fill='${p.c}'/>`
        + corners(44, 5, p.b);
      break;
    default: // line, the house print: three dots in a row with a strike
      w = h = 48;
      g = `<path d='M6 42 42 6' stroke='${p.c}' stroke-width='2.5' stroke-linecap='round'/>`
        + [[10, 38], [24, 24], [38, 10]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='5.5' fill='${p.a}'/>`).join('')
        + [[38, 38], [10, 10]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.4' fill='${p.b}'/>`).join('');
  }
  const bg = p.bg ? `<rect width='${w}' height='${h}' fill='${p.bg}'/>` : '';
  return { svg: `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${bg}${g}</svg>`, w, h };
}

const cache = new Map<string, string>();

/** A CSS background value for a print. Cached, because the same few are used everywhere. */
export function printBg(id: string, pal?: Palette, scale = 1) {
  const key = `${id}|${pal ? JSON.stringify(pal) : ''}|${scale}`;
  let v = cache.get(key);
  if (!v) {
    const t = tile(id, pal ?? PALETTES[id] ?? PALETTES.line);
    v = `url("data:image/svg+xml,${encodeURIComponent(t.svg).replace(/'/g, '%27')}") 0 0 / ${t.w * scale}px ${t.h * scale}px`;
    cache.set(key, v);
  }
  return v;
}

/** Sets the prints the stylesheet uses for buttons and the page background. */
export function applyPrints() {
  const root = document.documentElement.style;
  root.setProperty('--print-btn-1', printBg('ripple', TONE));
  root.setProperty('--print-btn-2', printBg('swift', TONE));
  root.setProperty('--print-btn-3', printBg('shards', GHOST));
  root.setProperty('--print-btn-4', printBg('shell', LIGHT));
  root.setProperty('--print-stage', printBg('line', FAINT, 2.4));
}
