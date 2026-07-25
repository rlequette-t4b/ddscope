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
    // framework-2/3: singleton pages (Nodes/Flows/Products/BOMs/Demand/
    // Configuration) are registered on the Page Strip (T-052 step 5, see
    // DDS._registerPages below) — route through the shell when the page
    // exists there. Map pages are keyed by numeric map id, never the
    // string 'map', so a showView('map') call always falls through to
    // the legacy branch below (harmless — DDS_MAP_UI owns map page
    // activation via switchMap/_activateMap, see src/ui/DDS_MAP_UI.js).
    if (typeof DDS_WORKBENCH_SHELL !== 'undefined' && DDS_WORKBENCH_SHELL._pages[viewName]) {
      DDS_WORKBENCH_SHELL.showPage(viewName);
      return;
    }

    // Legacy fallback — framework-1 (CommWise, no DDS_WORKBENCH_SHELL) and
    // any viewName not (yet) registered as a page.
    // Clear the side panel's content when leaving a view it applies to.
    // Nodes/Flows also use the side panel now (RFC step 4, T-052) — only
    // clear when navigating to a view it doesn't cover (Products, BOMs,
    // Demand, Configuration keep their own editing surface for v1).
    var _sidePanelViews = { map: true, nodes: true, flows: true };
    if (!_sidePanelViews[viewName] && typeof DDS_PANEL !== 'undefined' && DDS_PANEL.mode) {
      DDS_PANEL.close();
    }
    document.querySelectorAll('.dds-view').forEach(function(v) { v.classList.remove('active'); });
    var target = document.getElementById('dds-view-' + viewName);
    if (target) target.classList.add('active');
    DDS.state.currentView = viewName;
    document.querySelectorAll('.dds-nav-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.getElementById('dds-tab-' + viewName);
    if (activeTab) activeTab.classList.add('active');
    // Re-gray Toolbar-row / menu commands that only apply to the Map view
    // (Layout, Direction, Legend, Notes) — RFC §4 Header Layout, "grayed
    // out, not hidden".
    if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
  },

  // Register the six singleton Page Strip pages (RFC §4 Migration Path
  // step 5) — called once from DDS_INIT.boot(), mirrors the
  // _registerWorkbench() self-registration pattern used by toolbox
  // modules (DDS_AI_UI, DDS_TYPES_UI). Map pages are NOT registered here
  // — they are multi-instance and owned by DDS_MAP_UI (registered per
  // map in DDS_MAP_UI.openProject/createMap/duplicateMap). No-ops on
  // framework-1 (CommWise, no DDS_WORKBENCH_SHELL) — its legacy nav-tab
  // DOM keeps working through the showView fallback above.
  _registerPages: function() {
    if (typeof DDS_WORKBENCH_SHELL === 'undefined') return;

    // renderFn: re-renders the page's table/content on every show —
    // functional replacement for the old "click #dds-tab-X to re-render"
    // listeners (still present, guarded, in each *_UI.js for CommWise's
    // legacy nav — see e.g. DDS_PRODUCTS_UI.bindEvents). Same 50ms
    // setTimeout as those listeners used, kept for consistency (lets any
    // DOM/layout change from the page switch itself settle first).
    function mkOnShow(viewName, usesSidePanel, renderFn) {
      return function() {
        if (!usesSidePanel && typeof DDS_PANEL !== 'undefined' && DDS_PANEL.mode) DDS_PANEL.close();
        DDS.state.currentView = viewName;
        if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
        if (typeof renderFn === 'function') setTimeout(renderFn, 50);
      };
    }

    var singletons = [
      { id: 'nodes',         title: 'Nodes',         usesSidePanel: true,  renderFn: function() { if (window.DDS_NODES_UI) DDS_NODES_UI.renderTable(); } },
      { id: 'flows',         title: 'Flows',         usesSidePanel: true,  renderFn: function() { if (window.DDS_FLOWS_UI) DDS_FLOWS_UI.renderTable(); } },
      { id: 'products',      title: 'Products',      usesSidePanel: false, renderFn: function() { if (window.DDS_PRODUCTS_UI) DDS_PRODUCTS_UI.renderTable(); } },
      { id: 'boms',          title: 'BOMs',          usesSidePanel: false, renderFn: function() { if (window.DDS_BOMS_UI) DDS_BOMS_UI.renderTable(); } },
      { id: 'demand',        title: 'Demand',        usesSidePanel: false, renderFn: function() { if (window.DDS_DEMANDS_UI) DDS_DEMANDS_UI.renderTable(); } },
      { id: 'configuration', title: 'Configuration', usesSidePanel: false, renderFn: function() { if (window.DDS_CONFIGURATION_UI) DDS_CONFIGURATION_UI.render(); } }
    ];
    singletons.forEach(function(s) {
      DDS_WORKBENCH_SHELL.registerPage({
        id: s.id,
        title: s.title,
        kind: 'singleton',
        contentId: 'dds-view-' + s.id,
        closable: false,
        onShow: mkOnShow(s.id, s.usesSidePanel, s.renderFn)
      });
    });
  },

  openProject: function() {
    // Open-project teardown (2026-07-25, twin of ISS-022's close path) —
    // loadProject/handleSave call openProject() directly without a
    // preceding closeProject(), so a project opened over an already-open
    // one used to leak the previous project's map tabs on the Page Strip.
    // Run the same teardown closeProject does before registering the new
    // project's map pages. No-op on a first open (no active page, maps
    // empty); reads DDS_MAP.state.maps, still the previous project's at
    // this point (overwritten later in DDS_MAP_UI.openProject). See
    // docs/DDScope_Modules.md DDS_WORKBENCH_SHELL Open-project contract.
    if (typeof DDS_WORKBENCH_SHELL !== 'undefined') DDS_WORKBENCH_SHELL.clearActivePage();
    if (typeof DDS_MAP_UI !== 'undefined' && typeof DDS_MAP_UI.closeAllMapPages === 'function') DDS_MAP_UI.closeAllMapPages();

    var name = DDS_STORE.getProject().project.name || 'Untitled';
    var label = document.getElementById('dds-nav-project-label');
    if (label) label.textContent = name;
    var center = document.getElementById('dds-nav-project-center');
    if (center) center.classList.remove('dds-hidden');

    // CommWise (framework-1) legacy compat: no shell there yet (see
    // docs/DDScope_Plugin_UI_RFC.md §5 Decisions) — fall back to the old
    // #dds-btn-ai dds-hidden gating directly. Local/Tauri: the rail icon is
    // always visible (2026-07-14 feedback), nothing to gate here.
    if (typeof DDS_WORKBENCH_SHELL === 'undefined') {
      var aiBtn = document.getElementById('dds-btn-ai');
      if (aiBtn) aiBtn.classList.remove('dds-hidden');
    }

    ['map','nodes','flows','products','boms','demand','annotations','configuration'].forEach(function(t) {
      var tab = document.getElementById('dds-tab-' + t);
      if (tab) tab.classList.remove('dds-hidden');
    });
    // Temporary view-tab strip (RFC §4 Header Layout, migrates to the Page
    // Strip at step 5) — hidden while empty (no project) so it doesn't show
    // as a blank bar (2026-07-14 feedback).
    var tabsRow = document.getElementById('dds-view-tabs-row');
    if (tabsRow) tabsRow.classList.remove('dds-hidden');
    // Page Strip (RFC step 5): always visible now (2026-07-14 feedback) —
    // no longer hidden-while-empty like the temporary tabsRow above, so
    // nothing to un-hide here; see fragments/app-shell.html (no dds-hidden
    // in the markup) and closeProject below (no longer re-hides it either).
    // dds-btn-save-as removed from the new fragment (RFC §4 Header Layout)
    // — Save As now lives in the File menu, gated by file.saveAs's
    // isEnabled (see DDS_UI_MENU.js). CommWise legacy compat: if the old
    // button is still present there (fragment not yet updated), keep
    // un-hiding it as before.
    var saveAsBtn = document.getElementById('dds-btn-save-as');
    if (saveAsBtn) saveAsBtn.classList.remove('dds-hidden');

    DDS.showView('map');
    if (window.DDS_NOTES_UI) DDS_NOTES_UI.show();
    // Types Toolbox palette is data-dependent (node/product types,
    // swim-lanes) and only re-rendered on toolbox open (DDS_TYPES_UI._applyOpen)
    // — if the toolbox is already open when a project is opened (e.g. it was
    // showing its empty state), it must be told to refresh explicitly, same
    // as DDS_NOTES_UI.show() above (2026-07-14 feedback, T-052 step 3).
    if (window.DDS_TYPES_UI) DDS_TYPES_UI.refresh();
    if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
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
    if (typeof DDS_WORKBENCH_SHELL === 'undefined') {
      var aiBtn = document.getElementById('dds-btn-ai');
      if (aiBtn) aiBtn.classList.add('dds-hidden');
    }

    ['map','nodes','flows','products','boms','demand','annotations','configuration'].forEach(function(t) {
      var tab = document.getElementById('dds-tab-' + t); if (tab) tab.classList.add('dds-hidden');
    });
    var tabsRowC = document.getElementById('dds-view-tabs-row');
    if (tabsRowC) tabsRowC.classList.add('dds-hidden');
    // Page Strip (RFC step 5) — first hide whichever page is currently
    // active, static or dynamic (2026-07-15, ISS-022: closeAllMapPages
    // alone left a stale singleton page on screen when it, not a map, was
    // active at close time), then unregister every map page (singleton
    // pages stay registered, they're permanent). The strip itself stays
    // visible (2026-07-14 feedback, always shown) — no longer hidden on
    // close.
    if (typeof DDS_WORKBENCH_SHELL !== 'undefined') DDS_WORKBENCH_SHELL.clearActivePage();
    if (typeof DDS_MAP_UI !== 'undefined' && typeof DDS_MAP_UI.closeAllMapPages === 'function') DDS_MAP_UI.closeAllMapPages();
    var saveAsBtnC = document.getElementById('dds-btn-save-as');
    if (saveAsBtnC) saveAsBtnC.classList.add('dds-hidden');

    if (typeof DDS_AI_UI !== 'undefined') DDS_AI_UI.close();
    if (window.DDS_TYPES_UI) DDS_TYPES_UI.close();
    if (window.DDS_NOTES_UI) DDS_NOTES_UI.hide();
    // Was DDS.showView('map') (legacy CommWise nav-tab fallback, framework-1
    // retired 2026-07-15, T-059) — removed 2026-07-15 (ISS-022 follow-up):
    // 'map' never matches a registered Page Strip id (map pages are keyed
    // by numeric map id), so the call always fell through to showView's
    // legacy branch and re-added .active to #dds-view-map, undoing the
    // clearActivePage()/destroyCy() cleanup above. No project/view is open
    // after close, so there is nothing to show here.
    DDS.state.currentView = null;
    if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
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
