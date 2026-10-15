/**
 * The end of a match: who took the series, what you earned (Aura, Dara Seeds, rating),
 * what your next title unlocks, and a rematch. It can't be swiped away, because every way
 * out is a choice: rematch, a new opponent, or home.
 *
 * A rematch can be the same game, or a different mode or stake (a different level against
 * Baba Ayo). Between two players, one asks and the other accepts.
 */
import { useEffect, useState } from 'react';
import { BOT_LEVEL_INFO, BOT_LEVELS, type BotLevel } from '../../shared/bot';
import { nextUnlockLevel, unlocksAt } from '../../shared/collections';
import { MODE_IDS, MODES, seriesLabel, type ModeId } from '../../shared/modes';
import { titleFor, titleMeans } from '../../shared/progression';
import type { MatchView, Rematch, Reward, SeatView } from '../../shared/protocol';
import { fmt, FRIEND_TABLES, prize } from '../../shared/stakes';
import { Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { buzz } from '../lib/haptics';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';

export type RematchAsk = { mode?: ModeId; stake?: number; level?: BotLevel };

interface Props {
  open: boolean;
  view: MatchView;
  me: SeatView;
  opp: SeatView;
  reward: Reward | null;
  notice: string | null;
  onRematch: (ask?: RematchAsk) => void;
  onNew: () => void;
  onHome: () => void;
}

/** What each game is, in a few words, so nobody has to guess. */
const MODE_HINT: Record<ModeId, string> = {
  classic: '3×3, three in a row',
  fading: '3×3, oldest piece vanishes',
  big: '5×5, four in a row',
  pro: '7×7, five in a row',
};
const LEVEL_HINT: Record<BotLevel, string> = { jeje: 'Easy', sharp: 'Medium', agba: 'Hard' };

/** "Big · Stake 500" or "Classic · No stake". */
const describe = (r: Rematch) => `${MODES[r.mode].name} · ${r.stake ? `Stake ${fmt(r.stake)}` : 'No stake'}`;
const same = (a: Rematch | null, b: Rematch | null) => !!a && !!b && a.mode === b.mode && a.stake === b.stake;

/** Counts up from 0, once, when the number first arrives. */
function useCountUp(target: number | null, ms = 700) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (target === null) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

export function ResultSheet(props: Props) {
  const [changing, setChanging] = useState(false);
  // A new match result (or a rematch starting) goes back to the result itself.
  const { open } = props;
  useEffect(() => { if (!open) setChanging(false); }, [open]);
  return (
    <Sheet open={open} onClose={props.onHome} label={changing ? 'Change the rematch' : 'Result'} locked closeButton={!changing} closeLabel="Close and go Home">
      {changing ? (
        <ChangeRematch {...props} onBack={() => setChanging(false)} onAsk={(ask) => { setChanging(false); props.onRematch(ask); }} />
      ) : (
        <Result {...props} onChange={() => setChanging(true)} />
      )}
    </Sheet>
  );
}

function Result({ open, view: v, me, opp, reward, notice, onRematch, onNew, onHome, onChange }: Props & { onChange: () => void }) {
  const you = v.you!;
  const s = v.series;
  const aborted = s?.reason === 'aborted';
  const won = s?.winner === you;
  const lost = s?.winner !== null && s?.winner !== undefined && !won;
  const single = v.bo === 1;
  // A new player's first match: win it and you're through; lose or draw and it's one more game.
  const firstWin = v.first && won;
  const a = me.score;
  const b = opp.score;
  const bot = v.kind === 'bot';
  const aura = useCountUp(reward ? reward.aura + reward.goalBonus + (reward.habits?.extraAura ?? 0) : null);
  const levelled = reward && reward.levelAfter > reward.levelBefore;

  useEffect(() => {
    if (open && levelled) {
      const t = setTimeout(() => sfx.levelUp(), 500);
      return () => clearTimeout(t);
    }
  }, [open, levelled]);

  if (aborted) {
    // The host closed their friend room before it started.
    const closed = v.kind === 'friend' && v.game === 0 && opp.mark === 'X';
    return (
      <>
        <div className="result-head">
          <span className="kicker">No match</span>
          <p className="big">{closed ? 'Room closed.' : 'Match called off.'}</p>
        </div>
        <p className="muted">
          {closed
            ? `${opp.name} closed the room before the match started.`
            : `${opp.name} left before the match got going, so nobody wins and nobody loses rating.`}
          {v.stake ? ` Your ${fmt(v.stake)} Dara Seeds are back.` : ''}
        </p>
        {v.kind === 'quick'
          ? <button type="button" className="btn primary block lg" onClick={onNew}>Find another match</button>
          : <button type="button" className="btn ghost block" onClick={onHome}>Home</button>}
      </>
    );
  }

  let title: string;
  if (s?.reason === 'abandon') title = won ? 'Your opponent don japa. You win.' : 'You left, so they take it.';
  else if (s?.reason === 'idle') title = won ? `${opp.name} didn't start the next game. You take it.` : "You didn't start the next game in time, so they take it.";
  else if (s?.reason === 'resign') title = won ? `${opp.name} left. You take it.` : 'You left, so they take it.';
  else if (won) title = single ? 'Gbam! You win.' : `E choke! You take it ${a} to ${b}.`;
  else if (lost) title = single ? `Chai. ${bot ? 'Baba Ayo' : 'They'} got this one.` : `Chai. ${bot ? 'Baba Ayo takes' : 'They take'} it ${b} to ${a}.`;
  else title = single ? 'Draw. Notin spoil.' : `Level, ${a} to ${b}. Notin spoil.`;

  const cw = reward ? reward.cowries : null;
  const cwLabel = v.stake && s?.winner === null ? 'Stake back' : 'Seeds';
  const unlockLevel = reward ? nextUnlockLevel(reward.levelAfter) : null;
  const unlocked = levelled ? unlocksAt(reward!.levelAfter) : [];

  // Rematch requests. Theirs, if it differs from yours, is an offer you can accept.
  const mine = v.rematch[you];
  const theirs = v.rematch[1 - you];
  const offer = !bot && opp.connected && theirs && !same(mine, theirs) ? theirs : null;
  const waiting = !bot && !!mine && !offer;
  let rematchLabel = v.stake ? `Rematch · Stake ${fmt(v.stake)}` : 'Rematch';
  if (firstWin) rematchLabel = 'Continue';
  else if (bot) rematchLabel = 'Play again';
  else if (!opp.connected) rematchLabel = `${opp.name} left`;
  else if (offer) rematchLabel = 'Accept rematch';
  else if (waiting) rematchLabel = `Waiting for ${opp.name}`;
  const ended = s?.reason === 'abandon' || s?.reason === 'resign' || s?.reason === 'idle';

  return (
    <>
      <div className="result-head">
        <span className="kicker">{won ? 'Odogwu' : lost ? 'Shikena' : 'Gbas gbos'}</span>
        <p className="big">{title}</p>
      </div>

      <div className="gains">
        <div>
          <b><Icon id="i-aura" className="" />{reward ? `+${aura}` : '…'}</b>
          <span>Aura</span>
        </div>
        <div>
          <b><Icon id="i-seed" className="" />{cw === null ? '…' : cw > 0 ? `+${fmt(cw)}` : cw < 0 ? `-${fmt(-cw)}` : v.stake && s?.winner === null ? fmt(v.stake) : '0'}</b>
          <span>{cwLabel}</span>
        </div>
        <div>
          {v.kind === 'quick' ? (
            <>
              <b>{reward ? `${reward.ratingAfter - reward.ratingBefore >= 0 ? '+' : ''}${reward.ratingAfter - reward.ratingBefore}` : '…'}</b>
              <span>Rating</span>
            </>
          ) : (
            <>
              <b><Icon id="i-flame" className="" />{reward ? reward.dayStreak : '…'}</b>
              <span>Day streak</span>
            </>
          )}
        </div>
      </div>

      {levelled && (
        <div className="level-up" role="status">
          <Icon id="i-aura" style={{ width: 32, height: 32 }} />
          <div>
            <b>New title: {titleFor(reward!.levelAfter)}. Jisi ike!</b>
            <span>{titleMeans(reward!.levelAfter)} {unlocked.length ? `New: ${unlocked.join(', ')}. Find them in You.` : 'More unlocks ahead.'}</span>
          </div>
        </div>
      )}

      {reward && (reward.daily > 0 || reward.goalBonus > 0) && (
        <p className="fine">
          {reward.daily > 0 && <>Your daily <b>+{fmt(reward.daily)} Dara Seeds</b> landed. </>}
          {reward.goalBonus > 0 && <>Daily goal done: 3 wins today, <b>+{reward.goalBonus} Aura</b>.</>}
        </p>
      )}

      {!levelled && unlockLevel && (
        <p className="unlock">{titleFor(unlockLevel)} unlocks: <b>{unlocksAt(unlockLevel).join(', ')}</b>.</p>
      )}

      {offer ? (
        <div className="offer" role="status">
          <b>{opp.name} wants a rematch</b>
          <span>{describe(offer)} · {seriesLabel(MODES[offer.mode].bo)}</span>
        </div>
      ) : waiting ? (
        <p className="fine" role="status">You asked for <b>{describe(mine!)}</b>. Waiting for {opp.name} to accept.</p>
      ) : (
        !ended && (
          <p className="taunt">
            {firstWin
              ? 'You beat Baba Ayo. Now take on players across Nigeria.'
              : v.first
                ? 'Baba Ayo says: again? One game, you start.'
                : bot ? 'Baba Ayo says: again?' : lost ? 'Run it back?' : `${opp.name} says: no rage bait me. Rematch?`}
          </p>
        )
      )}
      {notice && <p className="form-error" role="alert">{notice}</p>}

      <button
        type="button"
        className="btn primary block lg"
        disabled={!bot && (!opp.connected || waiting)}
        onClick={() => {
          buzz('tap');
          if (firstWin) return onHome();
          onRematch(offer ? { mode: offer.mode, stake: offer.stake } : undefined);
        }}
      >
        {rematchLabel}
      </button>
      {/* One clear next step above; the other choices are quieter, and X goes Home. The first match keeps it to one. */}
      {!v.first && <div className="more">
        <button type="button" className="link-btn" disabled={!bot && !opp.connected} onClick={onChange}>
          {bot ? 'Change game or level' : 'Change game or stake'}
        </button>
        {v.kind !== 'friend' && (
          <button type="button" className="link-btn" onClick={onNew}>{bot ? 'Find a player' : 'New opponent'}</button>
        )}
      </div>}
    </>
  );
}

/**
 * Pick a different game for the rematch. Two players pick a mode and a stake (the stake you
 * just played for, or a friend-room stake), and the other player has to accept. Against
 * Baba Ayo you pick a mode and his level, and it starts at once.
 */
function ChangeRematch({ view: v, opp, onAsk, onBack }: Props & { onAsk: (ask: RematchAsk) => void; onBack: () => void }) {
  const { profile } = usePlayer();
  const bot = v.kind === 'bot';
  const [mode, setMode] = useState<ModeId>(v.mode);
  const [stake, setStake] = useState(v.stake);
  const [level, setLevel] = useState<BotLevel>(v.level ?? 'sharp');
  const stakes = [...new Set<number>([...FRIEND_TABLES, v.stake])].sort((a, b) => a - b);

  const pickStake = (n: number) => {
    if (n > profile.cowries) {
      buzz('invalid');
      toast(`You need ${fmt(n)} Dara Seeds for that stake.`);
      return;
    }
    buzz('tap');
    setStake(n);
  };

  return (
    <>
      <div>
        <h2>{bot ? 'Change the game' : 'Change the rematch'}</h2>
        <p className="fine">{bot ? 'Pick a game and how hard Baba Ayo plays.' : `Pick a game and a stake. ${opp.name} has to accept before it starts.`}</p>
      </div>

      <span className="kicker" id="pick-game">Game</span>
      <div className="pick-group" role="group" aria-labelledby="pick-game">
        {MODE_IDS.map((id) => (
          <button key={id} type="button" className="pick" aria-pressed={id === mode} onClick={() => { buzz('tap'); setMode(id); }}>
            <b>{MODES[id].name}</b>
            <span>{MODE_HINT[id]}</span>
            <span>{seriesLabel(MODES[id].bo)}</span>
          </button>
        ))}
      </div>

      {bot ? (
        <>
          <span className="kicker" id="pick-level">How hard Baba Ayo plays</span>
          <div className="pick-group three" role="group" aria-labelledby="pick-level">
            {BOT_LEVELS.map((l) => (
              <button key={l} type="button" className="pick" aria-pressed={l === level} onClick={() => { buzz('tap'); setLevel(l); }}>
                <b>{BOT_LEVEL_INFO[l].name}</b>
                <span>{LEVEL_HINT[l]}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <span className="kicker" id="pick-stake">Stake each</span>
          <div className="pick-chips" role="group" aria-labelledby="pick-stake">
            {stakes.map((n) => (
              <button key={n} type="button" aria-pressed={n === stake} aria-disabled={n > profile.cowries} onClick={() => pickStake(n)}>
                {n ? fmt(n) : 'No stake'}
              </button>
            ))}
          </div>
          <p className="fine">{stake ? <>Winner takes <b>{fmt(prize(stake))}</b> Dara Seeds.</> : 'Playing for Aura and rating only.'}</p>
        </>
      )}

      <button
        type="button"
        className="btn primary block lg"
        onClick={() => { buzz('tap'); onAsk(bot ? { mode, level } : { mode, stake }); }}
      >
        {bot ? 'Play' : 'Ask for rematch'}
      </button>
      <div className="more">
        <button type="button" className="link-btn" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
