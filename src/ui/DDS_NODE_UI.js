// ============================================================
// DDS_NODE_UI — node search/create modal (map toolbar) + canvas add
//
// T-036 part 1: the map `+ Node` modal is a combined create-and-add-to-map
// mechanism. The name field is a search/create input (same pattern as the
// `+ Product` modal _apmOnInput dropdown):
//   — existing node already on active map → shown grayed "(on map)", not
//     selectable;
//   — existing node not on active map → place it via TX.MAP_ADD_NODE
//     (undoable — the Elements panel bypassed the command layer);
//   — no exact match → `+ Create "[name]"` → TX.NODE_CREATE with mapId;
//     type and swim-lane fields shown only in the create case.
// Exact-name matches suppress the create entry — duplicate node names are
// avoided by construction.
//
// ID NAMESPACE: this injected modal uses `dds-map-node-*` ids — distinct
// from the static `dds-modal-node-*` / `dds-node-*` modal in
// fragments/app-shell.html owned by DDS_NODES_UI (table view). The previous
// version injected under the SAME ids, destroying the static modal and its
// bindings on first use of the map `+ Node` button (pre-existing collision,
// fixed with the T-036 rework).
// ============================================================

var DDS_NODE_UI = {};

// { id: int, name } existing node (not on map) | { id: null, name } create | null
DDS_NODE_UI._selectedNode = null;

DDS_NODE_UI.injectModal = function() {
  var existing = document.getElementById('dds-map-node-overlay');
  if (existing) existing.parentNode.removeChild(existing);
  var html = [
    '<div class="dds-overlay dds-hidden" id="dds-map-node-overlay">',
    '  <div class="dds-modal" style="max-width:420px">',
    '    <div class="dds-modal-header">',
    '      <span class="dds-modal-title">Add node</span>',
    '      <button class="dds-btn dds-modal-close" id="dds-map-node-close">&times;</button>',
    '    </div>',
    '    <div class="dds-modal-body">',
    '      <div class="dds-field" style="position:relative">',
    '        <label class="dds-label" for="dds-map-node-input">Node *</label>',
    '        <input class="dds-input" id="dds-map-node-input" type="text" placeholder="Search or create..." autocomplete="off" />',
    '        <div id="dds-map-node-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--dds-border-light,#e2e8f0);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:9999;max-height:200px;overflow-y:auto"></div>',
    '      </div>',
    '      <div class="dds-field dds-hidden" id="dds-map-node-type-field"><label class="dds-label" for="dds-map-node-type">Type</label>',
    '        <select class="dds-select" id="dds-map-node-type"></select></div>',
    '      <div class="dds-field dds-hidden" id="dds-map-node-lane-field"><label class="dds-label" for="dds-map-node-lane">Swim-lane</label>',
    '        <select class="dds-select" id="dds-map-node-lane"></select></div>',
    '    </div>',
    '    <div class="dds-modal-footer">',
    '      <button class="dds-btn dds-btn-secondary" id="dds-map-node-cancel">Cancel</button>',
    '      <button class="dds-btn dds-btn-secondary" id="dds-map-node-save" disabled>Save</button>',
    '      <button class="dds-btn dds-btn-primary" id="dds-map-node-save-close" disabled>Save &amp; Close</button>',
    '    </div></div></div>'
  ].join('\n');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  document.body.appendChild(tmp.firstElementChild);

  document.getElementById('dds-map-node-close').addEventListener('click', function() { DDS_NODE_UI.closeModal(); });
  document.getElementById('dds-map-node-cancel').addEventListener('click', function() { DDS_NODE_UI.closeModal(); });
  document.getElementById('dds-map-node-save').addEventListener('click', function() { DDS_NODE_UI._doSave(false); });
  document.getElementById('dds-map-node-save-close').addEventListener('click', function() { DDS_NODE_UI._doSave(true); });
  document.getElementById('dds-map-node-overlay').addEventListener('click', function(e) {
    if (e.target === this) DDS_NODE_UI.closeModal();
  });
  // Enter = Save & Close
  document.getElementById('dds-map-node-overlay').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = document.getElementById('dds-map-node-save-close');
      if (btn && !btn.disabled) { e.preventDefault(); DDS_NODE_UI._doSave(true); }
    }
  });
};

