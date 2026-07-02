// AUDITOR:LARGE_BLOCK_JUSTIFIED - single-responsibility CTT overlay renderer: create, sync, drag, resize.
// ============================================================
// DDS_MAP.renderCTTOverlays — CTT line HTML overlay
// ============================================================
// Creates one .dds-ctt-node-wrap per node that has at least one
// map_demands record on the active map. The wraps are children
// of a single .dds-ctt-line-wrap div inside .dds-canvas-wrap.
//
// Displayed value: max CTT among all map_demands for this node
// on the active map, computed via DDS_DURATION.compare.
//
// Position: centre of the line at (node.x + demand_x, node.y + demand_y).
// Length: demand_length canvas units; defaults to node rendered width.
//
// Drag line wrap     → persists demand_x, demand_y to map_nodes.
// Drag handle L or R → resizes symmetrically; persists demand_length.
// Node drag          → CTT overlay repositioned via _syncCTTNodePosition.
//
// Drag/resize both mutate map_nodes directly during onMove for real-time
// rendering — wrapped per DDScope_Commands.md §1.5 (begin at mousedown,
// restore-then-update at commit, rollback on click-without-move). Mirrors
// the DDS_SWIMLANES resize/drag pattern (SCRIPT 1100).
// ============================================================

DDS_MAP._cttWrap = null; // the single .dds-ctt-line-wrap container

// ------------------------------------------------------------------
// Convert model units to screen pixels (and back) using Cytoscape zoom
// ------------------------------------------------------------------
DDS_MAP._modelToScreen = function(modelVal) {
  if (!DDS_CY) return modelVal;
  return modelVal * DDS_CY.zoom();
};

DDS_MAP._screenToModel = function(screenVal) {
  if (!DDS_CY) return screenVal;
  var z = DDS_CY.zoom();
  return z > 0 ? screenVal / z : screenVal;
};

// ------------------------------------------------------------------
// Convert model (Cytoscape) coordinates to canvas-wrap pixel position
// ------------------------------------------------------------------
DDS_MAP._modelToWrapPx = function(mx, my) {
  if (!DDS_CY) return { x: mx, y: my };
  var pan  = DDS_CY.pan();
  var zoom = DDS_CY.zoom();
  // Cytoscape offset within .dds-canvas-wrap
  var cyEl   = document.getElementById('dds-cy');
  var wrapEl = document.querySelector('.dds-canvas-wrap');
  var offX = 0, offY = 0;
  if (cyEl && wrapEl) {
    var cyRect   = cyEl.getBoundingClientRect();
    var wrapRect = wrapEl.getBoundingClientRect();
    offX = cyRect.left - wrapRect.left;
    offY = cyRect.top  - wrapRect.top;
  }
  return {
    x: offX + pan.x + mx * zoom,
    y: offY + pan.y + my * zoom
  };
};

// ------------------------------------------------------------------
// Get or create the master CTT wrap div
// ------------------------------------------------------------------
DDS_MAP._getCTTWrap = function() {
  var wrap = document.querySelector('.dds-canvas-wrap .dds-ctt-line-wrap');
  if (!wrap) {
    var canvasWrap = document.querySelector('.dds-canvas-wrap');
    if (!canvasWrap) return null;
    wrap = document.createElement('div');
    wrap.className = 'dds-ctt-line-wrap';
    canvasWrap.appendChild(wrap);
  }
  DDS_MAP._cttWrap = wrap;
  return wrap;
};

// ------------------------------------------------------------------
// Compute max CTT for a node on the active map
// Returns { value, unit } or null.
// ------------------------------------------------------------------
DDS_MAP._maxCTTForNode = function(nodeId, mapId) {
  var mapDemands = DDS_STORE.query('map_demands', { map_id: mapId });
  var demandIds  = mapDemands.map(function(md) { return md.demand_id; });
  var nodeDemands = DDS_STORE.query('demands', { node_id: nodeId }).filter(function(d) {
    return demandIds.indexOf(d.id) !== -1;
  });
  if (nodeDemands.length === 0) return null;
  var best = null;
  nodeDemands.forEach(function(d) {
    if (d.ctt_value == null || !d.ctt_unit) return;
    if (!best) { best = { value: d.ctt_value, unit: d.ctt_unit }; return; }
    best = DDS_DURATION.compare(best.value, best.unit, d.ctt_value, d.ctt_unit);
  });
  return best;
};

// ------------------------------------------------------------------
// Position a .dds-ctt-node-wrap in wrap-relative pixels
// ------------------------------------------------------------------
DDS_MAP._positionCTTNodeWrap = function(el, nodeModelX, nodeModelY, demandX, demandY, lengthModel) {
  var zoom    = DDS_CY ? DDS_CY.zoom() : 1;
  var px      = DDS_MAP._modelToWrapPx(nodeModelX + (demandX || 0), nodeModelY + (demandY || 0));
  var lineW   = Math.max(20, (lengthModel || 80) * zoom);
  el.style.left      = Math.round(px.x - lineW / 2) + 'px';
  el.style.top       = Math.round(px.y - 12) + 'px'; // 12px = label height approx
  el.querySelector('.dds-ctt-line').style.width = Math.round(lineW) + 'px';
};

