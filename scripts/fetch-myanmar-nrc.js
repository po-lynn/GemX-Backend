#!/usr/bin/env node
/**
 * Fetches Myanmar NRC townships from htetoozin/Myanmar-NRC and writes
 * features/users/data/myanmar-nrc-townships.json for the UserForm dropdown.
 * Run: node scripts/fetch-myanmar-nrc.js
 */
const fs = require('fs');
const path = require('path');

const URL = 'https://raw.githubusercontent.com/htetoozin/Myanmar-NRC/master/nrc.json';
const OUT = path.join(__dirname, '../features/users/data/myanmar-nrc-townships.json');

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const json = await res.json();
  const data = json.data || [];
  const byState = {};
  for (const t of data) {
    const code = String(t.nrc_code || t.nrc_code);
    if (!byState[code]) byState[code] = [];
    byState[code].push({ value: t.name_en, label: t.name_en });
  }
  // Sort states 1-14
  const sorted = {};
  for (let i = 1; i <= 14; i++) {
    const k = String(i);
    if (byState[k]) sorted[k] = byState[k];
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2), 'utf8');
  const total = Object.values(sorted).reduce((s, arr) => s + arr.length, 0);
  console.log(`Wrote ${total} townships to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