DDS_NODE_UI.openModal = function() {
  DDS_NODE_UI.injectModal();
  DDS_NODE_UI._selectedNode = null;

  var typeEl = document.getElementById('dds-map-node-type');
  typeEl.innerHTML = '<option value="">— no type —</option>';
  var types = DDS_STORE.query('node_types');
  var defaultType = types.find(function(t) { return t.is_default; }) || types[0];
  types.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.code;
    opt.textContent = t.label || t.code;
    if (defaultType && t.code === defaultType.code) opt.selected = true;
    typeEl.appendChild(opt);
  });

  var laneEl = document.getElementById('dds-map-node-lane');
  var lanes = DDS_STORE.query('swim_lanes');
  function _populateLanes(preselectedId) {
    laneEl.innerHTML = '<option value="">— no swim-lane —</option>';
    lanes.forEach(function(sl) {
      var opt = document.createElement('option');
      opt.value = sl.id;
      opt.textContent = sl.name || ('Lane ' + sl.id);
      if (preselectedId && sl.id === preselectedId) opt.selected = true;
      laneEl.appendChild(opt);
    });
  }
  var initialDefaultLaneId = null;
  if (defaultType && defaultType.default_swim_lane_id) {
    initialDefaultLaneId = defaultType.default_swim_lane_id;
  }
  _populateLanes(initialDefaultLaneId);
  typeEl.addEventListener('change', function() {
    var selectedType = types.find(function(t) { return t.code === typeEl.value; });
    _populateLanes(selectedType ? (selectedType.default_swim_lane_id || null) : null);
  });

  // Create-only fields hidden until the create entry is selected
  document.getElementById('dds-map-node-type-field').classList.add('dds-hidden');
  document.getElementById('dds-map-node-lane-field').classList.add('dds-hidden');

  var input = document.getElementById('dds-map-node-input');
  input.value = '';
  DDS_NODE_UI._setButtons(null);
  DDS_NODE_UI._hideDropdown();

  input.oninput = function() { DDS_NODE_UI._onInput(this.value); };
  input.onblur  = function() { setTimeout(DDS_NODE_UI._hideDropdown, 150); };

  var overlay = document.getElementById('dds-map-node-overlay');
  overlay.classList.remove('dds-hidden');
  void overlay.offsetWidth;
  overlay.classList.add('visible');
  input.focus();
};

// Set save-button labels and enabled state from the current selection.
// sel: null (nothing selected) | { id: int } (existing → "Add to map") |
//      { id: null } (create → "Save").
DDS_NODE_UI._setButtons = function(sel) {
  var saveBtn      = document.getElementById('dds-map-node-save');
  var saveCloseBtn = document.getElementById('dds-map-node-save-close');
  var disabled = !sel;
  saveBtn.disabled = disabled;
  saveCloseBtn.disabled = disabled;
  if (sel && sel.id !== null) {
    saveBtn.textContent = 'Add to map';
    saveCloseBtn.innerHTML = 'Add &amp; Close';
  } else {
    saveBtn.textContent = 'Save';
    saveCloseBtn.innerHTML = 'Save &amp; Close';
  }
};