// ------------------------------------------------------------------
// Drag behaviour for the line wrap (reposition demand_x / demand_y)
// DDScope_Commands.md §1.5 — begin at mousedown (before onMove mutates
// the record directly), restore-original-then-update at commit, rollback
// on click-without-move. Listeners are scoped to the mousedown call (added
// on mousedown, removed on mouseup) — fixes a latent listener-accumulation
// issue in the previous version, which re-bound document-level listeners
// on every renderCTTOverlays() call without ever removing them.
// ------------------------------------------------------------------
DDS_MAP._bindCTTLineDrag = function(nodeWrapEl, nodeId, mapNodeId) {
  nodeWrapEl.addEventListener('mousedown', function(e) {
    // Ignore clicks on resize handles
    if (e.target.classList.contains('dds-ctt-handle')) return;
    e.preventDefault();

    var startX = e.clientX, startY = e.clientY;
    var _moved = false;
    var mn0 = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
    var origDX = (mn0 && mn0.demand_x != null) ? mn0.demand_x : 0;
    var origDY = (mn0 && mn0.demand_y != null) ? mn0.demand_y : 60;
    // Open transaction before onMove mutates map_nodes directly
    var _txId = DDS_TRANSACTIONS.begin(TX.MAP_MOVE_CTT);

    function onMove(e) {
      if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) _moved = true;
      var dx = DDS_MAP._screenToModel(e.clientX - startX);
      var dy = DDS_MAP._screenToModel(e.clientY - startY);
      var newDX = origDX + dx;
      var newDY = origDY + dy;
      DDS_STORE.update('map_nodes', { id: mapNodeId }, { demand_x: newDX, demand_y: newDY });
      // Reposition immediately
      var mn = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
      if (!mn) return;
      var node = DDS_STORE.query('nodes', { id: nodeId })[0];
      if (!node) return;
      var lengthModel = (mn.demand_length != null) ? mn.demand_length : 80;
      DDS_MAP._positionCTTNodeWrap(nodeWrapEl, mn.x, mn.y, newDX, newDY, lengthModel);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!_moved) {
        DDS_TRANSACTIONS.rollback(_txId);
        return;
      }
      // onMove mutated the record directly — restore originals so _addChange
      // captures the correct backup, then update to the new (current) values.
      var mnFinal = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
      if (mnFinal) {
        var finalDX = mnFinal.demand_x, finalDY = mnFinal.demand_y;
        mnFinal.demand_x = origDX; mnFinal.demand_y = origDY; // restore for _addChange
        DDS_STORE.update('map_nodes', { id: mapNodeId }, { demand_x: finalDX, demand_y: finalDY });
      }
      DDS_TRANSACTIONS.commit(_txId);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
};

// ------------------------------------------------------------------
// Drag behaviour for handles (resize demand_length)
// Same §1.5 pattern as _bindCTTLineDrag above, keyed on TX.MAP_RESIZE_CTT.
// ------------------------------------------------------------------
DDS_MAP._bindCTTHandleDrag = function(handleEl, nodeWrapEl, mapNodeId, side) {
  handleEl.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var startX = e.clientX;
    var _moved = false;
    var mn0 = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
    var origLength = (mn0 && mn0.demand_length != null) ? mn0.demand_length : 80;
    // Open transaction before onMove mutates map_nodes directly
    var _txId = DDS_TRANSACTIONS.begin(TX.MAP_RESIZE_CTT);

    function onMove(e) {
      if (Math.abs(e.clientX - startX) > 2) _moved = true;
      var delta = DDS_MAP._screenToModel(e.clientX - startX);
      // Both handles resize symmetrically
      var newLen = Math.max(20, origLength + (side === 'r' ? delta : -delta) * 2);
      DDS_STORE.update('map_nodes', { id: mapNodeId }, { demand_length: newLen });
      var mn = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
      if (!mn) return;
      DDS_MAP._positionCTTNodeWrap(nodeWrapEl, mn.x, mn.y, mn.demand_x || 0, mn.demand_y || 60, newLen);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!_moved) {
        DDS_TRANSACTIONS.rollback(_txId);
        return;
      }
      var mnFinal = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
      if (mnFinal) {
        var finalLen = mnFinal.demand_length;
        mnFinal.demand_length = origLength; // restore for _addChange
        DDS_STORE.update('map_nodes', { id: mapNodeId }, { demand_length: finalLen });
      }
      DDS_TRANSACTIONS.commit(_txId);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
};

// ------------------------------------------------------------------
// Sync one CTT overlay when its parent node is dragged
// Called from initCy dragfree handler.
// ------------------------------------------------------------------
DDS_MAP._syncCTTNodePosition = function(nodeId, newX, newY) {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  var nodeWrapEl = document.querySelector('.dds-ctt-node-wrap[data-node-id="' + nodeId + '"]');
  if (!nodeWrapEl) return;
  var mapNodeId = parseInt(nodeWrapEl.dataset.mapNodeId);
  var mn = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
  if (!mn) return;
  var lengthModel = (mn.demand_length != null) ? mn.demand_length : 80;
  DDS_MAP._positionCTTNodeWrap(nodeWrapEl, newX, newY, mn.demand_x || 0, mn.demand_y || 60, lengthModel);
};

// ------------------------------------------------------------------
// Sync all CTT overlays on pan/zoom
// ------------------------------------------------------------------
DDS_MAP._syncAllCTT = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  document.querySelectorAll('.dds-ctt-node-wrap').forEach(function(el) {
    var nodeId    = parseInt(el.dataset.nodeId);
    var mapNodeId = parseInt(el.dataset.mapNodeId);
    var mn = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
    if (!mn) return;
    var lengthModel = (mn.demand_length != null) ? mn.demand_length : 80;
    DDS_MAP._positionCTTNodeWrap(el, mn.x, mn.y, mn.demand_x || 0, mn.demand_y || 60, lengthModel);
  });
};

