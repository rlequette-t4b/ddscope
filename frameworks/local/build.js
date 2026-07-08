#!/usr/bin/env node
/**
 * frameworks/local/build.js
 *
 * Regenerates frameworks/local/index.html from frameworks/local/template.html.
 *
 * Single source of truth for module/fragment/style order:
 *   assembly.json (repo root)
 * — a framework-agnostic manifest, not a CommWise artifact. Files removed from
 * assembly.json (dead facades, not-yet-extracted modules like DDS_AI_SERVICE /
 * T-005) are automatically absent here. `order` values happen to equal CommWise's
 * historical SCRIPT/DIV/STYLE numbers (carried over for continuity, not sourced
 * from CommWise going forward) — see docs/DDScope_Modular_Architecture.md §8
 * Decoupling Log, Step 4 (T-033).
 *
 * The two CDN loader positions (SCRIPT 350, 1784) and the local-only header
 * (fragment + style, see fixtures/header-local.*) are not src/ files and have
 * no entry in assembly.json — they are injected from frameworks/local/fixtures/
 * at hardcoded positions. The CDN loaders are verbatim copies of the live
 * CommWise blocks; the header is local-only (see docs/DDScope_Framework_Local.md
 * §Local-only additions — CommWise's own DIV 100/STYLE 100 header is platform
 * chrome with no local equivalent).
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
const ASSEMBLY = path.join(REPO_ROOT, 'assembly.json');
const TEMPLATE = path.join(__dirname, 'template.html');
const OUTPUT = path.join(__dirname, 'index.html');

// CDN loader positions — not tracked in assembly.json (not src/ files).
// See docs/DDScope_Modular_Architecture.md §8 Decoupling Log, Step 2.
const CDN_INJECTIONS = [
  { position: 350, fixture: 'fixtures/script-350-cdn-cytoscape.js', comment: 'SCRIPT 350 — CDN: Cytoscape + Dagre (verbatim, see fixtures/)' },
  { position: 1784, fixture: 'fixtures/script-1784-cdn-sortablejs.js', comment: 'SCRIPT 1784 — CDN: SortableJS (verbatim, see fixtures/). Must precede SCRIPT 1785.' }
];

// Local-only fragment — not tracked in assembly.json (no CommWise block:
// DIV 100/STYLE 100 are CommWise platform chrome, skipped/non-portable).
// Position 150 places it just before DIV 200 (app shell), where CommWise's
// own header sits in the assembly order.
const LOCAL_FRAGMENTS = [
  { position: 150, fixture: 'fixtures/header-local.html', comment: 'Local-only header — DDScope brand + settings gear (see docs/DDScope_Framework_Local.md)' }
];

// Local-only style — same rationale as LOCAL_FRAGMENTS above.
const LOCAL_STYLES = [
  { fixture: 'fixtures/header-local.css', comment: 'Local-only header styling (see fixtures/header-local.css)' }
];

/**
 * Reads a [{ path, order }] array from assembly.json and returns it sorted by
 * order, with fields renamed to { file, position } to match the shape the
 * rest of this script already works with.
 */
function toRows(items) {
  return items
    .map(({ path: file, order: position }) => ({ file, position }))
    .sort((a, b) => a.position - b.position);
}

async function main() {
  const assembly = JSON.parse(await readFile(ASSEMBLY, 'utf8'));

  const scripts = toRows(assembly.modules);
  const divs = toRows(assembly.fragments.items);
  const styles = toRows(assembly.styles.items);

  if (scripts.length === 0) throw new Error('No modules found in assembly.json — check the file.');
  if (divs.length === 0) throw new Error('No fragments found in assembly.json — check the file.');
  if (styles.length === 0) throw new Error('No styles found in assembly.json — check the file.');

  // --- Styles: <link> tags (assembly order) + inline local-only styles ---
  const trackerStylesHtml = styles
    .map(({ file }) => `<link rel="stylesheet" href="../../${file}">`)
    .join('\n');
  const localStylesParts = [];
  for (const { fixture, comment } of LOCAL_STYLES) {
    const content = await readFile(path.join(__dirname, fixture), 'utf8');
    localStylesParts.push(`<!-- ${comment} -->\n<style>\n${content.trim()}\n</style>`);
  }
  const stylesHtml = [trackerStylesHtml, ...localStylesParts].join('\n');

  // --- Fragments: concatenated content, in DIV order, local-only fragments merged in ---
  const mergedFragments = [
    ...divs.map(d => ({ ...d, kind: 'tracker' })),
    ...LOCAL_FRAGMENTS.map(f => ({ ...f, kind: 'local' }))
  ].sort((a, b) => a.position - b.position);

  const fragmentParts = [];
  for (const entry of mergedFragments) {
    if (entry.kind === 'tracker') {
      const content = await readFile(path.join(REPO_ROOT, entry.file), 'utf8');
      fragmentParts.push(`<!-- DIV ${entry.position} — ${entry.file} -->\n${content.trim()}`);
    } else {
      const content = await readFile(path.join(__dirname, entry.fixture), 'utf8');
      fragmentParts.push(`<!-- ${entry.comment} -->\n${content.trim()}`);
    }
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

  console.log(`[build] ${scripts.length} modules, ${CDN_INJECTIONS.length} CDN loaders, ${divs.length} fragments (+${LOCAL_FRAGMENTS.length} local-only), ${styles.length} styles (+${LOCAL_STYLES.length} local-only).`);
  console.log(`[build] Wrote ${path.relative(REPO_ROOT, OUTPUT)}`);
}

main().catch(err => {
  console.error('[build] Failed:', err.message);
  process.exit(1);
});
