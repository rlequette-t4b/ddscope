// All modules are registered globally to emulate the browser.
//
// src/core/*.js files are plain classic scripts (no ESM export — see
// docs/DDScope_Framework_Local.md and CommWise SCRIPT blocks, the source
// of truth: they never contain `export`). They are executed here via
// node:vm.runInThisContext, the same semantics as a browser <script> tag —
// top-level `var X = ...` attaches X directly to globalThis, no import()
// or export statement required.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const coreModules = [
  'DDS_TOOLS',
  'DDS_COLORS',
  'DDS_DURATION',
  'DDS_STORE',
  'DDS_TRANSACTIONS',
  'DDS_TX',
  'DDS_CMD',
  'DDS_MODEL',
  'DDS_I18N_CATALOG_EN',
  'DDS_I18N',
];

// DDS_TX.js defines its object as `TX` / `window.TX` internally (see the
// file itself) — not `DDS_TX`. The old shim aliased it to `DDS_TX` via
// `export default TX` (moduleData.default). Recreate that alias explicitly
// so both `TX` and `DDS_TX` remain available as globals, unchanged behavior.
const GLOBAL_NAME_OVERRIDES = {
  DDS_TX: 'TX',
};

for (const moduleName of coreModules) {
  const filePath = path.join(__dirname, `../src/core/${moduleName}.js`);
  const code = readFileSync(filePath, 'utf8');
  vm.runInThisContext(code, { filename: filePath });
  const realName = GLOBAL_NAME_OVERRIDES[moduleName] || moduleName;
  const value = globalThis[realName];
  globalThis[moduleName] = value;
  console.log(`Load and declare ${moduleName}`, value);
}

