// ============================================================
// DDS_WORKBENCH_SHELL — IWorkbenchShell, v1 pilot implementation
// (framework-2 / local runner only — see
// docs/DDScope_Plugin_UI_RFC.md §4 Migration Path, step 1).
//
// Contract for v1: registerToolbox(descriptor), registerView(descriptor,
// mountFn), showView(id), hideView(id), plus registerPage(descriptor,
// mountFn), showPage(id), closePage(id) for the Page Strip (RFC §4
// Migration Path step 5).
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
// A page is one entry in the full-width Page Strip (#dds-page-strip, at
// the very bottom of #dds-app — see RFC §2/§4 Page Strip). Two kinds:
// 'singleton' (permanent, never closable — Configuration/Nodes/Flows/
// Products/BOMs/Demand) and 'map' (multi-instance, closable/renamable —
// see DDS_MAP_UI). Same registration shape as toolbox/view, just a
// different container: registerPage's optional contentId gets its
// visibility toggled by the shell directly (mirrors registerToolbox's
// panelId), while onShow/onHide stay responsible for everything else
// (e.g. a map page's onShow triggers DDS_MAP.loadMap). This pass (T-052
// step 5, first lot) only builds the API + the empty strip container —
// no call site registers a page yet; that migration (six singleton
// pages + the map "+"/rename/duplicate/delete flow, replacing the
// temporary #dds-view-tabs-row and .dds-map-toolbar) is the next lot.
//
// framework-1 (CommWise) is not wired to this module (out of scope) —
// every method no-ops safely when the relevant DOM root (#dds-rail,
// #dds-page-strip) is absent, so loading this file elsewhere does not
// throw.
// ============================================================

var DDS_WORKBENCH_SHELL = {
  _toolboxes: {},   // id -> { id, icon, title, panelId, onShow, onHide, views: [] }
  _views: {},       // id -> { id, toolboxId, title, order }
  _openToolboxId: null,
  _pages: {},        // id -> { id, title, kind, contentId, closable, onShow, onHide }
  _activePageId: null
};

// ---------------------------------------------------------------------------
// Shared panel width — VSCode Activity-Bar style: every toolbox panel shares
// one width (not each toolbox owning its own), and a user resize persists
// across sessions via DDS_SETTINGS (key: workbench_panel_width). Decided
// 2026-07-14 (RFC §5 Decisions) after step 3 (Types Toolbox) shipped with a
// second, independently-fixed panel width, prompting the "why are these
// different" feedback. Lazily read from DDS_SETTINGS on first use — by the
// time a toolbox is first shown, DDS_INIT's boot() has already awaited
// DDS_SETTINGS.ready(), so the cache is populated.
// ---------------------------------------------------------------------------

DDS_WORKBENCH_SHELL._MIN_WIDTH = 280;
DDS_WORKBENCH_SHELL._MAX_WIDTH = 700;
DDS_WORKBENCH_SHELL._DEFAULT_WIDTH = 380;
DDS_WORKBENCH_SHELL._panelWidth = null;

DDS_WORKBENCH_SHELL._getPanelWidth = function() {
  if (DDS_WORKBENCH_SHELL._panelWidth !== null) return DDS_WORKBENCH_SHELL._panelWidth;
  var stored = window.DDS_SETTINGS ? DDS_SETTINGS.get('workbench_panel_width') : null;
  var n = stored ? parseInt(stored, 10) : NaN;
  DDS_WORKBENCH_SHELL._panelWidth = (n && n >= DDS_WORKBENCH_SHELL._MIN_WIDTH && n <= DDS_WORKBENCH_SHELL._MAX_WIDTH)
    ? n : DDS_WORKBENCH_SHELL._DEFAULT_WIDTH;
  return DDS_WORKBENCH_SHELL._panelWidth;
};

DDS_WORKBENCH_SHELL._setPanelWidth = function(px) {
  px = Math.max(DDS_WORKBENCH_SHELL._MIN_WIDTH, Math.min(DDS_WORKBENCH_SHELL._MAX_WIDTH, Math.round(px)));
  DDS_WORKBENCH_SHELL._panelWidth = px;
  if (DDS_WORKBENCH_SHELL._openToolboxId) {
    var toolbox = DDS_WORKBENCH_SHELL._toolboxes[DDS_WORKBENCH_SHELL._openToolboxId];
    if (toolbox && toolbox.panelId) {
      var openPanel = document.getElementById(toolbox.panelId);
      if (openPanel) openPanel.style.width = px + 'px';
    }
  }
  if (window.DDS_SETTINGS) DDS_SETTINGS.set('workbench_panel_width', String(px));
};

