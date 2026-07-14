// ============================================================
// DDS_WORKBENCH_SHELL — IWorkbenchShell, v1 pilot implementation
// (framework-2 / local runner only — see
// docs/DDScope_Plugin_UI_RFC.md §4 Migration Path, step 1).
//
// Contract for v1: registerToolbox(descriptor), registerView(descriptor,
// mountFn), showView(id), hideView(id).
//
// A toolbox is one rail entry (id, icon, title). It owns exactly one
// docked panel; its onShow/onHide callbacks own that panel's actual
// content behavior (width, canvas resize, etc.) — the shell only owns
// the rail icon and the "single panel open at a time" state, per the
// RFC's Rail and Panel / UI Command Pattern sections.
//
// A view is one content section registered under a toolbox. v1 has
// exactly one view per toolbox (see DDS_AI_UI's registration) — the
// mountFn hook exists to prove the registerView contract end-to-end,
// not to mount real content yet (the AI panel DOM is already built by
// fragments/app-shell.html). Real content-mounting via mountFn is
// deferred to the Types Toolbox (RFC step 3).
//
// framework-1 (CommWise) and framework-3 (Tauri) are not wired to this
// module yet (out of scope for this pass) — every method no-ops safely
// when #dds-rail is absent from the DOM, so loading this file elsewhere
// does not throw.
// ============================================================

var DDS_WORKBENCH_SHELL = {
  _toolboxes: {},   // id -> { id, icon, title, onShow, onHide, views: [] }
  _views: {},       // id -> { id, toolboxId, title, order }
  _openToolboxId: null
};

// Register a toolbox — creates its rail icon (if #dds-rail exists in the
// current framework's DOM) and wires the click-to-toggle behavior.
// descriptor: { id, icon, title, onShow, onHide }
DDS_WORKBENCH_SHELL.registerToolbox = function(descriptor) {
  var id = descriptor.id;
  DDS_WORKBENCH_SHELL._toolboxes[id] = {
    id: id,
    icon: descriptor.icon,
    title: descriptor.title,
    onShow: descriptor.onShow || function() {},
    onHide: descriptor.onHide || function() {},
    views: []
  };

  var rail = document.getElementById('dds-rail');
  if (!rail) return; // no rail in this framework's DOM yet — no-op

  var btn = document.createElement('button');
  btn.className = 'dds-rail-icon dds-hidden';
  btn.id = 'dds-rail-' + id;
  btn.title = descriptor.title || '';
  btn.innerHTML = descriptor.icon || '';
  btn.addEventListener('click', function() { DDS_WORKBENCH_SHELL.toggleToolbox(id); });
  rail.appendChild(btn);
};

// Register a view under an already-registered toolbox. mountFn is called
// once, immediately, at registration time (v1: no lazy/first-show mount
// yet — see file header note).
// descriptor: { id, toolboxId, title, order }
DDS_WORKBENCH_SHELL.registerView = function(descriptor, mountFn) {
  var toolbox = DDS_WORKBENCH_SHELL._toolboxes[descriptor.toolboxId];
  if (!toolbox) {
    console.warn('[DDS_WORKBENCH_SHELL] registerView: unknown toolbox "' + descriptor.toolboxId + '"');
    return;
  }
  DDS_WORKBENCH_SHELL._views[descriptor.id] = descriptor;
  toolbox.views.push(descriptor.id);
  if (typeof mountFn === 'function') mountFn();
};

DDS_WORKBENCH_SHELL.showView = function(viewId) {
  var view = DDS_WORKBENCH_SHELL._views[viewId];
  if (!view) return;
  DDS_WORKBENCH_SHELL._showToolbox(view.toolboxId);
};

DDS_WORKBENCH_SHELL.hideView = function(viewId) {
  var view = DDS_WORKBENCH_SHELL._views[viewId];
  if (!view) return;
  DDS_WORKBENCH_SHELL._hideToolbox(view.toolboxId);
};

// Toggle behavior for the rail icon itself: clicking the already-open
// toolbox's icon closes it (VSCode Activity Bar behavior, per RFC).
DDS_WORKBENCH_SHELL.toggleToolbox = function(id) {
  if (DDS_WORKBENCH_SHELL._openToolboxId === id) DDS_WORKBENCH_SHELL._hideToolbox(id);
  else DDS_WORKBENCH_SHELL._showToolbox(id);
};

DDS_WORKBENCH_SHELL._showToolbox = function(id) {
  var toolbox = DDS_WORKBENCH_SHELL._toolboxes[id];
  if (!toolbox) return;
  // Only one panel open at a time (Rail and Panel, RFC §2).
  if (DDS_WORKBENCH_SHELL._openToolboxId && DDS_WORKBENCH_SHELL._openToolboxId !== id) {
    DDS_WORKBENCH_SHELL._hideToolbox(DDS_WORKBENCH_SHELL._openToolboxId);
  }
  DDS_WORKBENCH_SHELL._openToolboxId = id;
  toolbox.onShow();
  var btn = document.getElementById('dds-rail-' + id);
  if (btn) btn.classList.add('active');
};

DDS_WORKBENCH_SHELL._hideToolbox = function(id) {
  var toolbox = DDS_WORKBENCH_SHELL._toolboxes[id];
  if (!toolbox) return;
  if (DDS_WORKBENCH_SHELL._openToolboxId === id) DDS_WORKBENCH_SHELL._openToolboxId = null;
  toolbox.onHide();
  var btn = document.getElementById('dds-rail-' + id);
  if (btn) btn.classList.remove('active');
};

// Enable/disable a toolbox's rail icon — e.g. the AI toolbox is only
// usable once a project is open. Mirrors the old #dds-btn-ai dds-hidden
// gating (see src/presentation/DDS.js openProject/closeProject).
DDS_WORKBENCH_SHELL.setToolboxEnabled = function(id, enabled) {
  var btn = document.getElementById('dds-rail-' + id);
  if (!btn) return;
  btn.classList.toggle('dds-hidden', !enabled);
  if (!enabled && DDS_WORKBENCH_SHELL._openToolboxId === id) DDS_WORKBENCH_SHELL._hideToolbox(id);
};
