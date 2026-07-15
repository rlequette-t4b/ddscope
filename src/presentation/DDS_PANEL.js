// ============================================================
// DDS_PANEL — side panel controller (auto-save)
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive panel controller
//
// RFC step 4 (Fixed-Width Side Panel, docs/DDScope_Plugin_UI_RFC.md §4):
// the panel reserves its column width at all times it is toggled on
// (show()/hide()/toggleVisibility() — bound to the Toolbar row's Panel
// button, see DDS_UI_MENU.js view.toggleSidePanel) — selection only
// swaps *content* via showContext(), never width or presence. Node,
// Flow, and Lane are registered as contexts through the same
// registerContext() mechanism a future plugin editor would use.

var DDS_PANEL = { mode: null, entityId: null, cyElement: null };
// Color palette — use DDS_COLORS (SCRIPT 105)

// ---- Pan animation (used by show()/hide() only — content swaps do not
// move the canvas, see RFC §4 Fixed-Width Side Panel) ---------

DDS_PANEL._setRemoveBtn = function(enabled) {
  var btn = document.getElementById('dds-btn-remove-from-map');
  if (btn) btn.disabled = !enabled;

};

DDS_PANEL._animatePan = function(deltaX) {
  if (!window.DDS_CY) return;
  var duration = 220; // matches CSS transition width 0.22s
  var startTime = null;
  var startPan = DDS_CY.pan().x;
  var targetPan = startPan + deltaX;
  function tick(now) {
    if (!startTime) startTime = now;
    var t = Math.min((now - startTime) / duration, 1);
    // CSS ease = cubic-bezier(0.25, 0.1, 0.25, 1.0)
    var ease = 3*(1-t)*t*t*0.1 + 3*(1-t)*t*t + t*t*t; // approximation via De Casteljau
    ease = t * t * (3 - 2 * t); // smoothstep — closer perceptually to CSS ease
    DDS_CY.pan({ x: startPan + deltaX * ease, y: DDS_CY.pan().y });
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

// ---- Context registry (RFC step 4) --------------------------
// registerContext(key, { mount(data), unmount() }) — mount populates the
// fixed DOM (or, for a future plugin with no static section, a generic
// container) and is called by showContext(). unmount is optional,
// called on the previously-active context before the next mount.

DDS_PANEL._contexts = {};
DDS_PANEL._sections = ['node', 'flow', 'lane', 'empty', 'multi'];

DDS_PANEL.registerContext = function(key, def) {
  DDS_PANEL._contexts[key] = def || {};
};

DDS_PANEL._showSection = function(key) {
  var show = key || 'empty';
  DDS_PANEL._sections.forEach(function(s) {
    var el = document.getElementById('dds-panel-' + s);
    if (el) el.classList.toggle('dds-hidden', s !== show);
  });
};

// Remove-button enablement no longer follows panel visibility (the panel
// is reserved/visible independently of selection now) — it follows the
// actual Cytoscape selection, plus two cases with no cy selection at all:
// the swim-lane special case (a lane is never a Cytoscape element) and a
// node/flow opened from the Nodes/Flows table (T-052 step 4 — "outside of
// maps", no cy element either). DDS_REMOVE/DDS_MAP_UI detect both via
// DDS_PANEL.mode/entityId — see DDScope_Commands.md §3.3.
DDS_PANEL._refreshRemoveBtn = function() {
  var hasPanelEntity = (DDS_PANEL.mode === 'lane' || DDS_PANEL.mode === 'node' || DDS_PANEL.mode === 'flow')
    && DDS_PANEL.entityId != null;
  var sel = window.DDS_CY ? DDS_CY.elements(':selected').not('.dds-note-ghost').not('.dds-annotation-ghost') : null;
  DDS_PANEL._setRemoveBtn(hasPanelEntity || !!(sel && sel.length));
};

// Content swap only — never touches width/presence. key === 'empty'
// clears the current selection/edit context (nothing-selected state).
DDS_PANEL.showContext = function(key, data) {
  var prev = DDS_PANEL._contexts[DDS_PANEL.mode];
  if (prev && typeof prev.unmount === 'function') prev.unmount();
  DDS_PANEL.mode = (key === 'empty') ? null : key;
  DDS_PANEL.entityId = null;
  DDS_PANEL.cyElement = null;
  var ctx = DDS_PANEL._contexts[key];
  if (ctx && typeof ctx.mount === 'function') ctx.mount(data);
  DDS_PANEL._showSection(key);
  DDS_PANEL._refreshRemoveBtn();
};

// close(): clears the current selection/edit context back to 'empty'.
// Does NOT affect panel visibility (see show()/hide() below) — kept as
// the stable name every pre-step-4 call site already uses (DDS.js
// showView, DDS_UI_NAV undo/redo, this file's own cy handlers), so none
// of them needed to change for this migration.
DDS_PANEL.close = function() {
  if (DDS_CY) DDS_CY.elements().unselect();
  DDS_PANEL.showContext('empty');
};

// ---- Visibility (reserved column, toggled independently of selection —
// symmetric to DDS_WORKBENCH_SHELL's toolbox panel width mechanism, but
// its own persisted key since the side panel is a separate mechanism,
// not part of IWorkbenchShell — see RFC §4 Migration Path) -----------

DDS_PANEL._MIN_WIDTH = 280;
DDS_PANEL._MAX_WIDTH = 600;
DDS_PANEL._DEFAULT_WIDTH = 360;
DDS_PANEL._panelWidth = null;
DDS_PANEL._visible = false;

DDS_PANEL._getPanelWidth = function() {
  if (DDS_PANEL._panelWidth !== null) return DDS_PANEL._panelWidth;
  var stored = window.DDS_SETTINGS ? DDS_SETTINGS.get('side_panel_width') : null;
  var n = stored ? parseInt(stored, 10) : NaN;
  DDS_PANEL._panelWidth = (n && n >= DDS_PANEL._MIN_WIDTH && n <= DDS_PANEL._MAX_WIDTH)
    ? n : DDS_PANEL._DEFAULT_WIDTH;
  return DDS_PANEL._panelWidth;
};

DDS_PANEL._setPanelWidth = function(px) {
  px = Math.max(DDS_PANEL._MIN_WIDTH, Math.min(DDS_PANEL._MAX_WIDTH, Math.round(px)));
  DDS_PANEL._panelWidth = px;
  if (DDS_PANEL._visible) {
    var panelEl = document.getElementById('dds-panel');
    if (panelEl) panelEl.style.width = px + 'px';
  }
  if (window.DDS_SETTINGS) DDS_SETTINGS.set('side_panel_width', String(px));
};

DDS_PANEL.show = function() {
  if (DDS_PANEL._visible) return;
  DDS_PANEL._visible = true;
  var panelEl = document.getElementById('dds-panel');
  var w = DDS_PANEL._getPanelWidth();
  panelEl.classList.add('open');
  panelEl.style.width = w + 'px';
  DDS_PANEL._animatePan(-w);
};

DDS_PANEL.hide = function() {
  if (!DDS_PANEL._visible) return;
  DDS_PANEL._visible = false;
  var panelEl = document.getElementById('dds-panel');
  var w = DDS_PANEL._getPanelWidth();
  panelEl.classList.remove('open');
  panelEl.style.width = '0';
  DDS_PANEL._animatePan(w);
};

DDS_PANEL.toggleVisibility = function() {
  if (DDS_PANEL._visible) DDS_PANEL.hide(); else DDS_PANEL.show();
};

// Drag handle on the panel's left edge (it is the rightmost workspace
// column, so growing it moves its left edge — mirror of
// DDS_WORKBENCH_SHELL.initResizeHandle, whose toolbox panels grow from
// their right edge instead).
DDS_PANEL._initResizeHandle = function() {
  var handle = document.getElementById('dds-panel-resize-handle');
  var panel  = document.getElementById('dds-panel');
  if (!handle || !panel) return;
  var dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', function(e) {
    if (!DDS_PANEL._visible) return;
    dragging = true; startX = e.clientX; startW = panel.offsetWidth;
    handle.classList.add('dragging');
    panel.style.transition = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var newW = Math.max(DDS_PANEL._MIN_WIDTH, Math.min(DDS_PANEL._MAX_WIDTH, startW - (e.clientX - startX)));
    panel.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    DDS_PANEL._setPanelWidth(panel.offsetWidth);
    panel.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (window.DDS_CY && typeof DDS_CY.resize === 'function') DDS_CY.resize();
  });
};

