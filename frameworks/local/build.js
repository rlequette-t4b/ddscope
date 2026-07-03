#!/usr/bin/env node
/**
 * frameworks/local/build.js
 *
 * Regenerates frameworks/local/index.html from frameworks/local/template.html.
 *
 * Single source of truth for module/fragment/style order:
 *   frameworks/commwise/sync-tracker.md
 * — the same file that tracks CommWise sync state, so the runner's assembly order
 * can never drift from it silently. Files removed from the tracker (dead facades,
 * not-yet-extracted modules like DDS_AI_SERVICE / T-005) are automatically absent here.
 *
 * The two CDN loader positions (SCRIPT 350, 1784) are not src/ files — they are
 * injected from frameworks/local/fixtures/, verbatim copies of the live CommWise
 * blocks (see docs/DDScope_Modular_Architecture.md §8 Decoupling Log, Step 2).
 *
 * Usage:
 *   node frameworks/local/build.js
 *
 * See docs/DDScope_Framework_Local.md §Fragment and CDN handling.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SYNC_TRACKER = path.join(REPO_ROOT, 'frameworks', 'commwise', 'sync-tracker.md');
const TEMPLATE = path.join(__dirname, 'template.html');
const OUTPUT = path.join(__dirname, 'index.html');

// CDN loader positions — not tracked in sync-tracker.md (not src/ files).
// See docs/DDScope_Modular_Architecture.md §8 Decoupling Log, Step 2.
const CDN_INJECTIONS = [
  { position: 350, fixture: 'fixtures/script-350-cdn-cytoscape.js', comment: 'SCRIPT 350 — CDN: Cytoscape + Dagre (verbatim, see fixtures/)' },
  { position: 1784, fixture: 'fixtures/script-1784-cdn-sortablejs.js', comment: 'SCRIPT 1784 — CDN: SortableJS (verbatim, see fixtures/). Must precede SCRIPT 1785.' }
];

/**
 * Extracts { file, position } rows from any Markdown table whose first two columns
 * are `` `path` `` and `TYPE NNN` (TYPE = SCRIPT | DIV | STYLE). Matches sync-tracker.md's
 * three tables (Tracking Table, Fragments, Styles) with a single pass.
 */
function extractRows(markdown, type) {
  const re = new RegExp('^\\|\\s*`([^`]+)`\\s*\\|\\s*' + type + '\\s+(\\d+)\\s*\\|', 'gm');
  const rows = [];
  let m;
  while ((m = re.exec(markdown)) !== null) {
    rows.push({ file: m[1], position: parseInt(m[2], 10) });
  }
  rows.sort((a, b) => a.position - b.position);
  return rows;
}

async function main() {
  const tracker = await readFile(SYNC_TRACKER, 'utf8');

  const scripts = extractRows(tracker, 'SCRIPT');
  const divs = extractRows(tracker, 'DIV');
  const styles = extractRows(tracker, 'STYLE');

  if (scripts.length === 0) throw new Error('No SCRIPT rows found in sync-tracker.md — check the table format.');
  if (divs.length === 0) throw new Error('No DIV rows found in sync-tracker.md — check the table format.');
  if (styles.length === 0) throw new Error('No STYLE rows found in sync-tracker.md — check the table format.');

  // --- Styles: <link> tags, in STYLE order ---
  const stylesHtml = styles
    .map(({ file }) => `<link rel="stylesheet" href="../../${file}">`)
    .join('\n');

  // --- Fragments: concatenated content, in DIV order ---
  const fragmentParts = [];
  for (const { file, position } of divs) {
    const content = await readFile(path.join(REPO_ROOT, file), 'utf8');
    fragmentParts.push(`<!-- DIV ${position} — ${file} -->\n${content.trim()}`);
  }
  const fragmentsHtml = fragmentParts.join('\n\n');

  // --- Scripts: <script src> tags in SCRIPT order, CDN fixtures inlined at their position ---
  const merged = [
    ...scripts.map(s => ({ ...s, kind: 'module' })),
    ...CDN_INJECTIONS.map(c => ({ ...c, kind: 'cdn' }))
  ].sort((a, b) => a.position - b.position);

  const scriptParts = [];
  for (const entry of merged) {
    if (entry.kind === 'module') {
      scriptParts.push(`<script src="../../src/${entry.file}"></script>`);
    } else {
      const content = await readFile(path.join(__dirname, entry.fixture), 'utf8');
      scriptParts.push(`<!-- ${entry.comment} -->\n<script>\n${content.trim()}\n</script>`);
    }
  }
  const scriptsHtml = scriptParts.join('\n');

  // --- Assemble ---
  const template = await readFile(TEMPLATE, 'utf8');
  const output = template
    .replace('{{STYLES}}', stylesHtml)
    .replace('{{FRAGMENTS}}', fragmentsHtml)
    .replace('{{SCRIPTS}}', scriptsHtml);

  await writeFile(OUTPUT, output, 'utf8');

  console.log(`[build] ${scripts.length} modules, ${CDN_INJECTIONS.length} CDN loaders, ${divs.length} fragments, ${styles.length} styles.`);
  console.log(`[build] Wrote ${path.relative(REPO_ROOT, OUTPUT)}`);
}

main().catch(err => {
  console.error('[build] Failed:', err.message);
  process.exit(1);
});
