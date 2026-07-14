// ============================================================
// DDS_TYPES_UI — Types Toolbox (rail-opened palette + search/create)
// (framework-2 / framework-3 only — see DDS_WORKBENCH_SHELL.js and
// docs/DDScope_Plugin_UI_RFC.md §4 Migration Path, step 3.)
//
// Second registerToolbox/registerView call after DDS_AI_UI's pilot (step 1)
// — proves the IWorkbenchShell contract generalizes beyond the AI panel,
// and is the first call site to do real content mounting via mountFn (the
// AI panel's DOM was already static — see DDS_WORKBENCH_SHELL.js header).
//
// Replaces the map toolbar's `+ Swim-lane` / `+ Node` / `+ Product` buttons
// (RFC §4 Current Toolbar Remapping) with:
//   — a Palette (one draggable chip per node type / product type / existing
//     swim-lane — RFC §4 Types Toolbox). Dragging a chip onto the canvas
//     creates the instance and places it at the drop point; double-click is
//     the no-drag fallback, using DDS_LAYOUT.placeNode's guessed position
//     (same as the old modals).
//   — a Search zone that reuses the existing search/create modals verbatim
//     (DDS_NODE_UI.openModal / openAddProductModal, DDS_LANE_UI.openModal)
//     rather than re-implementing their dropdown logic inline — pragmatic
//     scope cut for this pass, flagged in J-038.
//
// Drop-position support required extending TX.NODE_CREATE, TX.LANE_CREATE,
// TX.MAP_ADD_LANE, TX.MAP_ADD_PRODUCT_NODE with an optional params.position
// override (see src/core/DDS_CMD.js, same date) — additive, existing call
// sites unaffected.
// ============================================================

var DDS_TYPES_UI = {};

DDS_TYPES_UI._open = false;

// ===== Open/close (routed through the shell, mirrors DDS_AI_UI) =====

DDS_TYPES_UI._notifyCytoscape = function() {
  setTimeout(function() {
    if (window.DDS_CY && typeof DDS_CY.resize === 'function') DDS_CY.resize();
  }, 240);
};

DDS_TYPES_UI._applyOpen = function() {
  if (DDS_TYPES_UI._open) return;
  DDS_TYPES_UI._open = true;
  // Width + .open class are shell-owned (DDS_WORKBENCH_SHELL._showToolbox,
  // panelId 'dds-types-panel') — shared across every toolbox panel, VSCode
  // Activity-Bar style, resize persisted via DDS_SETTINGS (2026-07-14
  // feedback, RFC §5 Decisions). Nothing to do here for width.
  DDS_TYPES_UI._renderPalette();
  DDS_TYPES_UI._notifyCytoscape();
};

DDS_TYPES_UI._applyClose = function() {
  if (!DDS_TYPES_UI._open) return;
  DDS_TYPES_UI._open = false;
  DDS_TYPES_UI._notifyCytoscape();
};

DDS_TYPES_UI._registerWorkbench = function() {
  if (typeof DDS_WORKBENCH_SHELL === 'undefined') return;
  DDS_WORKBENCH_SHELL.registerToolbox({
    id: 'types',
    icon: '&#127912;',
    title: 'Types',
    panelId: 'dds-types-panel',
    onShow: DDS_TYPES_UI._applyOpen,
    onHide: DDS_TYPES_UI._applyClose
  });
  DDS_WORKBENCH_SHELL.registerView({ id: 'types-main', toolboxId: 'types', title: 'Types', order: 0 }, function() {
    // Palette content is data-dependent (node/product types, swim-lanes) —
    // rendered on each open (_applyOpen), not once at registration time,
    // so it reflects the currently open project. Nothing to mount here.
  });
};

DDS_TYPES_UI.open = function() {
  if (typeof DDS_WORKBENCH_SHELL === 'undefined') { DDS_TYPES_UI._applyOpen(); return; }
  DDS_WORKBENCH_SHELL.showView('types-main');
};

DDS_TYPES_UI.close = function() {
  if (typeof DDS_WORKBENCH_SHELL === 'undefined') { DDS_TYPES_UI._applyClose(); return; }
  DDS_WORKBENCH_SHELL.hideView('types-main');
};

