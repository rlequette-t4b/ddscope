// ============================================================
// DDS_UI_MENU — Header rows: menu bar dropdowns, dirty badge, and the
// UI Command Registry's v1 command registrations.
// (see docs/DDScope_Plugin_UI_RFC.md §4 Header Layout, Migration Path
// step 2)
//
// Registers the commands behind the new Identity/Menu/Toolbar rows in
// fragments/app-shell.html and binds their two trigger surfaces (menu
// items here; the pre-existing map-toolbar buttons — Fit, Layout, Auto-
// Layout, Direction, Legend, Notes, Undo, Redo — keep their original
// bindings in src/ui/DDS_MAP_UI.js / src/ui/DDS_UI_NAV.js unchanged, and
// are only relocated in the DOM). Most menu commands call the same
// underlying function as their toolbar counterpart directly, so there is
// exactly one implementation per action — the registry only decides how
// it's triggered (RFC §2 UI Command Pattern).
// ============================================================

var DDS_UI_MENU = {};

// ---- Command registration ----

DDS_UI_MENU._registerCommands = function() {
  var hasProject = function() { return !!DDS_STORE.getProject(); };
  var onMapView  = function() { return DDS && DDS.state && DDS.state.currentView === 'map'; };

  // File
  DDS_UI_COMMANDS.register('file.new',    { handler: DDS_UI_NAV.newProject });
  DDS_UI_COMMANDS.register('file.open',   { handler: DDS_UI_NAV.loadProject });
  DDS_UI_COMMANDS.register('file.save',   { handler: DDS_UI_NAV.save,   isEnabled: hasProject });
  DDS_UI_COMMANDS.register('file.saveAs', { handler: DDS_UI_NAV.saveAs, isEnabled: hasProject });
  DDS_UI_COMMANDS.register('file.close',  { handler: DDS_UI_NAV.closeProject, isEnabled: hasProject });

  // Edit — Undo/Redo call the same DDS_UI_NAV functions the toolbar
  // buttons use (see DDS_UI_NAV.js); Remove proxies the existing
  // #dds-btn-remove-from-map click (context-dependent selection logic
  // lives there, not duplicated here).
  DDS_UI_COMMANDS.register('edit.undo', { handler: DDS_UI_NAV.undo, isEnabled: function() { return DDS_TRANSACTIONS.canUndo(); } });
  DDS_UI_COMMANDS.register('edit.redo', { handler: DDS_UI_NAV.redo, isEnabled: function() { return DDS_TRANSACTIONS.canRedo(); } });
  DDS_UI_COMMANDS.register('edit.remove', {
    handler: function() { var b = document.getElementById('dds-btn-remove-from-map'); if (b && !b.disabled) b.click(); },
    isEnabled: function() { var b = document.getElementById('dds-btn-remove-from-map'); return !!b && !b.disabled; }
  });

  // View — rail/identity row visibility are small toggles (v1). Side
  // panel visibility now goes through DDS_PANEL.toggleVisibility() (RFC
  // step 4, T-052) — content swap stays separate, see DDS_PANEL.js.
  // Fullscreen still depends on the Page Strip (RFC step 5, not built
  // yet) — left as a static disabled menu item in the fragment.
  DDS_UI_COMMANDS.register('view.toggleRail', {
    handler: function() { var r = document.getElementById('dds-rail'); if (r) r.classList.toggle('dds-hidden'); }
  });
  DDS_UI_COMMANDS.register('view.toggleSidePanel', {
    handler: function() { if (window.DDS_PANEL) DDS_PANEL.toggleVisibility(); }
  });
  DDS_UI_COMMANDS.register('view.toggleIdentityRow', {
    handler: function() { var r = document.getElementById('dds-identity-row'); if (r) r.classList.toggle('dds-hidden'); }
  });

  // Arrange — same functions as the Layout/Direction toolbar buttons.
  DDS_UI_COMMANDS.register('arrange.layout',    { handler: function() { DDS_MAP.runLayout(); }, isEnabled: onMapView });
  DDS_UI_COMMANDS.register('arrange.direction', { handler: function() { DDS_MAP_UI.toggleDirection(); }, isEnabled: onMapView });

  // Extras
  DDS_UI_COMMANDS.register('extras.legend', { handler: function() { DDS_MAP.toggleLegend(); }, isEnabled: onMapView });
  DDS_UI_COMMANDS.register('extras.notes',  { handler: function() { if (window.DDS_NOTES_UI) DDS_NOTES_UI.toggle(); }, isEnabled: onMapView });
  // The local-only header (DDScope brand + settings gear) was retired
  // 2026-07-14 — the Identity row now carries the brand, and this menu
  // item is the settings entry point instead of the old gear button.
  // SETTINGS (src/core/DDS_SETTINGS.js) is a plain global, safe to call
  // directly regardless of whether #dds-header-settings-btn exists.
  DDS_UI_COMMANDS.register('extras.settings', {
    handler: function() { if (window.SETTINGS) SETTINGS.open(); }
  });

  // Keybindings — kept to the small set that already existed (Ctrl/Cmd+S)
  // plus Undo/Redo, rather than inventing new bindings for actions that
  // never had one.
  DDS_UI_COMMANDS.setKeybinding('mod+s', 'file.save');
  DDS_UI_COMMANDS.setKeybinding('mod+z', 'edit.undo');
  DDS_UI_COMMANDS.setKeybinding('mod+shift+z', 'edit.redo');
  DDS_UI_COMMANDS.bindKeyboard();
};

