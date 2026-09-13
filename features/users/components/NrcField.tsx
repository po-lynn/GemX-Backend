"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IdCard, ChevronDown, Search } from "lucide-react";
import {
  NRC_STATES,
  NRC_TOWNSHIPS_BY_STATE,
  NRC_TOWNSHIP_COUNT,
  type NrcTownshipEntry,
} from "@/features/users/data/nrc-townships";
import {
  NRC_CITIZEN_TYPES,
  NRC_CITIZEN_TYPES_MM,
  NRC_STATE_NAMES,
  buildMyanmarNrc,
  toMyanmarDigits,
  type NrcCitizenType,
} from "@/lib/nrc";

// Recreated from design_handoff_nrc_field/ (GemX NRC Field.dc.html + README.md) against the
// canonical state/township table in features/users/data/nrc-townships-mm.json.
const CITIZEN_TYPES = (Object.keys(NRC_CITIZEN_TYPES) as NrcCitizenType[]).map((code) => ({
  code,
  mm: NRC_CITIZEN_TYPES_MM[code],
  en: NRC_CITIZEN_TYPES[code],
}));

export type NrcValue = {
  state: string; // decimal NRC state number "1"-"14", or "" if unset
  township: string; // township_code_mm, or "" if unset
  type: NrcCitizenType;
  number: string; // up to 6 ASCII digits
};

type NrcFieldProps = {
  value: NrcValue;
  onChange: (next: NrcValue) => void;
};

const EMPTY_TOWNSHIPS: NrcTownshipEntry[] = [];