DDS_TYPES_UI.toggle = function() {
  if (typeof DDS_WORKBENCH_SHELL === 'undefined') {
    if (DDS_TYPES_UI._open) DDS_TYPES_UI._applyClose(); else DDS_TYPES_UI._applyOpen();
    return;
  }
  DDS_WORKBENCH_SHELL.toggleToolbox('types');
};

// Re-render the palette if the toolbox happens to already be open — called
// by DDS.openProject (src/presentation/DDS.js) so a toolbox left open on the
// empty state (no project) picks up the newly loaded types/lanes without
// requiring a close/reopen (2026-07-14 feedback). No-op when closed, since
// _applyOpen already renders fresh content on the next open.
DDS_TYPES_UI.refresh = function() {
  if (!DDS_TYPES_UI._open) return;
  DDS_TYPES_UI._renderPalette();
};

// ===== Palette rendering =====

DDS_TYPES_UI._buildChip = function(label, color) {
  var chip = document.createElement('div');
  chip.className = 'dds-types-chip';
  if (color) chip.style.borderLeftColor = color;
  chip.textContent = label;
  return chip;
};

DDS_TYPES_UI._renderPalette = function() {
  DDS_TYPES_UI._renderNodeTypes();
  DDS_TYPES_UI._renderProductTypes();
  DDS_TYPES_UI._renderLanes();
};

DDS_TYPES_UI._renderNodeTypes = function() {
  var wrap = document.getElementById('dds-types-palette-nodetype');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!DDS_STORE.getProject()) { wrap.innerHTML = '<div class="dds-types-empty">No project open.</div>'; return; }
  var types = DDS_STORE.query('node_types');
  if (types.length === 0) { wrap.innerHTML = '<div class="dds-types-empty">None configured.</div>'; return; }
  types.forEach(function(t) {
    var chip = DDS_TYPES_UI._buildChip(t.label || t.code, t.color);
    chip.draggable = true;
    chip.title = 'Drag onto the map, or double-click to add';
    chip.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/x-dds-type', JSON.stringify({ kind: 'nodetype', code: t.code }));
      e.dataTransfer.effectAllowed = 'copy';
    });
    chip.addEventListener('dblclick', function() { DDS_TYPES_UI._createNode(t.code, null); });
    wrap.appendChild(chip);
  });
};

DDS_TYPES_UI._renderProductTypes = function() {
  var wrap = document.getElementById('dds-types-palette-prodtype');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!DDS_STORE.getProject()) { wrap.innerHTML = '<div class="dds-types-empty">No project open.</div>'; return; }
  var types = DDS_STORE.query('product_types');
  if (types.length === 0) { wrap.innerHTML = '<div class="dds-types-empty">None configured.</div>'; return; }
  types.forEach(function(t) {
    var chip = DDS_TYPES_UI._buildChip(t.label || t.code, t.color);
    chip.draggable = true;
    chip.title = 'Drag onto the map, or double-click to add';
    chip.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/x-dds-type', JSON.stringify({ kind: 'prodtype', code: t.code }));
      e.dataTransfer.effectAllowed = 'copy';
    });
    chip.addEventListener('dblclick', function() { DDS_TYPES_UI._createProduct(t.code, null); });
    wrap.appendChild(chip);
  });
};

DDS_TYPES_UI._renderLanes = function() {
  var wrap = document.getElementById('dds-types-palette-lane');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!DDS_STORE.getProject()) { wrap.innerHTML = '<div class="dds-types-empty">No project open.</div>'; return; }
  var lanes = DDS_STORE.query('swim_lanes');
  if (lanes.length === 0) { wrap.innerHTML = '<div class="dds-types-empty">None configured.</div>'; return; }
  var mapId = DDS_MAP.state.currentMapId;
  var onMapIds = mapId
    ? DDS_STORE.query('map_swim_lanes', { map_id: mapId }).map(function(r) { return r.swim_lane_id; })
    : [];
  lanes.forEach(function(l) {
    var onMap = onMapIds.indexOf(l.id) !== -1;
    var chip = DDS_TYPES_UI._buildChip(l.name, l.color);
    if (onMap) {
      chip.classList.add('dds-types-chip-onmap');
      chip.title = l.name + ' (on map)';
    } else {
      chip.draggable = true;
      chip.title = 'Drag onto the map, or double-click to add';
      chip.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('application/x-dds-type', JSON.stringify({ kind: 'lane', id: l.id }));
        e.dataTransfer.effectAllowed = 'copy';
      });
      chip.addEventListener('dblclick', function() { DDS_TYPES_UI._addLane(l.id, null); });
    }
    wrap.appendChild(chip);
  });
};