DDS_PANEL._esc = function(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

// ---- Tags widget -------------------------------------------

// Collect all tags currently used in the project
DDS_PANEL._allProjectTags = function() {
  var seen = {};
  var p = DDS_STORE.getProject();
  if (!p) return [];
  var add = function(arr) { (arr || []).forEach(function(t) { if (t) seen[t] = true; }); };
  (p.nodes    || []).forEach(function(r) { add(r.tags); });
  (p.flows    || []).forEach(function(r) { add(r.tags); });
  (p.products || []).forEach(function(r) { add(r.tags); });
  (p.skus     || []).forEach(function(r) { add(r.tags); });
  (p.tag_styles || []).forEach(function(r) { if (r.tag) seen[r.tag] = true; });
  return Object.keys(seen).sort();
};

DDS_PANEL.renderTags = function(wrapId, inputId, tags, onUpdate) {
  var wrap = document.getElementById(wrapId);
  var input = document.getElementById(inputId);
  if (!wrap || !input) return;
  wrap.querySelectorAll('.dds-tag').forEach(function(t) { t.remove(); });
  (tags || []).forEach(function(tag) {
    var pill = document.createElement('span');
    pill.className = 'dds-tag';
    pill.innerHTML = DDS_PANEL._esc(tag) +
      '<span class="dds-tag-remove" data-tag="' + DDS_PANEL._esc(tag) + '">&times;</span>';
    pill.querySelector('.dds-tag-remove').addEventListener('click', function() {
      var idx = tags.indexOf(this.dataset.tag);
      if (idx !== -1) { tags.splice(idx, 1); DDS_PANEL.renderTags(wrapId, inputId, tags, onUpdate); }
      if (onUpdate) onUpdate(tags);
    });
    wrap.insertBefore(pill, input);
  });
};

DDS_PANEL.bindTagInput = function(inputId, tags, wrapId, onUpdate) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.value = '';

  // --- Suggestions dropdown ---
  var _dropdown = null;
  var _activeIdx = -1;

  function _removeSuggestions() {
    if (_dropdown) { _dropdown.remove(); _dropdown = null; }
    _activeIdx = -1;
  }

  function _addTag(val) {
    val = val.trim().replace(/,$/, '');
    if (val && !tags.includes(val)) {
      tags.push(val);
      DDS_PANEL.renderTags(wrapId, inputId, tags, onUpdate);
      if (onUpdate) onUpdate(tags);
    }
    input.value = '';
    _removeSuggestions();
  }

  function _showSuggestions(query) {
    _removeSuggestions();
    var all = DDS_PANEL._allProjectTags();
    var q = query.toLowerCase();
    var matches = all.filter(function(t) {
      return t.toLowerCase().indexOf(q) !== -1 && !tags.includes(t);
    });
    if (matches.length === 0) return;

    _dropdown = document.createElement('div');
    _dropdown.className = 'dds-tag-suggestions';

    // Position below the input
    var rect = input.getBoundingClientRect();
    _dropdown.style.top  = (rect.bottom + window.scrollY + 2) + 'px';
    _dropdown.style.left = (rect.left   + window.scrollX)     + 'px';
    document.body.appendChild(_dropdown);

    matches.forEach(function(tag, i) {
      var item = document.createElement('div');
      item.className = 'dds-tag-suggestion-item';
      item.textContent = tag;
      item.addEventListener('mousedown', function(e) {
        e.preventDefault(); // prevent input blur before click
        _addTag(tag);
      });
      _dropdown.appendChild(item);
    });
  }

  function _highlightItem(idx) {
    if (!_dropdown) return;
    var items = _dropdown.querySelectorAll('.dds-tag-suggestion-item');
    items.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
    if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', function() {
    var q = this.value.trim();
    if (q.length === 0) { _removeSuggestions(); return; }
    _showSuggestions(q);
  });

  input.addEventListener('keydown', function(e) {
    if (_dropdown) {
      var items = _dropdown.querySelectorAll('.dds-tag-suggestion-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _activeIdx = Math.min(_activeIdx + 1, items.length - 1);
        _highlightItem(_activeIdx);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        _activeIdx = Math.max(_activeIdx - 1, 0);
        _highlightItem(_activeIdx);
        return;
      }
      if (e.key === 'Escape') { _removeSuggestions(); return; }
      if ((e.key === 'Enter' || e.key === ',') && _activeIdx >= 0 && items[_activeIdx]) {
        e.preventDefault();
        _addTag(items[_activeIdx].textContent);
        return;
      }
    }
    // Default behaviour: Enter/comma adds the typed value
    if ((e.key === 'Enter' || e.key === ',') && this.value.trim()) {
      e.preventDefault();
      _addTag(this.value);
      return;
    }
    if (e.key === 'Backspace' && !this.value && tags.length) {
      tags.pop();
      DDS_PANEL.renderTags(wrapId, inputId, tags, onUpdate);
      if (onUpdate) onUpdate(tags);
    }
  });

  input.addEventListener('blur', function() {
    // Small delay so mousedown on suggestion fires first
    setTimeout(_removeSuggestions, 150);
  });
};

