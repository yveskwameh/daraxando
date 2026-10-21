/**
 * Player codes on Home and the first screen (docs/accounts-prototype.html). Lazy, so none of it is
 * in the first download, and only loaded where codes are on (src/lib/codes.ts).
 *
 *  AccountPops (Home):  "Tunde was opened on another phone", with Not me; "Someone asked us for
 *                       Tunde", with Stop; the borrowed-phone bar with Give it back; and a code
 *                       that arrived in a link while a player is on the phone.
 *  RecoveryWatch (all): this phone asked for help with a lost code. It checks the answer when the
 *                       app opens, says what happened once, and brings the player back when the
 *                       24 hours are up.
 *  WelcomeBack:         the first screen on a phone that remembers players: Continue as them.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Avatar } from './art';
import { Sheet } from './Sheet';
import { TopPop } from './TopPop';
import { codeApi, codeSeen, firstScreen, myRecovery, phonePlayers, takeLinkedCode, type PhonePlayer } from '../lib/codes';
import { buzz } from '../lib/haptics';
import { usePlayer, useSession } from '../lib/session';
import { toast } from '../lib/toast';

const CodeSheet = lazy(() => import('../sheets/CodeSheet'));
const FindSheet = lazy(() => import('../sheets/FindSheet'));
const PlayersSheet = lazy(() => import('../sheets/PlayersSheet'));

/** "today at 15:42", "yesterday at 09:10", "on 12 Oct at 18:05". */
function at(ms: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  const day = days === 0 ? 'today' : days === -1 ? 'yesterday' : days === 1 ? 'tomorrow' : `on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  return `${day} at ${time}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function AccountPops() {
  const session = usePlayer();
  const { profile, token, alerts } = session;
  const me = phonePlayers.get(profile.id);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [given, setGiven] = useState<{ code: string; title: string; lead: string } | null>(null);
  const [giveBack, setGiveBack] = useState(false);
  // A code from a shared link, opened while a player is on this phone: it would be a borrow.
  const [linked] = useState(takeLinkedCode);
  const [find, setFind] = useState(!!linked);
  const [busy, setBusy] = useState(false);

  const hide = (k: string) => setHidden((h) => new Set(h).add(k));

  const used = alerts?.codeUse;
  const showUse = !!used && used > codeSeen.get(profile.id) && used > (me?.since ?? 0) && !hidden.has('use');
  const takeover = alerts?.takeover && !hidden.has(`take:${alerts.takeover.id}`) ? alerts.takeover : null;

  const notMe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await codeApi.lock(token);
      if (used) codeSeen.set(profile.id, used);
      hide('use');
      session.signIn(r.token, r.profile);
      buzz('win');
      setGiven({ code: r.code, title: `${r.profile.name} is safe again`, lead: 'Every other phone is signed out, and here is your new code. The old one no longer works.' });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <>
      {me?.borrowed && (
        <div className="borrow-bar" role="status">
          <span><b>Borrowed phone</b>You leave when you give it back.</span>
          <button type="button" className="mini-btn" onClick={() => setGiveBack(true)}>Give it back</button>
        </div>
      )}

      {showUse && !takeover && (
        <TopPop className="acct-pop" role="alertdialog" label="Opened on another phone" onHide={() => hide('use')}>
          <div>
            <b>{profile.name} was opened on another phone</b>
            <span>{cap(at(used!))}, with your player code. Was that you?</span>
          </div>
          <div className="more">
            <button type="button" className="btn primary sm" onClick={() => { codeSeen.set(profile.id, used!); hide('use'); }}>That was me</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={notMe}>Not me</button>
          </div>
        </TopPop>
      )}

      {takeover && (
        <TopPop className="acct-pop warn" role="alertdialog" label={`Someone asked us for ${profile.name}`} onHide={() => hide(`take:${takeover.id}`)}>
          <div>
            <b>Someone asked us for {profile.name}</b>
            <span>They said they lost their code. {cap(at(takeover.due))}, {profile.name} moves to their phone. Not you? Stop it now.</span>
          </div>
          <div className="more">
            <button
              type="button"
              className="btn primary sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await codeApi.stop(token, takeover.id);
                  hide(`take:${takeover.id}`);
                  session.setAlerts(alerts?.codeUse ? { codeUse: alerts.codeUse } : null);
                  toast.ok(`Stopped. ${profile.name} stays with you. If you shared your code, get a new one in Settings.`, 6000);
                } catch (err) {
                  toast.error((err as Error).message);
                }
                setBusy(false);
              }}
            >
              Stop it
            </button>
            <button type="button" className="btn ghost sm" onClick={() => hide(`take:${takeover.id}`)}>It's me</button>
          </div>
        </TopPop>
      )}

      <Sheet open={giveBack} onClose={() => setGiveBack(false)} label="Give the phone back" closeButton={false}>
        <div className="titled">
          <h2>{me?.borrowed?.back && phonePlayers.get(me.borrowed.back) ? `Switch back to ${phonePlayers.get(me.borrowed.back)!.name}?` : 'Give the phone back?'}</h2>
          <p className="fine">{profile.name} leaves this phone. Your seeds and streak stay with your player.</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary block"
            onClick={() => {
              setGiveBack(false);
              const back = me?.borrowed?.back ? phonePlayers.get(me.borrowed.back) : null;
              toast(back ? `Now playing as ${back.name}.` : `${profile.name} left this phone.`);
              session.endBorrow();
            }}
          >
            Give it back
          </button>
          <button type="button" className="btn ghost block" onClick={() => setGiveBack(false)}>Keep playing</button>
        </div>
      </Sheet>

      <Suspense fallback={null}>
        {given && <CodeSheet open onClose={() => setGiven(null)} given={given} />}
        {linked && <FindSheet open={find} onClose={() => setFind(false)} initial={linked} />}
      </Suspense>
    </>
  );
}