// ------------------------------------------------------------------
// Main render function — called after loadMap and on map_demands change
// ------------------------------------------------------------------
DDS_MAP.renderCTTOverlays = function(mapId) {
  // Remove existing overlays
  var existing = document.querySelector('.dds-canvas-wrap .dds-ctt-line-wrap');
  if (existing) existing.parentNode.removeChild(existing);
  DDS_MAP._cttWrap = null;

  if (!mapId || !DDS_CY) return;

  // Find all nodes that have at least one map_demands record on this map
  var mapDemands = DDS_STORE.query('map_demands', { map_id: mapId });
  if (mapDemands.length === 0) return;

  // Group demand_ids by node_id
  var nodeIds = {};
  mapDemands.forEach(function(md) {
    var demand = DDS_STORE.query('demands', { id: md.demand_id })[0];
    if (!demand) return;
    nodeIds[demand.node_id] = true;
  });

  var nodeIdList = Object.keys(nodeIds).map(Number);
  if (nodeIdList.length === 0) return;

  var wrap = DDS_MAP._getCTTWrap();
  if (!wrap) return;

  nodeIdList.forEach(function(nodeId) {
    var ctt = DDS_MAP._maxCTTForNode(nodeId, mapId);
    if (!ctt) return;

    var mn = DDS_STORE.query('map_nodes', { map_id: mapId, node_id: nodeId })[0];
    if (!mn) return;

    // Default length: Cytoscape node rendered width if available
    var lengthModel = mn.demand_length;
    if (lengthModel == null) {
      var cyNode = DDS_CY.$('#n' + nodeId);
      if (cyNode.length) {
        var bb = cyNode.renderedBoundingBox();
        var zoom = DDS_CY.zoom();
        lengthModel = zoom > 0 ? bb.w / zoom : 80;
      } else {
        lengthModel = 80;
      }
      DDS_STORE.update('map_nodes', { id: mn.id }, { demand_length: lengthModel });
    }

    var demandX = (mn.demand_x != null) ? mn.demand_x : 0;
    var demandY = (mn.demand_y != null) ? mn.demand_y : 60;
    var labelText = 'CTT: ' + DDS_DURATION.toDisplay(ctt.value, ctt.unit);
    var lineW = Math.max(20, lengthModel * (DDS_CY ? DDS_CY.zoom() : 1));

    // Build the node wrap
    var nodeWrap = document.createElement('div');
    nodeWrap.className = 'dds-ctt-node-wrap';
    nodeWrap.dataset.nodeId    = nodeId;
    nodeWrap.dataset.mapNodeId = mn.id;

    var label = document.createElement('div');
    label.className = 'dds-ctt-label';
    label.textContent = labelText;

    var barRow = document.createElement('div');
    barRow.className = 'dds-ctt-bar-row';

    var handleL = document.createElement('div');
    handleL.className = 'dds-ctt-handle';

    var line = document.createElement('div');
    line.className = 'dds-ctt-line';
    line.style.width = Math.round(lineW) + 'px';

    var handleR = document.createElement('div');
    handleR.className = 'dds-ctt-handle';

    barRow.appendChild(handleL);
    barRow.appendChild(line);
    barRow.appendChild(handleR);
    nodeWrap.appendChild(label);
    nodeWrap.appendChild(barRow);
    wrap.appendChild(nodeWrap);

    // Position
    DDS_MAP._positionCTTNodeWrap(nodeWrap, mn.x, mn.y, demandX, demandY, lengthModel);

    // Bind interactions
    DDS_MAP._bindCTTLineDrag(nodeWrap, nodeId, mn.id);
    DDS_MAP._bindCTTHandleDrag(handleL, nodeWrap, mn.id, 'l');
    DDS_MAP._bindCTTHandleDrag(handleR, nodeWrap, mn.id, 'r');
  });
};
