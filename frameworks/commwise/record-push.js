#!/usr/bin/env node
/**
 * frameworks/commwise/record-push.js
 *
 * Stamps frameworks/commwise/push-state.json. Never calls the CommWise MCP
 * itself — pushing happens through that MCP in an AI session; this script
 * only records what already happened, after the fact, so plan-push.js has
 * an accurate baseline next time.
 *
 * Modes:
 *
 *   --baseline
 *     Stamps every assembly.json entry whose push-state.json entry has
 *     contentHash: null (seeded from the retired sync-tracker.md, never
 *     actually hashed) with its CURRENT file hash — without claiming a
 *     push just happened. Existing lastPush metadata is preserved. Entries
 *     that already have a real hash are left untouched. Run this once to
 *     bootstrap; safe to re-run any time (idempotent for already-stamped
 *     entries).
 *
 *   --push <revision> <path> [path...]
 *     After actually pushing the given paths (assembly.json-relative, e.g.
 *     core/DDS_TOOLS.js or fragments/app-shell.html) to CommWise, stamps
 *     their contentHash to the current file content and lastPush to
 *     { date: today, revision }. Works for both updates to existing
 *     entries and brand-new ones (codeType/position pulled from
 *     assembly.json).
 *
 *   --delete <path> [path...]
 *     After actually deleting the given paths' blocks from CommWise via
 *     commwise_delete_blocks, removes their entries from push-state.json.
 *
 * Usage:
 *   node frameworks/commwise/record-push.js --baseline
 *   node frameworks/commwise/record-push.js --push "#29200" core/DDS_TOOLS.js fragments/app-shell.html
 *   node frameworks/commwise/record-push.js --delete fragments/panel-elements.html
 *
 * See docs/DDScope_Framework_CommWise.md §Push planning.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ASSEMBLY = path.join(REPO_ROOT, 'assembly.json');
const PUSH_STATE = path.join(__dirname, 'push-state.json');

function sha256(content) {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// This framework's id, matching assembly.json's optional per-entry
// 'frameworks' scoping array (see docs/DDScope_Assemblies.md §1 - Module
// block model). An entry scoped away from framework-1 (e.g. framework-2-only
// IAITransport implementations) is never a CommWise push candidate.
const FRAMEWORK_ID = 'framework-1';
function inScope({ frameworks }) {
  return !frameworks || frameworks.includes(FRAMEWORK_ID);
}

// Entries scoped away from framework-1 via assembly.json's 'frameworks'
// field are dropped here too — --push would otherwise happily record a
// CommWise push for a file that was never actually pushed there.
async function loadDesiredByPath() {
  const assembly = JSON.parse(await readFile(ASSEMBLY, 'utf8'));
  const byPath = new Map();
  for (const m of assembly.modules.filter(inScope)) {
    byPath.set(m.path, { codeType: 'script', position: m.order, absFile: path.join(REPO_ROOT, 'src', m.path) });
  }
  for (const f of assembly.fragments.items.filter(inScope)) {
    byPath.set(f.path, { codeType: 'div', position: f.order, absFile: path.join(REPO_ROOT, f.path) });
  }
  for (const s of assembly.styles.items.filter(inScope)) {
    byPath.set(s.path, { codeType: 'style', position: s.order, absFile: path.join(REPO_ROOT, s.path) });
  }
  return byPath;
}

async function loadPushState() {
  try {
    return JSON.parse(await readFile(PUSH_STATE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { _readme: 'CommWise push-state for DDScope. Written only by record-push.js.', appID: null, artifacts: [] };
    }
    throw err;
  }
}

async function savePushState(state) {
  await writeFile(PUSH_STATE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const desired = await loadDesiredByPath();
  const state = await loadPushState();
  const byPath = new Map((state.artifacts ?? []).map(a => [a.path, a]));

  if (mode === '--baseline') {
    let stamped = 0;
    for (const [p, info] of desired) {
      const existing = byPath.get(p);
      if (existing && existing.contentHash) continue;
      const content = await readFile(info.absFile, 'utf8');
      const hash = sha256(content);
      if (existing) {
        existing.contentHash = hash;
        existing.codeType = info.codeType;
        existing.position = info.position;
      } else {
        byPath.set(p, {
          path: p,
          codeType: info.codeType,
          position: info.position,
          contentHash: hash,
          lastPush: { date: today(), revision: 'baseline' }
        });
      }
      stamped++;
    }
    state.artifacts = [...byPath.values()];
    await savePushState(state);
    console.log(`[record-push] Baseline: stamped ${stamped} entr${stamped === 1 ? 'y' : 'ies'} with a current content hash.`);
    return;
  }

  if (mode === '--push') {
    const [revision, ...paths] = rest;
    if (!revision || paths.length === 0) {
      throw new Error('Usage: record-push.js --push <revision> <path> [path...]');
    }
    for (const p of paths) {
      const info = desired.get(p);
      if (!info) throw new Error(`${p} is not in assembly.json — cannot record a push for it.`);
      const content = await readFile(info.absFile, 'utf8');
      const hash = sha256(content);
      byPath.set(p, {
        path: p,
        codeType: info.codeType,
        position: info.position,
        contentHash: hash,
        lastPush: { date: today(), revision }
      });
    }
    state.artifacts = [...byPath.values()];
    await savePushState(state);
    console.log(`[record-push] Recorded push of ${paths.length} artifact(s) at revision ${revision}.`);
    return;
  }

  if (mode === '--delete') {
    const paths = rest;
    if (paths.length === 0) throw new Error('Usage: record-push.js --delete <path> [path...]');
    let removed = 0;
    for (const p of paths) {
      if (byPath.delete(p)) removed++;
    }
    state.artifacts = [...byPath.values()];
    await savePushState(state);
    console.log(`[record-push] Removed ${removed} artifact(s) from push-state.json.`);
    return;
  }

  throw new Error('Usage: record-push.js --baseline | --push <revision> <path...> | --delete <path...>');
}

main().catch(err => {
  console.error('[record-push] Failed:', err.message);
  process.exit(1);
});
