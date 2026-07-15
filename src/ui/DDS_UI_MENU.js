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

  // File — v2 pilot for the Declarative Menu Contributions model (RFC §4,
  // TODO/T-056): register() now carries title (rendering data, not just
  // hardcoded HTML text), and contribute() places each command into the
  // File dropdown instead of a hand-authored <button data-cmd> in
  // fragments/app-shell.html. DDS_UI_COMMANDS.renderMenuItems('File', ...)
  // builds the actual DOM — see DDS_UI_MENU._renderContributedMenus below.
  DDS_UI_COMMANDS.register('file.new',    { handler: DDS_UI_NAV.newProject, title: 'New' });
  DDS_UI_COMMANDS.register('file.open',   { handler: DDS_UI_NAV.loadProject, title: 'Open' });
  DDS_UI_COMMANDS.register('file.save',   { handler: DDS_UI_NAV.save,   isEnabled: hasProject, title: 'Save' });
  DDS_UI_COMMANDS.register('file.saveAs', { handler: DDS_UI_NAV.saveAs, isEnabled: hasProject, title: 'Save As' });
  DDS_UI_COMMANDS.register('file.close',  { handler: DDS_UI_NAV.closeProject, isEnabled: hasProject, title: 'Close' });

  DDS_UI_COMMANDS.contribute('file.new',    { surface: 'menu', location: 'File', order: 0 });
  DDS_UI_COMMANDS.contribute('file.open',   { surface: 'menu', location: 'File', order: 1 });
  DDS_UI_COMMANDS.contribute('file.save',   { surface: 'menu', location: 'File', order: 2 });
  DDS_UI_COMMANDS.contribute('file.saveAs', { surface: 'menu', location: 'File', order: 3 });
  DDS_UI_COMMANDS.contribute('file.close',  { surface: 'menu', location: 'File', order: 4 });

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

  // View — rail/identity row visibility and side panel visibility are
  // Toggle Commands (RFC §4, TODO/T-056): isActive reads the DOM class
  // that already is the source of truth for each panel's visibility, so
  // no new state to keep in sync. Both surfaces go through the registry
  // for these three — the toolbar buttons (#dds-btn-toggle-rail etc.,
  // bound in _bindToolbarToggles below) AND the View menu (migrated to
  // contribute(), see below) — so isActive drives a toolbar highlight
  // (.dds-btn-ghost.active, styles/buttons-modal-forms.css) and a menu
  // checkmark from the exact same state read.
  // Handlers call refreshEnablement() themselves after mutating state —
  // none of these three dirty the project, touch undo/redo, or switch
  // pages, so none of the existing global refreshEnablement() triggers
  // (DDS_STORE.onDirtyChange, undo/redo, page switch — see DDS_INIT.js)
  // would otherwise catch them (RFC §4 Toggle Commands/Refresh: "a
  // toggle whose state can change independently of those triggers ...
  // must call refreshEnablement() from its own handler").
  DDS_UI_COMMANDS.register('view.toggleRail', {
    handler: function() {
      var r = document.getElementById('dds-rail');
      if (r) r.classList.toggle('dds-hidden');
      DDS_UI_COMMANDS.refreshEnablement();
    },
    isActive: function() { var r = document.getElementById('dds-rail'); return !!r && !r.classList.contains('dds-hidden'); },
    title: 'Toggle Rail'
  });
  DDS_UI_COMMANDS.register('view.toggleSidePanel', {
    handler: function() {
      if (window.DDS_PANEL) DDS_PANEL.toggleVisibility();
      DDS_UI_COMMANDS.refreshEnablement();
    },
    isActive: function() { var p = document.getElementById('dds-panel'); return !!p && !p.classList.contains('dds-hidden'); },
    title: 'Toggle Side Panel'
  });
  DDS_UI_COMMANDS.register('view.toggleIdentityRow', {
    handler: function() {
      var r = document.getElementById('dds-identity-row');
      if (r) r.classList.toggle('dds-hidden');
      DDS_UI_COMMANDS.refreshEnablement();
    },
    isActive: function() { var r = document.getElementById('dds-identity-row'); return !!r && !r.classList.contains('dds-hidden'); },
    title: 'Toggle Identity Row'
  });
  // Still depends on the Page Strip (RFC step 5, built, but no
  // fullscreen mechanism wired to it yet) — kept as an always-disabled
  // command rather than a hand-authored disabled <button>, now that View
  // is generated from contributions (every trigger needs a command).
  DDS_UI_COMMANDS.register('view.fullscreen', {
    handler: function() {},
    isEnabled: function() { return false; },
    title: 'Fullscreen'
  });

  DDS_UI_COMMANDS.contribute('view.toggleRail',       { surface: 'menu', location: 'View', order: 0 });
  DDS_UI_COMMANDS.contribute('view.toggleSidePanel',  { surface: 'menu', location: 'View', order: 1 });
  DDS_UI_COMMANDS.contribute('view.toggleIdentityRow',{ surface: 'menu', location: 'View', order: 2 });
  DDS_UI_COMMANDS.contribute('view.fullscreen',       { surface: 'menu', location: 'View', order: 3 });

  // Arrange — same functions as the Layout/Direction toolbar buttons.
  // Direction is a Toggle Command whose toolbar button already has its
  // own dedicated active-state rendering (DDS_MAP_UI.updateDirectionBtn
  // — icon flip via CSS transform, called from several places, not just
  // this command's handler) — isActive here only drives the Arrange
  // menu's checkmark; the toolbar button is untouched.
  DDS_UI_COMMANDS.register('arrange.layout',    { handler: function() { DDS_MAP.runLayout(); }, isEnabled: onMapView, title: 'Layout' });
  DDS_UI_COMMANDS.register('arrange.direction', {
    handler: function() {
      DDS_MAP_UI.toggleDirection();
      // toggleDirection already calls updateDirectionBtn for the toolbar
      // button's own dedicated visual (untouched by this registry) —
      // this refreshEnablement() is only to sync the new Arrange menu
      // checkmark, which has no other trigger for this state change.
      DDS_UI_COMMANDS.refreshEnablement();
    },
    isEnabled: onMapView,
    isActive: function() {
      var mapId = DDS_MAP.state.currentMapId;
      var map = mapId && DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
      return !!map && map.direction === 'left-right';
    },
    title: 'Direction'
  });

  DDS_UI_COMMANDS.contribute('arrange.layout',    { surface: 'menu', location: 'Arrange', order: 0 });
  DDS_UI_COMMANDS.contribute('arrange.direction', { surface: 'menu', location: 'Arrange', order: 1 });

  // Extras — Legend and Notes are Toggle Commands; only the menu goes
  // through the registry (their toolbar buttons, #dds-btn-legend/
  // #dds-btn-notes, keep their own separate bindings in DDS_MAP_UI.js,
  // untouched — no risk of two code paths fighting over the same
  // element's state).
  DDS_UI_COMMANDS.register('extras.legend', {
    handler: function() { DDS_MAP.toggleLegend(); DDS_UI_COMMANDS.refreshEnablement(); },
    isEnabled: onMapView,
    isActive: function() {
      var mapId = DDS_MAP.state.currentMapId;
      var mapRec = mapId && DDS_STORE.query('maps', { id: mapId })[0];
      return !!mapRec && mapRec.legend_visible !== false;
    },
    title: 'Legend'
  });
  DDS_UI_COMMANDS.register('extras.notes', {
    handler: function() { if (window.DDS_NOTES_UI) DDS_NOTES_UI.toggle(); DDS_UI_COMMANDS.refreshEnablement(); },
    isEnabled: onMapView,
    isActive: function() {
      var p = document.getElementById('dds-notes-panel');
      return !!p && !p.classList.contains('dds-hidden');
    },
    title: 'Notes'
  });
  // The local-only header (DDScope brand + settings gear) was retired
  // 2026-07-14 — the Identity row now carries the brand, and this menu
  // item is the settings entry point instead of the old gear button.
  // SETTINGS (src/core/DDS_SETTINGS.js) is a plain global, safe to call
  // directly regardless of whether #dds-header-settings-btn exists.
  DDS_UI_COMMANDS.register('extras.settings', {
    handler: function() { if (window.SETTINGS) SETTINGS.open(); },
    title: 'Settings'
  });

  DDS_UI_COMMANDS.contribute('extras.legend',   { surface: 'menu', location: 'Extras', order: 0 });
  DDS_UI_COMMANDS.contribute('extras.notes',    { surface: 'menu', location: 'Extras', order: 1 });
  DDS_UI_COMMANDS.contribute('extras.settings', { surface: 'menu', location: 'Extras', order: 2 });

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
    // Menus not yet migrated to contribute() still have their items
    // hand-authored in fragments/app-shell.html — bind them here.
    // bindTrigger is idempotent, so this sweep is also safe to run over
    // a dropdown already populated by DDS_UI_COMMANDS.renderMenuItems
    // (File) — those items are simply already bound and this is a no-op
    // for them.
    menu.querySelectorAll('.dds-menu-item[data-cmd]').forEach(function(item) {
      DDS_UI_COMMANDS.bindTrigger(item, item.dataset.cmd);
    });
    // Close-on-click delegated at the dropdown container so it covers
    // both hand-authored items and anything a renderMenuItems() call (or
    // a future plugin contribute()) adds later, with no per-item wiring.
    var dropdown = menu.querySelector('.dds-menu-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', function(e) {
        if (e.target.closest('.dds-menu-item')) DDS_UI_MENU._closeAllMenus();
      });
    }
  });

  document.addEventListener('click', DDS_UI_MENU._closeAllMenus);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') DDS_UI_MENU._closeAllMenus(); });
};

