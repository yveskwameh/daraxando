/**
 * You. Your name (change it any time), your state, your title and Aura, your badges, and your
 * collections: avatars, your X & O pieces and prints. Locked items show the title that opens
 * them, and the title pill opens the whole ladder. Settings sit behind the gear at the top, where phones keep them.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AVATARS, PIECES, PRINTS, pieceById, type Item } from '../../shared/collections';
import { BADGES, STAR_AURA, badgeStars, badgeValue, type Habits } from '../../shared/habits';
import { stateName, zoneName, type StateCode } from '../../shared/places';
import { auraForLevel, levelInfo, tierOf, titleFor } from '../../shared/progression';
import { cleanName, nameChars, type Account } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { printBg } from '../art/prints';
import { Avatar, Icon, Piece } from '../components/art';
import { Sheet } from '../components/Sheet';
import { StatePicker } from '../components/StatePicker';
import { auth, shortEmail, type Intent } from '../lib/auth';
import { isStandalone } from '../lib/device';
import { buzz } from '../lib/haptics';
import { promptInstall } from '../lib/install';
import { suggestNames } from '../lib/names';
import { prefs, usePrefs, type Prefs } from '../lib/prefs';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';
import { InstallSheet } from '../sheets/InstallSheet';

const TitlesSheet = lazy(() => import('../sheets/TitlesSheet'));
const SaveSheet = lazy(() => import('../sheets/SaveSheet'));

type Tab = 'badges' | 'avatar' | 'piece' | 'print';

export function Profile({ go }: { go: Go }) {
  const { profile, token, update, signOut } = usePlayer();
  const [tab, setTab] = useState<Tab>('badges');
  const [settings, setSettings] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [titles, setTitles] = useState(false);
  // Stays mounted after the first open, so it can slide away when it closes.
  const [titlesUsed, setTitlesUsed] = useState(false);
  // Save your progress, or sign in to another player. Stays mounted after the first open, so it can slide away.
  const [save, setSave] = useState<Intent | null>(null);
  const [saveAs, setSaveAs] = useState<Intent>('save');
  const [saveUsed, setSaveUsed] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [confirm, setConfirm] = useState<'out' | 'delete' | null>(null);
  const [confirmAs, setConfirmAs] = useState<'out' | 'delete'>('out');
  const [deleting, setDeleting] = useState(false);
  const lv = levelInfo(profile.aura);
  const next = auraForLevel(lv.level + 1);
  const zone = zoneName(profile.state);

  // What this player is saved with, for Settings. Asked for only while Settings is open.
  useEffect(() => {
    if (!settings) return;
    let live = true;
    auth.account(token).then((a) => live && setAccount(a), () => {});
    return () => { live = false; };
  }, [settings, token, profile.saved]);

  const openSave = (intent: Intent) => {
    setSaveAs(intent);
    setSaveUsed(true);
    setSave(intent);
  };
  const ask = (what: 'out' | 'delete') => {
    setConfirmAs(what);
    setConfirm(what);
  };
  const leave = () => {
    go({ name: 'home' }, { replace: true });
    signOut();
  };

  return (
    <main className="screen" aria-label="You">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => go({ name: 'home' })}><Icon id="i-back" /></button>
        <h1>You</h1>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setSettings(true)}><Icon id="i-gear" /></button>
      </div>

      <div className="me-hero">
        <Avatar avatar={profile.avatar} print={profile.print} size={84} />
        <div style={{ minWidth: 0 }}>
          <div className="name-line">
            <h2>{profile.name}</h2>
            <button type="button" aria-label={editing ? 'Cancel, keep your name' : 'Change your name'} aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
              <Icon id={editing ? 'i-close' : 'i-pencil'} className="" />
            </button>
          </div>
          <div className="me-meta">
            <button type="button" className="pill" aria-label={`Your state: ${stateName(profile.state)}. Change it.`} onClick={() => setStateOpen(true)}>
              <Icon id="i-pin" className="pin" />{stateName(profile.state)}{zone ? ` · ${zone}` : ''}
            </button>
            <button type="button" className="pill title-pill" aria-label={`Your title: ${lv.title}. See all titles.`} onClick={() => { setTitlesUsed(true); setTitles(true); }}>
              <Icon id="i-aura" className="" />{lv.title}
            </button>
            <span className="pill">{profile.rating} · {tierOf(profile.rating)}</span>
          </div>
        </div>
      </div>

      {!profile.saved && !editing && (
        <div className="toggle-row save-row">
          <span className="save-ic"><Icon id="i-shield" className="" /></span>
          <div><b>Save your progress</b><span>Keep it when you change phones.</span></div>
          <button type="button" className="mini-btn" onClick={() => openSave('save')}>Save</button>
        </div>
      )}

      {editing ? (
        <NameEdit
          current={profile.name}
          onCancel={() => setEditing(false)}
          onSave={async (name) => {
            if (await update({ name })) {
              setEditing(false);
              toast.ok('Name saved. Others see it from your next match.');
            }
          }}
        />
      ) : (
        <div className="aura-row">
          <div className="t">
            <b><Icon id="i-aura" className="" />{profile.aura.toLocaleString('en-US')} Aura</b>
            <span>{lv.toNext.toLocaleString('en-US')} more to become {lv.nextTitle}</span>
          </div>
          <span className="aura-bar" role="progressbar" aria-valuemin={auraForLevel(lv.level)} aria-valuemax={next} aria-valuenow={profile.aura} aria-label="Aura toward your next title">
            <i style={{ width: `${Math.max(3, (lv.into / lv.span) * 100)}%` }} />
          </span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {([['badges', 'Badges'], ['avatar', 'Avatar'], ['piece', 'X & O'], ['print', 'Print']] as const).map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{name}</button>
        ))}
      </div>

      <div className="panel" role="tabpanel">
        {tab === 'badges' && <Badges habits={profile.habits} />}
        {tab === 'avatar' && (
          <Collection
            intro={<><b>{open(AVATARS, lv.level)} of {AVATARS.length} open.</b> Animals from folktales and everyday life across Nigeria. New titles unlock the rest.</>}
            items={AVATARS}
            level={lv.level}
            selected={profile.avatar}
            render={(a) => <Avatar avatar={a.id} print={profile.print} size={64} />}
            note={(a) => (a as (typeof AVATARS)[number]).alt}
            onPick={(a) => {
              void update({ avatar: a.id });
              toast((a as (typeof AVATARS)[number]).story);
            }}
          />
        )}
        {tab === 'piece' && (
          <Collection
            intro={<><b>Your X &amp; O</b> is what you place on the board. Yours always shows in indigo, your opponent's in pink. {open(PIECES, lv.level)} of {PIECES.length} open.</>}
            items={PIECES}
            level={lv.level}
            selected={profile.piece}
            render={(p) => <span className="pc me-c"><Piece id={p.id} /></span>}
            note={(p) => `Pairs with ${pieceById((p as (typeof PIECES)[number]).pair).name}`}
            onPick={(p) => void update({ piece: p.id })}
          />
        )}
        {tab === 'print' && (
          <Collection
            intro={<><b>Your fabric.</b> It shows on your avatar ring and your nameplate in matches. Finer prints unlock with new titles. {open(PRINTS, lv.level)} of {PRINTS.length} open.</>}
            items={PRINTS}
            level={lv.level}
            selected={profile.print}
            render={(p) => <span className="sw" style={{ background: printBg(p.id) }} />}
            note={(p) => (p as (typeof PRINTS)[number]).note}
            onPick={(p) => void update({ print: p.id })}
          />
        )}
      </div>

      <Sheet open={settings} onClose={() => setSettings(false)} label="Settings">
        <h2>Settings</h2>
        <div className="scroll">
          <Settings account={account} onSave={() => openSave('save')} onSignin={() => openSave('signin')} onSignOut={() => ask('out')} onDelete={() => ask('delete')} />
        </div>
      </Sheet>

      <Suspense fallback={null}>
        {saveUsed && <SaveSheet open={save !== null} onClose={() => setSave(null)} intent={saveAs} back="/you" has={saveAs === 'save' ? account : null} />}
      </Suspense>

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} label={confirmAs === 'out' ? 'Sign out' : 'Delete my account'} closeButton={false}>
        {confirmAs === 'out' ? (
          <>
            <div className="titled">
              <h2>Sign out of {profile.name}?</h2>
              <p className="fine">Sign back in any time with {signInWith(account)}. This phone goes back to the first screen.</p>
            </div>
            <div className="actions">
              <button type="button" className="btn primary block" onClick={() => { setConfirm(null); toast(`Signed out. Sign back in with ${signInWith(account)}.`, 4000); leave(); }}>Sign out</button>
              <button type="button" className="btn ghost block" onClick={() => setConfirm(null)}>Stay signed in</button>
            </div>
          </>
        ) : (
          <>
            <div className="titled">
              <h2>Delete {profile.name} for good?</h2>
              <p className="fine">
                Your player, your {fmt(profile.cowries)} Dara Seeds, your title, streak, badges and match history are deleted
                {profile.saved ? ', and we forget your email and Google account' : ''}. This can't be undone.
              </p>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn primary block"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await auth.deleteMe(token);
                    setConfirm(null);
                    toast('Your account is deleted.', 4000);
                    leave();
                  } catch (err) {
                    toast.error((err as Error).message);
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting' : 'Delete for good'}
              </button>
              <button type="button" className="btn ghost block" onClick={() => setConfirm(null)}>Keep my account</button>
            </div>
          </>
        )}
      </Sheet>

      <Suspense fallback={null}>
        {titlesUsed && <TitlesSheet open={titles} onClose={() => setTitles(false)} />}
      </Suspense>

      <Sheet open={stateOpen} onClose={() => setStateOpen(false)} label="Your state">
        <div className="titled">
          <h2>Where do you play from?</h2>
          <p className="fine">We match you with nearby players first. We only keep the state you pick.</p>
        </div>
        <div className="scroll">
          <StatePicker
            value={profile.state}
            onPick={async (s: StateCode) => {
              setStateOpen(false);
              if (await update({ state: s })) toast.ok(`Saved. Quick match looks in ${stateName(s)} first.`);
            }}
          />
        </div>
      </Sheet>
    </main>
  );
}

const open = (list: readonly Item[], level: number) => list.filter((x) => x.lvl <= level).length;

/** "Google (tunde@gmail.com)", "tunde@gmail.com", or both. */
function signInWith(a: Account | null) {
  if (!a) return 'Google or your email';
  const g = a.google !== null ? `Google${a.google ? ` (${shortEmail(a.google)})` : ''}` : '';
  const e = a.email ? shortEmail(a.email) : '';
  return [g, e].filter(Boolean).join(' or ') || 'Google or your email';
}