// ---- NODE context --------------------------------------------
// Registered like a plugin editor would be (see registerContext above).

DDS_PANEL.registerContext('node', { mount: function(data) {
  var cyNode = data.cyNode || null;
  var nodeId = data.id;
  DDS_PANEL.cyElement = cyNode;
  DDS_PANEL.entityId = nodeId;
  var node = DDS_STORE.query('nodes', { id: nodeId })[0];
  if (!node) return;

  // Map-scoped fields (below) only make sense when opened from an actual
  // canvas selection (cyNode given) — there is a specific, currently
  // rendered map they belong to. Opened from the Nodes table (cyNode
  // null), editing happens entirely outside any map — there is no
  // "active map" concept to fall back on (it would just be whichever map
  // was last viewed, not a deliberate context), so these fields are
  // hidden rather than disabled (T-052 step 4 feedback).
  var _mapId = cyNode ? DDS_MAP.state.currentMapId : null;
  var _mnRec = _mapId ? DDS_STORE.query('map_nodes', { map_id: _mapId, node_id: nodeId })[0] : null;

  document.getElementById('dds-panel-title').textContent = 'Node';

  // Name
  var nameEl = document.getElementById('dds-pn-name');
  nameEl.value = node.name || '';
  nameEl.onblur = function() {
    var val = this.value.trim();
    DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, name: val }, DDS_MAP.state.currentMapId, function() {
      if (cyNode) cyNode.data('label', val);
    });
  };

  // Type
  var typeEl = document.getElementById('dds-pn-type');
  typeEl.innerHTML = '<option value="">— no type —</option>';
  DDS_STORE.query('node_types').forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.code; opt.textContent = t.label || t.code;
    if (t.code === node.type_code) opt.selected = true;
    typeEl.appendChild(opt);
  });
  typeEl.onchange = function() {
    var val = this.value || null;
    DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, type_code: val }, DDS_MAP.state.currentMapId, function() {
      if (cyNode) cyNode.data('shape', DDS_MAP.getShape(val));
      DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
    });
  };

  // Swim-lane
  var laneEl = document.getElementById('dds-pn-lane');
  laneEl.innerHTML = '<option value="">— no swim-lane —</option>';
  DDS_STORE.query('swim_lanes').forEach(function(sl) {
    var opt = document.createElement('option');
    opt.value = sl.id; opt.textContent = sl.name;
    if (sl.id === node.swim_lane_id) opt.selected = true;
    laneEl.appendChild(opt);
  });
  laneEl.onchange = function() {
    var val = this.value ? parseInt(this.value) : null;
    DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, swim_lane_id: val }, DDS_MAP.state.currentMapId, function() {
      DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
    });
  };

  // Notes
  var notesEl = document.getElementById('dds-pn-notes');
  notesEl.value = node.notes || '';
  notesEl.onblur = function() {
    var val = this.value;
    DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, notes: val }, DDS_MAP.state.currentMapId, function() {
      DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
    });
  };

  // Show note on map (map_nodes flag) — only meaningful with a cy element
  var snmField = document.getElementById('dds-pn-show-note-on-map-field');
  if (snmField) snmField.style.display = cyNode ? '' : 'none';
  var snmEl = cyNode ? document.getElementById('dds-pn-show-note-on-map') : null;
  if (snmEl) {
    var mapId   = _mapId;
    var mnRec   = _mnRec;
    var hasNote = !!(node.notes && node.notes.trim());
    snmEl.disabled = !hasNote;
    snmEl.checked  = !!(mnRec && mnRec.note_visible && hasNote);
    snmEl.onchange = function() {
      var enabled = this.checked;
      DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, note_visible: enabled }, DDS_MAP.state.currentMapId, function() {
      if (mnRec) mnRec.note_visible = enabled;
      if (DDS_CY) {
        // Remove existing ghost for this node
        DDS_CY.$('#note-' + nodeId).remove();
        if (enabled && node.notes && node.notes.trim()) {
          var parentCy = DDS_CY.$('#n' + nodeId);
          if (parentCy.length) {
            var pPos = parentCy.position();
            var dx   = (mnRec && mnRec.note_dx != null) ? mnRec.note_dx : 0;
            var dy   = (mnRec && mnRec.note_dy != null) ? mnRec.note_dy : 30;
            DDS_CY.add({
              group: 'nodes',
              classes: 'dds-note-ghost',
              data: {
                id: 'note-' + nodeId,
                nodeId: nodeId,
                mapNodeId: mnRec ? mnRec.id : null,
                label: node.notes
              },
              position: { x: pPos.x + dx, y: pPos.y + dy }
            });
          }
        }
      }
      }); // end DDS_CMD.execute
    };
    // Refresh ghost label when notes field changes
    var notesElRef = document.getElementById('dds-pn-notes');
    if (notesElRef) {
      var _origBlur = notesElRef.onblur;
      notesElRef.onblur = function() {
        if (_origBlur) _origBlur.call(this);
        var newNotes = this.value;
        var ghost = DDS_CY && DDS_CY.$('#note-' + nodeId);
        if (ghost && ghost.length) ghost.data('label', newNotes);
        // Update disabled state
        var nowHasNote = !!(newNotes && newNotes.trim());
        snmEl.disabled = !nowHasNote;
        if (!nowHasNote) {
          snmEl.checked = false;
          if (mnRec) DDS_STORE.update('map_nodes', { id: mnRec.id }, { note_visible: false });
          if (DDS_CY) DDS_CY.$('#note-' + nodeId).remove();
        }
      };
    }
  }

  // Label position override (map_nodes) — only meaningful with a cy element
  var lpField = document.getElementById('dds-pn-label-pos-field');
  if (lpField) lpField.style.display = cyNode ? '' : 'none';
  var lpEl = cyNode ? document.getElementById('dds-pn-label-pos') : null;
  if (lpEl) {
    var mapId2  = _mapId;
    var mnRec2  = _mnRec;
    lpEl.value    = (mnRec2 && mnRec2.label_position) ? mnRec2.label_position : '';
    lpEl.onchange = function() {
      var val = this.value || null;
      DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, label_position: val }, DDS_MAP.state.currentMapId, function() {
        if (mnRec2) mnRec2.label_position = val;
        // Apply immediately to the Cytoscape node without reloading the whole map
        if (cyNode) DDS_MAP.applyNodeStyle(cyNode);
      });
    };
  }

  // Tags
  var tags = Array.isArray(node.tags) ? node.tags.slice() : [];
  var _onNodeTagUpdate = function(updated) {
    DDS_CMD.execute(TX.NODE_UPDATE, { id: nodeId, tags: updated.slice() }, DDS_MAP.state.currentMapId, function() {
      // Refresh node color and legend immediately
      if (cyNode && typeof DDS_MAP !== 'undefined') {
        cyNode.style('background-color', DDS_MAP.resolveNodeColor(nodeId));
        DDS_MAP.renderLegend();
      }
      DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
    });
  };
  DDS_PANEL.renderTags('dds-pn-tags-wrap', 'dds-pn-tag-input', tags, _onNodeTagUpdate);
  DDS_PANEL.bindTagInput('dds-pn-tag-input', tags, 'dds-pn-tags-wrap', _onNodeTagUpdate);

  // SKUs
  var skus = DDS_STORE.query('skus', { node_id: nodeId });
  var productById = {};
  DDS_STORE.query('products').forEach(function(p) { productById[p.id] = p; });
  var skuList  = document.getElementById('dds-pn-skus-list');
  var skuEmpty = document.getElementById('dds-pn-skus-empty');
  skuList.innerHTML = '';
  skuEmpty.classList.toggle('dds-hidden', skus.length > 0);
  skus.forEach(function(sku) {
    var prod = productById[sku.product_id];
    var row = document.createElement('div'); row.className = 'dds-sku-row';
    row.innerHTML = '<div class="dds-sku-name">' + DDS_PANEL._esc(prod ? prod.name : '?') + '</div>';
    var skuTags  = Array.isArray(sku.tags) ? sku.tags.slice() : [];
    var wrapId   = 'dds-sku-tags-'  + sku.product_id;
    var inputId  = 'dds-sku-input-' + sku.product_id;
    var tagWrap  = document.createElement('div');   tagWrap.className  = 'dds-tags-wrap'; tagWrap.id = wrapId;
    var tagInput = document.createElement('input'); tagInput.className = 'dds-tag-input';  tagInput.id = inputId; tagInput.placeholder = 'Add tag…';
    tagWrap.appendChild(tagInput); row.appendChild(tagWrap);
    var saveSku = function(updated) {
      DDS_CMD.execute(TX.SKU_UPDATE, { node_id: nodeId, product_id: sku.product_id, tags: updated.slice() }, null);
    };
    DDS_PANEL.renderTags(wrapId, inputId, skuTags, saveSku);
    DDS_PANEL.bindTagInput(inputId, skuTags, wrapId, saveSku);

    // Demand sub-section
    DDS_PANEL._renderSkuDemand(row, nodeId, sku.product_id);

    skuList.appendChild(row);
  });
}});