// Renders every menu location already migrated to the Declarative Menu
// Contributions model (RFC §4, TODO/T-056). Must run before
// _bindMenuBar's sweep populates/binds hand-authored items — order
// between the two doesn't actually matter for correctness (bindTrigger
// is idempotent either way), but rendering first keeps the DOM fully
// built before any binding pass touches it. File (T-056 pilot), then
// View/Arrange/Extras (added to actually exercise Toggle Commands) —
// Edit and Help stay v1 hand-authored markup for now.
DDS_UI_MENU._renderContributedMenus = function() {
  DDS_UI_COMMANDS.renderMenuItems('File',    document.getElementById('dds-menu-dropdown-file'));
  DDS_UI_COMMANDS.renderMenuItems('View',    document.getElementById('dds-menu-dropdown-view'));
  DDS_UI_COMMANDS.renderMenuItems('Arrange', document.getElementById('dds-menu-dropdown-arrange'));
  DDS_UI_COMMANDS.renderMenuItems('Extras',  document.getElementById('dds-menu-dropdown-extras'));
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
  DDS_UI_MENU._renderContributedMenus();
  DDS_UI_MENU._bindMenuBar();
  DDS_UI_MENU._bindToolbarToggles();
  var badge = document.getElementById('dds-menu-dirty-badge');
  if (badge) badge.addEventListener('click', function() { DDS_UI_COMMANDS.execute('file.save'); });
};
