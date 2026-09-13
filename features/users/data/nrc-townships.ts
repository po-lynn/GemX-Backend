import raw from "./nrc-townships-mm.json";
import { fromMyanmarDigits } from "@/lib/nrc";

// Canonical Myanmar NRC state/township reference data — the single source shared by the admin
// web picker (NrcField) and, eventually, any backend that needs real state/township values.
// Keep this file byte-for-byte as supplied; all app-shaped lookups are derived below.
type RawEntry = {
  state_code: string;
  township_code_mm: string;
  township_mm: string;
  state_mm: string;
};

export type NrcTownshipEntry = { code: string; name: string };
export type NrcStateEntry = { value: string; nameMm: string; nameShortMm: string };

const entries = raw as RawEntry[];

const townshipsByState: Record<string, NrcTownshipEntry[]> = {};
const stateEntries: NrcStateEntry[] = [];
const seenStates = new Set<string>();

for (const entry of entries) {
  const state = fromMyanmarDigits(entry.state_code);
  (townshipsByState[state] ??= []).push({ code: entry.township_code_mm, name: entry.township_mm });
  if (!seenStates.has(state)) {
    seenStates.add(state);
    // Card-form short names ("ကချင်") drop the trailing "State"/"Region" suffix the full
    // name carries — used in the compact <select> option; the full name is shown as a helper.
    stateEntries.push({
      value: state,
      nameMm: entry.state_mm,
      nameShortMm: entry.state_mm.replace("ပြည်နယ်", "").replace("တိုင်းဒေသကြီး", ""),
    });
  }
}
for (const list of Object.values(townshipsByState)) {
  list.sort((a, b) => a.code.localeCompare(b.code));
}
stateEntries.sort((a, b) => Number(a.value) - Number(b.value));

/** Township `{code, name}` options, keyed by NRC state number ("1"-"14"). */
export const NRC_TOWNSHIPS_BY_STATE: Record<string, NrcTownshipEntry[]> = townshipsByState;

/** The 14 NRC states/regions, sorted by state number, with Myanmar names. */
export const NRC_STATES: NrcStateEntry[] = stateEntries;

/** Total township count across all states (426) — shown as a reference count in the UI. */
export const NRC_TOWNSHIP_COUNT = entries.length;
