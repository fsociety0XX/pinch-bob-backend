/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-var-requires */
// generate-redirect-map.js
// ------------------------
// Usage: sudo node generate-redirect-map.js
// This will overwrite /etc/nginx/redirects.map with your latest mappings.

const fs = require('fs');
const path = require('path');

// Path to your CSV and to the Nginx map file
const CSV_PATH = path.resolve(__dirname, 'redirectUrls.csv');
const MAP_PATH = '/etc/nginx/redirects.map';

function readCsvLines(csvPath) {
  return fs
    .readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
}

function normalizePath(p) {
  p = p.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  return p.replace(/\s+/g, '%20'); // escape spaces, if any
}

function parseEntry(line, idx) {
  // split into at most 3 parts (old, new, productName)
  const parts = line.split(',', 3);
  if (parts.length < 2) {
    throw new Error(
      `Line ${idx + 1}: expected at least 2 columns, got ${parts.length}`
    );
  }
  const oldRaw = parts[0];
  const newRaw = parts[1];
  const oldPath = normalizePath(oldRaw);
  const newPath = normalizePath(newRaw);
  return { oldPath, newPath };
}

function buildMap(entries) {
  return `${entries
    .map(
      ({ oldPath, newPath }) =>
        // pad oldPath to 50 chars for neatness
        `${oldPath.padEnd(50, ' ')} ${newPath};`
    )
    .join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const rawLines = readCsvLines(CSV_PATH);
  // drop header if it contains the words "Old" and "New"
  const dataLines =
    rawLines[0].toLowerCase().includes('old') &&
    rawLines[0].toLowerCase().includes('new')
      ? rawLines.slice(1)
      : rawLines;

  const entries = dataLines.map((line, idx) => parseEntry(line, idx));
  const mapFile = buildMap(entries);

  fs.writeFileSync(MAP_PATH, mapFile, { mode: 0o644 });
  console.log(`✅ Wrote ${entries.length} redirects to ${MAP_PATH}`);
}

main();
