/**
 * The QR code and the saved picture for a player code (src/sheets/CodeSheet.tsx). Only the code
 * sheet imports this, so the QR library stays out of the first download.
 *
 * The phone draws the picture itself, so the code never goes anywhere: on an iPhone it opens the
 * share menu, whose "Save Image" puts it in Photos; elsewhere it downloads, which phones put with
 * their pictures. Share to myself sends the code as text with a link that fills it in.
 */
import { encode } from 'uqr';
import { codeLink } from '../../shared/codes';
import { copyText } from './clipboard';
import { isIOS } from './device';

/** The QR code's squares, for drawing: true is dark. The link opens the game with the code filled in. */
export function qrOf(code: string) {
  const q = encode(codeLink(location.origin, code), { ecc: 'M', border: 0 });
  return { size: q.size, dark: q.data };
}

/** The QR code as an SVG path, one square per dark module. */
export function qrPath(code: string) {
  const { size, dark } = qrOf(code);
  let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (dark[y][x]) d += `M${x} ${y}h1v1h-1z`;
  return { size, d };
}

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The player's animal from the sprite, as a picture the canvas can draw. Null if it can't be found. */
function avatarImage(avatar: string): Promise<HTMLImageElement | null> {
  const sym = document.getElementById(`av-${avatar}`);
  if (!sym) return Promise.resolve(null);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.getAttribute('viewBox') ?? '0 0 100 100'}">${sym.innerHTML}</svg>`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * The picture: the logo, your animal and name, the QR code, the code in four groups, and a line
 * saying to keep it private. 1080 by 1350, the shape phones show best.
 */
export async function drawCard(code: string, name: string, avatar: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const head = css('--head', 'sans-serif');
  const body = css('--body', 'sans-serif');
  await Promise.all([document.fonts.load(`900 96px ${head}`), document.fonts.load(`800 64px ${head}`), document.fonts.load(`500 34px ${body}`)]).catch(() => {});
  const c = {
    night: css('--night', '#0b0a2a'), deep: css('--deep', '#17164a'), indigo: css('--indigo', '#3d27db'),
    fuchsia: css('--fuchsia', '#dc0fa1'), cream: css('--cream', '#fff4e0'),
  };

  ctx.fillStyle = c.night;
  ctx.fillRect(0, 0, W, H);
  // The card, with the cream ring the app's stickers have.
  rounded(ctx, 60, 60, W - 120, H - 120, 56);
  ctx.fillStyle = c.indigo;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = c.cream;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  // The Sticker logo: "Dara" and the X&O sticker pressed up against it.
  ctx.font = `900 92px ${head}`;
  const dara = ctx.measureText('Dara').width;
  ctx.font = `900 54px ${head}`;
  const tagW = ctx.measureText('X&O').width + 44;
  const logoW = dara + 6 + tagW;
  const lx = (W - logoW) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 92px ${head}`;
  ctx.textAlign = 'left';
  ctx.fillText('Dara', lx, 190);
  rounded(ctx, lx + dara + 6, 152, tagW, 76, 38);
  ctx.fillStyle = c.fuchsia;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = c.cream;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 54px ${head}`;
  ctx.textAlign = 'center';
  ctx.fillText('X&O', lx + dara + 6 + tagW / 2, 192);

  // Your animal and name.
  ctx.font = `800 60px ${head}`;
  const nameW = Math.min(ctx.measureText(name).width, 640);
  const rowW = 112 + 24 + nameW;
  const ax = (W - rowW) / 2;
  ctx.beginPath();
  ctx.arc(ax + 56, 330, 56, 0, Math.PI * 2);
  ctx.fillStyle = c.deep;
  ctx.fill();
  const img = await avatarImage(avatar);
  if (img) ctx.drawImage(img, ax + 12, 286, 88, 88);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(name, ax + 136, 334, 640);

  // The QR code on cream, with room around it so cameras read it.
  const { size, dark } = qrOf(code);
  const box = 560;
  const bx = (W - box) / 2;
  const by = 430;
  rounded(ctx, bx, by, box, box, 40);
  ctx.fillStyle = c.cream;
  ctx.fill();
  const cell = Math.floor((box - 80) / size);
  const ox = bx + (box - cell * size) / 2;
  const oy = by + (box - cell * size) / 2;
  ctx.fillStyle = c.night;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (dark[y][x]) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);

  // The code in four groups, and the line.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 68px ${head}`;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
  ctx.fillText(code, W / 2, 1080, W - 200);
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  ctx.fillStyle = '#e3e0ff';
  ctx.font = `500 34px ${body}`;
  ctx.fillText('Your player code. Keep this private:', W / 2, 1160);
  ctx.fillText('anyone with this code can play as you.', W / 2, 1208);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Saves the picture. iPhone: the share menu, where "Save Image" puts it in Photos. Elsewhere: a
 * download, which Android shows with the phone's pictures. 'shared' and 'saved' both mean it went
 * somewhere; 'cancelled' means they closed the share menu.
 */
export async function savePicture(blob: Blob, name: string): Promise<'saved' | 'shared' | 'cancelled' | 'failed'> {
  const file = new File([blob], `${name.replace(/[^A-Za-z0-9]+/g, '-')}-player-code.png`, { type: 'image/png' });
  if (isIOS && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      return (err as Error).name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Share to myself: the phone's share menu with the code and its link, or a copy where there's no menu. */
export async function shareCode(code: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = `My Dara X&O player code: ${code}. Keep it private.\n${codeLink(location.origin, code)}`;
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
