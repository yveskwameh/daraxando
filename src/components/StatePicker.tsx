/** Every state, grouped by zone, as tappable chips. Used at sign-up and in You. */
import { STATES, ZONES, type StateCode, type ZoneCode } from '../../shared/places';

export function StatePicker({ value, onPick }: { value: StateCode | null; onPick: (s: StateCode) => void }) {
  return (
    <>
      {(Object.keys(ZONES) as ZoneCode[]).map((z) => (
        <div key={z} role="group" aria-label={ZONES[z]} style={{ display: 'grid', gap: 8 }}>
          <span className="kicker">{ZONES[z]}</span>
          <div className="chips-row">
            {STATES.filter((s) => s[2] === z).map(([code, name]) => (
              <button key={code} type="button" aria-pressed={value === code} onClick={() => onPick(code)}>{name}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="chips-row" role="group" aria-label="Other">
        <button type="button" aria-pressed={value === 'OUT'} onClick={() => onPick('OUT')}>Outside Nigeria</button>
        <button type="button" aria-pressed={value === 'NONE'} onClick={() => onPick('NONE')}>Prefer not to say</button>
      </div>
    </>
  );
}
