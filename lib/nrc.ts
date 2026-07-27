import { z } from "zod";

// Myanmar NRC format: StateNo/TownshipCode(CitizenType)SequentialNo
// e.g. 12/ABC(N)123456 — also accepted written in Myanmar script, e.g. ၉/မလန(နိုင်)၁၂၈၂၃၃
// State: 1–14  |  Township: 3 uppercase letters (or Myanmar script)  |  Type: N/P/T/E (or Myanmar script)  |  Seq: 6 digits
const NRC_LATIN_SOURCE = String.raw`\d{1,2}\/[A-Z]{3}\([NPTE]\)\d{6}`;
// Myanmar script has no fixed codepoint count per syllable (vowel signs/medials stack onto
// base consonants), so township/type are matched as variable-length runs of Myanmar script
// rather than a fixed character count.
const NRC_MYANMAR_SOURCE = "[\\u1040-\\u1049]{1,2}\\/[\\u1000-\\u109F]{1,10}\\([\\u1000-\\u109F]{1,10}\\)[\\u1040-\\u1049]{6}";
export const NRC_REGEX = new RegExp(`^(?:${NRC_LATIN_SOURCE}|${NRC_MYANMAR_SOURCE})$`);

export const NRC_CITIZEN_TYPES = {
  N: "Naing (National)",
  P: "Pyu (Associate)",
  T: "Thit (Naturalized)",
  E: "Ein (Honorary)",
} as const;

export type NrcCitizenType = keyof typeof NRC_CITIZEN_TYPES;

export const nrcSchema = z
  .string()
  .regex(NRC_REGEX, "Invalid NRC format — expected e.g. 12/ABC(N)123456 or the Myanmar script equivalent")
  .max(20);

export function validateNrc(value: string): boolean {
  return NRC_REGEX.test(value);
}

function myanmarDigitsToNumber(digits: string): number {
  return parseInt(
    Array.from(digits)
      .map((ch) => String(ch.charCodeAt(0) - 0x1040))
      .join(""),
    10,
  );
}

/**
 * Parse a valid NRC string into its components.
 * Accepts both the Latin transliteration and Myanmar script formats.
 * Returns null if the format is invalid.
 */
export function parseNrc(value: string) {
  if (!validateNrc(value)) return null;
  const [statePart, rest] = value.split("/");

  const latinMatch = rest.match(/^([A-Z]{3})\(([NPTE])\)(\d{6})$/);
  if (latinMatch) {
    return {
      state: parseInt(statePart, 10),
      township: latinMatch[1],
      type: latinMatch[2] as NrcCitizenType,
      serial: latinMatch[3],
    };
  }

  const myanmarMatch = rest.match(/^([က-႟]{1,10})\(([က-႟]{1,10})\)([၀-၉]{6})$/);
  if (myanmarMatch) {
    return {
      state: myanmarDigitsToNumber(statePart),
      township: myanmarMatch[1],
      type: myanmarMatch[2],
      serial: myanmarMatch[3],
    };
  }

  return null;
}

const SAMPLE_TOWNSHIPS = [
  "AHN", "BAH", "BLN", "CAN", "DAW", "GYO", "HAN", "INS", "KMD",
  "LAM", "MAN", "MGN", "MKN", "MON", "MYK", "NAN", "PAT", "PBE",
  "PKN", "PYI", "RGN", "SAG", "SAN", "SGN", "SHW", "TAD", "TAN",
  "THA", "TWN", "YAM", "YAN", "YGN", "ZAY",
];

/**
 * Generate a random valid NRC number.
 * Useful for seeding / test fixtures — not for real identity assignment.
 */
export function generateNrc(options?: {
  state?: number;
  township?: string;
  type?: NrcCitizenType;
}): string {
  const state = options?.state ?? Math.floor(Math.random() * 14) + 1;
  const township =
    options?.township ??
    SAMPLE_TOWNSHIPS[Math.floor(Math.random() * SAMPLE_TOWNSHIPS.length)];
  const type = options?.type ?? "N";
  const serial = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return `${state}/${township}(${type})${serial}`;
}
