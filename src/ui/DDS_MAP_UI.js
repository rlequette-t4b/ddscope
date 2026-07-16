// ============================================================
// DDS_MAP_UI — map selector + toolbar wiring
// ============================================================

var DDS_MAP_UI = {};

// Render map selector for the current project
DDS_MAP_UI.renderSelector = function() {
  var sel = document.getElementById('dds-map-selector');
  if (!sel) return;

  var maps = DDS_MAP.state.maps;
  var currentMapId = DDS_MAP.state.currentMapId;

  sel.innerHTML = '';
  maps.forEach(function(map) {
    var opt = document.createElement('option');
    opt.value = map.id;
    opt.textContent = map.name;
    if (map.id === currentMapId) opt.selected = true;
    sel.appendChild(opt);
  });

  // Update delete button state
  var delBtn = document.getElementById('dds-btn-map-delete');
  if (delBtn) delBtn.disabled = maps.length <= 1;
};

// Keep renderTabs as alias for compatibility (calls renderSelector)
DDS_MAP_UI.renderTabs = DDS_MAP_UI.renderSelector;

// Register one map as a Page Strip page (T-052 step 5, framework-2/3
// only — no-op if DDS_WORKBENCH_SHELL is absent, e.g. CommWise). Shares
// #dds-view-map as contentId across every map page — the canvas DOM is
// a single reused surface, only its data changes (DDS_MAP.loadMap), same
// as it always has; the Page Strip just adds a tab per map on top of
// that. Also wires the tab's right-click context menu (Rename/Duplicate/
// Delete — RFC §2 Page Strip).
DDS_MAP_UI._registerMapPage = function(map) {
  if (typeof DDS_WORKBENCH_SHELL === 'undefined') return;
  DDS_WORKBENCH_SHELL.registerPage({
    id: map.id,
    title: map.name,
    kind: 'map',
    contentId: 'dds-view-map',
    closable: true,
    onShow: function() { DDS_MAP_UI._activateMap(map.id); }
  });
  // Right-click shortcut onto the shared Page menu (RFC §2 Page Strip: "a
  // right-click shortcut directly on a tab", TODO/T-054) — opens at the
  // click point. Replaces the old, right-click-only _openMapContextMenu.
  var tab = document.getElementById('dds-page-tab-' + map.id);
  if (tab) tab.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    if (window.DDS_PAGE_MENU) DDS_PAGE_MENU.open(e);
  });
};

// Unregister every map page — called from DDS.closeProject (RFC step 5).
// Also resets the in-memory map model (2026-07-15, ISS-022): DDS_MAP.state
// used to be left stale (old project's maps/currentMapId) until the next
// openProject overwrote it. The Page Strip's own active-page cleanup is a
// separate step, DDS_WORKBENCH_SHELL.clearActivePage(), called by
// DDS.closeProject alongside this.
DDS_MAP_UI.closeAllMapPages = function() {
  if (typeof DDS_WORKBENCH_SHELL !== 'undefined') {
    DDS_MAP.state.maps.forEach(function(m) { DDS_WORKBENCH_SHELL.closePage(m.id); });
  }
  DDS_MAP.state.maps = [];
  DDS_MAP.state.currentMapId = null;
  if (typeof DDS_MAP.destroyCy === 'function') DDS_MAP.destroyCy();
};

// Actual data-loading side effect of activating a map — shared by the
// Page Strip's showPage onShow (framework-2/3) and switchMap's legacy
// branch (CommWise <select> onchange) below, so both surfaces load a map
// the same way and keep DDS.state.currentView / command enablement
// correct regardless of which UI triggered the switch.
DDS_MAP_UI._activateMap = async function(mapId) {
  DDS_MAP.state.currentMapId = mapId;
  DDS_MAP_UI.renderSelector(); // no-op if #dds-map-selector is absent (framework-2/3)
  await DDS_MAP.loadMap(mapId);
  var map = DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
  DDS_MAP_UI.updateDirectionBtn(map ? (map.direction || 'right-left') : 'right-left');
  DDS.state.currentView = 'map';
  if (window.DDS_UI_COMMANDS) DDS_UI_COMMANDS.refreshEnablement();
};

