#!/usr/bin/env node
/* eslint-disable no-restricted-syntax */
// generate-redirect-map.js
// ------------------------
// Reads redirectUrls.csv, ensures no duplicate old URLs,
// then writes /etc/nginx/redirects.map

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.resolve(__dirname, 'redirectUrls.csv');
const MAP_PATH = '/etc/nginx/redirects.map';

function readCsvLines(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  return content.split(/\r?\n/).filter((line) => line.trim() !== '');
}

function normalizePath(input) {
  const trimmed = input.trim();
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\s+/g, '%20');
}

function parseEntry(line, idx) {
  const parts = line.split(',', 3).map((part) => part.trim());
  if (parts.length < 2) {
    console.error(
      `Line ${idx + 1}: expected at least 2 columns, got ${parts.length}`
    );
    process.exit(1);
  }
  const oldPath = normalizePath(parts[0]);
  const newPath = normalizePath(parts[1]);
  return { oldPath, newPath, lineNum: idx + 1 };
}

function buildMap(entries) {
  return `${entries
    .map(({ oldPath, newPath }) => `${oldPath.padEnd(50, ' ')} ${newPath};`)
    .join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const rawLines = readCsvLines(CSV_PATH);
  const header = rawLines[0].toLowerCase();
  const dataLines =
    header.includes('old') && header.includes('new')
      ? rawLines.slice(1)
      : rawLines;

  const entries = dataLines.map((line, idx) => parseEntry(line, idx));

  // Detect duplicate old-paths
  const seen = new Set();
  for (const { oldPath, lineNum } of entries) {
    if (seen.has(oldPath)) {
      console.error(
        `Duplicate redirect for "${oldPath}" at CSV line ${lineNum}`
      );
      process.exit(1);
    }
    seen.add(oldPath);
  }

  const mapFile = buildMap(entries);
  fs.writeFileSync(MAP_PATH, mapFile, { mode: 0o644 });
  console.log(`Wrote ${entries.length} redirects to ${MAP_PATH}`);
}

main();
