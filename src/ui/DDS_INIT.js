// ============================================================
// DDS_INIT — Bootstrap
// ============================================================

(function() {
  var _booted = false;

  async function boot() {
    if (_booted) return;
    _booted = true;

    // Wait for app settings to load from DataStore before continuing.
    // Ensures DDS.state.settings.debug_mode (and future flags) are
    // available to all modules from the very first render.
    try {
      await DDS_SETTINGS.ready();
    } catch(e) {
      console.warn('[DDS_INIT] DDS_SETTINGS.ready() failed — continuing with defaults:', e);
    }

    // Apply persisted log level from settings
    if (window.DDS_TOOLS && window.DDS_SETTINGS) {
      DDS_TOOLS.log.setLevel(DDS_SETTINGS.getLogLevel());
    }

    // Wire DDS_STORE dirty-state callback to DOM (isolated from the store for testability)
    DDS_STORE.onDirtyChange = function(dirty, name) {
      var label = document.getElementById('dds-nav-project-label');
      // CommWise (framework-1) legacy compat: the old fragment has no
      // separate dirty badge (fragments/app-shell.html is scoped to
      // framework-2/3 only, see assembly.json) — keep appending the "•"
      // marker to the label there. The new fragment shows dirty state via
      // #dds-menu-dirty-badge instead (RFC §4 Header Layout, "folds the
      // project name's • dirty marker and the Save button into a single
      // control").
      var hasNewChrome = !!document.getElementById('dds-menu-dirty-badge');
      if (label) label.textContent = name + (!hasNewChrome && dirty ? ' •' : '');
      if (window.DDS_UI_MENU) DDS_UI_MENU.refreshDirtyBadge(dirty);
      var legacySaveBtn = document.getElementById('dds-btn-save');
      if (legacySaveBtn) legacySaveBtn.disabled = !dirty;
      if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
    };

    // Bind all UI event listeners
    DDS_UI_NAV.bindEvents();
    if (window.DDS_UI_MENU) DDS_UI_MENU.bindEvents();
    DDS_MAP_UI.bindEvents();
    DDS_NODE_UI.bindEvents();
    DDS_LANE_UI.bindEvents();
    DDS_PANEL.bindEvents();
    DDS_PRODUCTS_UI.bindEvents();
    DDS_BOMS_UI.bindEvents();
    DDS_DEMANDS_UI.bindEvents();
    // DDS_ANNOTATIONS_UI removed (T-045, 2026-07-10) — see DDScope_UI.md §2
    DDS_REMOVE.bindEvents();
    DDS_AI_UI.bindEvents();
    if (window.DDS_TYPES_UI) DDS_TYPES_UI.bindEvents();
    DDS_NODES_UI.bindEvents();
    DDS_CONFIGURATION_UI.bindEvents();
    DDS_NOTES_UI.init();

    // Try to reopen last file (Chrome/Edge only)
    try {
      var reopened = await DDS_UI_NAV.tryReopenLast();
      if (reopened === 'opened') {
        if (window.DDS_AI_UI) DDS_AI_UI.reset();
        DDS.openProject();
        return;
      }

    } catch(e) {}

    // No file reopened — show empty map view
    DDS.showView('map');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