// ===== Canvas drop target =====

// Screen (clientX/clientY) -> Cytoscape model coordinates. Standard
// cytoscape transform: renderedPosition = modelPosition * zoom + pan, so
// modelPosition = (renderedPosition - pan) / zoom. renderedPosition here is
// the drop point relative to the #dds-cy container's own top-left corner.
DDS_TYPES_UI._screenToModel = function(clientX, clientY) {
  var container = document.getElementById('dds-cy');
  var rect = container.getBoundingClientRect();
  var pan  = DDS_CY.pan();
  var zoom = DDS_CY.zoom();
  return {
    x: Math.round((clientX - rect.left - pan.x) / zoom),
    y: Math.round((clientY - rect.top  - pan.y) / zoom)
  };
};

DDS_TYPES_UI._initDrop = function() {
  var wrap = document.getElementById('dds-canvas-wrap');
  if (!wrap) return;

  wrap.addEventListener('dragover', function(e) {
    if (!e.dataTransfer.types || e.dataTransfer.types.indexOf('application/x-dds-type') === -1) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  wrap.addEventListener('drop', function(e) {
    var raw = e.dataTransfer.getData('application/x-dds-type');
    if (!raw) return;
    e.preventDefault();
    if (!DDS_STORE.getProject() || !DDS_MAP.state.currentMapId || !window.DDS_CY) return;
    var payload;
    try { payload = JSON.parse(raw); } catch (err) { return; }
    var pos = DDS_TYPES_UI._screenToModel(e.clientX, e.clientY);
    if (payload.kind === 'nodetype')      DDS_TYPES_UI._createNode(payload.code, pos);
    else if (payload.kind === 'prodtype') DDS_TYPES_UI._createProduct(payload.code, pos);
    else if (payload.kind === 'lane')     DDS_TYPES_UI._addLane(payload.id, pos);
  });
};

// ===== Create/add actions — mirror DDS_NODE_UI / DDS_LANE_UI onSuccess handling =====

DDS_TYPES_UI._createNode = function(typeCode, pos) {
  if (!DDS_STORE.getProject() || !DDS_MAP.state.currentMapId) return;
  var mapId = DDS_MAP.state.currentMapId;
  var type  = DDS_STORE.query('node_types', { code: typeCode })[0] || null;
  var name  = type ? (type.label || type.code) : 'New node';
  var params = {
    name: name,
    type_code: typeCode,
    swim_lane_id: type ? (type.default_swim_lane_id || null) : null
  };
  if (pos) params.position = pos;
  var result = DDS_CMD.execute(TX.NODE_CREATE, params, mapId, function(cmdResult) {
    var newEl = DDS_CY.add({ group: 'nodes', data: {
      id: 'n' + cmdResult.nodeId, nodeId: cmdResult.nodeId, mapNodeId: cmdResult.mapNodeId,
      label: name, shape: DDS_MAP.getShape(typeCode), typeCode: typeCode
    }, position: { x: cmdResult.x, y: cmdResult.y } });
    var emptyEl = document.getElementById('dds-map-empty');
    if (emptyEl) emptyEl.classList.add('dds-hidden');
    DDS_MAP.applyNodeColors();
    DDS_MAP.triggerAutoLayout();
    // Drag-drop creation (pos given) selects the new element by default
    // so the side panel opens straight into it (T-052 step 4 feedback) —
    // the double-click fallback (pos null) leaves selection untouched.
    // Clear any prior selection first so this stays a single selection
    // (DDS_PANEL._wireCy treats 2+ selected elements as a multi-selection).
    if (pos) { DDS_CY.elements().unselect(); newEl.select(); }
  });
  if (!result.ok) console.error('[DDS] Types Toolbox: create node failed');
};

DDS_TYPES_UI._createProduct = function(typeCode, pos) {
  if (!DDS_STORE.getProject() || !DDS_MAP.state.currentMapId) return;
  var mapId = DDS_MAP.state.currentMapId;
  var prodType = DDS_STORE.query('product_types', { code: typeCode })[0] || null;
  // Default swim-lane: same resolution as the old +Product modal
  // (DDS_NODE_UI.openAddProductModal) — the product-node-default node
  // type's default lane, falling back to the default/first node type.
  var nodeTypes = DDS_STORE.query('node_types');
  var productNodeType = nodeTypes.find(function(t) { return t.is_product_node_default; })
    || nodeTypes.find(function(t) { return t.is_default; })
    || nodeTypes[0] || null;
  var defaultLaneId = productNodeType ? (productNodeType.default_swim_lane_id || null) : null;
  var params = {
    product_name: 'New ' + (prodType ? (prodType.label || prodType.code) : 'product'),
    product_type_code: typeCode,
    swim_lane_id: defaultLaneId
  };
  if (pos) params.position = pos;
  var result = DDS_CMD.execute(TX.MAP_ADD_PRODUCT_NODE, params, mapId, function(cmdResult) {
    var newEl = DDS_CY.add({ group: 'nodes', data: {
      id: 'n' + cmdResult.nodeId, nodeId: cmdResult.nodeId, mapNodeId: cmdResult.mapNodeId,
      label: cmdResult.name, shape: DDS_MAP.getShape(cmdResult.typeCode), typeCode: cmdResult.typeCode
    }, position: { x: cmdResult.x, y: cmdResult.y } });
    var emptyEl = document.getElementById('dds-map-empty');
    if (emptyEl) emptyEl.classList.add('dds-hidden');
    DDS_MAP.applyNodeColors();
    DDS_MAP.triggerAutoLayout();
    // Drag-drop creation (pos given) selects the new element by default —
    // see _createNode above.
    if (pos) { DDS_CY.elements().unselect(); newEl.select(); }
  });
  if (!result.ok) console.error('[DDS] Types Toolbox: create product failed');
};

DDS_TYPES_UI._addLane = function(laneId, pos) {
  if (!DDS_STORE.getProject() || !DDS_MAP.state.currentMapId) return;
  var mapId = DDS_MAP.state.currentMapId;
  var params = { swim_lane_id: laneId };
  if (pos) params.position = pos;
  var result = DDS_CMD.execute(TX.MAP_ADD_LANE, params, mapId, function() {
    DDS_MAP.loadMap(mapId, true);
    if (typeof DDS_SWIMLANES !== 'undefined') DDS_SWIMLANES.render();
    // Drag-drop creation (pos given) opens the new lane in the side panel
    // by default — a lane isn't a Cytoscape element, so this is the
    // equivalent of newEl.select() in _createNode/_createProduct above.
    // Clear any cy selection too, so a previously-selected node/flow isn't
    // left highlighted on canvas while the panel shows the new lane.
    if (pos && window.DDS_PANEL) {
      if (window.DDS_CY) DDS_CY.elements().unselect();
      DDS_PANEL.openLane(laneId);
    }
  });
  if (!result.ok) { console.error('[DDS] Types Toolbox: add lane failed'); return; }
  DDS_TYPES_UI._renderLanes(); // refresh on-map graying
};

// ===== Search zone — reuses the existing search/create modals verbatim =====

DDS_TYPES_UI.bindEvents = function() {
  DDS_TYPES_UI._registerWorkbench();
  DDS_TYPES_UI._initDrop();
  if (typeof DDS_WORKBENCH_SHELL !== 'undefined' && typeof DDS_WORKBENCH_SHELL.initResizeHandle === 'function') {
    DDS_WORKBENCH_SHELL.initResizeHandle('dds-types-resize-handle', 'dds-types-panel');
  }

  var btnNode = document.getElementById('dds-types-search-node');
  if (btnNode) btnNode.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_NODE_UI.openModal();
  });

  var btnProduct = document.getElementById('dds-types-search-product');
  if (btnProduct) btnProduct.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_NODE_UI.openAddProductModal();
  });

  var btnLane = document.getElementById('dds-types-search-lane');
  if (btnLane) btnLane.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_LANE_UI.openModal();
  });
};
