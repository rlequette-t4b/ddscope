// ============================================================
// DDS_REMOVE — unified remove modal
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive remove controller
// Checkbox 'Remove only from map' unchecked = full functional delete.
// Checked = remove from active map only.
// Supports single element (open) and multi-selection (openMulti).

var DDS_REMOVE = {};
DDS_REMOVE._pending = null;

// ---- Consequence computation (for full delete) --------------

DDS_REMOVE._nodeConsequences = function(nodeId) {
  var flows = DDS_STORE.query('flows').filter(function(f) {
    return f.source_node_id === nodeId || f.target_node_id === nodeId;
  });
  var skus = DDS_STORE.query('skus', { node_id: nodeId });
  var boms = DDS_STORE.query('boms', { node_id: nodeId });
  return { flows: flows, skus: skus, boms: boms };
};

DDS_REMOVE._flowOrphanSkus = function(flowId) {
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  if (!flow) return [];
  var productIds = Array.isArray(flow.product_ids) ? flow.product_ids : [];
  var orphans = [];
  [flow.source_node_id, flow.target_node_id].forEach(function(nid) {
    productIds.forEach(function(pid) {
      var others = DDS_STORE.query('flows').filter(function(f) {
        if (f.id === flowId) return false;
        var pids = Array.isArray(f.product_ids) ? f.product_ids : [];
        return pids.includes(pid) && (f.source_node_id === nid || f.target_node_id === nid);
      });
      if (others.length === 0) {
        var sku = DDS_STORE.query('skus', { node_id: nid, product_id: pid })[0];
        if (sku) orphans.push(sku);
      }
    });
  });
  return orphans;
};

DDS_REMOVE._laneConsequences = function(swimLaneId) {
  var nodes = DDS_STORE.query('nodes', { swim_lane_id: swimLaneId });
  var annotations = DDS_STORE.query('annotations', { swim_lane_id: swimLaneId });
  var allFlows = [], allSkus = [], allBoms = [];
  nodes.forEach(function(n) {
    var c = DDS_REMOVE._nodeConsequences(n.id);
    c.flows.forEach(function(f) { if (!allFlows.find(function(x) { return x.id === f.id; })) allFlows.push(f); });
    c.skus.forEach(function(s) { allSkus.push(s); });
    c.boms.forEach(function(b) { allBoms.push(b); });
  });
  return { nodes: nodes, annotations: annotations, flows: allFlows, skus: allSkus, boms: allBoms };
};

// ---- Shared modal open helper ------------------------------

DDS_REMOVE._openModal = function(title, bodyHtml, pendingPayload) {
  // Append checkbox
  bodyHtml += '<label class="dds-remove-map-only-row"><input type="checkbox" id="dds-remove-map-only-chk"> Remove only from map</label>';

  DDS_REMOVE._pending = pendingPayload;
  document.getElementById('dds-remove-modal-title').textContent = title;
  document.getElementById('dds-remove-modal-body').innerHTML = bodyHtml;

  // Consequences block toggle on checkbox change
  var chk  = document.getElementById('dds-remove-map-only-chk');
  var cons = document.getElementById('dds-remove-consequences');
  if (chk && cons) {
    chk.addEventListener('change', function() {
      cons.style.display = this.checked ? 'none' : '';
    });
  }

  var overlay = document.getElementById('dds-remove-modal-overlay');
  if (overlay) {
    overlay.classList.remove('dds-hidden');
    overlay.classList.add('visible');
  }
};

// ---- Single-element modal ----------------------------------

