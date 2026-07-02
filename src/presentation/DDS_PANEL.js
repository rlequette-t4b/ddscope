// ============================================================
// DDS_PANEL — side panel controller (auto-save)
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive panel controller

var DDS_PANEL = { mode: null, entityId: null, cyElement: null };
// Color palette — use DDS_COLORS (SCRIPT 105)

// ---- Open / close ------------------------------------------

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

DDS_PANEL.open = function(mode) {
  var wasOpen = !!DDS_PANEL.mode;
  DDS_PANEL.mode = mode;
  DDS_PANEL._setRemoveBtn(true);
  ['node','flow','lane','annotation'].forEach(function(s) {
    var el = document.getElementById('dds-panel-' + s);
    if (el) el.classList.toggle('dds-hidden', s !== mode);
  });
  var panelEl = document.getElementById('dds-panel');
  panelEl.classList.add('open');
  panelEl.style.width = '360px';
  if (!wasOpen) DDS_PANEL._animatePan(-360);
};

DDS_PANEL.close = function() {
  var wasOpen = !!DDS_PANEL.mode;
  var panelEl = document.getElementById('dds-panel');
  panelEl.classList.remove('open');
  panelEl.style.width = '0';
  if (DDS_CY) DDS_CY.elements().unselect();
  DDS_PANEL.mode = null; DDS_PANEL.entityId = null; DDS_PANEL.cyElement = null;
  DDS_PANEL._setRemoveBtn(false);
  if (wasOpen) DDS_PANEL._animatePan(360);
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

// ---- NODE panel --------------------------------------------

DDS_PANEL.openNode = function(cyNode) {
  DDS_PANEL.cyElement = cyNode;
  var nodeId = cyNode.data('nodeId');
  DDS_PANEL.entityId = nodeId;
  var node = DDS_STORE.query('nodes', { id: nodeId })[0];
  if (!node) return;

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

  // Show note on map (map_nodes flag)
  var snmEl = document.getElementById('dds-pn-show-note-on-map');
  if (snmEl) {
    var mapId   = DDS_MAP.state.currentMapId;
    var mnRec   = mapId ? DDS_STORE.query('map_nodes', { map_id: mapId, node_id: nodeId })[0] : null;
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

  // Label position override (map_nodes)
  var lpEl = document.getElementById('dds-pn-label-pos');
  if (lpEl) {
    var mapId2  = DDS_MAP.state.currentMapId;
    var mnRec2  = mapId2 ? DDS_STORE.query('map_nodes', { map_id: mapId2, node_id: nodeId })[0] : null;
    lpEl.value  = (mnRec2 && mnRec2.label_position) ? mnRec2.label_position : '';
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

  DDS_PANEL.open('node');
};

// ---- FLOW panel --------------------------------------------

DDS_PANEL.openFlow = function(cyEdge) {
  DDS_PANEL.cyElement = cyEdge;
  var flowId = cyEdge.data('flowId');
  DDS_PANEL.entityId = flowId;
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  if (!flow) return;
  DDS_PANEL._flowRef = flow;

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

  // Show notes as edge label / annotation (map_flows flags)
  var snlEl = document.getElementById('dds-pf-show-notes-label');
  var nmRow = document.getElementById('dds-pf-notes-mode-row');
  var nmEl  = document.getElementById('dds-pf-notes-mode');
  if (snlEl) {
    var mapFlowId2 = cyEdge.data('mapFlowId');
    var mfRec2 = mapFlowId2 ? DDS_STORE.query('map_flows', { id: mapFlowId2 })[0] : null;
    var _isAnnotation = !!(mfRec2 && mfRec2.notes_as_annotation);
    snlEl.checked = !!(mfRec2 && mfRec2.show_notes_label);
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
            DDS_MAP.renderFlowNoteGhost(flowId, cyEdge.data('mapFlowId') || mfRec2.id);
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
        var mfId = cyEdge.data('mapFlowId');
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

  // Hide layout controls when endpoints are not in the same lane
  var loRow = document.getElementById('dds-pf-layout-offset-row');
  if (loRow) loRow.style.display = _sameLane ? '' : 'none';

  // Layout direction inverted (bidirectional flows only, same-lane only)
  var ldiRow = document.getElementById('dds-pf-layout-dir-inverted-row');
  var ldiEl  = document.getElementById('dds-pf-layout-dir-inverted');
  if (ldiRow && ldiEl) {
    var isBidi = flow.bidirectional === true;
    ldiRow.style.display = (isBidi && _sameLane) ? '' : 'none';
    if (isBidi) {
      var mapFlowId4 = cyEdge.data('mapFlowId');
      var mfRec4 = mapFlowId4 ? DDS_STORE.query('map_flows', { id: mapFlowId4 })[0] : null;
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
    var mapFlowId3 = cyEdge.data('mapFlowId');
    var mfRec3 = mapFlowId3 ? DDS_STORE.query('map_flows', { id: mapFlowId3 })[0] : null;
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

  // Curve style (map_flows attribute — presentation layer)
  var csEl = document.getElementById('dds-pf-curve-style');
  if (csEl) {
    var mapFlowId = cyEdge.data('mapFlowId');
    var mfRec = mapFlowId ? DDS_STORE.query('map_flows', { id: mapFlowId })[0] : null;
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

  DDS_PANEL.open('flow');
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

// ---- SWIM-LANE panel ---------------------------------------

DDS_PANEL.openLane = function(swimLaneId) {
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

  DDS_PANEL.open('lane');
};

// ---- ANNOTATION panel --------------------------------------

DDS_PANEL.openAnnotation = function(annotationId) {
  DDS_PANEL.entityId = annotationId;
  DDS_PANEL.cyElement = DDS_CY ? DDS_CY.$('#ann-' + annotationId) : null;
  var ann = DDS_STORE.query('annotations', { id: annotationId })[0];
  if (!ann) return;

  document.getElementById('dds-panel-title').textContent = 'Annotation';

  // Notes
  var notesEl = document.getElementById('dds-pa-notes');
  if (notesEl) {
    notesEl.value = ann.notes || '';
    notesEl.onblur = function() {
      var val = this.value;
      DDS_TX_HELPER.run(TX.ANNOTATION_UPDATE, function() {
        DDS_ANNOTATIONS.update(annotationId, { notes: val });
      }, function() {
        var ghost = DDS_CY && DDS_CY.$('#ann-' + annotationId);
        if (ghost && ghost.length) ghost.data('label', val);
        DDS_STORE.markDirty();
      });
    };
  }

  // Swim-lane
  var laneEl = document.getElementById('dds-pa-lane');
  if (laneEl) {
    laneEl.innerHTML = '<option value="">(none)</option>';
    DDS_STORE.query('swim_lanes').forEach(function(l) {
      var opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.name;
      if (l.id === ann.swim_lane_id) opt.selected = true;
      laneEl.appendChild(opt);
    });
    laneEl.onchange = function() {
      var laneId = this.value ? parseInt(this.value, 10) : null;
      DDS_TX_HELPER.run(TX.ANNOTATION_UPDATE, function() {
        DDS_ANNOTATIONS.update(annotationId, { swim_lane_id: laneId });
      }, function() {
        DDS_STORE.markDirty();
      });
    };
  }

  // Tags
  var tags = Array.isArray(ann.tags) ? ann.tags.slice() : [];
  var _onAnnTagUpdate = function(updated) {
    DDS_TX_HELPER.run(TX.ANNOTATION_UPDATE, function() {
      DDS_ANNOTATIONS.update(annotationId, { tags: updated.slice() });
    });
  };
  DDS_PANEL.renderTags('dds-pa-tags-wrap', 'dds-pa-tag-input', tags, _onAnnTagUpdate);
  DDS_PANEL.bindTagInput('dds-pa-tag-input', tags, 'dds-pa-tags-wrap', _onAnnTagUpdate);

  // Font size (map_annotations.font_size — presentation layer)
  var FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
  var DEFAULT_FONT = 11;
  var mapId = DDS_MAP.state.currentMapId;
  var maRec = mapId ? DDS_STORE.query('map_annotations', { map_id: mapId, annotation_id: annotationId })[0] : null;
  var _currentFont = (maRec && maRec.font_size) ? maRec.font_size : DEFAULT_FONT;

  var fontDisplay = document.getElementById('dds-pa-font-display');
  var fontDecBtn  = document.getElementById('dds-pa-font-dec');
  var fontIncBtn  = document.getElementById('dds-pa-font-inc');

  function _applyFont(size) {
    _currentFont = size;
    if (fontDisplay) fontDisplay.textContent = size + 'px';
    DDS_TX_HELPER.run(TX.ANNOTATION_UPDATE, function() {
      if (maRec) {
        DDS_STORE.update('map_annotations', { id: maRec.id }, { font_size: size });
        maRec.font_size = size;
      }
    }, function() {
      var ghost = DDS_CY && DDS_CY.$('#ann-' + annotationId);
      if (ghost && ghost.length) ghost.style('font-size', size + 'px');
      DDS_STORE.markDirty();
    });
  }

  if (fontDisplay) fontDisplay.textContent = _currentFont + 'px';
  if (fontDecBtn) {
    fontDecBtn.onclick = function() {
      var idx = FONT_SIZES.indexOf(_currentFont);
      if (idx > 0) _applyFont(FONT_SIZES[idx - 1]);
      else if (idx === -1) _applyFont(FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(DEFAULT_FONT) - 1)]);
    };
  }
  if (fontIncBtn) {
    fontIncBtn.onclick = function() {
      var idx = FONT_SIZES.indexOf(_currentFont);
      if (idx !== -1 && idx < FONT_SIZES.length - 1) _applyFont(FONT_SIZES[idx + 1]);
      else if (idx === -1) _applyFont(FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(DEFAULT_FONT) + 1)]);
    };
  }

  // Delete button
  var delBtn = document.getElementById('dds-pa-delete');
  if (delBtn) {
    delBtn.onclick = function() {
      DDS_REMOVE.open('annotation', annotationId);
    };
  }

  DDS_PANEL.open('annotation');
};

// ---- Cytoscape wiring (called from DDS_MAP.initCy) ---------

DDS_PANEL._wireCy = function() {
  if (!DDS_CY) return;

  DDS_CY.on('select', 'node, edge', function() {
    // Defer to let Cytoscape finish accumulating the selection
    setTimeout(function() {
      if (!DDS_CY) return;
      var selected = DDS_CY.elements(':selected').not('.dds-note-ghost');
      if (selected.length > 1) {
        // Multi-selection: close panel, clear all handles, activate Remove button only
        document.getElementById('dds-panel').classList.remove('open');
        DDS_PANEL.mode = null;
        DDS_PANEL.entityId = null;
        DDS_PANEL.cyElement = null;
        DDS_PANEL._setRemoveBtn(true);
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
      if (el.isNode() && el.hasClass('dds-annotation-ghost')) {
        DDS_PANEL.openAnnotation(el.data('annotationId'));
      } else if (el.isNode()) {
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
  document.getElementById('dds-panel-close').addEventListener('click', function() { DDS_PANEL.close(); });
};
