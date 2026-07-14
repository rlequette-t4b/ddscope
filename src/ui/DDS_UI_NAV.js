// ============================================================
// DDS_UI_NAV — New / Load / Save / Save As + project modal
// ============================================================
// File I/O lives here. DDS_STORE handles only in-memory data.
// ============================================================

var DDS_UI_NAV = {};
var DDS_UI_PROJECTS = DDS_UI_NAV; // backward-compat alias

// ------------------------------------------------------------------
// File System Access API helpers (Chrome/Edge)
// ------------------------------------------------------------------

var _hasFileAPI = typeof window.showOpenFilePicker === 'function';
var _fileHandle = null; // current FileSystemFileHandle

// IFileStorage backend injection point — optional, additive only. A
// framework may inject one via window.DDS_FILE_STORAGE_BACKEND. Looked up
// lazily (function, not a captured var) so injection timing relative to
// this file's own <script> position doesn't matter — same pattern as
// window.DDS_AI_TRANSPORT in src/ai/DDS_AI.js, and unlike
// window.DDS_SETTINGS_BACKEND (which IS captured at module-eval time in
// DDS_SETTINGS.js's _resolveBackend(), but only ever called lazily inside
// ready(), so timing never mattered there either). Absent for framework-1
// (CommWise) and framework-2 (local runner) — both keep using the File
// System Access API / <input> fallback below unchanged. Set by
// frameworks/tauri/template.html to storage-impl-3 (DDS_FILE_STORAGE_TAURI,
// see docs/DDScope_Service_FileStorage.md §3).
function _fileStorageBackend() {
  return window.DDS_FILE_STORAGE_BACKEND || null;
}

function _openHandleDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('dds_store', 1);
    req.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

async function _persistHandle(handle) {
  try {
    _fileHandle = handle;
    var db = await _openHandleDB();
    var tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'last');
  } catch(e) { /* silently ignore */ }
}