/** This phone asked for help with a lost code: the answer, once, and the player when it's time. */
export function RecoveryWatch() {
  const session = useSession();
  const [news, setNews] = useState<{ title: string; line: string } | null>(null);
  const [given, setGiven] = useState<{ code: string; title: string; lead: string } | null>(null);

  useEffect(() => {
    const mine = myRecovery.get();
    if (!mine) return;
    codeApi.check(mine).then(
      (r) => {
        const s = r.status;
        if (r.token && r.profile && r.code) {
          myRecovery.clear();
          buzz('win');
          session.signIn(r.token, r.profile);
          setGiven({ code: r.code, title: `${r.profile.name} is back`, lead: `Here's your new code. Save it this time.${s.note ? ` ${s.note}` : ''}` });
          return;
        }
        if (s.state === mine.seen) return;
        if (s.state === 'waiting') {
          myRecovery.set({ ...mine, seen: s.state });
          setNews({ title: `Good news about ${s.name}`, line: `${s.name} comes back to this phone ${at(s.due!)}, if nobody stops it. Open the game then.${s.note ? ` ${s.note}` : ''}` });
        } else if (s.state === 'refused') {
          myRecovery.clear();
          setNews({ title: `We couldn't give ${s.name} back`, line: `${s.note ?? ''}${s.again ? ` You can ask again from ${new Date(s.again).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.` : ''}`.trim() });
        } else if (s.state === 'stopped') {
          myRecovery.clear();
          setNews({ title: `${s.name} stays where it is`, line: `${s.name}'s player stopped this request on their phone.` });
        } else if (s.state === 'done') {
          myRecovery.clear();
        }
      },
      (err: { status?: number }) => {
        if (err.status === 404) myRecovery.clear();
      },
    );
    // Once each time the app opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {news && (
        <TopPop className="acct-pop" role="status" onHide={() => setNews(null)}>
          <div><b>{news.title}</b>{news.line && <span>{news.line}</span>}</div>
          <div className="more"><button type="button" className="btn ghost sm" onClick={() => setNews(null)}>OK</button></div>
        </TopPop>
      )}
      <Suspense fallback={null}>
        {given && session.profile && <CodeSheet open onClose={() => setGiven(null)} given={given} />}
      </Suspense>
    </>
  );
}

/**
 * The first screen on a phone that remembers players (Yves, 21 October 2026: a player who signed
 * out came back to Play now and became a new player). Continue as the last one, pick another, or
 * start a new player.
 */
export function WelcomeBack({ onNew }: { onNew: () => void }) {
  const session = useSession();
  const [list] = useState<PhonePlayer[]>(() => phonePlayers.own());
  const [players, setPlayers] = useState(false);
  const [find, setFind] = useState(false);
  const first = list[0];
  if (!first) return null;
  return (
    <main className="screen onb welcome-back" aria-label="Welcome back">
      <div className="titled center">
        <span className="hero-av"><Avatar avatar={first.avatar} print={first.print} size={96} /></span>
        <h1>Welcome back, {first.name}</h1>
        <p className="fine">{list.length > 1 ? `${list.length} players on this phone.` : 'Your player is still on this phone.'}</p>
      </div>
      <div className="actions">
        <button type="button" className="btn primary block lg" onClick={() => { buzz('tap'); session.switchTo(first.id); }}>Continue as {first.name}</button>
        <div className="more">
          <button type="button" className="btn ghost sm" onClick={() => setPlayers(true)}>Another player</button>
          <button type="button" className="btn ghost sm" onClick={() => { firstScreen.fresh = true; onNew(); }}>New player</button>
        </div>
      </div>
      <Suspense fallback={null}>
        <PlayersSheet open={players} onClose={() => setPlayers(false)} onFind={() => { setPlayers(false); setFind(true); }} onNew={() => { setPlayers(false); firstScreen.fresh = true; onNew(); }} />
        <FindSheet open={find} onClose={() => setFind(false)} />
      </Suspense>
    </main>
  );
}
