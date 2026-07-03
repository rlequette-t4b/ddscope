// ============================================================
// DDS — DDScope global state
// ============================================================
// project and dirty are shims delegating to DDS_STORE.
// currentMap and currentView remain here (presentation state).
// ============================================================

var DDS = {
  state: {
    currentMap:  null,
    currentView: 'map'
  },

  // Compatibility helpers used throughout the codebase
  // DDS.state.currentProject — returns the project metadata object
  get currentProject() { return DDS_STORE.getProject() ? DDS_STORE.getProject().project : null; },

  showView: function(viewName) {
    // Close side panel when leaving the map view
    if (viewName !== 'map' && typeof DDS_PANEL !== 'undefined' && DDS_PANEL.mode) {
      DDS_PANEL.close();
    }
    document.querySelectorAll('.dds-view').forEach(function(v) { v.classList.remove('active'); });
    var target = document.getElementById('dds-view-' + viewName);
    if (target) target.classList.add('active');
    DDS.state.currentView = viewName;
    document.querySelectorAll('.dds-nav-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.getElementById('dds-tab-' + viewName);
    if (activeTab) activeTab.classList.add('active');
  },

  openProject: function() {
    var name = DDS_STORE.getProject().project.name || 'Untitled';
    var label = document.getElementById('dds-nav-project-label');
    if (label) label.textContent = name;
    var center = document.getElementById('dds-nav-project-center');
    if (center) center.classList.remove('dds-hidden');

    var aiBtn = document.getElementById('dds-btn-ai');
    if (aiBtn) aiBtn.classList.remove('dds-hidden');

    ['map','nodes','flows','products','boms','demand','annotations','configuration'].forEach(function(t) {
      var tab = document.getElementById('dds-tab-' + t);
      if (tab) tab.classList.remove('dds-hidden');
    });
    var saveAsBtn = document.getElementById('dds-btn-save-as');
    if (saveAsBtn) saveAsBtn.classList.remove('dds-hidden');

    DDS.showView('map');
    if (window.DDS_NOTES_UI) DDS_NOTES_UI.show();
    DDS_MAP_UI.openProject().then(function() {
      // Reset dirty after all inserts triggered during project open (e.g. Map 1 safety insert)
      DDS_STORE.resetDirty();
    });
  },

  closeProject: function() {
    DDS_STORE.setProject(null);
    DDS.state.currentMap = null;

    var center = document.getElementById('dds-nav-project-center');
    if (center) center.classList.add('dds-hidden');
    var aiBtn = document.getElementById('dds-btn-ai');
    if (aiBtn) aiBtn.classList.add('dds-hidden');

    ['map','nodes','flows','products','boms','demand','annotations','configuration'].forEach(function(t) {
      var tab = document.getElementById('dds-tab-' + t); if (tab) tab.classList.add('dds-hidden');
    });
    var saveAsBtnC = document.getElementById('dds-btn-save-as');
    if (saveAsBtnC) saveAsBtnC.classList.add('dds-hidden');

    if (typeof DDS_AI_UI !== 'undefined') DDS_AI_UI.close();
    if (window.DDS_NOTES_UI) DDS_NOTES_UI.hide();
    DDS.showView('map');
  }
};

// Auto-layout flag helpers
DDS.getAutoLayout = function() {
  var p = DDS_STORE.getProject();
  if (!p || !p.project) return true;
  var val = p.project.auto_layout;
  return (val === undefined || val === null) ? true : !!val;
};

DDS.setAutoLayout = function(val) {
  var p = DDS_STORE.getProject();
  if (!p || !p.project) return;
  p.project.auto_layout = !!val;
  DDS_STORE.markDirty();
};

// ------------------------------------------------------------------
// DDS.state shims — delegate project and dirty to DDS_STORE
// Allows all existing modules using DDS.state.project / DDS.state.dirty
// to continue working without modification during migration.
// ------------------------------------------------------------------
Object.defineProperty(DDS.state, 'project', {
  get: function() { return DDS_STORE.getProject(); },
  set: function(json) { DDS_STORE.setProject(json); },
  configurable: true,
  enumerable: true
});

Object.defineProperty(DDS.state, 'dirty', {
  get: function() { return DDS_STORE.isDirty(); },
  set: function() { /* no-op: use DDS_STORE.markDirty() or resetDirty() */ },
  configurable: true,
  enumerable: true
});

// DDS.state.currentProject compatibility shim
// Allows legacy code using DDS.state.currentProject.id to keep working.
// DDS.state.project.project holds { name, description, created_by }.
// ID is not used in the in-memory model — return a fixed sentinel.
Object.defineProperty(DDS.state, 'currentProject', {
  get: function() {
    var p = DDS_STORE.getProject();
    if (!p) return null;
    return Object.assign({ id: '__local__' }, p.project);
  },
  configurable: true
});