async function _loadHandle() {
  try {
    var db = await _openHandleDB();
    return await new Promise(function(resolve, reject) {
      var tx = db.transaction('handles', 'readonly');
      var req = tx.objectStore('handles').get('last');
      req.onsuccess = function(e) { resolve(e.target.result || null); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  } catch(e) { return null; }
}

// Read text from file — injected IFileStorage backend, or File System
// Access API, or <input> fallback.
async function _pickAndReadFile() {
  var backend = _fileStorageBackend();
  if (backend) return backend.pickAndReadFile();
  if (_hasFileAPI) {
    var handles = await window.showOpenFilePicker({
      types: [{ description: 'DDScope project', accept: { 'application/json': ['.json'] } }]
    });
    var handle = handles[0];
    var file = await handle.getFile();
    var text = await file.text();
    await _persistHandle(handle);
    return text;
  }
  return new Promise(function(resolve, reject) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function() {
      var file = input.files[0];
      if (!file) return reject(new Error('No file selected'));
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.onerror = function() { reject(new Error('File read error')); };
      reader.readAsText(file);
    };
    input.click();
  });
}

// Write JSON string to file — injected IFileStorage backend, or File
// System Access API, or download fallback.
async function _writeFile(json, suggestedName, pickNew) {
  var backend = _fileStorageBackend();
  if (backend) return backend.writeFile(json, suggestedName, pickNew);
  if (_hasFileAPI && _fileHandle && !pickNew) {
    var perm = await _fileHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await _fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error('Write permission denied');
    var writable = await _fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
    return;
  }
  if (_hasFileAPI) {
    var handle = await window.showSaveFilePicker({
      suggestedName: suggestedName,
      types: [{ description: 'DDScope project', accept: { 'application/json': ['.json'] } }]
    });
    var writable2 = await handle.createWritable();
    await writable2.write(json);
    await writable2.close();
    await _persistHandle(handle);
    return;
  }
  // Fallback: download
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

// Try to reopen last file at boot (Chrome/Edge only, no user gesture needed if already granted).
// Returns 'opened' | 'prompt' | false
DDS_UI_NAV.tryReopenLast = async function() {
  var backend = _fileStorageBackend();
  if (backend) return backend.tryReopenLast();
  if (!_hasFileAPI) return false;
  try {
    var handle = await _loadHandle();
    if (!handle) return false;
    var perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      var file = await handle.getFile();
      var text = await file.text();
      DDS_STORE.loadFromText(text);
      _fileHandle = handle;
      return 'opened';
    }
    _fileHandle = handle;
    return 'prompt';
  } catch(e) {
    console.error('[DDS_UI_NAV] tryReopenLast error:', e);
    return false;
  }
};

// Request permission and open — must be called from a user gesture.
DDS_UI_NAV.reopenWithPermission = async function() {
  var backend = _fileStorageBackend();
  if (backend) return backend.reopenWithPermission ? backend.reopenWithPermission() : false;
  if (!_fileHandle) return false;
  try {
    var perm = await _fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    var file = await _fileHandle.getFile();
    var text = await file.text();
    DDS_STORE.loadFromText(text);
    return true;
  } catch(e) {
    console.error('[DDS_UI_NAV] reopenWithPermission error:', e);
    return false;
  }
};

function ddsEl(id) { return document.getElementById(id); }
function ddsShow(id) {
  var el = ddsEl(id); if (!el) return;
  if (el.classList.contains('dds-overlay')) { el.classList.remove('dds-hidden'); void el.offsetWidth; el.classList.add('visible'); }
  else { el.classList.remove('dds-hidden'); }
}
function ddsHide(id) {
  var el = ddsEl(id); if (!el) return;
  if (el.classList.contains('dds-overlay')) { el.classList.remove('visible'); }
  else { el.classList.add('dds-hidden'); }
}
function ddsEscape(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- New project ----

DDS_UI_NAV.newProject = function() {
  if (DDS_STORE.isDirty() && !window.confirm('Unsaved changes will be lost. Continue?')) return;
  _jsonData = null;
  ddsEl('dds-modal-project-title').textContent = 'New project';
  ddsEl('dds-modal-project-save').textContent = 'Create';
  ddsEl('dds-proj-name').value = '';
  ddsEl('dds-proj-desc').value = '';
  ddsEl('dds-proj-from').value = 'empty';
  ddsEl('dds-proj-source-json').value = '';
  ddsHide('dds-proj-source-existing-field');
  ddsHide('dds-proj-source-json-field');
  ddsHide('dds-proj-copy-field');
  ddsShow('dds-proj-from-field');
  DDS_UI_NAV._validateName();
  ddsShow('dds-modal-project-overlay');
  ddsEl('dds-proj-name').focus();
};

// ---- Load project ----

DDS_UI_NAV.loadProject = async function() {
  if (DDS_STORE.isDirty() && !window.confirm('Unsaved changes will be lost. Continue?')) return;
  try {
    var text = await _pickAndReadFile();
    DDS_STORE.loadFromText(text);
    if (window.DDS_AI_UI) DDS_AI_UI.reset();
    DDS.openProject();
  } catch(e) {
    if (e && e.name !== 'AbortError') {
      console.error('[DDS] Load error:', e);
      alert('Could not load file: ' + e.message);
    }
  }
};

// ---- Save ----

DDS_UI_NAV.save = async function() {
  var _ps = DDS_STORE.getProject();
  if (!_ps) return;
  try {
    var name = (_ps.project.name || 'project').replace(/\s+/g, '_');
    await _writeFile(DDS_STORE.toJson(), name + '_ddscope.json', false);
    DDS_STORE.resetDirty();
  } catch(e) {
    if (e && e.name !== 'AbortError') alert('Could not save: ' + e.message);
  }
};

// ---- Save As ----

DDS_UI_NAV.saveAs = async function() {
  var _psa = DDS_STORE.getProject();
  if (!_psa) return;
  try {
    var name = (_psa.project.name || 'project').replace(/\s+/g, '_');
    await _writeFile(DDS_STORE.toJson(), name + '_ddscope.json', true);
    DDS_STORE.resetDirty();
  } catch(e) {
    if (e && e.name !== 'AbortError') alert('Could not save: ' + e.message);
  }
};

// ---- Modal logic ----

var _jsonData = null;

DDS_UI_NAV._onFromChange = function() {
  var from = ddsEl('dds-proj-from').value;
  from === 'json' ? ddsShow('dds-proj-source-json-field') : ddsHide('dds-proj-source-json-field');
  from !== 'empty' ? ddsShow('dds-proj-copy-field') : ddsHide('dds-proj-copy-field');
  DDS_UI_NAV._validateName();
};

DDS_UI_NAV._validateName = function() {
  var name = (ddsEl('dds-proj-name').value || '').trim();
  ddsEl('dds-modal-project-save').disabled = !name;
};

DDS_UI_NAV.handleSave = async function() {
  var saveBtn = ddsEl('dds-modal-project-save');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';

  var name     = (ddsEl('dds-proj-name').value || '').trim();
  var desc     = (ddsEl('dds-proj-desc').value || '').trim();
  var from     = ddsEl('dds-proj-from').value;
  var modeEl   = document.querySelector('input[name="dds-copy-mode"]:checked');
  var copyMode = modeEl ? modeEl.value : 'full';

  try {
    // 1. Create blank project in memory
    var ctx = await APP_CONTEXT.ready();
    DDS_STORE.newProject(name, desc, ctx.user.email);

    // 2. Import from JSON source if requested
    if (from === 'json' && _jsonData) {
      // Clear the auto-created Map 1 before importing
      var _pi = DDS_STORE.getProject();
      _pi.maps           = [];
      _pi.map_nodes      = [];
      _pi.map_flows      = [];
      _pi.map_swim_lanes = [];
      DDS_JSON.importFromJson(_jsonData, copyMode);
    }

    // 3. Open the project (state.project is now set)
    DDS_UI_NAV.closeModal();
    if (window.DDS_AI_UI) DDS_AI_UI.reset();
    DDS.openProject();

  } catch(err) {
    console.error('[DDS] Create project error:', err);
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
  }
};

DDS_UI_NAV.closeModal = function() { ddsHide('dds-modal-project-overlay'); };

// ---- Close project ----
// First documented UI trigger for DDS.closeProject() (previously
// undocumented, see TODO/T-046 and docs/DDScope_Plugin_UI_RFC.md
// §4 Header Layout — File menu).
DDS_UI_NAV.closeProject = function() {
  if (!DDS_STORE.getProject()) return;
  if (DDS_STORE.isDirty() && !window.confirm('Unsaved changes will be lost. Continue?')) return;
  DDS.closeProject();
};

// ---- Edit project (name + description) ----

DDS_UI_NAV.openEditProject = function() {
  var _pe = DDS_STORE.getProject();
  if (!_pe) return;
  var proj = _pe.project;
  ddsEl('dds-edit-proj-name').value = proj.name || '';
  ddsEl('dds-edit-proj-desc').value = proj.description || '';
  ddsEl('dds-modal-edit-project-save').disabled = !(proj.name || '').trim();
  ddsShow('dds-modal-edit-project-overlay');
  ddsEl('dds-edit-proj-name').focus();
};

DDS_UI_NAV.closeEditProject = function() { ddsHide('dds-modal-edit-project-overlay'); };

DDS_UI_NAV.handleEditProjectSave = function() {
  var name = (ddsEl('dds-edit-proj-name').value || '').trim();
  var desc = (ddsEl('dds-edit-proj-desc').value || '').trim();
  if (!name) return;
  DDS_CMD.execute(TX.PROJECT_RENAME, { name: name, description: desc }, null, function() {
    // Update nav label
    var label = ddsEl('dds-nav-project-label');
    if (label) label.textContent = name;
    DDS_UI_NAV.closeEditProject();
  });
};

// ---- Event bindings ----

DDS_UI_NAV.bindEvents = function() {
  document.querySelectorAll('.dds-nav-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { DDS.showView(tab.dataset.view); });
  });

  // New/Open/Save/Save As no longer have dedicated nav buttons in the
  // new fragment — their first documented home is the File menu (RFC
  // §4 Header Layout), wired via DDS_UI_COMMANDS in src/ui/DDS_UI_MENU.js.
  // CommWise (framework-1) legacy compat: fragments/app-shell.html is
  // scoped to framework-2/3 only (see assembly.json), so CommWise's live
  // DOM may still have these old buttons with no File-menu equivalent yet
  // — bind them directly so they keep working there until a CommWise
  // legacy adapter is built (RFC §5 Decisions). No-op elsewhere since the
  // ids no longer exist there.
  var bind = function(id, fn) { var el = ddsEl(id); if (el) el.addEventListener('click', fn); };
  bind('dds-btn-new',     function() { DDS_UI_NAV.newProject(); });
  bind('dds-btn-load',    function() { DDS_UI_NAV.loadProject(); });
  bind('dds-btn-save',    function() { DDS_UI_NAV.save(); });
  bind('dds-btn-save-as', function() { DDS_UI_NAV.saveAs(); });

  ddsEl('dds-proj-from').addEventListener('change', function() { DDS_UI_NAV._onFromChange(); });
  ddsEl('dds-proj-name').addEventListener('input',  function() { DDS_UI_NAV._validateName(); });

  ddsEl('dds-proj-source-json').addEventListener('change', function() {
    var file = this.files[0];
    if (!file) { _jsonData = null; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        _jsonData = JSON.parse(e.target.result);
        if (_jsonData.project) {
          if (!ddsEl('dds-proj-name').value) ddsEl('dds-proj-name').value = (_jsonData.project.name || '') + ' (copy)';
          if (!ddsEl('dds-proj-desc').value) ddsEl('dds-proj-desc').value = _jsonData.project.description || '';
          DDS_UI_NAV._validateName();
        }
      } catch(err) { _jsonData = null; alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
  });

  document.querySelectorAll('input[name="dds-copy-mode"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.dds-radio-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === radio.value);
      });
    });
  });

  bind('dds-modal-project-save',   function() { DDS_UI_NAV.handleSave(); });
  bind('dds-modal-project-cancel', function() { DDS_UI_NAV.closeModal(); });
  bind('dds-modal-project-close',  function() { DDS_UI_NAV.closeModal(); });
  ddsEl('dds-modal-project-overlay').addEventListener('click', function(e) {
    if (e.target === this) DDS_UI_NAV.closeModal();
  });

  // Edit project modal — identity row: double-click the project name to
  // rename (RFC §4 Header Layout, decided 2026-07-14). Reuses the existing
  // name+description modal rather than a new contentEditable widget. Works
  // against #dds-nav-project-label, unchanged id in both old and new
  // fragments. CommWise legacy compat: also keep the old pencil button
  // working if present (removed from the new fragment).
  var projectLabel = ddsEl('dds-nav-project-label');
  if (projectLabel) projectLabel.addEventListener('dblclick', function() { DDS_UI_NAV.openEditProject(); });
  bind('dds-btn-edit-project', function() { DDS_UI_NAV.openEditProject(); });
  bind('dds-modal-edit-project-save',    function() { DDS_UI_NAV.handleEditProjectSave(); });
  bind('dds-modal-edit-project-cancel',  function() { DDS_UI_NAV.closeEditProject(); });
  bind('dds-modal-edit-project-close',   function() { DDS_UI_NAV.closeEditProject(); });
  ddsEl('dds-edit-proj-name').addEventListener('input', function() {
    ddsEl('dds-modal-edit-project-save').disabled = !this.value.trim();
  });
  ddsEl('dds-edit-proj-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); DDS_UI_NAV.handleEditProjectSave(); }
    if (e.key === 'Escape') DDS_UI_NAV.closeEditProject();
  });
  ddsEl('dds-modal-edit-project-overlay').addEventListener('click', function(e) {
    if (e.target === this) DDS_UI_NAV.closeEditProject();
  });

  // Ctrl+S / Cmd+S now bound centrally via DDS_UI_COMMANDS.bindKeyboard()
  // (see src/ui/DDS_UI_MENU.js) — file.save keybinding.

  DDS_UI_NAV.bindUndoRedo();
};