// Switch to a different map. framework-2/3: routes through the Page
// Strip so its active tab stays in sync regardless of caller (click on a
// tab already goes through DDS_WORKBENCH_SHELL.showPage directly — this
// branch matters for programmatic callers: createMap/duplicateMap/
// deleteMap/openProject below). framework-1 (CommWise, no shell): calls
// _activateMap directly, same as before this migration.
DDS_MAP_UI.switchMap = async function(mapId) {
  if (typeof DDS_WORKBENCH_SHELL !== 'undefined' && DDS_WORKBENCH_SHELL._pages[mapId]) {
    DDS_WORKBENCH_SHELL.showPage(mapId);
    return;
  }
  await DDS_MAP_UI._activateMap(mapId);
};

// Rename map inline
DDS_MAP_UI.startRename = function(tab, map) {
  var nameSpan = tab.querySelector('.dds-map-tab-name');
  nameSpan.contentEditable = 'true';
  nameSpan.focus();
  var range = document.createRange();
  range.selectNodeContents(nameSpan);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  function save() {
    nameSpan.contentEditable = 'false';
    var newName = (nameSpan.textContent || '').trim() || map.name;
    nameSpan.textContent = newName;
    if (newName !== map.name) {
      DDS_CMD.execute(TX.MAP_RENAME, { id: map.id, name: newName }, null, function() {
        map.name = newName;
      });
    }
  }
  nameSpan.addEventListener('blur', save, { once: true });
  nameSpan.addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  { e.preventDefault(); nameSpan.blur(); }
    if (e.key === 'Escape') { nameSpan.textContent = map.name; nameSpan.blur(); }
  }, { once: true });
};

// Update auto-layout button visual state
DDS_MAP_UI.updateAutoLayoutBtn = function() {
  var btn = document.getElementById('dds-btn-auto-layout');
  if (!btn) return;
  if (DDS.getAutoLayout()) {
    btn.classList.add('active');
    btn.title = 'Auto-Layout: ON (click to disable)';
  } else {
    btn.classList.remove('active');
    btn.title = 'Auto-Layout: OFF (click to enable)';
  }
};

// Update direction toggle button to reflect current map direction. Icon
// stays fixed (icon + tooltip only, RFC docs/DDScope_Plugin_UI_RFC.md §3
// Icons/Toolbar Buttons, TODO/T-054) — only the title text and the
// dds-btn-direction-active class change; the class flips the icon
// horizontally via CSS (styles/layout-nav-cards.css), it no longer swaps
// textContent.
DDS_MAP_UI.updateDirectionBtn = function(direction) {
  var btn = document.getElementById('dds-btn-direction');
  if (!btn) return;
  if (direction === 'left-right') {
    btn.title = 'Direction: left → right (click to toggle)';
    btn.classList.add('dds-btn-direction-active');
  } else {
    btn.title = 'Direction: right ← left (click to toggle)';
    btn.classList.remove('dds-btn-direction-active');
  }
};

// Toggle direction on the active map
DDS_MAP_UI.toggleDirection = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  var map = DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
  if (!map) return;
  var newDir = (map.direction === 'left-right') ? 'right-left' : 'left-right';
  map.direction = newDir;
  DDS_STORE.update('maps', { id: mapId }, { direction: newDir });
  DDS_MAP_UI.updateDirectionBtn(newDir);
};

// Create a new map
DDS_MAP_UI.createMap = function() {
  DDS_CMD.execute(TX.MAP_CREATE, {}, null, function(result) {
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
    var map = DDS_MAP.state.maps.find(function(m) { return m.id === result.id; });
    if (map) DDS_MAP_UI._registerMapPage(map);
    DDS_MAP_UI.switchMap(result.id);
  });
};