DDS_PANEL.openNode = function(cyNode) {
  DDS_PANEL.showContext('node', { id: cyNode.data('nodeId'), cyNode: cyNode });
};

// Opened from a Nodes-table row (RFC step 4) — always the "outside of
// maps" editor, deliberately not tied to whichever map happens to be
// active (see the 'node' context above). Map-scoped fields hide
// themselves accordingly.
DDS_PANEL.openNodeById = function(nodeId) {
  DDS_PANEL.showContext('node', { id: nodeId, cyNode: null });
};

// ---- FLOW context --------------------------------------------

DDS_PANEL.registerContext('flow', { mount: function(data) {
  var cyEdge = data.cyEdge || null;
  var flowId = data.id;
  DDS_PANEL.cyElement = cyEdge;
  DDS_PANEL.entityId = flowId;
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  if (!flow) return;
  DDS_PANEL._flowRef = flow;

  // Map-scoped fields (below) only make sense when opened from an actual
  // canvas selection (cyEdge given) — see the matching comment on the
  // 'node' context above for why the Flows-table entry point (cyEdge
  // null) hides them instead of tying them to whichever map happens to
  // be active.
  var _mapId = cyEdge ? DDS_MAP.state.currentMapId : null;
  var _mfRec = _mapId ? DDS_STORE.query('map_flows', { map_id: _mapId, flow_id: flowId })[0] : null;

  document.getElementById('dds-panel-title').textContent = 'Flow';

  // Endpoints summary (source → target)
  var epEl = document.getElementById('dds-pf-endpoints');
  if (epEl) {
    var _renderEndpoint = function(nodeId) {
      var n = DDS_STORE.query('nodes', { id: nodeId })[0];
      if (!n) return '<span class="dds-flow-endpoint-node">?</span>';
      var name = DDS_PANEL._esc(n.name || '—');
      var tags = Array.isArray(n.tags) && n.tags.length
        ? '<span class="dds-flow-endpoint-tags">(' + n.tags.map(DDS_PANEL._esc).join(', ') + ')</span>'
        : '';
      return '<span class="dds-flow-endpoint-node">' + name + tags + '</span>';
    };
    var dir = (function() {
      var m = (DDS_MAP.state.maps || []).find(function(m) { return m.id === DDS_MAP.state.currentMapId; });
      return m ? (m.direction || 'right-left') : 'right-left';
    })();
    var arrow = dir === 'left-right' ? '&#8594;' : '&#8592;';
    epEl.innerHTML =
      _renderEndpoint(flow.source_node_id) +
      '<span class="dds-flow-endpoint-arrow">' + arrow + '</span>' +
      _renderEndpoint(flow.target_node_id);
  }

  // Lead time value
  var ltValEl = document.getElementById('dds-pf-lt-value');
  ltValEl.value = flow.lead_time_value || '';
  ltValEl.onblur = function() {
    var val = parseFloat(this.value) || null;
    DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, lead_time_value: val }, DDS_MAP.state.currentMapId);
    // Lead time not displayed on canvas (v1)
  };

  // Lead time unit
  var ltUnitEl = document.getElementById('dds-pf-lt-unit');
  ltUnitEl.value = flow.lead_time_unit || 'days';
  ltUnitEl.onchange = function() {
    var val = this.value;
    DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, lead_time_unit: val }, DDS_MAP.state.currentMapId);
    // Lead time not displayed on canvas (v1)
  };

  // Notes
  var notesEl = document.getElementById('dds-pf-notes');
  notesEl.value = flow.notes || '';
  notesEl.onblur = function() {
    var val = this.value;
    DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, notes: val }, DDS_MAP.state.currentMapId, function() {
      // Refresh canvas rendering if show_notes_label is active
      var snlEl2 = document.getElementById('dds-pf-show-notes-label');
      var nmEl2  = document.getElementById('dds-pf-notes-mode');
      if (snlEl2 && snlEl2.checked) {
        var isAnno2 = nmEl2 && nmEl2.value === 'annotation';
        if (isAnno2) {
          var ghost = DDS_CY && DDS_CY.$('#flow-note-' + flowId);
          if (ghost && ghost.length) ghost.data('label', val || '');
        } else {
          if (cyEdge) cyEdge.data('label', val || '');
        }
      }
    });
  };

  // Show notes as edge label / annotation (map_flows flags) — only
  // meaningful with a cy element
  var snlField = document.getElementById('dds-pf-show-notes-label-field');
  if (snlField) snlField.style.display = cyEdge ? '' : 'none';
  var snlEl = cyEdge ? document.getElementById('dds-pf-show-notes-label') : null;
  var nmRow = document.getElementById('dds-pf-notes-mode-row');
  var nmEl  = document.getElementById('dds-pf-notes-mode');
  if (snlEl) {
    var mfRec2 = _mfRec;
    var _isAnnotation = !!(mfRec2 && mfRec2.notes_as_annotation);
    snlEl.checked  = !!(mfRec2 && mfRec2.show_notes_label);
    // Sync mode select
    if (nmEl) nmEl.value = _isAnnotation ? 'annotation' : 'label';
    if (nmRow) nmRow.style.display = snlEl.checked ? '' : 'none';

    snlEl.onchange = function() {
      var val = this.checked;
      DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, show_notes_label: val }, DDS_MAP.state.currentMapId, function() {
        // Show/hide mode select
        if (nmRow) nmRow.style.display = val ? '' : 'none';
        if (!val) {
          if (cyEdge) cyEdge.data('label', '');
          if (DDS_CY) DDS_CY.$('#flow-note-' + flowId).remove();
        } else {
          var currentNotes = document.getElementById('dds-pf-notes').value;
          var isAnno = nmEl && nmEl.value === 'annotation';
          if (isAnno) {
            DDS_MAP.renderFlowNoteGhost(flowId, mfRec2.id);
          } else {
            if (cyEdge) cyEdge.data('label', currentNotes || '');
          }
        }
      });
    };

    // Mode select handler
    if (nmEl) {
      nmEl.onchange = function() {
        var isAnno = this.value === 'annotation';
        var mfId = mfRec2 ? mfRec2.id : null;
        DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, notes_as_annotation: isAnno }, DDS_MAP.state.currentMapId, function() {
          var currentNotes = document.getElementById('dds-pf-notes').value;
          if (isAnno) {
            if (cyEdge) cyEdge.data('label', '');
            DDS_MAP.renderFlowNoteGhost(flowId, mfId);
          } else {
            if (DDS_CY) DDS_CY.$('#flow-note-' + flowId).remove();
            if (cyEdge) cyEdge.data('label', currentNotes || '');
          }
        });
      };
    }
  }

  // Bidirectional
  var biEl = document.getElementById('dds-pf-bidirectional');
  if (biEl) {
    biEl.checked = flow.bidirectional === true;
    biEl.onchange = function() {
      var val = this.checked;
      DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, bidirectional: val }, DDS_MAP.state.currentMapId, function() {
        if (cyEdge) cyEdge.data('bidirectional', val ? 'true' : 'false');
      });
    };
  }

  // Determine if both flow endpoints are in the same swim-lane on this map.
  // Layout offset and direction inversion only apply when both nodes share a lane.
  var _sameLane = (function() {
    var mapId = DDS_MAP.state.currentMapId;
    if (!mapId) return false;
    var srcNode = DDS_STORE.query('nodes', { id: flow.source_node_id })[0];
    var tgtNode = DDS_STORE.query('nodes', { id: flow.target_node_id })[0];
    var srcLane = srcNode && srcNode.swim_lane_id;
    var tgtLane = tgtNode && tgtNode.swim_lane_id;
    if (!srcLane || !tgtLane || srcLane !== tgtLane) return false;
    // Check the lane is actually present on this map
    return DDS_STORE.query('map_swim_lanes', { map_id: mapId, swim_lane_id: srcLane }).length > 0;
  })();

  // Hide layout controls when endpoints are not in the same lane, or when
  // there is no cy element (Flows-table entry point — see above)
  var loRow = document.getElementById('dds-pf-layout-offset-row');
  if (loRow) loRow.style.display = (cyEdge && _sameLane) ? '' : 'none';

  // Layout direction inverted (bidirectional flows only, same-lane only)
  var ldiRow = document.getElementById('dds-pf-layout-dir-inverted-row');
  var ldiEl  = document.getElementById('dds-pf-layout-dir-inverted');
  if (ldiRow && ldiEl) {
    var isBidi = flow.bidirectional === true;
    ldiRow.style.display = (cyEdge && isBidi && _sameLane) ? '' : 'none';
    if (isBidi) {
      var mfRec4 = _mfRec;
      ldiEl.checked = !!(mfRec4 && mfRec4.layout_direction_inverted === true);
      ldiEl.onchange = function() {
        var val = this.checked;
        DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, layout_direction_inverted: val }, DDS_MAP.state.currentMapId, function() {
          if (cyEdge) cyEdge.data('layoutDirectionInverted', val);
          // No loadMap() — takes effect on next Layout run only
        });
      };
    }
  }

  // Layout offset
  var loEl = document.getElementById('dds-pf-layout-offset');
  if (loEl) {
    var mfRec3 = _mfRec;
    loEl.value = (mfRec3 && mfRec3.layout_offset != null) ? mfRec3.layout_offset : 1;
    loEl.onchange = function() {
      var val = Math.max(0, parseInt(this.value) || 0);
      this.value = val; // normalise display
      DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, layout_offset: val }, DDS_MAP.state.currentMapId, function() {
        if (cyEdge) cyEdge.data('layoutOffset', val);
        // No loadMap() — layout_offset takes effect on next Layout run only
      });
    };
  }

  // Tags
  var tags = Array.isArray(flow.tags) ? flow.tags.slice() : [];
  var _onFlowTagUpdate = function(updated) {
    DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, tags: updated.slice() }, DDS_MAP.state.currentMapId);
  };
  DDS_PANEL.renderTags('dds-pf-tags-wrap', 'dds-pf-tag-input', tags, _onFlowTagUpdate);
  DDS_PANEL.bindTagInput('dds-pf-tag-input', tags, 'dds-pf-tags-wrap', _onFlowTagUpdate);

  // Curve style (map_flows attribute — presentation layer) — only
  // meaningful with a cy element
  var csField = document.getElementById('dds-pf-curve-style-field');
  if (csField) csField.style.display = cyEdge ? '' : 'none';
  var csEl = cyEdge ? document.getElementById('dds-pf-curve-style') : null;
  if (csEl) {
    var mfRec = _mfRec;
    csEl.value = (mfRec && mfRec.curve_style) ? mfRec.curve_style : 'taxi';
    csEl.onchange = function() {
      var newCs = (this.value === 'straight') ? 'straight' : 'taxi';
      DDS_CMD.execute(TX.FLOW_UPDATE, { id: flowId, curve_style: newCs }, DDS_MAP.state.currentMapId, function() {
        if (cyEdge) {
          cyEdge.data('curveStyle', newCs);
          cyEdge.style('curve-style', newCs);
          if (newCs === 'taxi') {
            var pct = cyEdge.data('waypointPct');
            if (pct == null) pct = 0.5;
            cyEdge.style('taxi-turn', Math.round(pct * 100) + '%');
          }
          DDS_FLOW_UI._removeWaypointHandle();
          if (newCs === 'taxi') DDS_FLOW_UI._showWaypointHandle(cyEdge);
        }
      });
    };
  }

  // Products
  var productIds = Array.isArray(flow.product_ids) ? flow.product_ids.map(Number) : [];
  var productById = {};
  DDS_STORE.query('products').forEach(function(p) { productById[p.id] = p; });
  DDS_PANEL._flowProductIds = productIds.slice();
  DDS_PANEL._renderFlowProducts(flowId, flow, productById);

  var addSel = document.getElementById('dds-pf-product-add');
  addSel.innerHTML = '<option value="">Add product…</option>';
  Object.values(productById).forEach(function(p) {
    if (DDS_PANEL._flowProductIds.includes(p.id)) return;
    var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
    addSel.appendChild(opt);
  });
  addSel.onchange = function() {
    var pid = parseInt(this.value); if (!pid) return;
    DDS_CMD.execute(TX.FLOW_ADD_PRODUCT, { flow_id: flowId, product_id: pid }, DDS_MAP.state.currentMapId, function() {
      DDS_PANEL._flowProductIds.push(pid);
      DDS_PANEL._renderFlowProducts(flowId, flow, productById);
    });
    this.value = '';
  };
}});