// ---- Undo / Redo ----

// Shared by both button bindings below and DDS_UI_MENU's edit.undo/edit.redo
// commands (RFC UI Command Registry) — one action, two trigger surfaces.
DDS_UI_NAV.undo = function() {
  if (DDS_TRANSACTIONS.undo()) DDS_UI_NAV._afterUndoRedo();
};
DDS_UI_NAV.redo = function() {
  if (DDS_TRANSACTIONS.redo()) DDS_UI_NAV._afterUndoRedo();
};

DDS_UI_NAV.bindUndoRedo = function() {
  var btnUndo = document.getElementById('dds-btn-undo');
  var btnRedo = document.getElementById('dds-btn-redo');
  if (!btnUndo || !btnRedo) return;

  function _refresh() {
    btnUndo.disabled = !DDS_TRANSACTIONS.canUndo();
    btnRedo.disabled = !DDS_TRANSACTIONS.canRedo();
    if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
  }

  DDS_UI_NAV._afterUndoRedo = async function() {
    // Close side panel — its fields are stale after undo/redo
    if (window.DDS_PANEL) DDS_PANEL.close();
    var view = DDS && DDS.state && DDS.state.currentView;
    if (view === 'map') {
      await DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
    } else if (view) {
      // Re-render the active table view
      if (view === 'nodes'       && window.DDS_NODES_UI)       DDS_NODES_UI.render();
      if (view === 'flows'       && window.DDS_FLOWS_UI)        DDS_FLOWS_UI.render();
      if (view === 'products'    && window.DDS_PRODUCTS_UI)     DDS_PRODUCTS_UI.render();
      if (view === 'boms'        && window.DDS_BOMS_UI)         DDS_BOMS_UI.render();
      if (view === 'demand'      && window.DDS_DEMANDS_UI)      DDS_DEMANDS_UI.render();
      // 'annotations' view removed (T-045, 2026-07-10) — see DDScope_UI.md §2
    }
    DDS_STORE.markDirty();
    _refresh();
  };

  btnUndo.addEventListener('click', function(e) {
    if (!e.isTrusted) return;
    DDS_UI_NAV.undo();
  });

  btnRedo.addEventListener('click', function(e) {
    if (!e.isTrusted) return;
    DDS_UI_NAV.redo();
  });

  // Keep button state in sync with transaction stack
  DDS_TRANSACTIONS.onChange(_refresh);

  // Initial state
  _refresh();
};
