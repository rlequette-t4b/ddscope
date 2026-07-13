// ============================================================
// DDS_FILE_STORAGE_TAURI — IFileStorage implementation storage-impl-3
// (TauriFsStorage, framework-3 / Tauri desktop shell only).
// See docs/DDScope_Service_FileStorage.md §3 (this implementation) and §1
// (interface contract). TODO T-048 Phase 2.
//
// Not wired to window.DDS_FILE_STORAGE_BACKEND by this file — that
// assignment is done by frameworks/tauri/template.html, same convention as
// window.DDS_SETTINGS_BACKEND / window.DDS_AI_TRANSPORT (see
// docs/DDScope_Framework_Local.md §Role of template.html). This module only
// defines the object.
//
// Framework-3-only: scoped in assembly.json via "frameworks": ["framework-3"]
// (see docs/DDScope_Assemblies.md §1 - Module block model) — never a
// CommWise push candidate, never loaded there, never loaded by framework-2.
//
// Uses window.__TAURI__ (global API bridge, enabled via tauri.conf.json
// "app.withGlobalTauri": true in the scaffolded project) rather than ES
// module imports — consistent with every other src/ file (plain IIFE
// globals, no bundler). Requires the "dialog" and "fs" plugins
// (`npm run tauri add dialog` / `npm run tauri add fs`) plus an fs capability
// scope permissive enough for arbitrary user-selected paths — DDScope
// project files can live anywhere on disk, not just inside the app's own
// data directory. See docs/DDScope_Framework_Tauri.md §Deferred - native
// IFileStorage for the capability config.
//
// Persistence note: unlike storage-impl-1 (FileSystemAccessStorage), Tauri's
// dialog/fs plugins have no runtime permission-prompt step comparable to
// FileSystemFileHandle.queryPermission/requestPermission — a capability
// granted at build time is just granted. So this implementation's
// tryReopenLast() only ever resolves 'opened' or false, never 'prompt';
// reopenWithPermission() exists only for interface symmetry with
// storage-impl-1 and is not expected to be called by DDS_UI_NAV as currently
// wired (DDS_INIT.js only checks for 'opened', see its own boot() function).
// ============================================================

var DDS_FILE_STORAGE_TAURI = (function() {
  'use strict';

  var LAST_PATH_KEY = 'ddscope.tauri.lastFilePath';
  var _lastPath = null;

  function _tauri() {
    if (!window.__TAURI__ || !window.__TAURI__.dialog || !window.__TAURI__.fs) {
      throw new Error('[DDS_FILE_STORAGE_TAURI] window.__TAURI__.dialog/fs not available — ' +
        'check "app.withGlobalTauri" in tauri.conf.json and that the dialog/fs plugins are installed ' +
        '(npm run tauri add dialog / npm run tauri add fs).');
    }
    return window.__TAURI__;
  }

  function _persistLastPath(path) {
    _lastPath = path;
    try { localStorage.setItem(LAST_PATH_KEY, path); }
    catch (e) { console.warn('[DDS_FILE_STORAGE_TAURI] Failed to persist last path', e); }
  }

  function _loadLastPath() {
    try { return localStorage.getItem(LAST_PATH_KEY); }
    catch (e) { return null; }
  }

  // IFileStorage.pickAndReadFile() -> Promise<string> (file text content)
  // Throws { name: 'AbortError' } if the user cancels the dialog — same
  // convention DDS_UI_NAV.loadProject() already checks for.
  async function pickAndReadFile() {
    var t = _tauri();
    var path = await t.dialog.open({
      multiple: false,
      directory: false,
      filters: [{ name: 'DDScope project', extensions: ['json'] }]
    });
    if (!path) { var err = new Error('User cancelled'); err.name = 'AbortError'; throw err; }
    var text = await t.fs.readTextFile(path);
    _persistLastPath(path);
    return text;
  }

  // IFileStorage.writeFile(json, suggestedName, pickNew) -> Promise<void>
  // Mirrors storage-impl-1's _writeFile signature: writes to the
  // last-used path unless pickNew (Save As) or no path is known yet.
  async function writeFile(json, suggestedName, pickNew) {
    var t = _tauri();
    var path = _lastPath || _loadLastPath();
    if (!path || pickNew) {
      path = await t.dialog.save({
        defaultPath: suggestedName,
        filters: [{ name: 'DDScope project', extensions: ['json'] }]
      });
      if (!path) { var err = new Error('User cancelled'); err.name = 'AbortError'; throw err; }
      _persistLastPath(path);
    }
    await t.fs.writeTextFile(path, json);
  }

  // IFileStorage.tryReopenLast() -> Promise<'opened' | false>
  // No 'prompt' state — see module comment above.
  async function tryReopenLast() {
    var path = _loadLastPath();
    if (!path) return false;
    try {
      var t = _tauri();
      var text = await t.fs.readTextFile(path);
      DDS_STORE.loadFromText(text);
      _lastPath = path;
      return 'opened';
    } catch (e) {
      // File moved/deleted/inaccessible since last session — not fatal,
      // DDS_INIT.js falls back to an empty map view.
      console.warn('[DDS_FILE_STORAGE_TAURI] tryReopenLast failed:', e);
      return false;
    }
  }

  // IFileStorage.reopenWithPermission() -> Promise<boolean>
  // Interface symmetry only — see module comment above.
  async function reopenWithPermission() {
    var result = await tryReopenLast();
    return result === 'opened';
  }

  return {
    pickAndReadFile: pickAndReadFile,
    writeFile: writeFile,
    tryReopenLast: tryReopenLast,
    reopenWithPermission: reopenWithPermission
  };
})();