// Duplicate active map
DDS_MAP_UI.duplicateMap = function(srcMap) {
  DDS_CMD.execute(TX.MAP_DUPLICATE, { source_id: srcMap.id }, null, function(result) {
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
    var map = DDS_MAP.state.maps.find(function(m) { return m.id === result.id; });
    if (map) DDS_MAP_UI._registerMapPage(map);
    DDS_MAP_UI.switchMap(result.id);
  });
};

// Delete active map
DDS_MAP_UI.deleteMap = function(map) {
  if (DDS_MAP.state.maps.length <= 1) return;
  DDS_CMD.execute(TX.MAP_DELETE, { id: map.id }, null, function() {
    if (typeof DDS_WORKBENCH_SHELL !== 'undefined') DDS_WORKBENCH_SHELL.closePage(map.id);
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
    var remaining = DDS_MAP.state.maps[0];
    if (remaining) DDS_MAP_UI.switchMap(remaining.id);
  });
};

// Wire toolbar buttons + tab bar
DDS_MAP_UI.bindEvents = function() {
  var fitBtn          = document.getElementById('dds-btn-fit');
  var layoutBtn       = document.getElementById('dds-btn-layout');
  var legendBtn       = document.getElementById('dds-btn-legend');
  var notesBtn        = document.getElementById('dds-btn-notes');
  var directionBtn    = document.getElementById('dds-btn-direction');
  var mapSelector     = document.getElementById('dds-map-selector');
  var renameMapBtn    = document.getElementById('dds-btn-map-rename');
  var newMapBtn       = document.getElementById('dds-btn-map-new');
  var dupMapBtn       = document.getElementById('dds-btn-map-duplicate');
  var delMapBtn       = document.getElementById('dds-btn-map-delete');
  var addSwimLaneBtn  = document.getElementById('dds-btn-add-swimlane');
  if (fitBtn)          fitBtn.addEventListener('click',       function() { DDS_MAP.fitMap(); });
  if (layoutBtn)       layoutBtn.addEventListener('click',    function() { DDS_MAP.runLayout(); });
  if (legendBtn)       legendBtn.addEventListener('click',    function() { DDS_MAP.toggleLegend(); });
  if (notesBtn)        notesBtn.addEventListener('click',     function() { if (window.DDS_NOTES_UI) DDS_NOTES_UI.toggle(); });
  if (mapSelector)     mapSelector.addEventListener('change', function() {
    var mapId = parseInt(this.value, 10);
    if (mapId && mapId !== DDS_MAP.state.currentMapId) DDS_MAP_UI.switchMap(mapId);
  });
  if (renameMapBtn)    renameMapBtn.addEventListener('click',  function() { DDS_MAP_UI.openRenameModal(); });
  if (newMapBtn)       newMapBtn.addEventListener('click',    function() { DDS_MAP_UI.createMap(); });
  if (dupMapBtn)       dupMapBtn.addEventListener('click',    function() {
    var map = DDS_MAP.state.maps.find(function(m) { return m.id === DDS_MAP.state.currentMapId; });
    if (map) DDS_MAP_UI.duplicateMap(map);
  });
  if (delMapBtn)       delMapBtn.addEventListener('click',    function() {
    var map = DDS_MAP.state.maps.find(function(m) { return m.id === DDS_MAP.state.currentMapId; });
    if (map) DDS_MAP_UI.deleteMap(map);
  });

  var autoLayoutBtn = document.getElementById('dds-btn-auto-layout');
  if (autoLayoutBtn) {
    autoLayoutBtn.addEventListener('click', function() {
      DDS.setAutoLayout(!DDS.getAutoLayout());
      DDS_MAP_UI.updateAutoLayoutBtn();
    });
  }

  var removeFromMapBtn = document.getElementById('dds-btn-remove-from-map');
  if (removeFromMapBtn) {
    removeFromMapBtn.addEventListener('click', function() {
      // Annotation ghost (T-045): no-op — a note never participates in the
      // Remove button / Remove modal flow (see DDScope_UI.md §5). It is
      // removed/hidden only via the swim-lane panel's note list, or the
      // canvas Del key (map-only, handled directly in DDS_REMOVE.bindEvents).
      if (DDS_CY && DDS_CY.elements(':selected').filter('.dds-annotation-ghost').length > 0) return;

      // Lane: not a Cytoscape element — detect via panel state
      if (DDS_PANEL.mode === 'lane' && DDS_PANEL.entityId) {
        DDS_REMOVE.open('lane', DDS_PANEL.entityId);
        return;
      }

      var selected = DDS_CY ? DDS_CY.elements(':selected').not('.dds-note-ghost').not('.dds-annotation-ghost') : null;

      if (!selected || selected.length === 0) {
        // Node/flow opened from the Nodes/Flows table — no cy element, so
        // no cy selection either (T-052 step 4, mirrors the lane case
        // above). Full delete only — no map context to remove-only-from.
        if ((DDS_PANEL.mode === 'node' || DDS_PANEL.mode === 'flow') && DDS_PANEL.entityId != null) {
          DDS_REMOVE.open(DDS_PANEL.mode === 'flow' ? 'edge' : 'node', DDS_PANEL.entityId, false);
        }
        return;
      }

      if (selected.length === 1) {
        var el = selected[0];
        var type = el.isNode() ? 'node' : 'edge';
        if (DDS_PANEL.mode && DDS_PANEL.entityId) {
          type = DDS_PANEL.mode === 'flow' ? 'edge' : DDS_PANEL.mode;
          DDS_REMOVE.open(type, DDS_PANEL.entityId);
        } else {
          var id = el.isNode() ? el.data('nodeId') : el.data('flowId');
          DDS_REMOVE.open(type, id);
        }
      } else {
        DDS_REMOVE.openMulti(selected);
      }
    });
  }

  if (directionBtn)    directionBtn.addEventListener('click', function() { DDS_MAP_UI.toggleDirection(); });
  // Undo / Redo button state — click handlers are owned by DDS_UI_NAV.bindUndoRedo()

  // Page Strip "+" (new map) and hamburger (opens the shared Page menu,
  // src/ui/DDS_PAGE_MENU.js) — T-052 step 5 / T-054 Page Strip Styling,
  // framework-2/3 only (elements absent on CommWise, lookups no-op).
  var pageStripAdd = document.getElementById('dds-page-strip-add');
  if (pageStripAdd) pageStripAdd.addEventListener('click', function() { DDS_MAP_UI.createMap(); });

  var pageStripHamburger = document.getElementById('dds-page-strip-hamburger');
  if (pageStripHamburger) pageStripHamburger.addEventListener('click', function() {
    if (window.DDS_PAGE_MENU) DDS_PAGE_MENU.open(pageStripHamburger);
  });

  // T-036 part 4: search/create dedicated modal (was DDS_CONFIGURATION_UI's
  // CRUD modal directly — always-create-only, plus an untransacted direct
  // DDS_STORE.insert('map_swim_lanes', ...) for placement, never undoable).
  // The Configuration tab's own "+ Add" button still opens the CRUD modal
  // directly — unaffected, no map dimension there.
  if (addSwimLaneBtn)  addSwimLaneBtn.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_LANE_UI.openModal();
  });

};

