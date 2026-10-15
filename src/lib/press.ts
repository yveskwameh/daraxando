/**
 * What every Ankara sticker button does when pressed: straighten, squeeze, slide its print,
 * click, buzz, and on the main buttons throw a few sparks. One listener on the document
 * handles every button, so buttons stay plain <button class="btn"> elements.
 */
import { isLite, reducedMotion } from './device';
import { buzz } from './haptics';
import { sfx } from './sound';

const COLORS = ['#ffc921', '#ff4fb8', '#9b8fff', '#fff4e0'];

export function burst(x: number, y: number, count = isLite ? 5 : 8) {
  if (reducedMotion()) return;
  const layer = document.getElementById('sparks');
  if (!layer) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.left = `${x - 4}px`;
    s.style.top = `${y - 4}px`;
    s.style.background = COLORS[i % COLORS.length];
    layer.appendChild(s);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const d = 34 + Math.random() * 26;
    const anim = s.animate(
      [
        { transform: 'translate(0, 0) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(220deg) scale(.2)`, opacity: 0 },
      ],
      { duration: 460, easing: 'cubic-bezier(.2, .8, .2, 1)' },
    );
    anim.onfinish = () => s.remove();
  }
}

export function initPress() {
  document.addEventListener('pointerdown', (e) => {
    const b = (e.target as Element).closest?.('.btn') as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    b.classList.add('is-down');
    if (b.classList.contains('primary')) burst(e.clientX, e.clientY);
    sfx.tap();
    buzz('tap');
  });
  const up = () => document.querySelectorAll('.btn.is-down').forEach((b) => b.classList.remove('is-down'));
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