DDS_PANEL.openFlow = function(cyEdge) {
  DDS_PANEL.showContext('flow', { id: cyEdge.data('flowId'), cyEdge: cyEdge });
};

// Opened from a Flows-table row (RFC step 4) — always the "outside of
// maps" editor, same reasoning as openNodeById above. Map-scoped fields
// hide themselves accordingly.
DDS_PANEL.openFlowById = function(flowId) {
  DDS_PANEL.showContext('flow', { id: flowId, cyEdge: null });
};

DDS_PANEL._renderFlowProducts = function(flowId, flow, productById) {
  var list = document.getElementById('dds-pf-products-list'); if (!list) return;
  list.innerHTML = '';
  DDS_PANEL._flowProductIds.forEach(function(pid) {
    var p = productById[pid];
    var row = document.createElement('div'); row.className = 'dds-product-row';
    row.innerHTML = '<span class="dds-product-row-name">' + DDS_PANEL._esc(p ? p.name : '?') + '</span>' +
      '<button class="dds-btn dds-btn-ghost dds-btn-sm" data-pid="' + pid + '">&times;</button>';
    row.querySelector('button').addEventListener('click', function() {
      var pid = parseInt(this.dataset.pid);
      DDS_CMD.execute(TX.FLOW_REMOVE_PRODUCT, { flow_id: flowId, product_id: pid }, DDS_MAP.state.currentMapId, function() {
        var idx = DDS_PANEL._flowProductIds.indexOf(pid);
        if (idx !== -1) DDS_PANEL._flowProductIds.splice(idx, 1);
        DDS_PANEL._renderFlowProducts(flowId, flow, productById);
      });
    });
    list.appendChild(row);
  });
};

