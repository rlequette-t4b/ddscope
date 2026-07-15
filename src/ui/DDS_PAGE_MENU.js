// ============================================================
// DDS_PAGE_MENU — shared Page Strip menu (RFC §2 Page Strip / §3 Visual
// Style Guide/Page Strip Styling, TODO/T-054).
//
// Opens from three trigger surfaces, always the same content: the
// hamburger icon at the start of the strip (#dds-page-strip-hamburger,
// wired in DDS_MAP_UI.bindEvents), the active tab's chevron (added to
// every tab by DDS_WORKBENCH_SHELL.registerPage, CSS-gated to the active
// one), or a right-click on any map tab (wired in
// DDS_MAP_UI._registerMapPage). Content: an "Insert Page" action, then
// the full page list — singleton pages (Nodes/Flows/Products/BOMs/
// Demand/Configuration) and map pages together, in the same order as the
// visible strip, with a checkmark on the current page. Map rows reveal
// Rename/Duplicate/Delete/Move on hover (an inline row-actions cluster,
// not a separately positioned flyout submenu — see styles/page-strip.css
// for why). Singleton rows get no actions — they're permanent (RFC §2
// Page Strip).
//
// Replaces the old #dds-page-context-menu (Rename/Duplicate/Delete only,
// right-click-only, three plain buttons) — DDS_MAP_UI's
// _openMapContextMenu/_closeMapContextMenu are gone, this module is the
// only Page Strip popup now.
//
// Move (reordering pages) is deliberately left disabled: no position-
// mutation mechanism exists yet anywhere in the Page Strip (map
// 'position' is read for ordering — DDS_MAP_UI.renderSelector — but
// nothing writes it today), so wiring a real drag/reorder flow is a
// separate piece of work, not a side effect of adding this menu. Same
// "reserved but not yet built" treatment as Cut/Copy/Paste in the Edit
// menu (fragments/app-shell.html, TODO/T-003).
//
// framework-2/3 only — every entry point already guards on
// DDS_WORKBENCH_SHELL / #dds-page-strip being present; this module's own
// DOM lookups (#dds-page-menu) simply no-op (return early) on
// framework-1 (CommWise), which has none of these elements.
// ============================================================

var DDS_PAGE_MENU = {};

DDS_PAGE_MENU._outsideClickHandler = null;

// Small inline icon set for this menu's own controls (Insert Page's "+",
// the current-page checkmark, and the four row actions) — same
// hand-vendored, Lucide-style approach as the Toolbar Buttons pass
// (fragments/app-shell.html), not a separate library.
DDS_PAGE_MENU._ICONS = {
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  move: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>'
};

// Read rows from the live DOM tabs (#dds-page-strip-tabs), not
// DDS_WORKBENCH_SHELL._pages directly. That object is keyed by id, and
// JS always iterates integer-like keys in ascending numeric order before
// string keys regardless of insertion order — since map ids are numeric
// and singleton ids are strings ('nodes', 'flows'...), Object.keys on
// _pages would not match the strip's actual visual/registration order.
// Reading the tabs keeps the menu's list identical to what's on screen.
DDS_PAGE_MENU._buildRows = function() {
  var tabs = document.querySelectorAll('#dds-page-strip-tabs .dds-page-tab');
  var rows = [];
  tabs.forEach(function(tab) {
    var rawId = tab.id.replace('dds-page-tab-', '');
    var isMap = /^\d+$/.test(rawId); // map ids are numeric; singleton ids are words
    var titleEl = tab.querySelector('.dds-page-tab-title');
    rows.push({
      id: isMap ? parseInt(rawId, 10) : rawId,
      title: titleEl ? titleEl.textContent : '',
      isMap: isMap,
      current: tab.classList.contains('active')
    });
  });
  return rows;
};

DDS_PAGE_MENU._actionBtn = function(iconName, title, onClick) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dds-page-menu-row-action';
  btn.title = title;
  btn.innerHTML = DDS_PAGE_MENU._ICONS[iconName] || '';
  btn.addEventListener('click', onClick);
  return btn;
};