// Wires a drag handle to resize its panel — the shared width, applied
// immediately during the drag and persisted (DDS_SETTINGS) on mouseup. Call
// once per panel, from the toolbox module's bindEvents (mirrors the old
// per-panel DDS_AI_UI._initResize, now generalized here so every toolbox
// panel resizes the same shared width instead of its own).
DDS_WORKBENCH_SHELL.initResizeHandle = function(handleId, panelId) {
  var handle = document.getElementById(handleId);
  var panel  = document.getElementById(panelId);
  if (!handle || !panel) return;
  var dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', function(e) {
    if (!panel.classList.contains('open')) return;
    dragging = true; startX = e.clientX; startW = panel.offsetWidth;
    handle.classList.add('dragging');
    panel.style.transition = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var newW = Math.max(DDS_WORKBENCH_SHELL._MIN_WIDTH, Math.min(DDS_WORKBENCH_SHELL._MAX_WIDTH, startW + (e.clientX - startX)));
    panel.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    DDS_WORKBENCH_SHELL._setPanelWidth(panel.offsetWidth);
    panel.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (window.DDS_CY && typeof DDS_CY.resize === 'function') DDS_CY.resize();
  });
};

// Register a toolbox — creates its rail icon (if #dds-rail exists in the
// current framework's DOM) and wires the click-to-toggle behavior.
// descriptor: { id, icon, title, panelId?, onShow, onHide }
// panelId, when given, is the toolbox's panel element id — the shell then
// owns that panel's width/.open class directly (shared width, see above);
// onShow/onHide stay responsible for everything else (height, canvas
// resize notification, legacy-button mirroring, content refresh).
DDS_WORKBENCH_SHELL.registerToolbox = function(descriptor) {
  var id = descriptor.id;
  DDS_WORKBENCH_SHELL._toolboxes[id] = {
    id: id,
    icon: descriptor.icon,
    title: descriptor.title,
    panelId: descriptor.panelId || null,
    onShow: descriptor.onShow || function() {},
    onHide: descriptor.onHide || function() {},
    views: []
  };

  var rail = document.getElementById('dds-rail');
  if (!rail) return; // no rail in this framework's DOM yet — no-op

  // The rail icon is always visible, regardless of project state (2026-07-14
  // feedback) — a toolbox's own content is responsible for guarding against
  // "no project open" if it needs to (see DDS_AI_UI.send()). setToolboxEnabled
  // remains available for a future toolbox that genuinely needs to gate itself.
  var btn = document.createElement('button');
  btn.className = 'dds-rail-icon';
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
  if (toolbox.panelId) {
    var panel = document.getElementById(toolbox.panelId);
    if (panel) { panel.classList.add('open'); panel.style.width = DDS_WORKBENCH_SHELL._getPanelWidth() + 'px'; }
  }
  toolbox.onShow();
  var btn = document.getElementById('dds-rail-' + id);
  if (btn) btn.classList.add('active');
};

