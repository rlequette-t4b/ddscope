#!/usr/bin/env node
/**
 * frameworks/tauri/build.js
 *
 * Regenerates frameworks/tauri/src/index.html — Tauri's frontendDist entry
 * point (src-tauri/tauri.conf.json -> build.frontendDist = "../src") — from
 * frameworks/tauri/template.html.
 *
 * Single source of truth for module/fragment/style order: assembly.json
 * (repo root), same as frameworks/local/build.js. Entries are filtered to
 * those with no 'frameworks' scope or scoped to FRAMEWORK_ID (see
 * docs/DDScope_Assemblies.md §1 - Module block model).
 *
 * DIFFERENCE FROM frameworks/local/build.js: everything is INLINED into the
 * generated index.html (scripts as <script>content</script>, styles as
 * <style>content</style>) rather than referenced live via <script src="../..">
 * / <link href="../..">. Tauri's frontendDist is read recursively and
 * embedded into the app binary at bundle time — files outside it are not
 * packaged — and its asset protocol blocks '../' path traversal even in dev,
 * so a live reference escaping frontendDist the way framework-2 does does
 * not work here. Verified 2026-07-12, see docs/DDScope_Framework_Tauri.md
 * §Content assembly.
 *
 * CDN loaders (Cytoscape/Dagre, SortableJS) and the local-only header
 * fragment/style are not duplicated here — this script reads them directly
 * from frameworks/local/fixtures/ at build time (same verbatim content,
 * single source, no drift). Only the *generated output* differs between the
 * two frameworks, not the fixture inputs.
 *
 * Usage:
 *   node frameworks/tauri/build.js
 *
 * See docs/DDScope_Framework_Tauri.md §Content assembly.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ASSEMBLY = path.join(REPO_ROOT, 'assembly.json');
const TEMPLATE = path.join(__dirname, 'template.html');
const OUTPUT = path.join(__dirname, 'src', 'index.html'); // matches tauri.conf.json build.frontendDist ("../src")
const LOCAL_FIXTURES = path.join(REPO_ROOT, 'frameworks', 'local', 'fixtures');

// CDN loader positions — shared fixtures with framework-2, read from
// frameworks/local/fixtures/ (not duplicated). See
// docs/DDScope_Modular_Architecture.md §8 Decoupling Log, Step 2.
const CDN_INJECTIONS = [
  { position: 350, fixture: 'script-350-cdn-cytoscape.js', comment: 'CDN: Cytoscape + Dagre (verbatim, shared with framework-2, see frameworks/local/fixtures/)' },
  { position: 1784, fixture: 'script-1784-cdn-sortablejs.js', comment: 'CDN: SortableJS (verbatim, shared with framework-2). Must precede DDS_NOTES_UI (order 1785).' }
];

// Local-only header — reused verbatim from framework-2's fixtures (the
// header is framework-agnostic markup binding to a neutral button id, see
// frameworks/local/fixtures/header-local.html's own comment). Position 150,
// same convention as framework-2 — placed just before the app shell (200).
const LOCAL_FRAGMENTS = [
  { position: 150, fixture: 'header-local.html', comment: 'Header — DDScope brand + settings gear (shared fixture, see frameworks/local/fixtures/)' }
];

const LOCAL_STYLES = [
  { fixture: 'header-local.css', comment: 'Header styling (shared fixture, see frameworks/local/fixtures/)' }
];

// This framework's id, matching assembly.json's optional per-entry
// 'frameworks' scoping array.
const FRAMEWORK_ID = 'framework-3';

function toRows(items) {
  return items
    .filter(({ frameworks }) => !frameworks || frameworks.includes(FRAMEWORK_ID))
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

  // --- Styles: inlined <style> blocks (assembly order) + local-only header style ---
  const styleParts = [];
  for (const { file } of styles) {
    const content = await readFile(path.join(REPO_ROOT, file), 'utf8');
    styleParts.push(`<!-- ${file} -->\n<style>\n${content.trim()}\n</style>`);
  }
  for (const { fixture, comment } of LOCAL_STYLES) {
    const content = await readFile(path.join(LOCAL_FIXTURES, fixture), 'utf8');
    styleParts.push(`<!-- ${comment} -->\n<style>\n${content.trim()}\n</style>`);
  }
  const stylesHtml = styleParts.join('\n');

  // --- Fragments: concatenated raw HTML, in DIV order, local-only header merged in ---
  const mergedFragments = [
    ...divs.map(d => ({ ...d, kind: 'tracker' })),
    ...LOCAL_FRAGMENTS.map(f => ({ ...f, kind: 'local' }))
  ].sort((a, b) => a.position - b.position);

  const fragmentParts = [];
  for (const entry of mergedFragments) {
    if (entry.kind === 'tracker') {
      const content = await readFile(path.join(REPO_ROOT, entry.file), 'utf8');
      fragmentParts.push(`<!-- ${entry.file} -->\n${content.trim()}`);
    } else {
      const content = await readFile(path.join(LOCAL_FIXTURES, entry.fixture), 'utf8');
      fragmentParts.push(`<!-- ${entry.comment} -->\n${content.trim()}`);
    }
  }
  const fragmentsHtml = fragmentParts.join('\n\n');

  // --- Scripts: inlined <script> blocks in SCRIPT order, CDN fixtures inlined at their position ---
  const merged = [
    ...scripts.map(s => ({ ...s, kind: 'module' })),
    ...CDN_INJECTIONS.map(c => ({ ...c, kind: 'cdn' }))
  ].sort((a, b) => a.position - b.position);

  const scriptParts = [];
  for (const entry of merged) {
    if (entry.kind === 'module') {
      const content = await readFile(path.join(REPO_ROOT, 'src', entry.file), 'utf8');
      scriptParts.push(`<!-- src/${entry.file} -->\n<script>\n${content.trim()}\n</script>`);
    } else {
      const content = await readFile(path.join(LOCAL_FIXTURES, entry.fixture), 'utf8');
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

  console.log(`[build] ${scripts.length} modules, ${CDN_INJECTIONS.length} CDN loaders, ${divs.length} fragments (+${LOCAL_FRAGMENTS.length} local-only), ${styles.length} styles (+${LOCAL_STYLES.length} local-only) — all inlined.`);
  console.log(`[build] Wrote ${path.relative(REPO_ROOT, OUTPUT)}`);
}

main().catch(err => {
  console.error('[build] Failed:', err.message);
  process.exit(1);
});
