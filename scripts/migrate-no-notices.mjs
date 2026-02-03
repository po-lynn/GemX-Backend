#!/usr/bin/env node
/**
 * Runs drizzle-kit migrate and filters out PostgreSQL NOTICE object dumps
 * (e.g. "schema already exists, skipping") so the output stays clean.
 */
import { spawn } from "node:child_process";

const child = spawn("npx", ["drizzle-kit", "migrate"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});

let inNoticeBlock = false;
let depth = 0;

function filterLine(line, stream) {
  const s = line.toString();
  if (s.trim() === "{") {
    inNoticeBlock = true;
    depth = 1;
    return;
  }
  if (inNoticeBlock) {
    for (const ch of s) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    if (depth <= 0) inNoticeBlock = false;
    return;
  }
  stream.write(line);
}

child.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] + (i < lines.length - 1 ? "\n" : "");
    if (line === "\n") {
      process.stdout.write(line);
      continue;
    }
    if (inNoticeBlock) {
      for (const ch of line) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth <= 0) inNoticeBlock = false;
      continue;
    }
    if (line.trim() === "{") {
      inNoticeBlock = true;
      depth = 1;
      continue;
    }
    process.stdout.write(line);
  }
});

child.stderr.on("data", (chunk) => {
  const lines = chunk.toString().split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] + (i < lines.length - 1 ? "\n" : "");
    if (line === "\n") {
      process.stderr.write(line);
      continue;
    }
    if (inNoticeBlock) {
      for (const ch of line) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth <= 0) inNoticeBlock = false;
      continue;
    }
    if (line.trim() === "{") {
      inNoticeBlock = true;
      depth = 1;
      continue;
    }
    process.stderr.write(line);
  }
});

child.on("close", (code) => process.exit(code ?? 0));
