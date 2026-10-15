/**
 * Nigeria's 36 states plus the FCT, grouped into the six geopolitical zones. Quick match
 * looks in your state first, then your zone, then all of Nigeria. A player picks their
 * state once. Nothing finer (no city, no coordinates) is ever stored.
 */

export const ZONES = {
  NC: 'North Central',
  NE: 'North East',
  NW: 'North West',
  SE: 'South East',
  SS: 'South South',
  SW: 'South West',
} as const;

export type ZoneCode = keyof typeof ZONES;

export const STATES = [
  ['BE', 'Benue', 'NC'], ['KO', 'Kogi', 'NC'], ['KW', 'Kwara', 'NC'], ['NA', 'Nasarawa', 'NC'],
  ['NI', 'Niger', 'NC'], ['PL', 'Plateau', 'NC'], ['FC', 'FCT Abuja', 'NC'],
  ['AD', 'Adamawa', 'NE'], ['BA', 'Bauchi', 'NE'], ['BO', 'Borno', 'NE'], ['GO', 'Gombe', 'NE'],
  ['TA', 'Taraba', 'NE'], ['YO', 'Yobe', 'NE'],
  ['JI', 'Jigawa', 'NW'], ['KD', 'Kaduna', 'NW'], ['KN', 'Kano', 'NW'], ['KT', 'Katsina', 'NW'],
  ['KE', 'Kebbi', 'NW'], ['SO', 'Sokoto', 'NW'], ['ZA', 'Zamfara', 'NW'],
  ['AB', 'Abia', 'SE'], ['AN', 'Anambra', 'SE'], ['EB', 'Ebonyi', 'SE'], ['EN', 'Enugu', 'SE'], ['IM', 'Imo', 'SE'],
  ['AK', 'Akwa Ibom', 'SS'], ['BY', 'Bayelsa', 'SS'], ['CR', 'Cross River', 'SS'], ['DE', 'Delta', 'SS'],
  ['ED', 'Edo', 'SS'], ['RI', 'Rivers', 'SS'],
  ['EK', 'Ekiti', 'SW'], ['LA', 'Lagos', 'SW'], ['OG', 'Ogun', 'SW'], ['ON', 'Ondo', 'SW'],
  ['OS', 'Osun', 'SW'], ['OY', 'Oyo', 'SW'],
] as const satisfies readonly (readonly [string, string, ZoneCode])[];

/** OUT is outside Nigeria. NONE is "prefer not to say", matched as all of Nigeria. */
export type StateCode = (typeof STATES)[number][0] | 'OUT' | 'NONE';

const BY_CODE = new Map<string, (typeof STATES)[number]>(STATES.map((s) => [s[0], s]));

export const isStateCode = (x: unknown): x is StateCode =>
  typeof x === 'string' && (x === 'OUT' || x === 'NONE' || BY_CODE.has(x));

export function stateName(code: string | null | undefined): string {
  if (code === 'OUT') return 'Outside Nigeria';
  return BY_CODE.get(code ?? '')?.[1] ?? 'Nigeria';
}

export const zoneOf = (code: string | null | undefined): ZoneCode | null => BY_CODE.get(code ?? '')?.[2] ?? null;

export const zoneName = (code: string | null | undefined) => {
  const z = zoneOf(code);
  return z ? ZONES[z] : null;
};