// ---- SWIM-LANE context ---------------------------------------

DDS_PANEL.registerContext('lane', { mount: function(data) {
  var swimLaneId = data.swimLaneId, highlightAnnotationId = data.highlightAnnotationId;
  DDS_PANEL.entityId = swimLaneId; DDS_PANEL.cyElement = null;
  var lane = DDS_STORE.query('swim_lanes', { id: swimLaneId })[0];
  if (!lane) return;

  document.getElementById('dds-panel-title').textContent = 'Swim-lane';

  // Name
  var nameEl = document.getElementById('dds-pl-name');
  nameEl.value = lane.name || '';
  nameEl.onblur = function() {
    var val = this.value.trim();
    DDS_CMD.execute(TX.LANE_UPDATE, { id: swimLaneId, name: val }, null, function() {
      var div = document.querySelector('.dds-swimlane[data-swim-lane-id="' + swimLaneId + '"]');
      if (div) {
        var header = div.querySelector('.dds-swimlane-header');
        if (header) header.textContent = val;
      }
    });
  };

  // Color swatches
  var swatchWrap = document.getElementById('dds-pl-swatches');
  swatchWrap.innerHTML = '';
  DDS_COLORS.forEach(function(color) {
    var sw = document.createElement('div');
    sw.className = 'dds-swatch' + (color === lane.color ? ' selected' : '');
    sw.style.background = color; sw.dataset.color = color;
    sw.addEventListener('click', function() {
      swatchWrap.querySelectorAll('.dds-swatch').forEach(function(s) { s.classList.remove('selected'); });
      sw.classList.add('selected');
      DDS_CMD.execute(TX.LANE_UPDATE, { id: swimLaneId, color: color }, null, function() {
        var div = document.querySelector('.dds-swimlane[data-swim-lane-id="' + swimLaneId + '"]');
        if (div) {
          div.style.borderColor = color;
          var header = div.querySelector('.dds-swimlane-header');
          if (header) header.style.background = color;
        }
      });
    });
    swatchWrap.appendChild(sw);
  });

  // Notes (annotations attached to this lane) — T-045
  DDS_PANEL._renderLaneNotes(swimLaneId, highlightAnnotationId);
}});