DDS_NODE_UI._onInput = function(val) {
  val = val.trim();
  DDS_NODE_UI._selectedNode = null;
  DDS_NODE_UI._setButtons(null);
  document.getElementById('dds-map-node-type-field').classList.add('dds-hidden');
  document.getElementById('dds-map-node-lane-field').classList.add('dds-hidden');

  var dropdown = document.getElementById('dds-map-node-dropdown');
  var nodes = DDS_STORE.query('nodes');
  var lower = val.toLowerCase();
  var matches = val ? nodes.filter(function(n) {
    return (n.name || '').toLowerCase().indexOf(lower) !== -1;
  }) : nodes;

  var onMapIds = DDS_STORE.query('map_nodes', { map_id: DDS_MAP.state.currentMapId })
    .map(function(r) { return r.node_id; });

  var laneMap = {};
  DDS_STORE.query('swim_lanes').forEach(function(l) { laneMap[l.id] = l.name || ('Lane ' + l.id); });
  var typeMap = {};
  DDS_STORE.query('node_types').forEach(function(t) { typeMap[t.code] = t.label || t.code; });

  dropdown.innerHTML = '';
  var items = [];

  matches.forEach(function(n) {
    items.push({ id: n.id, name: n.name, isNew: false, onMap: onMapIds.indexOf(n.id) !== -1,
      meta: [n.type_code ? (typeMap[n.type_code] || n.type_code) : null,
             n.swim_lane_id ? (laneMap[n.swim_lane_id] || null) : null]
            .filter(Boolean).join(' · ') });
  });

  var exactMatch = nodes.find(function(n) {
    return (n.name || '').toLowerCase() === lower;
  });
  if (val && !exactMatch) {
    items.push({ id: null, name: val, isNew: true, onMap: false, meta: '' });
  }

  if (items.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  items.forEach(function(item) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:var(--dds-text-sm);border-bottom:1px solid var(--dds-border-light,#f1f5f9)';
    if (item.isNew) {
      div.textContent = '+ Create "' + item.name + '"';
      div.style.color = 'var(--dds-accent)';
    } else {
      div.textContent = item.name + (item.meta ? ' — ' + item.meta : '') + (item.onMap ? ' (on map)' : '');
    }
    if (item.onMap) {
      // Already on the active map — grayed, not selectable
      div.style.color = 'var(--dds-text-muted,#94a3b8)';
      div.style.cursor = 'default';
    } else {
      div.onmousedown = function() {
        DDS_NODE_UI._selectedNode = { id: item.id, name: item.name };
        document.getElementById('dds-map-node-input').value = item.name;
        DDS_NODE_UI._hideDropdown();
        DDS_NODE_UI._setButtons(DDS_NODE_UI._selectedNode);
        // Type / lane fields only for the create case
        document.getElementById('dds-map-node-type-field').classList.toggle('dds-hidden', !item.isNew);
        document.getElementById('dds-map-node-lane-field').classList.toggle('dds-hidden', !item.isNew);
      };
      div.onmouseover = function() { this.style.background = 'var(--dds-bg-hover,#f8fafc)'; };
      div.onmouseout  = function() { this.style.background = ''; };
    }
    dropdown.appendChild(div);
  });

  dropdown.style.display = 'block';
};

DDS_NODE_UI._hideDropdown = function() {
  var d = document.getElementById('dds-map-node-dropdown');
  if (d) d.style.display = 'none';
};

DDS_NODE_UI.closeModal = function() {
  var overlay = document.getElementById('dds-map-node-overlay');
  if (overlay) overlay.classList.remove('visible');
  DDS_NODE_UI._hideDropdown();
  DDS_NODE_UI._selectedNode = null;
};

// _doSave: shared logic for Save (closeAfter=false) and Save & Close (closeAfter=true).
// Selection required: { id: int } → TX.MAP_ADD_NODE (place existing node);
// { id: null } → TX.NODE_CREATE with mapId (create and place).
DDS_NODE_UI._doSave = function(closeAfter) {
  var sel = DDS_NODE_UI._selectedNode;
  if (!sel) return;

  var saveBtn      = document.getElementById('dds-map-node-save');
  var saveCloseBtn = document.getElementById('dds-map-node-save-close');
  saveBtn.disabled = true;
  saveCloseBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';

  var mapId = DDS_MAP.state.currentMapId;

  function onSuccess(cmdResult) {
    // Add to Cytoscape (presentation — after commit)
    DDS_CY.add({ group: 'nodes', data: {
      id: 'n' + cmdResult.nodeId, nodeId: cmdResult.nodeId, mapNodeId: cmdResult.mapNodeId,
      label: cmdResult.name !== undefined ? cmdResult.name : sel.name,
      shape: DDS_MAP.getShape(cmdResult.typeCode), typeCode: cmdResult.typeCode
    }, position: { x: cmdResult.x, y: cmdResult.y } });

    var emptyEl = document.getElementById('dds-map-empty');
    if (emptyEl) emptyEl.classList.add('dds-hidden');
    DDS_MAP.applyNodeColors();
    DDS_MAP.triggerAutoLayout();

    if (closeAfter) {
      DDS_NODE_UI.closeModal();
    } else {
      // Reset for next entry
      DDS_NODE_UI._selectedNode = null;
      document.getElementById('dds-map-node-input').value = '';
      document.getElementById('dds-map-node-type-field').classList.add('dds-hidden');
      document.getElementById('dds-map-node-lane-field').classList.add('dds-hidden');
      DDS_NODE_UI._hideDropdown();
      saveBtn.innerHTML = 'Save';
      DDS_NODE_UI._setButtons(null);
      document.getElementById('dds-map-node-input').focus();
    }
  }

  var result;
  if (sel.id !== null) {
    // Existing node not on map → place it
    result = DDS_CMD.execute(TX.MAP_ADD_NODE, { node_id: sel.id }, mapId, onSuccess);
  } else {
    // Create and place
    var typeCode   = document.getElementById('dds-map-node-type').value || null;
    var laneVal    = document.getElementById('dds-map-node-lane').value;
    var swimLaneId = laneVal ? parseInt(laneVal) : null;
    result = DDS_CMD.execute(TX.NODE_CREATE, {
      name: sel.name, type_code: typeCode, swim_lane_id: swimLaneId
    }, mapId, function(cmdResult) {
      cmdResult.name = sel.name;
      cmdResult.typeCode = typeCode;
      onSuccess(cmdResult);
    });
  }

  if (!result.ok) {
    console.error('[DDS] Add node error');
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    saveCloseBtn.disabled = false;
  }
};

// Backward-compat alias. Note: since the dds-map-node-* id namespace split
// (T-036 part 1), this modal no longer shares DOM with DDS_NODES_UI.
DDS_NODE_UI.handleSave = function() { DDS_NODE_UI._doSave(true); };

DDS_NODE_UI.bindEvents = function() {
  var btn = document.getElementById('dds-btn-add-node');
  if (btn) btn.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_NODE_UI.openModal();
  });

  var btnApm = document.getElementById('dds-btn-add-product-on-map');
  if (btnApm) btnApm.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_NODE_UI.openAddProductModal();
  });
};

