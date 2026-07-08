#!/usr/bin/env node
/**
 * frameworks/commwise/plan-push.js
 *
 * Read-only diff between assembly.json (repo root, + current src/fragments/
 * styles file content) and frameworks/commwise/push-state.json (state
 * recorded at the last real push). Prints what a CommWise push would need
 * to do. Never touches CommWise itself — there is no CommWise MCP access
 * from a plain node script, only from an AI session. Use this output as the
 * to-do list for that session.
 *
 * Buckets:
 *   NEW          — in assembly.json, no push-state.json entry yet.
 *                  → commwise_insert_block at { codeType, position }.
 *   UNSTAMPED    — push-state.json entry exists but contentHash is null
 *                  (seeded from the retired sync-tracker.md, never actually
 *                  hashed). Run `record-push.js --baseline` once to clear
 *                  these before trusting this report for real.
 *   MODIFIED     — content hash differs from the last recorded push.
 *                  → commwise_update_block / commwise_replace_text.
 *   REPOSITIONED — content unchanged but codeType/position moved since the
 *                  last recorded push. → commwise_update_block with
 *                  new_position (or delete+reinsert if codeType changed).
 *   UNCHANGED    — hash matches. Nothing to do — this is the "don't repush
 *                  when nothing changed" guarantee.
 *   DELETED      — in push-state.json, no longer in assembly.json (file
 *                  removed or renamed). → commwise_delete_blocks.
 *
 * Usage:
 *   node frameworks/commwise/plan-push.js
 *
 * See docs/DDScope_Framework_CommWise.md §Push planning.
 */

import { readFile } from 'node:fs/promises';
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

/**
 * Flattens assembly.json's three groups into one list, each entry carrying
 * enough to both address it in CommWise (codeType, position) and read its
 * current content (absFile).
 */
async function loadDesired() {
  const assembly = JSON.parse(await readFile(ASSEMBLY, 'utf8'));
  const desired = [];
  for (const m of assembly.modules) {
    desired.push({ path: m.path, codeType: 'script', position: m.order, absFile: path.join(REPO_ROOT, 'src', m.path) });
  }
  for (const f of assembly.fragments.items) {
    desired.push({ path: f.path, codeType: 'div', position: f.order, absFile: path.join(REPO_ROOT, f.path) });
  }
  for (const s of assembly.styles.items) {
    desired.push({ path: s.path, codeType: 'style', position: s.order, absFile: path.join(REPO_ROOT, s.path) });
  }
  return desired;
}

async function loadPushState() {
  const raw = JSON.parse(await readFile(PUSH_STATE, 'utf8'));
  return raw.artifacts ?? [];
}

async function main() {
  const desired = await loadDesired();
  const known = await loadPushState();
  const knownByPath = new Map(known.map(a => [a.path, a]));
  const desiredPaths = new Set(desired.map(d => d.path));

  const plan = { new: [], unstamped: [], modified: [], repositioned: [], unchanged: [], deleted: [] };

  for (const d of desired) {
    const content = await readFile(d.absFile, 'utf8');
    const hash = sha256(content);
    const prior = knownByPath.get(d.path);

    if (!prior) {
      plan.new.push({ ...d, hash });
    } else if (prior.contentHash === null) {
      plan.unstamped.push({ ...d, hash });
    } else if (prior.contentHash !== hash) {
      plan.modified.push({ ...d, hash, priorHash: prior.contentHash });
    } else if (prior.position !== d.position || prior.codeType !== d.codeType) {
      plan.repositioned.push({ ...d, hash, priorPosition: prior.position, priorCodeType: prior.codeType });
    } else {
      plan.unchanged.push({ ...d, hash });
    }
  }

  for (const k of known) {
    if (!desiredPaths.has(k.path)) {
      plan.deleted.push(k);
    }
  }

  console.log(
    `[plan-push] ${plan.new.length} new, ${plan.unstamped.length} unstamped, ${plan.modified.length} modified, ` +
    `${plan.repositioned.length} repositioned only, ${plan.unchanged.length} unchanged, ${plan.deleted.length} to delete.`
  );

  if (plan.unstamped.length > 0) {
    console.log(`\n[plan-push] ${plan.unstamped.length} entr${plan.unstamped.length === 1 ? 'y has' : 'ies have'} no recorded hash yet — run:`);
    console.log('  node frameworks/commwise/record-push.js --baseline');
    console.log('before trusting MODIFIED/UNCHANGED below.');
  }

  for (const [bucket, items] of Object.entries(plan)) {
    if (bucket === 'unchanged' || items.length === 0) continue;
    console.log(`\n--- ${bucket.toUpperCase()} (${items.length}) ---`);
    for (const item of items) {
      const codeType = item.codeType ?? item.priorCodeType;
      const position = item.position ?? item.priorPosition;
      console.log(`  ${codeType} ${position}  ${item.path}`);
    }
  }
}

main().catch(err => {
  console.error('[plan-push] Failed:', err.message);
  process.exit(1);
});