DDS_PANEL.openLane = function(swimLaneId, highlightAnnotationId) {
  DDS_PANEL.showContext('lane', { swimLaneId: swimLaneId, highlightAnnotationId: highlightAnnotationId });
};

// ---- Notes sub-section (swim-lane panel) — T-045 ------------
// Annotations are always lane-attached (see DDScope_ElementsLifecycle §7).
// Editing, per-map visibility, and deletion all happen from this list —
// there is no dedicated Annotation panel any more.

DDS_PANEL._laneNoteFontSizes = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
DDS_PANEL._laneNoteDefaultFont = 11;

DDS_PANEL._renderLaneNotes = function(swimLaneId, highlightAnnotationId) {
  var list = document.getElementById('dds-pl-notes-list');
  if (!list) return;
  var mapId = DDS_MAP.state.currentMapId;
  var laneOnMap = mapId ? DDS_STORE.query('map_swim_lanes', { map_id: mapId, swim_lane_id: swimLaneId }).length > 0 : false;
  var notes = DDS_STORE.query('annotations', { swim_lane_id: swimLaneId });

  list.innerHTML = '';
  notes.forEach(function(ann) {
    var row = document.createElement('div');
    row.className = 'dds-lane-note-row';
    row.dataset.annotationId = ann.id;

    var textEl = document.createElement('textarea');
    textEl.className = 'dds-textarea';
    textEl.rows = 2;
    textEl.value = ann.notes || '';
    textEl.placeholder = 'Note text…';
    textEl.onblur = function() {
      var val = this.value;
      DDS_CMD.execute(TX.ANNOTATION_UPDATE, { id: ann.id, notes: val }, null, function() {
        ann.notes = val;
        var ghost = DDS_CY && DDS_CY.$('#ann-' + ann.id);
        if (ghost && ghost.length) ghost.data('label', val);
      });
    };
    row.appendChild(textEl);

    var controls = document.createElement('div');
    controls.className = 'dds-lane-note-controls';

    if (laneOnMap) {
      var maRec = mapId ? DDS_STORE.query('map_annotations', { map_id: mapId, annotation_id: ann.id })[0] : null;
      var visLabel = document.createElement('label');
      visLabel.className = 'dds-field-inline';
      var visChk = document.createElement('input');
      visChk.type = 'checkbox';
      visChk.checked = !!maRec;
      visChk.addEventListener('change', function() {
        var checked = this.checked;
        var txKey = checked ? TX.MAP_ADD_ANNOTATION : TX.MAP_REMOVE_ANNOTATION;
        DDS_CMD.execute(txKey, { id: ann.id }, mapId, function() {
          DDS_PANEL._renderLaneNotes(swimLaneId);
        });
      });
      visLabel.appendChild(visChk);
      visLabel.appendChild(document.createTextNode(' Visible on this map'));
      controls.appendChild(visLabel);

      if (maRec) {
        var fontWrap = document.createElement('div');
        fontWrap.className = 'dds-lane-note-font';
        var curFont = maRec.font_size || DDS_PANEL._laneNoteDefaultFont;
        var decBtn = document.createElement('button');
        decBtn.className = 'dds-btn dds-btn-secondary dds-btn-sm'; decBtn.textContent = 'A−';
        var display = document.createElement('span');
        display.className = 'dds-lane-note-font-display';
        display.textContent = curFont + 'px';
        var incBtn = document.createElement('button');
        incBtn.className = 'dds-btn dds-btn-secondary dds-btn-sm'; incBtn.textContent = 'A+';

        function applyFont(size) {
          DDS_CMD.execute(TX.MAP_RESIZE_ANNOTATION_FONT, { map_annotation_id: maRec.id, font_size: size }, null, function() {
            maRec.font_size = size;
            display.textContent = size + 'px';
            var ghost = DDS_CY && DDS_CY.$('#ann-' + ann.id);
            if (ghost && ghost.length) ghost.style('font-size', size + 'px');
          });
        }
        decBtn.onclick = function() {
          var idx = DDS_PANEL._laneNoteFontSizes.indexOf(curFont);
          if (idx > 0) { curFont = DDS_PANEL._laneNoteFontSizes[idx - 1]; applyFont(curFont); }
        };
        incBtn.onclick = function() {
          var idx = DDS_PANEL._laneNoteFontSizes.indexOf(curFont);
          if (idx !== -1 && idx < DDS_PANEL._laneNoteFontSizes.length - 1) { curFont = DDS_PANEL._laneNoteFontSizes[idx + 1]; applyFont(curFont); }
        };
        fontWrap.appendChild(decBtn); fontWrap.appendChild(display); fontWrap.appendChild(incBtn);
        controls.appendChild(fontWrap);
      }
    } else {
      var hint = document.createElement('span');
      hint.className = 'dds-text-sm dds-lane-note-hint';
      hint.textContent = 'Lane not on this map';
      controls.appendChild(hint);
    }

    var delBtn = document.createElement('button');
    delBtn.className = 'dds-btn dds-btn-ghost dds-btn-sm';
    delBtn.textContent = '×';
    delBtn.title = 'Delete note';
    delBtn.onclick = function() {
      DDS_CMD.execute(TX.ANNOTATION_DELETE, { id: ann.id }, null, function() {
        DDS_PANEL._renderLaneNotes(swimLaneId);
      });
    };
    controls.appendChild(delBtn);

    row.appendChild(controls);
    if (highlightAnnotationId != null && parseInt(highlightAnnotationId, 10) === ann.id) {
      row.classList.add('dds-lane-note-highlight');
    }
    list.appendChild(row);
  });

  var addBtn = document.getElementById('dds-pl-add-note');
  if (addBtn) {
    addBtn.disabled = !laneOnMap;
    addBtn.title = laneOnMap ? '' : 'Place this lane on the active map first';
    addBtn.onclick = function() {
      DDS_CMD.execute(TX.ANNOTATION_CREATE, { notes: '', swim_lane_id: swimLaneId }, null, function(result) {
        if (result && result.id) {
          DDS_ELEMENTS.addAnnotation(result.id);
          DDS_PANEL._renderLaneNotes(swimLaneId, result.id);
        }
      });
    };
  }

  if (highlightAnnotationId != null) {
    setTimeout(function() {
      var row = list.querySelector('[data-annotation-id="' + highlightAnnotationId + '"]');
      if (row) row.scrollIntoView({ block: 'nearest' });
    }, 0);
  }
};

