import { z } from "zod";

// Myanmar NRC format: StateNo/TownshipCode(CitizenType)SequentialNo
// e.g. 12/ABC(N)123456
// State: 1–14  |  Township: 3 uppercase letters  |  Type: N/P/T/E  |  Seq: 6 digits
export const NRC_REGEX = /^\d{1,2}\/[A-Z]{3}\([NPTE]\)\d{6}$/;

export const NRC_CITIZEN_TYPES = {
  N: "Naing (National)",
  P: "Pyu (Associate)",
  T: "Thit (Naturalized)",
  E: "Ein (Honorary)",
} as const;

export type NrcCitizenType = keyof typeof NRC_CITIZEN_TYPES;

export const nrcSchema = z
  .string()
  .regex(NRC_REGEX, "Invalid NRC format — expected e.g. 12/ABC(N)123456")
  .max(20);

export function validateNrc(value: string): boolean {
  return NRC_REGEX.test(value);
}

/**
 * Parse a valid NRC string into its components.
 * Returns null if the format is invalid.
 */
export function parseNrc(value: string) {
  if (!validateNrc(value)) return null;
  const [statePart, rest] = value.split("/");
  const match = rest.match(/^([A-Z]{3})\(([NPTE])\)(\d{6})$/);
  if (!match) return null;
  return {
    state: parseInt(statePart, 10),
    township: match[1],
    type: match[2] as NrcCitizenType,
    serial: match[3],
  };
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