/** Badges: three stars each, for things you do over time. Each star pays Aura once. */
function Badges({ habits }: { habits: Habits }) {
  const earned = BADGES.reduce((n, b) => n + badgeStars(b, badgeValue(habits, b.id)), 0);
  return (
    <>
      <p className="hint"><b>{earned} of {BADGES.length * 3} stars.</b> Each star pays {STAR_AURA.join(', ')} Aura as you reach it.</p>
      <ul className="badges">
        {BADGES.map((b) => {
          const value = badgeValue(habits, b.id);
          const stars = badgeStars(b, value);
          const target = b.stars[Math.min(stars, 2)];
          const done = stars === 3;
          return (
            <li key={b.id} className={stars ? 'got' : ''}>
              <span className="stars" aria-label={`${stars} of 3 stars`}>
                {[1, 2, 3].map((n) => <Icon key={n} id="i-star" className={n <= stars ? 'on' : ''} />)}
              </span>
              <b>{b.name}</b>
              <span className="what">{b.what}{b.id === 'streak' ? ` ${target} days` : ''}</span>
              <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(value, target)} aria-label={`${b.name}: ${Math.min(value, target)} of ${target}`}>
                <i style={{ width: `${Math.max(value ? 6 : 0, Math.min(1, value / target) * 100)}%` }} />
              </span>
              <small>{done ? 'All 3 stars' : `${Math.min(value, target)} / ${target}`}</small>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Collection<T extends Item>({ intro, items, level, selected, render, note, onPick }: {
  intro: ReactNode;
  items: readonly T[];
  level: number;
  selected: string;
  render: (x: T) => ReactNode;
  note: (x: T) => string;
  onPick: (x: T) => void;
}) {
  return (
    <>
      <p className="hint">{intro}</p>
      <div className="grid">
        {items.map((x) => {
          const locked = x.lvl > level;
          return (
            <button
              key={x.id}
              type="button"
              className={`tile${locked ? ' locked' : ''}`}
              aria-pressed={x.id === selected}
              aria-label={`${x.name}${locked ? `, opens at ${titleFor(x.lvl)}` : ''}`}
              onClick={() => {
                if (locked) {
                  buzz('invalid');
                  toast(`Become ${titleFor(x.lvl)} to unlock ${x.name}. Tap your title to see how far.`);
                  return;
                }
                buzz('tap');
                onPick(x);
              }}
            >
              {locked && <Icon id="i-lock" className="lock" />}
              {render(x)}
              <b>{x.name}</b>
              <span>{locked ? titleFor(x.lvl) : note(x)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function NameEdit({ current, onSave, onCancel }: { current: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(current);
  const [ideas, setIdeas] = useState(() => suggestNames(5, current));
  const clean = cleanName(value);
  return (
    <form
      className="edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (!clean) {
          buzz('invalid');
          toast.error('Use 2 to 16 letters or numbers.');
          return;
        }
        onSave(clean);
      }}
    >
      <label className="sr" htmlFor="name-in">Your name</label>
      <input id="name-in" className="text-in" value={value} maxLength={16} autoComplete="off" spellCheck={false} data-autofocus onChange={(e) => setValue(nameChars(e.target.value))} />
      <div className="chips-row">
        {ideas.map((n) => <button key={n} type="button" onClick={() => setValue(n)}>{n}</button>)}
        <button type="button" aria-label="More name ideas" onClick={() => setIdeas(suggestNames(5, value))}>
          <Icon id="i-shuffle" className="" style={{ width: 16, height: 16, verticalAlign: -3 }} />
        </button>
      </div>
      <div className="edit-row">
        <small>2 to 16 letters. Change it any time.</small>
        <button type="button" className="mini-btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="mini-btn" disabled={!clean}>Save</button>
      </div>
    </form>
  );
}

/**
 * Your record: win rate up front, a bar split into wins, draws and losses, and your best run
 * of wins. Losses are a quiet grey, never red.
 */
function Record({ wins, draws, losses, best, now }: { wins: number; draws: number; losses: number; best: number; now: number }) {
  const played = wins + draws + losses;
  const rate = played ? Math.round((wins / played) * 100) : 0;
  const parts = [
    { k: 'w', n: wins, label: wins === 1 ? 'Win' : 'Wins' },
    { k: 'd', n: draws, label: draws === 1 ? 'Draw' : 'Draws' },
    { k: 'l', n: losses, label: losses === 1 ? 'Loss' : 'Losses' },
  ];
  if (!played) {
    return (
      <section className="record empty" aria-label="Your record">
        <span className="record-ic"><Icon id="i-star" className="" /></span>
        <div>
          <b>No matches against players yet</b>
          <span>Your wins, draws and best run against other players show up here. Games with Baba Ayo don't count.</span>
        </div>
      </section>
    );
  }
  return (
    <section className="record" aria-label="Your record">
      <div className="record-top">
        <div className="rate">
          <b>{rate}%</b>
          <span>Win rate · {played} {played === 1 ? 'match' : 'matches'} against players</span>
        </div>
        <div className="run">
          <Icon id="i-star" className="" />
          <div>
            <b>{best ? `${best} ${best === 1 ? 'win' : 'wins'} in a row` : 'No win run yet'}</b>
            <span>{best ? (now > 0 ? `Your best run. Now on ${now}.` : 'Your best run') : 'Win a match to start one'}</span>
          </div>
        </div>
      </div>
      <div className="record-bar" aria-hidden="true">
        {parts.filter((p) => p.n > 0).map((p) => <i key={p.k} className={p.k} style={{ flexGrow: p.n }} />)}
      </div>
      <ul className="record-key">
        {parts.map((p) => <li key={p.k}><i className={p.k} /><b>{p.n}</b> {p.label}</li>)}
      </ul>
      <span className="sr">{`${played} ${played === 1 ? 'match' : 'matches'} against players: ${parts.map((p) => `${p.n} ${p.label.toLowerCase()}`).join(', ')}. Best run ${best} ${best === 1 ? 'win' : 'wins'} in a row.`}</span>
    </section>
  );
}

function Settings({ account, onSave, onSignin, onSignOut, onDelete }: {
  account: Account | null;
  onSave: () => void;
  onSignin: () => void;
  onSignOut: () => void;
  onDelete: () => void;
}) {
  const p = usePrefs();
  const { profile } = usePlayer();
  const [steps, setSteps] = useState(false);
  const installed = isStandalone();
  const rows: [keyof Prefs, string, string][] = [
    ['music', 'Music', 'A talking drum and shekere loop, made live on your phone.'],
    ['sfx', 'Sound effects', 'Taps, moves, wins.'],
    ['haptics', 'Vibration', 'Little buzzes on taps, wins and losses.'],
    ['nudges', "Baba Ayo's nudges", 'He reminds you about your streak. He can be dramatic.'],
  ];
  return (
    <div className="stack">
      <Record wins={profile.wins} draws={profile.draws} losses={profile.losses} best={profile.bestWinStreak} now={profile.winStreak} />
      {profile.saved ? (
        <div className="toggle-row">
          <div>
            <b>Your progress is saved</b>
            {!account && <span>Checking</span>}
            {account?.google != null && <span>Google{account.google ? `: ${shortEmail(account.google)}` : ''}</span>}
            {account?.email && <span>Email: {shortEmail(account.email)}</span>}
          </div>
          {account && (account.google === null || account.email === null) && (
            <button type="button" className="mini-btn ghost" onClick={onSave}>{account.google === null ? 'Add Google' : 'Add email'}</button>
          )}
        </div>
      ) : (
        <div className="toggle-row">
          <div><b>Save your progress</b><span>Keep your seeds, title and streak on any phone.</span></div>
          <button type="button" className="mini-btn" onClick={onSave}>Save</button>
        </div>
      )}
      <div className="toggle-row">
        <div><b>Another player</b><span>Sign in to a player you saved on another phone.</span></div>
        <button type="button" className="mini-btn ghost" onClick={onSignin}>Sign in</button>
      </div>
      {rows.map(([k, title, desc]) => (
        <div key={k} className="toggle-row">
          <div><b>{title}</b><span>{desc}</span></div>
          <button
            type="button"
            className="sw-toggle"
            role="switch"
            aria-checked={!!p[k]}
            aria-label={title}
            onClick={() => {
              const on = !p[k];
              prefs.set({ [k]: on } as Partial<Prefs>);
              if (k === 'haptics' && on) buzz('win');
            }}
          />
        </div>
      ))}
      <div className="toggle-row">
        <div><b>Install the app</b><span>Play full screen from your home screen.</span></div>
        <button
          type="button"
          className="mini-btn"
          disabled={installed}
          onClick={async () => { if (!(await promptInstall())) setSteps(true); }}
        >
          {installed ? 'Installed' : 'Install'}
        </button>
      </div>
      <div className="toggle-row">
        <div><b>Test vibration</b><span>Android buzzes. iPhone gives a light tap.</span></div>
        <button type="button" className="mini-btn" onClick={() => buzz('win', true)}>Buzz</button>
      </div>
      {profile.saved && (
        <div className="toggle-row">
          <div><b>Sign out</b><span>Sign back in any time with Google or your email.</span></div>
          <button type="button" className="mini-btn ghost" onClick={onSignOut}>Sign out</button>
        </div>
      )}
      <div className="toggle-row">
        <div><b>Delete my account</b><span>Your player and everything with it, for good.</span></div>
        <button type="button" className="mini-btn ghost" onClick={onDelete}>Delete</button>
      </div>
      <p className="fine">Dara X&amp;O is for players aged 13 and up. Dara Seeds are for fun: you can't buy, sell, send or cash them out.</p>
      <InstallSheet open={steps} onClose={() => setSteps(false)} />
    </div>
  );
}