// Open modal to rename the active map
DDS_MAP_UI.openRenameModal = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  var map = DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
  if (!map) return;

  // Create modal dynamically if it doesn't exist yet
  var overlay = document.getElementById('dds-modal-rename-map-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dds-modal-rename-map-overlay';
    overlay.className = 'dds-overlay dds-hidden';
    overlay.innerHTML = [
      '<div class="dds-modal">',
      '  <div class="dds-modal-header">',
      '    <span class="dds-modal-title">Rename Map</span>',
      '    <button class="dds-modal-close" id="dds-modal-rename-map-close">×</button>',
      '  </div>',
      '  <div class="dds-modal-body">',
      '    <label class="dds-form-label">Map name</label>',
      '    <input id="dds-rename-map-input" type="text" class="dds-input" style="width:100%" />',
      '  </div>',
      '  <div class="dds-modal-footer">',
      '    <button class="dds-btn dds-btn-secondary" id="dds-modal-rename-map-cancel">Cancel</button>',
      '    <button class="dds-btn dds-btn-primary" id="dds-modal-rename-map-save">Save</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
  }

  var input   = document.getElementById('dds-rename-map-input');
  var saveBtn = document.getElementById('dds-modal-rename-map-save');

  input.value = map.name;
  saveBtn.disabled = true;

  function validate() {
    var val = input.value.trim();
    saveBtn.disabled = !val || val === map.name;
  }
  input.oninput = validate;

  function close() { overlay.classList.remove('visible'); void overlay.offsetWidth; overlay.classList.add('dds-hidden'); }

  document.getElementById('dds-modal-rename-map-close').onclick  = close;
  document.getElementById('dds-modal-rename-map-cancel').onclick = close;

  saveBtn.onclick = function() {
    var newName = input.value.trim();
    if (!newName || newName === map.name) return;
    DDS_CMD.execute(TX.MAP_RENAME, { id: map.id, name: newName }, null, function() {
      map.name = newName;
      DDS_MAP_UI.renderSelector();
      if (typeof DDS_WORKBENCH_SHELL !== 'undefined') DDS_WORKBENCH_SHELL.setPageTitle(map.id, newName);
      close();
    });
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click();
    if (e.key === 'Escape') close();
  };

  overlay.classList.remove('dds-hidden');
  void overlay.offsetWidth;
  overlay.classList.add('visible');
  setTimeout(function() { input.select(); }, 50);
};