DDS_REMOVE.open = function(type, entityId) {
  var title = '', bodyHtml = '';
  var nodeById = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodeById[n.id] = n; });

  if (type === 'node') {
    var node = DDS_STORE.query('nodes', { id: entityId })[0];
    if (!node) return;
    var c = DDS_REMOVE._nodeConsequences(entityId);
    title = 'Remove Node';
    bodyHtml = '<p>Remove node <span class="dds-remove-entity-name">' + _escRm(node.name || '(unnamed)') + '</span>?</p>';
    bodyHtml += '<div class="dds-remove-consequences" id="dds-remove-consequences">';
    if (c.flows.length > 0) bodyHtml += '&#8226; ' + c.flows.length + ' flow(s) will be deleted<br>';
    if (c.skus.length  > 0) bodyHtml += '&#8226; ' + c.skus.length  + ' SKU(s) will be deleted<br>';
    if (c.boms.length  > 0) bodyHtml += '&#8226; ' + c.boms.length  + ' BOM(s) will be deleted<br>';
    bodyHtml += '</div>';
  } else if (type === 'edge') {
    var flow = DDS_STORE.query('flows', { id: entityId })[0];
    if (!flow) return;
    var srcName = (nodeById[flow.source_node_id] || {}).name || '?';
    var tgtName = (nodeById[flow.target_node_id] || {}).name || '?';
    var orphans = DDS_REMOVE._flowOrphanSkus(entityId);
    title = 'Remove Flow';
    bodyHtml = '<p>Remove flow <span class="dds-remove-entity-name">' + _escRm(srcName) + ' → ' + _escRm(tgtName) + '</span>?</p>';
    bodyHtml += '<div class="dds-remove-consequences" id="dds-remove-consequences">';
    if (orphans.length > 0) bodyHtml += '&#8226; ' + orphans.length + ' orphan SKU(s) will be deleted<br>';
    bodyHtml += '</div>';
  } else if (type === 'lane') {
    var lane = DDS_STORE.query('swim_lanes', { id: entityId })[0];
    if (!lane) return;
    var cl = DDS_REMOVE._laneConsequences(entityId);
    title = 'Remove Swim-lane';
    bodyHtml = '<p>Remove swim-lane <span class="dds-remove-entity-name">' + _escRm(lane.name || 'Lane') + '</span>?</p>';
    bodyHtml += '<div class="dds-remove-consequences" id="dds-remove-consequences">';
    if (cl.nodes.length       > 0) bodyHtml += '&#8226; ' + cl.nodes.length       + ' node(s) will be deleted<br>';
    if (cl.flows.length       > 0) bodyHtml += '&#8226; ' + cl.flows.length       + ' flow(s) will be deleted<br>';
    if (cl.annotations.length > 0) bodyHtml += '&#8226; ' + cl.annotations.length + ' annotation(s) will be deleted<br>';
    if (cl.skus.length        > 0) bodyHtml += '&#8226; ' + cl.skus.length        + ' SKU(s) will be deleted<br>';
    if (cl.boms.length        > 0) bodyHtml += '&#8226; ' + cl.boms.length        + ' BOM(s) will be deleted<br>';
    bodyHtml += '</div>';
  } else {
    // T-045 (2026-07-10): annotations no longer go through this modal at all
    // — see DDScope_UI.md §5 (Remove modal). Full delete happens from the
    // swim-lane panel's note list; map-only removal happens via the
    // "visible on this map" checkbox there, or the canvas Del key.
    return;
  }

  DDS_REMOVE._openModal(title, bodyHtml, { multi: false, type: type, id: entityId });
};

// ---- Multi-element modal -----------------------------------