// Opened by clicking a note's ghost on the canvas (T-045) — there is no
// dedicated Annotation panel any more; this resolves the parent swim-lane
// and opens its panel, scrolled to and highlighting the corresponding row.
DDS_PANEL.openAnnotation = function(annotationId) {
  var ann = DDS_STORE.query('annotations', { id: annotationId })[0];
  if (!ann || ann.swim_lane_id == null) return;
  DDS_PANEL.openLane(ann.swim_lane_id, annotationId);
};

// ---- EMPTY / MULTI contexts (RFC step 4 — v1 nothing-selected state is
// empty; multi-selection shows a simple count for now, see RFC §4 Fixed-
// Width Side Panel and the T-052 step 4 design discussion — commonality
// across a multi-selection, e.g. bulk tag edit, is left for later) -----

DDS_PANEL.registerContext('empty', { mount: function() {
  document.getElementById('dds-panel-title').textContent = '';
}});

DDS_PANEL.registerContext('multi', { mount: function(count) {
  document.getElementById('dds-panel-title').textContent = 'Selection';
  var el = document.getElementById('dds-panel-multi-count');
  if (el) el.textContent = count + ' elements selected';
}});

// ---- Cytoscape wiring (called from DDS_MAP.initCy) ---------

DDS_PANEL._wireCy = function() {
  if (!DDS_CY) return;

  DDS_CY.on('select', 'node, edge', function() {
    // Defer to let Cytoscape finish accumulating the selection
    setTimeout(function() {
      if (!DDS_CY) return;

      // Annotation ghost (T-045): opens the parent swim-lane panel, scrolled
      // to the note — handled separately from the node/edge selection below
      // (excluded from it via .not('.dds-annotation-ghost')) since it is never
      // a Remove-button-eligible selection on its own.
      var annSelected = DDS_CY.elements(':selected').not('.dds-note-ghost').filter('.dds-annotation-ghost');
      var selected = DDS_CY.elements(':selected').not('.dds-note-ghost').not('.dds-annotation-ghost');

      if (annSelected.length === 1 && selected.length === 0) {
        DDS_PANEL.openAnnotation(annSelected[0].data('annotationId'));
        return;
      }

      if (selected.length > 1) {
        // Multi-selection: swap content to the 'multi' context, clear all
        // flow handles. Remove button enablement is refreshed by
        // showContext() itself (based on the actual cy selection).
        DDS_PANEL.showContext('multi', selected.length);
        if (typeof DDS_FLOW_UI !== 'undefined') {
          DDS_FLOW_UI.removeHandle();
          DDS_FLOW_UI._removeRerouteHandles();
          DDS_FLOW_UI._removeWaypointHandle();
        }
        return;
      }
      // Single selection
      var el = selected[0];
      if (!el) return;
      if (el.isNode()) {
        DDS_PANEL.openNode(el);
      } else if (el.isEdge()) {
        DDS_PANEL.openFlow(el);
      }
    }, 0);
  });

  DDS_CY.on('unselect', function() {
    setTimeout(function() {
      if (DDS_CY && DDS_CY.elements(':selected').not('.dds-note-ghost').length === 0) {
        DDS_PANEL.close();
      }
    }, 80);
  });

  DDS_CY.on('tap', function(e) { if (e.target === DDS_CY) DDS_PANEL.close(); });
};

// ---- bindEvents --------------------------------------------

DDS_PANEL.bindEvents = function() {
  // No in-panel close button (RFC step 4) — same reasoning as the AI
  // Toolbox's removed #dds-ai-close: redundant with the Toolbar row's
  // "Panel" toggle (DDS_UI_MENU.js view.toggleSidePanel).
  DDS_PANEL._initResizeHandle();
  // Reserved by default (RFC §4 Fixed-Width Side Panel — open at all
  // times unless explicitly toggled off via the Toolbar row), nothing
  // selected yet.
  DDS_PANEL.show();
  DDS_PANEL.showContext('empty');
};
