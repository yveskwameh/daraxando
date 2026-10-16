/**
 * The title ladder: all twenty titles from JJC to Idan, in order, with what each means, the
 * Aura it takes and what it opens. Yours is highlighted and scrolled into view. It opens from
 * the title pill on You, so players can see how far the next title is.
 */
import { useEffect, useRef } from 'react';
import { unlocksAt } from '../../shared/collections';
import { auraForLevel, levelInfo, TITLES, titleFor } from '../../shared/progression';
import { fmt } from '../../shared/stakes';
import { Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { usePlayer } from '../lib/session';

export default function TitlesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Titles">
      {open && <Body />}
    </Sheet>
  );
}

function Body() {
  const { profile } = usePlayer();
  const lv = levelInfo(profile.aura);
  const now = Math.min(lv.level, TITLES.length);
  const here = useRef<HTMLLIElement>(null);

  // Bring your row to the middle of the list (only the list scrolls, never the page).
  useEffect(() => {
    const li = here.current;
    const list = li?.parentElement;
    if (li && list) list.scrollTop = li.offsetTop - (list.clientHeight - li.clientHeight) / 2;
  }, []);

  return (
    <>
      <div className="titled">
        <h2>Titles</h2>
        <p className="fine">
          Every match earns Aura. Earn enough and you move up a title. You're <b>{lv.title}</b>, {fmt(lv.toNext)} Aura from {lv.nextTitle}.
        </p>
      </div>
      <ol className="scroll titles">
        {TITLES.map((t, i) => {
          const level = i + 1;
          const state = level < now ? 'done' : level === now ? 'now' : 'next';
          // The first title's items are open from the start, so only later titles list what they open.
          const opens = level > 1 ? unlocksAt(level) : [];
          return (
            <li key={t.name} className={state} ref={state === 'now' ? here : undefined} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="tn" aria-hidden="true">{state === 'done' ? <Icon id="i-check" className="" /> : level}</span>
              <div>
                <b>{t.name}</b>
                <span>{t.means}</span>
                <small>{t.lang}{opens.length ? ` · Opens ${opens.join(', ')}` : ''}</small>
              </div>
              <span className="ta">
                {state === 'now' ? 'You' : state === 'next' && <>{fmt(auraForLevel(level))}<small>Aura</small></>}
              </span>
            </li>
          );
        })}
      </ol>
      {lv.level >= TITLES.length && (
        <p className="fine">Past {titleFor(TITLES.length)}, every new title counts up: {titleFor(TITLES.length + 1)}, {titleFor(TITLES.length + 2)} and on.</p>
      )}
    </>
  );
}