DDS_REMOVE.openMulti = function(cyElements) {
  // Collect typed items from the Cytoscape selection.
  // T-045 (2026-07-10): annotation ghosts are excluded entirely — a note is
  // never Remove-button-eligible, single or mixed selection (see
  // DDScope_UI.md §5 — Remove modal). Callers already filter them out before
  // reaching here (DDS_MAP_UI's Remove button, the canvas Del key), but the
  // guard is kept here too as a defensive default.
  var items = [];
  cyElements.forEach(function(el) {
    if (el.isNode()) {
      if (el.hasClass('dds-annotation-ghost')) return;
      var nodeId = el.data('nodeId');
      if (nodeId != null) items.push({ type: 'node', id: nodeId });
    } else if (el.isEdge()) {
      var flowId = el.data('flowId');
      if (flowId != null) items.push({ type: 'edge', id: flowId });
    }
  });
  if (items.length === 0) return;

  // Aggregate consequences (deduplicated)
  var nodeCount = 0, edgeCount = 0;
  var allFlowIds = {}, allSkuKeys = {}, allBomIds = {};
  var seenFlowDeletes = {}; // flow IDs already targeted for deletion

  items.forEach(function(item) {
    if (item.type === 'node') {
      nodeCount++;
      seenFlowDeletes[item.id] = true; // mark node as deleted — its flows will cascade
    } else if (item.type === 'edge') {
      edgeCount++;
    }
  });

  items.forEach(function(item) {
    if (item.type === 'node') {
      var c = DDS_REMOVE._nodeConsequences(item.id);
      c.flows.forEach(function(f) { allFlowIds[f.id] = true; });
      c.skus.forEach(function(s)  { allSkuKeys[s.node_id + ':' + s.product_id] = true; });
      c.boms.forEach(function(b)  { allBomIds[b.id] = true; });
    } else if (item.type === 'edge') {
      // Only count orphan SKUs from flows not already deleted via node cascade
      var flow = DDS_STORE.query('flows', { id: item.id })[0];
      if (flow) {
        // Skip if both endpoints are already being deleted (node cascade handles it)
        var srcDeleted = items.some(function(i) { return i.type === 'node' && i.id === flow.source_node_id; });
        var tgtDeleted = items.some(function(i) { return i.type === 'node' && i.id === flow.target_node_id; });
        if (!srcDeleted && !tgtDeleted) {
          allFlowIds[item.id] = true;
          var orphans = DDS_REMOVE._flowOrphanSkus(item.id);
          orphans.forEach(function(s) { allSkuKeys[s.node_id + ':' + s.product_id] = true; });
        }
      }
    }
  });

  // Build summary counts
  var cascadeFlows = Object.keys(allFlowIds).length;
  var cascadeSkus  = Object.keys(allSkuKeys).length;
  var cascadeBoms  = Object.keys(allBomIds).length;

  // Summary line
  var parts = [];
  if (nodeCount > 0) parts.push(nodeCount + ' node' + (nodeCount > 1 ? 's' : ''));
  if (edgeCount > 0) parts.push(edgeCount + ' flow' + (edgeCount > 1 ? 's' : ''));
  var title = 'Remove ' + parts.join(' and ');

  var bodyHtml = '<p>Remove <span class="dds-remove-entity-name">' + parts.join(' and ') + '</span>?</p>';
  bodyHtml += '<div class="dds-remove-consequences" id="dds-remove-consequences">';
  if (cascadeFlows > 0) bodyHtml += '&#8226; ' + cascadeFlows + ' flow(s) will be deleted<br>';
  if (cascadeSkus  > 0) bodyHtml += '&#8226; ' + cascadeSkus  + ' SKU(s) will be deleted<br>';
  if (cascadeBoms  > 0) bodyHtml += '&#8226; ' + cascadeBoms  + ' BOM(s) will be deleted<br>';
  bodyHtml += '</div>';

  DDS_REMOVE._openModal(title, bodyHtml, { multi: true, items: items });
};

// ---- Close modal -------------------------------------------

DDS_REMOVE._closeModal = function() {
  var ol = document.getElementById('dds-remove-modal-overlay');
  if (ol) { ol.classList.add('dds-hidden'); ol.classList.remove('visible'); }
  DDS_REMOVE._pending = null;
};

// ---- Execution ----------------------------------------------