export function NrcField({ value, onChange }: NrcFieldProps) {
  const { state, township, type, number } = value;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const stateEntry = NRC_STATES.find((s) => s.value === state) ?? null;
  const townshipsInState = state ? (NRC_TOWNSHIPS_BY_STATE[state] ?? EMPTY_TOWNSHIPS) : EMPTY_TOWNSHIPS;
  const currentTownship = townshipsInState.find((t) => t.code === township) ?? null;
  // A stored township that doesn't match this state's known list (legacy data, or a data-entry
  // mismatch) is still shown and kept — never silently swapped for a "valid" one — so editing an
  // existing user never drops their recorded value.
  const isUnrecognizedTownship = !currentTownship && township !== "";

  const q = query.trim();
  const filtered: NrcTownshipEntry[] = useMemo(() => {
    if (!q) return townshipsInState.slice(0, 120);
    return townshipsInState.filter((t) => t.code.includes(q) || t.name.includes(q)).slice(0, 120);
  }, [townshipsInState, q]);
  // Clamp instead of resetting via effect — the highlighted row just tracks whatever index is
  // still in range after the filtered list changes shape.
  const safeHighlight = filtered.length ? Math.min(highlight, filtered.length - 1) : 0;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDocMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function toggleOpen() {
    setOpen((o) => !o);
    setQuery("");
    setHighlight(0);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setHighlight(0);
  }

  function pickTownship(code: string) {
    onChange({ ...value, township: code });
    setOpen(false);
    setQuery("");
  }

  function handleStateChange(newState: string) {
    const first = (NRC_TOWNSHIPS_BY_STATE[newState] ?? [])[0];
    onChange({ ...value, state: newState, township: first?.code ?? "" });
    setQuery("");
    setOpen(false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(Math.min(safeHighlight + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(Math.max(safeHighlight - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = filtered[safeHighlight];
      if (picked) pickTownship(picked.code);
    }
  }

  function handleNumberChange(raw: string) {
    onChange({ ...value, number: raw.replace(/\D/g, "").slice(0, 6) });
  }

  const digits = number;
  const numberIsPartial = digits.length > 0 && digits.length < 6;
  const complete = state !== "" && township !== "" && digits.length === 6;

  const nrcMm = buildMyanmarNrc({ state, township: township || "—", type, number: digits });
  const nrcLatin = state
    ? `${state}/${township || "—"}(${NRC_CITIZEN_TYPES_MM[type]})${digits}`
    : "—";

  return (
    <div className="nrc-card">
      <div className="nrc-card-head">
        <div className="nrc-icon-tile"><IdCard size={16} strokeWidth={1.9} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nrc-card-title">National Registration Card</div>
          <div className="nrc-card-sub">Used for KYC review. Visible to admins only.</div>
        </div>
        <div className="nrc-pill">{NRC_TOWNSHIP_COUNT} TOWNSHIP CODES</div>
      </div>

      <div className="nrc-grid">
        {/* 1. State / Region */}
        <div className="nrc-field">
          <div className="nrc-label-row">
            <span className="nrc-label">State / Region</span>
            <span className="nrc-req">*</span>
          </div>
          <div className="nrc-select-wrap">
            <select
              className="nrc-select"
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
            >
              <option value="" disabled>Select state</option>
              {NRC_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {toMyanmarDigits(s.value)} - {s.nameShortMm}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="nrc-select-chevron" />
          </div>
          <div className="nrc-helper">
            {stateEntry ? `${stateEntry.nameMm} · ${NRC_STATE_NAMES[state] ?? ""}` : " "}
          </div>
        </div>

        {/* 2. Township code */}
        <div className="nrc-field" style={{ position: "relative" }} ref={popoverRef}>
          <div className="nrc-label-row">
            <span className="nrc-label">Township code</span>
            <span className="nrc-req">*</span>
            <span className="nrc-meta">{state ? `${townshipsInState.length} in this state` : ""}</span>
          </div>
          <button
            type="button"
            className="nrc-township-trigger"
            disabled={!state}
            onClick={toggleOpen}
          >
            <span className="nrc-township-badge">{currentTownship?.code || township || "—"}</span>
            <span className="nrc-township-name">
              {currentTownship
                ? currentTownship.name
                : isUnrecognizedTownship
                  ? "Unrecognized township code"
                  : "Select a township code"}
            </span>
            <ChevronDown size={14} style={{ color: "#8A90A2", flexShrink: 0 }} />
          </button>
          <div className="nrc-helper">Search by code or township name</div>

          {open && (
            <div className="nrc-popover">
              <div className="nrc-search-row">
                <Search size={15} style={{ color: "#8A90A2", flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  className="nrc-search-input"
                  value={query}
                  placeholder="ကမရ or ကျိုက်မရော"
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <div className="nrc-list">
                {filtered.map((t, i) => (
                  <div
                    key={t.code}
                    role="button"
                    tabIndex={-1}
                    className={`nrc-option${i === safeHighlight ? " highlight" : ""}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pickTownship(t.code)}
                  >
                    <span className="nrc-option-code">{t.code}</span>
                    <span className="nrc-option-name">{t.name}</span>
                    {t.code === township && <span className="nrc-option-mark">selected</span>}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="nrc-empty">No township code matches that search inside this state.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Citizenship type */}
        <div className="nrc-field">
          <div className="nrc-label-row">
            <span className="nrc-label">Citizenship type</span>
            <span className="nrc-req">*</span>
          </div>
          <div className="nrc-segmented">
            {CITIZEN_TYPES.map((t) => (
              <button
                key={t.code}
                type="button"
                className={`nrc-segment${t.code === type ? " on" : ""}`}
                onClick={() => onChange({ ...value, type: t.code })}
              >
                {t.mm}
              </button>
            ))}
          </div>
          <div className="nrc-helper">{NRC_CITIZEN_TYPES[type]}</div>
        </div>

        {/* 4. Number */}
        <div className="nrc-field">
          <div className="nrc-label-row">
            <span className="nrc-label">Number</span>
            <span className="nrc-req">*</span>
            <span className="nrc-meta">{digits.length}/6</span>
          </div>
          <input
            className={`nrc-number-input${numberIsPartial ? " warn" : ""}`}
            inputMode="numeric"
            placeholder="123456"
            value={digits}
            onChange={(e) => handleNumberChange(e.target.value)}
          />
          <div className={`nrc-helper${numberIsPartial ? " warn" : ""}`}>
            {numberIsPartial ? "Needs six digits" : "Six digits, as printed"}
          </div>
        </div>
      </div>

      <div className="nrc-preview">
        <div className="nrc-preview-col">
          <div className="nrc-preview-label">AS STORED</div>
          <div className="nrc-preview-mm">{nrcMm || "—"}</div>
        </div>
        <div className="nrc-preview-divider" />
        <div className="nrc-preview-col">
          <div className="nrc-preview-label">LATIN DIGITS</div>
          <div className="nrc-preview-latin">{nrcLatin}</div>
        </div>
        <div className="nrc-status-pill">
          <span className={`nrc-status-dot${complete ? " ready" : ""}`} />
          {complete ? "Ready for KYC review" : "Incomplete"}
        </div>
      </div>
    </div>
  );
}