DDS_PAGE_MENU._render = function() {
  var list = document.getElementById('dds-page-menu-list');
  if (!list) return;
  list.innerHTML = '';

  var rows = DDS_PAGE_MENU._buildRows();
  var mapCount = rows.filter(function(r) { return r.isMap; }).length;

  rows.forEach(function(row) {
    var el = document.createElement('div');
    el.className = 'dds-page-menu-row' + (row.current ? ' current' : '');

    var check = document.createElement('span');
    check.className = 'dds-page-menu-row-check';
    check.innerHTML = DDS_PAGE_MENU._ICONS.check;
    el.appendChild(check);

    var title = document.createElement('span');
    title.className = 'dds-page-menu-row-title';
    title.textContent = row.title;
    el.appendChild(title);

    el.addEventListener('click', function() {
      DDS_PAGE_MENU.close();
      DDS_WORKBENCH_SHELL.showPage(row.id);
    });

    // Row actions — map pages only (RFC §2 Page Strip: singleton pages
    // are permanent, no Rename/Delete/Move/Duplicate). Reuses the exact
    // handlers the old right-click-only context menu called
    // (DDS_MAP_UI.openRenameModal/duplicateMap/deleteMap) so behavior is
    // unchanged, only the trigger surface and surrounding chrome are new.
    if (row.isMap) {
      var actions = document.createElement('span');
      actions.className = 'dds-page-menu-row-actions';

      actions.appendChild(DDS_PAGE_MENU._actionBtn('pencil', 'Rename', function(e) {
        e.stopPropagation();
        DDS_PAGE_MENU.close();
        if (row.id !== DDS_MAP.state.currentMapId) DDS_MAP_UI.switchMap(row.id);
        DDS_MAP_UI.openRenameModal();
      }));

      actions.appendChild(DDS_PAGE_MENU._actionBtn('copy', 'Duplicate', function(e) {
        e.stopPropagation();
        DDS_PAGE_MENU.close();
        var map = DDS_MAP.state.maps.find(function(m) { return m.id === row.id; });
        if (map) DDS_MAP_UI.duplicateMap(map);
      }));

      var moveBtn = DDS_PAGE_MENU._actionBtn('move', 'Move (not yet implemented — TODO/T-054)', function(e) {
        e.stopPropagation();
      });
      moveBtn.disabled = true;
      actions.appendChild(moveBtn);

      var delBtn = DDS_PAGE_MENU._actionBtn('trash', 'Delete', function(e) {
        e.stopPropagation();
        DDS_PAGE_MENU.close();
        var map = DDS_MAP.state.maps.find(function(m) { return m.id === row.id; });
        if (map) DDS_MAP_UI.deleteMap(map);
      });
      delBtn.classList.add('dds-page-menu-row-danger');
      if (mapCount <= 1) delBtn.disabled = true; // last remaining map — mirrors the old context menu's guard
      actions.appendChild(delBtn);

      el.appendChild(actions);
    }

    list.appendChild(el);
  });
};

// anchorOrEvent: a DOM element (hamburger/chevron — menu opens above it,
// left-aligned to it) or a MouseEvent (right-click — menu opens with its
// bottom-left corner at the click point). Either way the menu opens
// upward (style.bottom, not style.top) since the Page Strip is
// bottom-anchored — the reverse of the Menu bar's downward dropdowns
// (RFC §3 Page Strip Styling).
DDS_PAGE_MENU.open = function(anchorOrEvent) {
  var menu = document.getElementById('dds-page-menu');
  if (!menu) return;

  DDS_PAGE_MENU._render();
  menu.classList.remove('dds-hidden');
  menu.style.top = 'auto';

  var x, yFromBottom;
  if (anchorOrEvent && anchorOrEvent.nodeType === 1) {
    var r = anchorOrEvent.getBoundingClientRect();
    x = r.left;
    yFromBottom = window.innerHeight - r.top;
  } else {
    x = anchorOrEvent.clientX;
    yFromBottom = window.innerHeight - anchorOrEvent.clientY;
  }

  var menuWidth = menu.getBoundingClientRect().width || 240;
  var maxLeft = window.innerWidth - menuWidth - 8;
  menu.style.left = Math.max(8, Math.min(x, maxLeft)) + 'px';
  menu.style.bottom = yFromBottom + 'px';

  // Deferred so the click that opened the menu doesn't immediately
  // trigger the outside-click handler (same pattern as the old
  // per-tab context menu's document click listener).
  setTimeout(function() {
    DDS_PAGE_MENU._outsideClickHandler = function(e) {
      if (!menu.contains(e.target)) DDS_PAGE_MENU.close();
    };
    document.addEventListener('click', DDS_PAGE_MENU._outsideClickHandler);
    document.addEventListener('keydown', DDS_PAGE_MENU._escHandler);
  }, 0);
};

DDS_PAGE_MENU._escHandler = function(e) {
  if (e.key === 'Escape') DDS_PAGE_MENU.close();
};

DDS_PAGE_MENU.close = function() {
  var menu = document.getElementById('dds-page-menu');
  if (!menu) return;
  menu.classList.add('dds-hidden');
  if (DDS_PAGE_MENU._outsideClickHandler) {
    document.removeEventListener('click', DDS_PAGE_MENU._outsideClickHandler);
    DDS_PAGE_MENU._outsideClickHandler = null;
  }
  document.removeEventListener('keydown', DDS_PAGE_MENU._escHandler);
};

// Insert Page — wired once at boot (not per-open); same handler as the
// standalone "+" button (DDS_MAP_UI.createMap, wired separately in
// DDS_MAP_UI.bindEvents).
DDS_PAGE_MENU.bindEvents = function() {
  var insertBtn = document.getElementById('dds-page-menu-insert');
  if (insertBtn) insertBtn.addEventListener('click', function() {
    DDS_PAGE_MENU.close();
    DDS_MAP_UI.createMap();
  });
};