// Removed (T-045, 2026-07-10): DDS_MAP_UI.openAnnotationModal, the toolbar
// "+ Annotation" modal. Annotation (note) creation now happens exclusively
// from the swim-lane panel's "+ Note" button (DDS_PANEL._renderLaneNotes),
// which always supplies the parent lane's swim_lane_id — see
// DDScope_ElementsLifecycle.md §7 and DDScope_UI.md §6.

// Migration (T-045, 2026-07-10): annotations created before this change may
// have swim_lane_id: null (the field used to be optional). Every annotation
// is now always lane-attached, so on project open, any orphan annotation is
// assigned to the project's first swim-lane (insertion order). If the
// project has zero swim-lanes, it is left unmigrated — a residual edge case,
// not expected in practice (see DDScope_DataModel.md §9 — Migration).
DDS_MAP_UI._migrateOrphanAnnotations = function() {
  var orphans = DDS_STORE.query('annotations').filter(function(a) { return a.swim_lane_id == null; });
  if (orphans.length === 0) return;
  var firstLane = DDS_STORE.query('swim_lanes')[0];
  if (!firstLane) return; // no lane to migrate to — left unmigrated
  orphans.forEach(function(a) {
    DDS_STORE.update('annotations', { id: a.id }, { swim_lane_id: firstLane.id });
  });
};

// Called by DDS.openProject — load maps and open first one
DDS_MAP_UI.openProject = async function() {
  if (typeof DDS_AI !== 'undefined') DDS_AI.clearHistory();

  DDS_MAP_UI._migrateOrphanAnnotations();

  DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });

  // Safety: create Map 1 if missing
  if (DDS_MAP.state.maps.length === 0) {
    DDS_STORE.insert('maps', { name: 'Map 1', position: 1 });
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
  }

  if (typeof DDS_WORKBENCH_SHELL !== 'undefined') {
    DDS_MAP.state.maps.forEach(DDS_MAP_UI._registerMapPage);
  }

  var firstMap = DDS_MAP.state.maps[0];
  await DDS_MAP_UI.switchMap(firstMap.id);
  DDS_MAP_UI.updateAutoLayoutBtn();
};