// ============================================================
// Add product on map — modal logic
// ============================================================

DDS_NODE_UI._apmSelectedProduct = null; // { id: int|null (null = new), name: string }

DDS_NODE_UI._injectAddProductModal = function() {
  var existing = document.getElementById('dds-modal-add-product-overlay');
  if (existing) existing.parentNode.removeChild(existing);
  var html = [
    '<div class="dds-overlay dds-hidden" id="dds-modal-add-product-overlay">',
    '  <div class="dds-modal" style="max-width:420px">',
    '    <div class="dds-modal-header">',
    '      <span class="dds-modal-title">Add product on map</span>',
    '      <button class="dds-btn dds-modal-close" id="dds-modal-add-product-close">&times;</button>',
    '    </div>',
    '    <div class="dds-modal-body">',
    '      <div class="dds-field" style="position:relative">',
    '        <label class="dds-label" for="dds-apm-product-input">Product</label>',
    '        <input class="dds-input" id="dds-apm-product-input" type="text" placeholder="Search or create..." autocomplete="off" />',
    '        <div id="dds-apm-product-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--dds-border-light,#e2e8f0);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:9999;max-height:200px;overflow-y:auto"></div>',
    '      </div>',
    '      <div class="dds-field dds-hidden" id="dds-apm-product-type-field">',
    '        <label class="dds-label" for="dds-apm-product-type">Product type</label>',
    '        <select class="dds-select" id="dds-apm-product-type"></select>',
    '      </div>',
    '      <div class="dds-field">',
    '        <label class="dds-label" for="dds-apm-lane">Swim-lane</label>',
    '        <select class="dds-select" id="dds-apm-lane"></select>',
    '      </div>',
    '    </div>',
    '    <div class="dds-modal-footer">',
    '      <button class="dds-btn dds-btn-secondary" id="dds-modal-add-product-cancel">Cancel</button>',
    '      <button class="dds-btn dds-btn-secondary" id="dds-modal-add-product-save" disabled>Save</button>',
    '      <button class="dds-btn dds-btn-primary" id="dds-modal-add-product-save-close" disabled>Save &amp; Close</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  document.body.appendChild(tmp.firstElementChild);
};

DDS_NODE_UI.openAddProductModal = function() {
  DDS_NODE_UI._injectAddProductModal();
  DDS_NODE_UI._apmSelectedProduct = null;

  var nodeTypes = DDS_STORE.query('node_types');
  var productNodeType = nodeTypes.find(function(t) { return t.is_product_node_default; })
    || nodeTypes.find(function(t) { return t.is_default; })
    || nodeTypes[0]
    || null;
  var defaultLaneId = productNodeType ? (productNodeType.default_swim_lane_id || null) : null;

  var laneEl = document.getElementById('dds-apm-lane');
  laneEl.innerHTML = '<option value="">— no swim-lane —</option>';
  DDS_STORE.query('swim_lanes').forEach(function(sl) {
    var opt = document.createElement('option');
    opt.value = sl.id;
    opt.textContent = sl.name || ('Lane ' + sl.id);
    if (defaultLaneId && sl.id === defaultLaneId) opt.selected = true;
    laneEl.appendChild(opt);
  });

  var prodTypes = DDS_STORE.query('product_types');
  var defaultProdType = prodTypes.find(function(t) { return t.is_default; }) || prodTypes[0] || null;
  var ptEl = document.getElementById('dds-apm-product-type');
  ptEl.innerHTML = '<option value="">— no type —</option>';
  prodTypes.forEach(function(pt) {
    var opt = document.createElement('option');
    opt.value = pt.code;
    opt.textContent = pt.label || pt.code;
    if (defaultProdType && pt.code === defaultProdType.code) opt.selected = true;
    ptEl.appendChild(opt);
  });
  document.getElementById('dds-apm-product-type-field').classList.add('dds-hidden');

  var input = document.getElementById('dds-apm-product-input');
  input.value = '';
  document.getElementById('dds-modal-add-product-save').disabled = true;
  document.getElementById('dds-modal-add-product-save-close').disabled = true;
  DDS_NODE_UI._apmHideDropdown();

  var overlay = document.getElementById('dds-modal-add-product-overlay');
  overlay.classList.remove('dds-hidden');
  void overlay.offsetWidth;
  overlay.classList.add('visible');
  input.focus();

  input.oninput = function() { DDS_NODE_UI._apmOnInput(this.value); };
  input.onblur = function() { setTimeout(DDS_NODE_UI._apmHideDropdown, 150); };

  document.getElementById('dds-modal-add-product-close').onclick = DDS_NODE_UI.closeAddProductModal;
  document.getElementById('dds-modal-add-product-cancel').onclick = DDS_NODE_UI.closeAddProductModal;
  document.getElementById('dds-modal-add-product-save').onclick = function() { DDS_NODE_UI._doAddProductSave(false); };
  document.getElementById('dds-modal-add-product-save-close').onclick = function() { DDS_NODE_UI._doAddProductSave(true); };
  document.getElementById('dds-modal-add-product-overlay').onclick = function(e) {
    if (e.target === this) DDS_NODE_UI.closeAddProductModal();
  };
  // Enter = Save & Close
  overlay.onkeydown = function(e) {
    if (e.key === 'Enter') {
      var btn = document.getElementById('dds-modal-add-product-save-close');
      if (btn && !btn.disabled) { e.preventDefault(); DDS_NODE_UI._doAddProductSave(true); }
    }
  };
};

DDS_NODE_UI._apmOnInput = function(val) {
  val = val.trim();
  DDS_NODE_UI._apmSelectedProduct = null;
  document.getElementById('dds-modal-add-product-save').disabled = true;
  document.getElementById('dds-modal-add-product-save-close').disabled = true;

  var dropdown = document.getElementById('dds-apm-product-dropdown');
  var products = DDS_STORE.query('products');
  var lower = val.toLowerCase();
  var matches = val ? products.filter(function(p) {
    return (p.name || '').toLowerCase().indexOf(lower) !== -1;
  }) : products;

  dropdown.innerHTML = '';
  var items = [];

  matches.forEach(function(p) {
    items.push({ id: p.id, name: p.name, isNew: false });
  });

  var exactMatch = products.find(function(p) {
    return (p.name || '').toLowerCase() === lower;
  });
  if (val && !exactMatch) {
    items.push({ id: null, name: val, isNew: true });
  }

  if (items.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  items.forEach(function(item) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:var(--dds-text-sm);border-bottom:1px solid var(--dds-border-light,#f1f5f9)';
    div.textContent = item.isNew ? ('+ Create "' + item.name + '"') : item.name;
    if (item.isNew) div.style.color = 'var(--dds-accent)';
    div.onmousedown = function() {
      DDS_NODE_UI._apmSelectedProduct = item;
      document.getElementById('dds-apm-product-input').value = item.name;
      DDS_NODE_UI._apmHideDropdown();
      document.getElementById('dds-modal-add-product-save').disabled = false;
      document.getElementById('dds-modal-add-product-save-close').disabled = false;
      document.getElementById('dds-apm-product-type-field').classList.toggle('dds-hidden', !item.isNew);
    };
    div.onmouseover = function() { this.style.background = 'var(--dds-bg-hover,#f8fafc)'; };
    div.onmouseout  = function() { this.style.background = ''; };
    dropdown.appendChild(div);
  });

  var inputEl = document.getElementById('dds-apm-product-input');
  var field = inputEl.parentElement;
  field.style.position = 'relative';
  dropdown.style.display = 'block';
};

DDS_NODE_UI._apmHideDropdown = function() {
  var d = document.getElementById('dds-apm-product-dropdown');
  if (d) d.style.display = 'none';
};

DDS_NODE_UI.closeAddProductModal = function() {
  var overlay = document.getElementById('dds-modal-add-product-overlay');
  if (overlay) overlay.classList.remove('visible');
  DDS_NODE_UI._apmHideDropdown();
  var saveBtn = document.getElementById('dds-modal-add-product-save');
  var saveCloseBtn = document.getElementById('dds-modal-add-product-save-close');
  if (saveBtn)      { saveBtn.disabled = true; saveBtn.textContent = 'Save'; }
  if (saveCloseBtn) { saveCloseBtn.disabled = true; }
  DDS_NODE_UI._apmSelectedProduct = null;
};

DDS_NODE_UI._doAddProductSave = function(closeAfter) {
  var sel = DDS_NODE_UI._apmSelectedProduct;
  if (!sel) return;

  var saveBtn      = document.getElementById('dds-modal-add-product-save');
  var saveCloseBtn = document.getElementById('dds-modal-add-product-save-close');
  saveBtn.disabled = true;
  saveCloseBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';

  var mapId = DDS_MAP.state.currentMapId;
  var laneVal = document.getElementById('dds-apm-lane').value;
  var swimLaneId = laneVal ? parseInt(laneVal) : null;
  var prodTypeCode = document.getElementById('dds-apm-product-type').value || null;

  var result = DDS_CMD.execute(TX.MAP_ADD_PRODUCT_NODE, {
    product_id: sel.id,
    product_name: sel.name,
    product_type_code: prodTypeCode,
    swim_lane_id: swimLaneId
  }, mapId, function(cmdResult) {
    // Add to Cytoscape (presentation — after commit)
    DDS_CY.add({ group: 'nodes', data: {
      id: 'n' + cmdResult.nodeId, nodeId: cmdResult.nodeId, mapNodeId: cmdResult.mapNodeId,
      label: cmdResult.name, shape: DDS_MAP.getShape(cmdResult.typeCode), typeCode: cmdResult.typeCode
    }, position: { x: cmdResult.x, y: cmdResult.y } });

    var emptyEl = document.getElementById('dds-map-empty');
    if (emptyEl) emptyEl.classList.add('dds-hidden');
    DDS_MAP.applyNodeColors();
    DDS_MAP.triggerAutoLayout();

    if (closeAfter) {
      DDS_NODE_UI.closeAddProductModal();
    } else {
      // Reset for next entry
      DDS_NODE_UI._apmSelectedProduct = null;
      document.getElementById('dds-apm-product-input').value = '';
      document.getElementById('dds-apm-product-type-field').classList.add('dds-hidden');
      DDS_NODE_UI._apmHideDropdown();
      saveBtn.innerHTML = 'Save';
      saveBtn.disabled = true;
      saveCloseBtn.disabled = true;
      document.getElementById('dds-apm-product-input').focus();
    }
  });

  if (!result.ok) {
    console.error('[DDS] Add product on map error');
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    saveCloseBtn.disabled = false;
  }
};

// Alias for backward compat
DDS_NODE_UI.handleAddProductSave = function() { DDS_NODE_UI._doAddProductSave(true); };
