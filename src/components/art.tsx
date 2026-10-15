/**
 * The game's drawings. Every icon, piece and avatar is a <symbol> in src/art/sprite.svg,
 * which is inlined into index.html once, so each use here is a tiny <use> tag.
 */
import type { CSSProperties } from 'react';
import { printBg } from '../art/prints';
import { fmt, short } from '../../shared/stakes';

export function Icon({ id, className = 'ic', style }: { id: string; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} aria-hidden="true" focusable="false">
      <use href={`#${id}`} />
    </svg>
  );
}

/** A piece. Its colours come from the parent: .me-c (indigo) or .op-c (pink). */
export function Piece({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" focusable="false">
      <use href={`#pc-${id}`} />
    </svg>
  );
}

/** A folktale animal inside a ring of the player's print. Baba Ayo gets a cream ring and a BOT tag. */
export function Avatar({ avatar, print, size = 44, ring, className = '' }: { avatar: string; print?: string; size?: number; ring?: string; className?: string }) {
  const bot = avatar === 'baba';
  const style = { '--s': `${size}px`, '--ring': ring ?? (bot ? 'var(--cream)' : printBg(print ?? 'line')) } as CSSProperties;
  return (
    <span className={`av ${className}`} style={style} aria-hidden="true">
      <i>
        <svg aria-hidden="true" focusable="false"><use href={`#av-${avatar}`} /></svg>
      </i>
      {bot && <span className="bot">BOT</span>}
    </span>
  );
}

/** An amount of Dara Seeds: the shell and the number. */
export function Cowries({ n, compact }: { n: number; compact?: boolean }) {
  return (
    <span className="cw">
      <Icon id="i-seed" className="" />
      {compact ? short(n) : fmt(n)}
    </span>
  );
}

/** The Sticker logo: "Dara" with a fuchsia X&O sticker pressed right up against it. */
export function Wordmark({ small }: { small?: boolean }) {
  return (
    <div className={`wordmark${small ? ' sm' : ''}`} role="img" aria-label="Dara X&O">
      <span aria-hidden="true">Dara</span>
      <span className="tag" aria-hidden="true">X&amp;O</span>
    </div>
  );
}