DDS_REMOVE.execute = function() {
  var p = DDS_REMOVE._pending;
  if (!p) return;
  var mapOnly = document.getElementById('dds-remove-map-only-chk');
  var isMapOnly = mapOnly && mapOnly.checked;
  DDS_REMOVE._closeModal();

  var mapId = DDS_MAP.state.currentMapId;

  // One DDS_CMD.execute() per user interaction. Store mutations and cascade
  // logic (including Cytoscape cleanup for cascaded records) live inside the
  // command itself (DDS_MODEL / DDS_ELEMENTS) — onSuccess only covers
  // presentation cleanup that those cascades don't already handle.
  var txKey, params;

  if (p.multi) {
    params = { items: p.items };
    txKey = isMapOnly ? TX.MAP_REMOVE_NODE : TX.MULTI_DELETE;
  } else if (isMapOnly) {
    if (p.type === 'node') { txKey = TX.MAP_REMOVE_NODE; params = { items: [{ type: 'node', id: p.id }] }; }
    else if (p.type === 'edge') { txKey = TX.MAP_REMOVE_FLOW; params = { id: p.id }; }
    else if (p.type === 'lane') { txKey = TX.MAP_REMOVE_LANE; params = { id: p.id }; }
    else { txKey = TX.MAP_REMOVE_NODE; params = { items: [{ type: 'node', id: p.id }] }; }
  } else {
    if (p.type === 'node')      { txKey = TX.NODE_DELETE; params = { id: p.id }; }
    else if (p.type === 'edge') { txKey = TX.FLOW_DELETE; params = { id: p.id }; }
    else if (p.type === 'lane') { txKey = TX.LANE_DELETE; params = { id: p.id }; }
    else                         { txKey = TX.NODE_DELETE; params = { id: p.id }; }
  }

  // Full lane delete needs presentation cleanup (DOM overlay + map reload)
  // that DDS_MODEL.deleteSwimLane does not perform itself.
  var laneIdForCleanup = (!p.multi && !isMapOnly && p.type === 'lane') ? p.id : null;

  DDS_CMD.execute(txKey, params, mapId, function() {
    if (typeof DDS_FLOW_UI !== 'undefined') {
      DDS_FLOW_UI.removeHandle();
      DDS_FLOW_UI._removeRerouteHandles();
      DDS_FLOW_UI._removeWaypointHandle();
    }
    if (laneIdForCleanup != null) {
      var laneDiv = document.querySelector('.dds-swimlane[data-swim-lane-id="' + laneIdForCleanup + '"]');
      if (laneDiv) laneDiv.remove();
      DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
    }
    DDS_PANEL.close();
    DDS_MAP.renderLegend();
  });
};

// ---- Bind modal buttons + Delete key -----------------------

DDS_REMOVE.bindEvents = function() {
  // Modal button delegation
  document.body.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'dds-remove-modal-confirm') {
      DDS_REMOVE.execute();
    }
    if (e.target && e.target.id === 'dds-remove-modal-cancel') {
      DDS_REMOVE._closeModal();
    }
    if (e.target && e.target.id === 'dds-remove-modal-overlay') {
      DDS_REMOVE._closeModal();
    }
  });

  // Delete key shortcut
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Delete') return;
    // Ignore when focus is in a text field
    var tag = document.activeElement ? document.activeElement.tagName : '';
    var editable = document.activeElement && document.activeElement.isContentEditable;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
    // Ignore if remove modal is already open
    var overlay = document.getElementById('dds-remove-modal-overlay');
    if (overlay && overlay.classList.contains('visible')) return;
    // Ignore if no project
    if (!DDS_STORE.getProject()) return;

    // Annotation ghost (T-045): removes it from the active map only, no modal
    // — takes priority over DDS_PANEL.mode, since the swim-lane panel may be
    // open only because this note's ghost was clicked to reach it (see
    // DDS_PANEL.openAnnotation). Never a full delete from the canvas.
    if (DDS_CY) {
      var selectedAnn = DDS_CY.elements(':selected').not('.dds-note-ghost').filter('.dds-annotation-ghost');
      if (selectedAnn.length === 1) {
        e.preventDefault();
        var annotationId = selectedAnn[0].data('annotationId');
        var annMapId = DDS_MAP.state.currentMapId;
        DDS_CMD.execute(TX.MAP_REMOVE_ANNOTATION, { id: annotationId }, annMapId, function() {
          if (typeof DDS_PANEL !== 'undefined' && DDS_PANEL.mode === 'lane' && DDS_PANEL.entityId) {
            DDS_PANEL._renderLaneNotes(DDS_PANEL.entityId);
          }
        });
        return;
      }
    }

    // Lane: not a Cytoscape element — detect via panel state
    if (typeof DDS_PANEL !== 'undefined' && DDS_PANEL.mode === 'lane' && DDS_PANEL.entityId) {
      e.preventDefault();
      DDS_REMOVE.open('lane', DDS_PANEL.entityId);
      return;
    }

    if (!DDS_CY) return;
    var selected = DDS_CY.elements(':selected').not('.dds-note-ghost').not('.dds-annotation-ghost');
    if (selected.length === 0) return;

    e.preventDefault();

    if (selected.length === 1) {
      var el = selected[0];
      var type, id;
      if (el.isNode()) {
        type = 'node';
        id = el.data('nodeId');
      } else {
        type = 'edge';
        id = el.data('flowId');
      }
      if (id != null) DDS_REMOVE.open(type, id);
    } else {
      DDS_REMOVE.openMulti(selected);
    }
  });
};

function _escRm(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