// ---- Menu bar dropdowns ----

DDS_UI_MENU._closeAllMenus = function() {
  document.querySelectorAll('.dds-menu.open').forEach(function(m) { m.classList.remove('open'); });
};

DDS_UI_MENU._bindMenuBar = function() {
  var menus = document.querySelectorAll('.dds-menu');
  menus.forEach(function(menu) {
    var label = menu.querySelector('.dds-menu-label');
    if (label) {
      label.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = menu.classList.contains('open');
        DDS_UI_MENU._closeAllMenus();
        if (!wasOpen) menu.classList.add('open');
      });
    }
    menu.querySelectorAll('.dds-menu-item[data-cmd]').forEach(function(item) {
      DDS_UI_COMMANDS.bindTrigger(item, item.dataset.cmd);
      item.addEventListener('click', function() { DDS_UI_MENU._closeAllMenus(); });
    });
  });

  document.addEventListener('click', DDS_UI_MENU._closeAllMenus);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') DDS_UI_MENU._closeAllMenus(); });
};

// ---- Toolbar-row rail/identity toggles ----

DDS_UI_MENU._bindToolbarToggles = function() {
  var railToggle = document.getElementById('dds-btn-toggle-rail');
  if (railToggle) DDS_UI_COMMANDS.bindTrigger(railToggle, 'view.toggleRail');
  var panelToggle = document.getElementById('dds-btn-toggle-panel');
  if (panelToggle) DDS_UI_COMMANDS.bindTrigger(panelToggle, 'view.toggleSidePanel');
  var identityToggle = document.getElementById('dds-btn-toggle-identity');
  if (identityToggle) DDS_UI_COMMANDS.bindTrigger(identityToggle, 'view.toggleIdentityRow');
};

// ---- Dirty-state badge — merges the old project-name "•" marker and
// the separate Save button into one control (RFC §4 Header Layout).
// Wired from DDS_STORE.onDirtyChange in src/ui/DDS_INIT.js.
DDS_UI_MENU.refreshDirtyBadge = function(dirty) {
  var badge = document.getElementById('dds-menu-dirty-badge');
  if (!badge) return;
  badge.classList.toggle('dds-hidden', !dirty);
};

DDS_UI_MENU.bindEvents = function() {
  DDS_UI_MENU._registerCommands();
  DDS_UI_MENU._bindMenuBar();
  DDS_UI_MENU._bindToolbarToggles();
  var badge = document.getElementById('dds-menu-dirty-badge');
  if (badge) badge.addEventListener('click', function() { DDS_UI_COMMANDS.execute('file.save'); });
};