DDS_WORKBENCH_SHELL._hideToolbox = function(id) {
  var toolbox = DDS_WORKBENCH_SHELL._toolboxes[id];
  if (!toolbox) return;
  if (DDS_WORKBENCH_SHELL._openToolboxId === id) DDS_WORKBENCH_SHELL._openToolboxId = null;
  if (toolbox.panelId) {
    var panel = document.getElementById(toolbox.panelId);
    if (panel) { panel.classList.remove('open'); panel.style.width = '0'; }
  }
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

// ---------------------------------------------------------------------------
// Page Strip — registerPage/showPage/closePage/setPageTitle (RFC §4
// Migration Path step 5). No call site uses these yet in this pass — see
// file header note. Mirrors registerToolbox/registerView: a page's
// optional contentId is shown/hidden by the shell directly (like a
// toolbox's panelId), onShow/onHide own everything else.
// ---------------------------------------------------------------------------

// Register a page — creates its Page Strip tab (if #dds-page-strip exists
// in the current framework's DOM) and wires click-to-activate.
// descriptor: { id, title, kind: 'singleton'|'map', contentId?, closable?,
// onShow?, onHide? }. closable defaults to true for kind 'map', false for
// 'singleton' (singleton pages are permanent — RFC §2 Page Strip).
DDS_WORKBENCH_SHELL.registerPage = function(descriptor, mountFn) {
  var id = descriptor.id;
  var kind = descriptor.kind || 'map';
  DDS_WORKBENCH_SHELL._pages[id] = {
    id: id,
    title: descriptor.title || '',
    kind: kind,
    contentId: descriptor.contentId || null,
    closable: (descriptor.closable !== undefined) ? !!descriptor.closable : (kind === 'map'),
    onShow: descriptor.onShow || function() {},
    onHide: descriptor.onHide || function() {}
  };

  var strip = document.getElementById('dds-page-strip-tabs');
  if (strip) {
    var tab = document.createElement('button');
    tab.className = 'dds-page-tab';
    tab.id = 'dds-page-tab-' + id;
    tab.type = 'button';
    tab.title = descriptor.title || '';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'dds-page-tab-title';
    nameSpan.textContent = descriptor.title || '';
    tab.appendChild(nameSpan);

    // Chevron — always present, CSS-gated to the active tab only (RFC
    // §3 Visual Style Guide/Page Strip Styling, TODO/T-054). Opens the
    // shared Page menu (src/ui/DDS_PAGE_MENU.js); stopPropagation so the
    // click doesn't also fire the tab's own showPage handler below.
    var chevron = document.createElement('span');
    chevron.className = 'dds-page-tab-chevron';
    chevron.title = 'Pages menu';
    chevron.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
    chevron.addEventListener('click', function(e) {
      e.stopPropagation();
      if (window.DDS_PAGE_MENU) DDS_PAGE_MENU.open(chevron);
    });
    tab.appendChild(chevron);

    tab.addEventListener('click', function() { DDS_WORKBENCH_SHELL.showPage(id); });
    strip.appendChild(tab);
  }

  if (typeof mountFn === 'function') mountFn();
};

// Activate a page: updates the active tab, shows/hides contentId (if
// given), and calls the outgoing/incoming pages' onHide/onShow — mirrors
// _showToolbox/_hideToolbox's "single thing active at a time" state, but
// for the Page Strip (always exactly one active page, never none, once
// at least one page is registered).
DDS_WORKBENCH_SHELL.showPage = function(id) {
  var page = DDS_WORKBENCH_SHELL._pages[id];
  if (!page) return;

  if (DDS_WORKBENCH_SHELL._activePageId && DDS_WORKBENCH_SHELL._activePageId !== id) {
    var prev = DDS_WORKBENCH_SHELL._pages[DDS_WORKBENCH_SHELL._activePageId];
    if (prev) {
      var prevTab = document.getElementById('dds-page-tab-' + prev.id);
      if (prevTab) prevTab.classList.remove('active');
      if (prev.contentId) {
        var prevContent = document.getElementById(prev.contentId);
        if (prevContent) prevContent.classList.remove('active');
      }
      prev.onHide();
    }
  }

  DDS_WORKBENCH_SHELL._activePageId = id;
  var tab = document.getElementById('dds-page-tab-' + id);
  if (tab) tab.classList.add('active');
  if (page.contentId) {
    var content = document.getElementById(page.contentId);
    if (content) content.classList.add('active');
  }
  page.onShow();
};

// Close (unregister) a page — removes its tab and calls onHide if it was
// the active page. No-op for non-closable pages (singleton pages, or a
// map descriptor explicitly registered with closable:false) — logs a
// warning rather than silently ignoring a caller mistake. The caller
// (DDS_MAP_UI, for map pages) stays responsible for picking and showing
// a replacement active page afterward, same as DDS_MAP_UI.deleteMap
// already does today for the map selector.
DDS_WORKBENCH_SHELL.closePage = function(id) {
  var page = DDS_WORKBENCH_SHELL._pages[id];
  if (!page) return;
  if (!page.closable) {
    console.warn('[DDS_WORKBENCH_SHELL] closePage: page "' + id + '" is not closable');
    return;
  }

  var tab = document.getElementById('dds-page-tab-' + id);
  if (tab && tab.parentNode) tab.parentNode.removeChild(tab);

  if (DDS_WORKBENCH_SHELL._activePageId === id) {
    DDS_WORKBENCH_SHELL._activePageId = null;
    page.onHide();
  }
  delete DDS_WORKBENCH_SHELL._pages[id];
};

// Hide whichever page is currently active, regardless of its closable
// flag — unlike closePage, this does NOT unregister the page (singleton
// pages stay registered, they're permanent) and works even when the
// active page isn't closable. Used by DDS.closeProject (2026-07-15,
// ISS-022) to guarantee the Page Strip never keeps showing stale content
// from a closed project, whether the page active at close time was a
// map (dynamic) page or a singleton (static) one — closeAllMapPages
// alone only ever touched map pages. No-op if no page is active.
DDS_WORKBENCH_SHELL.clearActivePage = function() {
  var id = DDS_WORKBENCH_SHELL._activePageId;
  if (!id) return;
  var page = DDS_WORKBENCH_SHELL._pages[id];
  DDS_WORKBENCH_SHELL._activePageId = null;
  if (!page) return;
  var tab = document.getElementById('dds-page-tab-' + id);
  if (tab) tab.classList.remove('active');
  if (page.contentId) {
    var content = document.getElementById(page.contentId);
    if (content) content.classList.remove('active');
  }
  page.onHide();
};

// Rename a page's tab label in place (map pages only, in practice — see
// DDS_MAP_UI's rename flow). No-op if the page isn't registered.
DDS_WORKBENCH_SHELL.setPageTitle = function(id, title) {
  var page = DDS_WORKBENCH_SHELL._pages[id];
  if (!page) return;
  page.title = title;
  var tab = document.getElementById('dds-page-tab-' + id);
  if (!tab) return;
  var nameSpan = tab.querySelector('.dds-page-tab-title');
  if (nameSpan) nameSpan.textContent = title;
  tab.title = title;
};
