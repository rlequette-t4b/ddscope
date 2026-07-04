// ============================================================
// DDS_MAP.loadMap — initialize Cytoscape + render map
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive map loading pipeline

DDS_MAP.initCy = function() {
  if (DDS_CY) { DDS_CY.destroy(); DDS_CY = null; }
  DDS_CY = cytoscape({
    container: document.getElementById('dds-cy'),
    style: DDS_MAP.CY_STYLE,
    elements: [], layout: { name: 'preset' },
    minZoom: 0.1, maxZoom: 3, wheelSensitivity: 0.3
  });

  // Persist node position on drag (registered second — reads post-snap position)
  DDS_CY.on('dragfree', 'node', function(e) {
    var node = e.target;
    // Ignore ghost note nodes — their drag is handled separately
    if (node.hasClass('dds-note-ghost')) return;
    var mapNodeId = node.data('mapNodeId');
    if (!mapNodeId) return;
    // Read position after snap handler has run (snap handler registered first)
    var pos    = node.position();
    var nodeId = node.data('nodeId');
    DDS_CMD.execute(TX.MAP_MOVE_NODE, { map_node_id: mapNodeId, x: pos.x, y: pos.y }, null, function(cmdResult) {
      // Reposition CTT overlay if present
      if (typeof DDS_MAP._syncCTTNodePosition === 'function') {
        DDS_MAP._syncCTTNodePosition(nodeId, pos.x, pos.y);
      }
      // Reposition attached note ghost if present
      var ghost = DDS_CY.$('#note-' + nodeId);
      if (ghost.length) {
        var mn = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
        var dx = (mn && mn.note_dx != null) ? mn.note_dx : 0;
        var dy = (mn && mn.note_dy != null) ? mn.note_dy : 30;
        ghost.position({ x: pos.x + dx, y: pos.y + dy });
      }
      DDS_MAP.triggerAutoLayout();
    });
  });

  DDS_CY.on('pan zoom', function() {
    DDS_SWIMLANES.syncOverlay();
    if (typeof DDS_MAP._syncAllCTT === 'function') DDS_MAP._syncAllCTT();
  });

  // --- Vertical snap on manual node drag ---
  // Guide shown during drag; snap applied only on dragfree to avoid cursor detachment.
  var SNAP_THRESHOLD = 6; // canvas units
  var _snapGuide = null;

  function _getSnapGuide() {
    if (_snapGuide) return _snapGuide;
    var wrap = document.querySelector('.dds-canvas-wrap');
    if (!wrap) return null;
    var g = document.createElement('div');
    g.id = 'dds-snap-guide';
    g.style.cssText = 'position:absolute;left:0;right:0;height:1px;background:rgba(46,125,50,0.6);pointer-events:none;display:none;z-index:900;border-top:1px dashed #2e7d32;';
    wrap.appendChild(g);
    _snapGuide = g;
    return g;
  }

  function _showSnapGuide(canvasY) {
    var g = _getSnapGuide();
    if (!g || !DDS_CY) return;
    var pan  = DDS_CY.pan();
    var zoom = DDS_CY.zoom();
    var cyEl = document.getElementById('dds-cy');
    var wrapEl = document.querySelector('.dds-canvas-wrap');
    if (!cyEl || !wrapEl) return;
    var offY = cyEl.getBoundingClientRect().top - wrapEl.getBoundingClientRect().top;
    var screenY = offY + canvasY * zoom + pan.y;
    g.style.top     = Math.round(screenY) + 'px';
    g.style.display = 'block';
  }

  function _hideSnapGuide() {
    if (_snapGuide) _snapGuide.style.display = 'none';
  }

  // Vertical guide (snap on X axis)
  var _snapGuideV = null;

  function _getSnapGuideV() {
    if (_snapGuideV) return _snapGuideV;
    var wrap = document.querySelector('.dds-canvas-wrap');
    if (!wrap) return null;
    var g = document.createElement('div');
    g.id = 'dds-snap-guide-v';
    g.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(46,125,50,0.6);pointer-events:none;display:none;z-index:900;border-left:1px dashed #2e7d32;';
    wrap.appendChild(g);
    _snapGuideV = g;
    return g;
  }

  function _showSnapGuideV(canvasX) {
    var g = _getSnapGuideV();
    if (!g || !DDS_CY) return;
    var pan  = DDS_CY.pan();
    var zoom = DDS_CY.zoom();
    var cyEl = document.getElementById('dds-cy');
    var wrapEl = document.querySelector('.dds-canvas-wrap');
    if (!cyEl || !wrapEl) return;
    var offX = cyEl.getBoundingClientRect().left - wrapEl.getBoundingClientRect().left;
    var screenX = offX + canvasX * zoom + pan.x;
    g.style.left    = Math.round(screenX) + 'px';
    g.style.display = 'block';
  }

  function _hideSnapGuideV() {
    if (_snapGuideV) _snapGuideV.style.display = 'none';
  }

  function _findSnapY(dragNode) {
    var pos      = dragNode.position();
    var snapY    = null;
    var minDist  = SNAP_THRESHOLD;
    var X_TOL    = SNAP_THRESHOLD; // same tolerance for X alignment

    // Collect direct neighbours (connected by an edge in the map)
    var neighbourIds = {};
    dragNode.connectedEdges().forEach(function(e) {
      var other = e.source().id() === dragNode.id() ? e.target() : e.source();
      neighbourIds[other.id()] = other;
    });
    var neighbours = Object.keys(neighbourIds).map(function(id) { return neighbourIds[id]; });

    // Rule 1: snap to Y of any direct neighbour
    neighbours.forEach(function(n) {
      var dist = Math.abs(n.position().y - pos.y);
      if (dist < minDist) { minDist = dist; snapY = n.position().y; }
    });

    // Rule 2: snap to Y median of two same-side neighbours sharing the same X column
    // with no other node between them on that column
    var upstream   = []; // neighbours that are sources of edges TO dragNode
    var downstream = []; // neighbours that are targets of edges FROM dragNode
    dragNode.connectedEdges().forEach(function(e) {
      if (e.target().id() === dragNode.id()) upstream.push(e.source());
      else downstream.push(e.target());
    });

    var X_COL_TOL = 20; // wider tolerance for column detection
    [upstream, downstream].forEach(function(group) {
      for (var i = 0; i < group.length; i++) {
        for (var j = i + 1; j < group.length; j++) {
          var a = group[i], b = group[j];
          var ax = a.position().x, bx = b.position().x;
          if (Math.abs(ax - bx) > X_COL_TOL) continue;
          var colX  = (ax + bx) / 2;
          var ayPos = a.position().y, byPos = b.position().y;
          var yLo   = Math.min(ayPos, byPos);
          var yHi   = Math.max(ayPos, byPos);
          // No other map node between them on this column?
          var blocked = false;
          var allNodes = DDS_CY.nodes();
          for (var k = 0; k < allNodes.length; k++) {
            var n = allNodes[k];
            if (n.id() === a.id() || n.id() === b.id() || n.id() === dragNode.id()) continue;
            if (Math.abs(n.position().x - colX) > X_COL_TOL) continue;
            if (n.position().y > yLo && n.position().y < yHi) { blocked = true; break; }
          }
          if (blocked) continue;
          var medY = (ayPos + byPos) / 2;
          var dist = Math.abs(medY - pos.y);
          if (dist < minDist) { minDist = dist; snapY = medY; }
        }
      }
    });

    return snapY;
  }

  // _findSnapX — mirror of _findSnapY on the X axis
  function _findSnapX(dragNode) {
    var pos     = dragNode.position();
    var snapX   = null;
    var minDist = SNAP_THRESHOLD;

    var neighbourIds = {};
    dragNode.connectedEdges().forEach(function(e) {
      var other = e.source().id() === dragNode.id() ? e.target() : e.source();
      neighbourIds[other.id()] = other;
    });
    var neighbours = Object.keys(neighbourIds).map(function(id) { return neighbourIds[id]; });

    // Rule 1: snap to X of any direct neighbour
    neighbours.forEach(function(n) {
      var dist = Math.abs(n.position().x - pos.x);
      if (dist < minDist) { minDist = dist; snapX = n.position().x; }
    });

    // Rule 2: snap to X median of two same-side neighbours on the same Y row
    var upstream   = [];
    var downstream = [];
    dragNode.connectedEdges().forEach(function(e) {
      if (e.target().id() === dragNode.id()) upstream.push(e.source());
      else downstream.push(e.target());
    });

    var Y_ROW_TOL = 20;
    [upstream, downstream].forEach(function(group) {
      for (var i = 0; i < group.length; i++) {
        for (var j = i + 1; j < group.length; j++) {
          var a = group[i], b = group[j];
          var ay = a.position().y, by = b.position().y;
          if (Math.abs(ay - by) > Y_ROW_TOL) continue;
          var rowY  = (ay + by) / 2;
          var axPos = a.position().x, bxPos = b.position().x;
          var xLo   = Math.min(axPos, bxPos);
          var xHi   = Math.max(axPos, bxPos);
          // No other map node between them on this row?
          var blocked = false;
          var allNodes = DDS_CY.nodes();
          for (var k = 0; k < allNodes.length; k++) {
            var n = allNodes[k];
            if (n.id() === a.id() || n.id() === b.id() || n.id() === dragNode.id()) continue;
            if (Math.abs(n.position().y - rowY) > Y_ROW_TOL) continue;
            if (n.position().x > xLo && n.position().x < xHi) { blocked = true; break; }
          }
          if (blocked) continue;
          var medX = (axPos + bxPos) / 2;
          var dist = Math.abs(medX - pos.x);
          if (dist < minDist) { minDist = dist; snapX = medX; }
        }
      }
    });

    return snapX;
  }

  // During drag: show guide only, do NOT move node (avoids cursor detachment)
  DDS_CY.on('drag', 'node', function(e) {
    var snapY = _findSnapY(e.target);
    if (snapY !== null) { _showSnapGuide(snapY); } else { _hideSnapGuide(); }
    var snapX = _findSnapX(e.target);
    if (snapX !== null) { _showSnapGuideV(snapX); } else { _hideSnapGuideV(); }
  });

  // On release: apply snap and persist if within threshold
  DDS_CY.on('dragfree', 'node', function(e) {
    _hideSnapGuide();
    _hideSnapGuideV();
    var dragNode = e.target;
    var pos      = dragNode.position();
    var snapY    = _findSnapY(dragNode);
    var snapX    = _findSnapX(dragNode);
    var newX     = snapX !== null ? snapX : pos.x;
    var newY     = snapY !== null ? snapY : pos.y;
    if (snapX !== null || snapY !== null) {
      // Apply snap in Cytoscape only — store write handled by the persist handler below
      dragNode.position({ x: newX, y: newY });
    }
  });

  // Annotation ghost drag — persist absolute canvas position
  DDS_CY.on('dragfree', 'node.dds-annotation-ghost', function(e) {
    var ghost           = e.target;
    var mapAnnotationId = ghost.data('mapAnnotationId');
    var pos             = ghost.position();
    if (!mapAnnotationId) return;
    DDS_CMD.execute(TX.MAP_MOVE_ANNOTATION, { map_annotation_id: mapAnnotationId, x: pos.x, y: pos.y }, null);
  });

  // Ghost note drag — persist relative offset (node notes)
  DDS_CY.on('dragfree', 'node.dds-note-ghost', function(e) {
    var ghost     = e.target;
    var nodeId    = ghost.data('nodeId');
    var mapNodeId = ghost.data('mapNodeId');
    if (!mapNodeId) return;
    var parentCy = DDS_CY.$('#n' + nodeId);
    if (!parentCy.length) return;
    var gPos = ghost.position();
    var pPos = parentCy.position();
    var dx   = Math.round(gPos.x - pPos.x);
    var dy   = Math.round(gPos.y - pPos.y);
    DDS_CMD.execute(TX.MAP_MOVE_NOTE_GHOST, { map_node_id: mapNodeId, note_dx: dx, note_dy: dy }, null);
  });

  // Flow note ghost drag — persist offset relative to edge midpoint
  DDS_CY.on('dragfree', 'node.dds-flow-note-ghost', function(e) {
    var ghost     = e.target;
    var flowId    = ghost.data('flowId');
    var mapFlowId = ghost.data('mapFlowId');
    if (!mapFlowId) return;
    var cyEdge = DDS_CY.$('#e' + flowId);
    if (!cyEdge.length) return;
    var mid   = cyEdge.midpoint();
    var gPos  = ghost.position();
    var dx    = Math.round(gPos.x - mid.x);
    var dy    = Math.round(gPos.y - mid.y);
    DDS_CMD.execute(TX.MAP_MOVE_FLOW_NOTE_GHOST, { map_flow_id: mapFlowId, notes_annotation_dx: dx, notes_annotation_dy: dy }, null);
  });

  DDS_MAP.state.cytoscapeReady = true;
  DDS_FLOW_UI.init();
  if (typeof DDS_PANEL !== 'undefined' && DDS_PANEL._wireCy) DDS_PANEL._wireCy();
  if (typeof DDS_MAP._wireSelectionStyles === 'function') DDS_MAP._wireSelectionStyles();
};

DDS_MAP.loadMap = async function(mapId, preserveViewport) {
  DDS_MAP.state.currentMapId = mapId;
  DDS.state.currentMap = mapId;

  if (!DDS_MAP.state.cytoscapeReady) DDS_MAP.initCy();

  // Capture current viewport if requested
  var savedViewport = null;
  if (preserveViewport && DDS_CY) {
    savedViewport = { zoom: DDS_CY.zoom(), pan: DDS_CY.pan() };
  }

  // All data is in memory — read directly from DDS_STORE
  var mapNodes = DDS_STORE.query('map_nodes', { map_id: mapId });
  var mapFlows = DDS_STORE.query('map_flows', { map_id: mapId });
  var nodeById = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodeById[n.id] = n; });
  var flowById = {};
  DDS_STORE.query('flows').forEach(function(f) { flowById[f.id] = f; });

  var elements = [];

  mapNodes.forEach(function(mn) {
    var node = nodeById[mn.node_id];
    if (!node) return;
    elements.push({
      group: 'nodes',
      data: {
        id: 'n' + node.id, nodeId: node.id, mapNodeId: mn.id,
        label: node.name || '(unnamed)',
        shape: DDS_MAP.getShape(node.type_code),
        typeCode: node.type_code
      },
      position: { x: mn.x || 100, y: mn.y || 100 }
    });
  });

  mapFlows.forEach(function(mf) {
    var flow = flowById[mf.flow_id];
    if (!flow) return;
    var srcOnMap = mapNodes.some(function(mn) { return mn.node_id === flow.source_node_id; });
    var tgtOnMap = mapNodes.some(function(mn) { return mn.node_id === flow.target_node_id; });
    if (!srcOnMap || !tgtOnMap) return;
    // Read waypoint_pct from map_flow record
    var mfRec = DDS_STORE.query('map_flows', { map_id: mapId, flow_id: flow.id })[0];
    var wPct = (mfRec && mfRec.waypoint_pct != null) ? mfRec.waypoint_pct : 0.5;
    var _cs = (mfRec && mfRec.curve_style) ? mfRec.curve_style : 'taxi';
    var curveStyle = (_cs === 'straight') ? 'straight' : 'taxi'; // bezier fallback to taxi
    var layoutOffset = (mfRec && mfRec.layout_offset != null) ? mfRec.layout_offset : 1;
    var _isAnno = (mfRec && mfRec.notes_as_annotation === true);
    // Label: only for label mode (not annotation — ghost is created by renderFlowNoteGhosts)
    var _edgeLabel = (mfRec && mfRec.show_notes_label && flow.notes && !_isAnno) ? flow.notes : '';
    elements.push({
      group: 'edges',
      data: {
        id: 'e' + flow.id, flowId: flow.id, mapFlowId: mfRec ? mfRec.id : null,
        source: 'n' + flow.source_node_id,
        target: 'n' + flow.target_node_id,
        label: _edgeLabel,
        waypointPct: wPct,
        curveStyle: curveStyle,
        layoutOffset: layoutOffset,
        layoutDirectionInverted: (mfRec && mfRec.layout_direction_inverted === true) ? true : false,
        bidirectional: flow.bidirectional === true ? 'true' : 'false'
      }
    });
  });

  DDS_CY.elements().remove();
  DDS_CY.add(elements);

  // Apply per-edge curve-style and taxi-turn
  DDS_CY.edges().forEach(function(cyEdge) {
    var cs = cyEdge.data('curveStyle') || 'taxi';
    cyEdge.style('curve-style', cs);
    if (cs === 'taxi') {
      var pct = cyEdge.data('waypointPct');
      if (pct == null) pct = 0.5;
      cyEdge.style('taxi-turn', Math.round(pct * 100) + '%');
    }
  });

  await DDS_SWIMLANES.renderOverlay(mapId);
  DDS_MAP.applyNodeColors();
  DDS_MAP.applyFlowStyles();
  DDS_MAP.renderLegend();
  DDS_MAP.renderNoteGhosts(mapId);
  DDS_MAP.renderFlowNoteGhosts(mapId);
  DDS_MAP.renderAnnotationGhosts(mapId);
  DDS_MAP.renderCTTOverlays(mapId);
  // Notes panel — reload for the new map
  if (window.DDS_NOTES_UI) DDS_NOTES_UI.load(mapId);
  // BFS rank badges — only if flag active and ranks have been stored
  if (window.DDS_SETTINGS && DDS_SETTINGS.isShowBfsRanks()) {
    DDS_MAP.renderBfsRankBadges(mapId);
  }
  // NOTE: triggerAutoLayout is NOT called here — calling runLayout() after a
  // full elements().remove()/add() cycle while Cytoscape pointer events are
  // active causes nodes to enter drag mode on simple click (stale grabbed state).
  // Auto-layout is triggered explicitly: Layout button, or panel changes that
  // call loadMap(mapId, true) and then triggerAutoLayout via their own handlers.
  if (savedViewport) {
    DDS_CY.viewport(savedViewport);
    DDS_SWIMLANES.syncOverlay();
  } else {
    DDS_MAP.fitMap();
  }
};

DDS_MAP.fitMap = function() {
  if (!DDS_CY) return;
  setTimeout(function() {
    var mapId = DDS_MAP.state.currentMapId;
    var mapSwimLanes = mapId ? DDS_STORE.query('map_swim_lanes', { map_id: mapId }) : [];

    // Exclude only BFS rank badges from fit calculation — all ghosts (note, flow-note, annotation) are included
    var realElements = DDS_CY.elements().filter(function(el) {
      return !el.hasClass('dds-bfs-badge');
    });
    var hasNodes = realElements.length > 0;
    var hasSwimlanes = mapSwimLanes.length > 0;
    if (!hasNodes && !hasSwimlanes) { DDS_CY.reset(); return; }

    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    if (hasNodes) {
      var bb = realElements.boundingBox();
      x1 = Math.min(x1, bb.x1); y1 = Math.min(y1, bb.y1);
      x2 = Math.max(x2, bb.x2); y2 = Math.max(y2, bb.y2);
    }
    mapSwimLanes.forEach(function(msl) {
      var sx = msl.x || 0, sy = msl.y || 0;
      var sw = msl.width || 200, sh = msl.height || 300;
      x1 = Math.min(x1, sx);      y1 = Math.min(y1, sy);
      x2 = Math.max(x2, sx + sw); y2 = Math.max(y2, sy + sh);
    });

    var cw = DDS_CY.width(), ch = DDS_CY.height();
    var padTop    = Math.round(ch * 0.03);
    var padBottom = Math.round(ch * 0.03);
    var padSide   = Math.round(cw * 0.03);
    var contentW = x2 - x1, contentH = y2 - y1;
    // Legend is bottom-left: shrink usable width and shift content right
    var legendEl = document.getElementById('dds-legend');
    var legendPad = (legendEl && !legendEl.classList.contains('dds-hidden')) ? legendEl.offsetWidth + 16 : 0;
    var usableW = cw - padSide * 2 - legendPad;
    var usableH = ch - padTop - padBottom;
    var zoom = Math.min(usableW / contentW, usableH / contentH, 2);
    zoom = Math.max(zoom, 0.1);
    var panX = legendPad + padSide + (usableW - contentW * zoom) / 2 - x1 * zoom;
    var panY = padTop + (usableH - contentH * zoom) / 2 - y1 * zoom;
    DDS_CY.viewport({ zoom: zoom, pan: { x: panX, y: panY } });
    DDS_SWIMLANES.syncOverlay();
  }, 50);
};

// ============================================================
// DDS_MAP.runLayout — custom BFS ranking for swim-lane nodes
// ============================================================

DDS_MAP.runLayout = function() {
  if (!DDS_CY || DDS_CY.nodes().length === 0) return;

  var mapId    = DDS_MAP.state.currentMapId;
  var mapRec   = DDS_STORE.query('maps', { id: mapId })[0];
  var dir      = (mapRec && mapRec.direction === 'left-right') ? 'LR' : 'RL';
  var mapLanes = DDS_STORE.query('map_swim_lanes', { map_id: mapId });
  var allNodes = DDS_STORE.query('nodes');
  var allFlows = DDS_STORE.query('flows');

  var nodeById = {};
  allNodes.forEach(function(n) { nodeById[n.id] = n; });

  var laneById = {};
  mapLanes.forEach(function(msl) { laneById[msl.swim_lane_id] = msl; });

  // Group Cytoscape nodes by swim-lane
  var laneGroups = {};  // swim_lane_id -> [cyNode]
  var freeNodes  = [];
  DDS_CY.nodes().filter(function(cyNode) { return !cyNode.hasClass('dds-note-ghost') && !cyNode.hasClass('dds-flow-note-ghost') && !cyNode.hasClass('dds-bfs-badge') && !cyNode.hasClass('dds-annotation-ghost'); }).forEach(function(cyNode) {
    var node = nodeById[cyNode.data('nodeId')];
    var slId = node && node.swim_lane_id;
    if (slId && laneById[slId]) {
      if (!laneGroups[slId]) laneGroups[slId] = [];
      laneGroups[slId].push(cyNode);
    } else {
      freeNodes.push(cyNode);
    }
  });

  var allPositions = {}; // mapNodeId -> {x, y}

  // ----------------------------------------------------------
  // BFS ranking: local to each swim-lane.
  // Operates only on nodes and flows visible in the lane on the active map.
  // Nodes whose predecessors are all outside the lane are treated as sources (rank 0).
  // rankMax = longest-path, rankMin = shortest-path.
  // ----------------------------------------------------------
  function _computeRanksForLane(laneNodeIds) {
    var laneSet = {};
    laneNodeIds.forEach(function(id) { laneSet[id] = true; });

    // Only flows where BOTH endpoints are in the lane
    // layout_offset = 0 means the flow is excluded from BFS (nodes free to share a column)
    // layout_offset = N means the target is placed at least N columns after the source (default 1)
    var laneFlows = allFlows.filter(function(f) {
      if (!laneSet[f.source_node_id] || !laneSet[f.target_node_id]) return false;
      var cyEdge = DDS_CY ? DDS_CY.$('#e' + f.id) : null;
      var offset = (cyEdge && cyEdge.length) ? cyEdge.data('layoutOffset') : 1;
      if (offset == null) offset = 1;
      return offset > 0;
    });

    // Build offset map for weighted rank propagation
    // For bidirectional flows with layout_direction_inverted, swap source/target in the BFS graph.
    var flowOffset = {};
    laneFlows.forEach(function(f) {
      var cyEdge = DDS_CY ? DDS_CY.$('#e' + f.id) : null;
      var offset = (cyEdge && cyEdge.length) ? cyEdge.data('layoutOffset') : 1;
      var inverted = cyEdge && cyEdge.data('layoutDirectionInverted') === true;
      var src = inverted ? f.target_node_id : f.source_node_id;
      var tgt = inverted ? f.source_node_id : f.target_node_id;
      flowOffset[src + '_' + tgt] = (offset != null && offset > 0) ? offset : 1;
    });

    var successors   = {};
    var predecessors = {};
    laneNodeIds.forEach(function(id) { successors[id] = []; predecessors[id] = []; });
    laneFlows.forEach(function(f) {
      var cyEdge = DDS_CY ? DDS_CY.$('#e' + f.id) : null;
      var inverted = cyEdge && cyEdge.data('layoutDirectionInverted') === true;
      var src = inverted ? f.target_node_id : f.source_node_id;
      var tgt = inverted ? f.source_node_id : f.target_node_id;
      successors[src].push(tgt);
      predecessors[tgt].push(src);
    });

    // Sources = nodes with no internal predecessors (external flows don't count)
    var sources = laneNodeIds.filter(function(id) { return predecessors[id].length === 0; });

    // rankMin — longest-path from sources (Kahn, cycle-safe)
    // Ensures a node is placed AFTER all its predecessors.
    var inDegree = {};
    laneNodeIds.forEach(function(id) { inDegree[id] = predecessors[id].length; });
    var queue = sources.slice();
    var rankMin = {};
    laneNodeIds.forEach(function(id) { rankMin[id] = 0; });
    var visited = {};
    while (queue.length > 0) {
      var nId = queue.shift();
      if (visited[nId]) continue;
      visited[nId] = true;
      (successors[nId] || []).forEach(function(sId) {
        if (visited[sId]) return;
        var w = flowOffset[nId + '_' + sId] || 1;
        rankMin[sId] = Math.max(rankMin[sId], rankMin[nId] + w);
        inDegree[sId]--;
        if (inDegree[sId] <= 0) queue.push(sId);
      });
    }

    // rankMax — second pass:
    // rankMax(n) = min(rankMin(successors)) - 1
    // If no internal successors: rankMax(n) = max rankMin in lane (last column)
    var maxRankMin = 0;
    laneNodeIds.forEach(function(id) {
      if (rankMin[id] > maxRankMin) maxRankMin = rankMin[id];
    });

    var rankMax = {};
    laneNodeIds.forEach(function(id) {
      var succs = successors[id] || [];
      if (succs.length === 0) {
        rankMax[id] = maxRankMin;
      } else {
        var minSuccRank = Infinity;
        succs.forEach(function(sId) {
          if (rankMin[sId] < minSuccRank) minSuccRank = rankMin[sId];
        });
        rankMax[id] = minSuccRank - 1;
      }
      // rankMax must be >= rankMin
      if (rankMax[id] < rankMin[id]) rankMax[id] = rankMin[id];
    });

    return { rankMin: rankMin, rankMax: rankMax };
  }

  // ----------------------------------------------------------
  // Place swim-lane nodes using BFS ranks.
  // Each node is assigned to the column in [rankMin, rankMax]
  // whose X is closest to its pre-layout X.
  // Vertical spread for 3+ nodes is bounded by the YMin/YMax
  // of all current nodes in the lane (with margin).
  // ----------------------------------------------------------
  function _placeLaneNodes(cyNodes, msl, rankMin, rankMax) {
    if (cyNodes.length === 0) return;
    var pad = 40;
    var lx = (msl.x || 0) + pad;
    var ly = (msl.y || 0) + pad;
    var lw = (msl.width  || 200) - pad * 2;
    var lh = (msl.height || 300) - pad * 2;

    // Compute column X values over the full rank range [0, maxRankMin].
    // This includes empty columns created by layout_offset > 1, so nodes with a
    // [rankMin, rankMax] range that spans them can land in those columns.
    var maxRankInLane = 0;
    cyNodes.forEach(function(cn) {
      var nId = cn.data('nodeId');
      if (rankMax[nId] > maxRankInLane) maxRankInLane = rankMax[nId];
    });
    var ranks = [];
    for (var r = 0; r <= maxRankInLane; r++) ranks.push(r);
    var numRanks = ranks.length;
    var rankSep  = numRanks > 1 ? Math.min(150, Math.floor(lw / (numRanks - 1 || 1))) : 0;
    var totalW   = numRanks > 1 ? (numRanks - 1) * rankSep : 0;
    var startX   = lx + (lw - totalW) / 2;

    // Column X for each rank value
    var colX = {};
    ranks.forEach(function(r, idx) {
      colX[r] = dir === 'RL'
        ? Math.round(startX + totalW - idx * rankSep)
        : Math.round(startX + idx * rankSep);
    });

    // Assign each node to its best column (closest X in its [rankMin, rankMax] range)
    var byCol = {}; // colRank -> [cyNode]
    cyNodes.forEach(function(cn) {
      var nId   = cn.data('nodeId');
      var preX  = cn.position().x;
      var rMin  = rankMin[nId];
      var rMax  = rankMax[nId];
      var bestR = rMin;
      var bestD = Infinity;
      for (var r = rMin; r <= rMax; r++) {
        if (colX[r] === undefined) continue;
        var d = Math.abs(colX[r] - preX);
        if (d < bestD) { bestD = d; bestR = r; }
      }

      if (!byCol[bestR]) byCol[bestR] = [];
      byCol[bestR].push(cn);
    });

    // Sort within each column by pre-layout Y (vertical stability), then alphabetically by name
    Object.keys(byCol).forEach(function(r) {
      byCol[r].sort(function(a, b) {
        var dy = a.position().y - b.position().y;
        if (dy !== 0) return dy;
        var na = (a.data('label') || '').toLowerCase();
        var nb = (b.data('label') || '').toLowerCase();
        return na < nb ? -1 : na > nb ? 1 : 0;
      });
    });

    var yMargin = 20;
    var MIN_NODE_GAP = 60; // minimum vertical distance between node centres in a column

    // Anti-overlap pass: spread nodes in a column to maintain MIN_NODE_GAP.
    // Prefers the direction with more room inside the lane; falls back to best-fit
    // (centred on available range) if the full gap cannot be satisfied.
    function _resolveOverlap(group, nx, laneTop, laneBot) {
      var count = group.length;
      if (count < 2) return;

      // Sort by current Y ascending
      group.sort(function(a, b) { return a.position().y - b.position().y; });

      // Check if any pair is too close
      var needsSpread = false;
      for (var i = 1; i < count; i++) {
        if (group[i].position().y - group[i - 1].position().y < MIN_NODE_GAP) {
          needsSpread = true; break;
        }
      }
      if (!needsSpread) return;

      // Required span to fit all nodes with MIN_NODE_GAP
      var requiredSpan = (count - 1) * MIN_NODE_GAP;
      var available    = laneBot - laneTop;

      if (requiredSpan <= available) {
        // Fits — decide direction: expand toward the side with more room
        var currentTop = group[0].position().y;
        var currentBot = group[count - 1].position().y;
        var roomAbove  = currentTop - laneTop;
        var roomBelow  = laneBot - currentBot;
        var centreY;
        if (roomAbove >= roomBelow) {
          // More room above: anchor bottom, grow upward
          centreY = Math.min(laneBot - requiredSpan / 2, Math.max(laneTop + requiredSpan / 2,
            currentBot - requiredSpan / 2));
        } else {
          // More room below: anchor top, grow downward
          centreY = Math.max(laneTop + requiredSpan / 2, Math.min(laneBot - requiredSpan / 2,
            currentTop + requiredSpan / 2));
        }
        // Clamp centreY so spread stays within lane
        centreY = Math.max(laneTop + requiredSpan / 2, Math.min(laneBot - requiredSpan / 2, centreY));
        group.forEach(function(cyNode, idx) {
          var ny = Math.round(centreY + (idx - (count - 1) / 2) * MIN_NODE_GAP);
          cyNode.position({ x: nx, y: ny });
          allPositions[cyNode.data('mapNodeId')] = { x: nx, y: ny };
        });
      } else {
        // Does not fit — place at best-fit: evenly spaced, centred in available range
        var spacing = count > 1 ? Math.floor(available / (count - 1)) : 0;
        var centreY = (laneTop + laneBot) / 2;
        group.forEach(function(cyNode, idx) {
          var ny = Math.round(centreY + (idx - (count - 1) / 2) * spacing);
          cyNode.position({ x: nx, y: ny });
          allPositions[cyNode.data('mapNodeId')] = { x: nx, y: ny };
        });
      }
    }

    // Place each column
    Object.keys(byCol).forEach(function(r) {
      var group = byCol[r];
      var count = group.length;
      var nx    = colX[r];
      if (nx === undefined) return;

      var laneTop = ly + yMargin;
      var laneBot = ly + lh - yMargin;

      // Adjust lane bounds for overflowing elements on boundary nodes.
      // Sort group by pre-layout Y to identify top/bottom nodes.
      var _sorted = group.slice().sort(function(a, b) { return a.position().y - b.position().y; });
      var _topNode    = _sorted[0];
      var _bottomNode = _sorted[_sorted.length - 1];

      // Top node: label_position:above → label protrudes upward
      if (_topNode) {
        var _topNodeId  = _topNode.data('nodeId');
        var _topNt      = (function() {
          var _n = DDS_STORE.query('nodes', { id: _topNodeId })[0];
          return _n && _n.type_code ? DDS_STORE.query('node_types', { code: _n.type_code })[0] : null;
        })();
        if (_topNt && _topNt.label_position === 'above') laneTop += 20;
      }

      // Bottom node: note_visible:true → ghost note protrudes downward (default dy=30)
      if (_bottomNode) {
        var _botNodeId  = _bottomNode.data('nodeId');
        var _botMapNode = DDS_STORE.query('map_nodes', {
          map_id: DDS_MAP.state.currentMapId, node_id: _botNodeId
        })[0];
        var _botNode    = DDS_STORE.query('nodes', { id: _botNodeId })[0];
        if (_botMapNode && _botMapNode.note_visible && _botNode && _botNode.notes) {
          var _noteDy = (_botMapNode.note_dy != null) ? Math.abs(_botMapNode.note_dy) : 30;
          laneBot -= _noteDy;
        }
        // Also handle label_position:below on the bottom node
        var _botNt = (function() {
          return _botNode && _botNode.type_code
            ? DDS_STORE.query('node_types', { code: _botNode.type_code })[0] : null;
        })();
        if (_botNt && _botNt.label_position === 'below') laneBot -= 20;
      }

      if (count <= 2) {
        // Preserve pre-layout Y, clamped to lane bounds
        group.forEach(function(cyNode) {
          var preY = cyNode.position().y;
          var ny = Math.round(Math.max(laneTop, Math.min(laneBot, preY)));
          cyNode.position({ x: nx, y: ny });
          allPositions[cyNode.data('mapNodeId')] = { x: nx, y: ny };
        });
      } else {
        // Spread evenly between the column's own YMin/YMax (pre-layout), clamped to lane
        var colYMin = Infinity, colYMax = -Infinity;
        group.forEach(function(cn) {
          var y = cn.position().y;
          if (y < colYMin) colYMin = y;
          if (y > colYMax) colYMax = y;
        });
        colYMin = Math.max(laneTop, colYMin);
        colYMax = Math.min(laneBot, colYMax);
        if (colYMax <= colYMin) { colYMin = colYMax = (colYMin + colYMax) / 2; }
        var centreY = (colYMin + colYMax) / 2;
        var spread  = colYMax - colYMin;
        var maxSpacing = 110;
        var spacing = Math.min(maxSpacing, count > 1 ? Math.floor(spread / (count - 1)) : 0);
        group.forEach(function(cyNode, idx) {
          var ny = Math.round(centreY + (idx - (count - 1) / 2) * spacing);
          cyNode.position({ x: nx, y: ny });
          allPositions[cyNode.data('mapNodeId')] = { x: nx, y: ny };
        });
      }

      // Anti-overlap: enforce MIN_NODE_GAP for all columns with 2+ nodes
      if (count >= 2) {
        _resolveOverlap(group, nx, laneTop, laneBot);
      }
    });
  }

  // ----------------------------------------------------------
  // Dagre for free nodes (no swim-lane on this map)
  // ----------------------------------------------------------
  function _runDagre(collection, rankDir, done) {
    if (collection.length === 0) { done(); return; }
    var layout = collection.layout({
      name: 'dagre', rankDir: rankDir,
      ranker: 'longest-path',
      nodeSep: 50, rankSep: 120, padding: 20,
      animate: false
    });
    layout.on('layoutstop', function() { done(); });
    layout.run();
  }

  function _persist() {
    Object.keys(allPositions).forEach(function(mapNodeId) {
      var pos = allPositions[mapNodeId];
      DDS_STORE.update('map_nodes', { id: parseInt(mapNodeId) }, { x: pos.x, y: pos.y });
    });
    // Reposition ghost note nodes to follow their parent after layout
    DDS_CY.$('node.dds-note-ghost').forEach(function(ghost) {
      var nodeId    = ghost.data('nodeId');
      var mapNodeId = ghost.data('mapNodeId');
      var parentCy  = DDS_CY.$('#n' + nodeId);
      if (!parentCy.length) return;
      var mn = DDS_STORE.query('map_nodes', { id: mapNodeId })[0];
      var dx = (mn && mn.note_dx != null) ? mn.note_dx : 0;
      var dy = (mn && mn.note_dy != null) ? mn.note_dy : 30;
      var pPos = parentCy.position();
      ghost.position({ x: pPos.x + dx, y: pPos.y + dy });
    });
    // Reposition flow note ghosts to follow their edge midpoint after layout
    DDS_CY.$('node.dds-flow-note-ghost').forEach(function(ghost) {
      var flowId    = ghost.data('flowId');
      var mapFlowId = ghost.data('mapFlowId');
      var cyEdge    = DDS_CY.$('#e' + flowId);
      if (!cyEdge.length) return;
      var mf  = DDS_STORE.query('map_flows', { id: mapFlowId })[0];
      var dx  = (mf && mf.notes_annotation_dx != null) ? mf.notes_annotation_dx : 0;
      var dy  = (mf && mf.notes_annotation_dy != null) ? mf.notes_annotation_dy : -30;
      var mid = cyEdge.midpoint();
      ghost.position({ x: mid.x + dx, y: mid.y + dy });
    });
    DDS_SWIMLANES.syncOverlay();
    // Refresh BFS rank badges after layout if flag is active
    if (window.DDS_MAP && window.DDS_SETTINGS) {
      DDS_MAP.clearBfsRankBadges();
      if (DDS_SETTINGS.isShowBfsRanks()) DDS_MAP.renderBfsRankBadges(DDS_MAP.state.currentMapId);
    }
    DDS_MAP.fitMap();
  }

  // Place swim-lane nodes — ranks computed locally per lane
  var laneIds = Object.keys(laneGroups);
  var _showBfsRanks = window.DDS_SETTINGS && DDS_SETTINGS.isShowBfsRanks();
  laneIds.forEach(function(slId) {
    var cyNodes     = laneGroups[slId];
    var laneNodeIds = cyNodes.map(function(cn) { return cn.data('nodeId'); });
    var ranks       = _computeRanksForLane(laneNodeIds);
    _placeLaneNodes(cyNodes, laneById[slId], ranks.rankMin, ranks.rankMax);
    // Store BFS ranks on map_nodes only when show_bfs_ranks debug flag is active
    if (_showBfsRanks) {
      cyNodes.forEach(function(cn) {
        var nId = cn.data('nodeId');
        var mnId = cn.data('mapNodeId');
        if (!mnId) return;
        DDS_STORE.update('map_nodes', { id: mnId }, {
          bfs_rank_min: ranks.rankMin[nId] != null ? ranks.rankMin[nId] : null,
          bfs_rank_max: ranks.rankMax[nId] != null ? ranks.rankMax[nId] : null
        });
      });
    }
  });

  // Free nodes (no swim-lane on this map) are not repositioned by layout.
  _persist();
};

// ============================================================
// DDS_MAP.triggerAutoLayout — run layout if auto-layout is on
// ============================================================

DDS_MAP.triggerAutoLayout = function() {
  if (typeof DDS !== 'undefined' && DDS.getAutoLayout()) {
    setTimeout(function() { DDS_MAP.runLayout(); }, 0);
  }
};

// ============================================================
// DDS_MAP.renderNoteGhosts — create/refresh ghost note nodes
// ============================================================

// ============================================================
// DDS_MAP.renderFlowNoteGhosts — create/refresh flow note ghost nodes
// ============================================================

DDS_MAP.renderFlowNoteGhosts = function(mapId) {
  if (!DDS_CY) return;
  // Remove all existing flow note ghosts
  DDS_CY.$('node.dds-flow-note-ghost').remove();

  var mapFlows = DDS_STORE.query('map_flows', { map_id: mapId });
  mapFlows.forEach(function(mf) {
    if (!mf.show_notes_label || !mf.notes_as_annotation) return;
    var flow = DDS_STORE.query('flows', { id: mf.flow_id })[0];
    if (!flow || !flow.notes) return;
    var cyEdge = DDS_CY.$('#e' + flow.id);
    if (!cyEdge.length) return;
    var mid = cyEdge.midpoint();
    var dx  = (mf.notes_annotation_dx != null) ? mf.notes_annotation_dx : 0;
    var dy  = (mf.notes_annotation_dy != null) ? mf.notes_annotation_dy : -30;
    DDS_CY.add({
      group: 'nodes',
      classes: 'dds-flow-note-ghost',
      data: {
        id: 'flow-note-' + flow.id,
        flowId: flow.id,
        mapFlowId: mf.id,
        label: flow.notes
      },
      position: { x: mid.x + dx, y: mid.y + dy }
    });
  });
};

// Single-flow variant — used by panel handlers for immediate update
DDS_MAP.renderFlowNoteGhost = function(flowId, mapFlowId) {
  if (!DDS_CY) return;
  // Remove existing ghost for this flow
  DDS_CY.$('#flow-note-' + flowId).remove();
  var mf   = DDS_STORE.query('map_flows', { id: mapFlowId })[0];
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  if (!mf || !flow || !flow.notes) return;
  var cyEdge = DDS_CY.$('#e' + flowId);
  if (!cyEdge.length) return;
  var mid = cyEdge.midpoint();
  var dx  = (mf.notes_annotation_dx != null) ? mf.notes_annotation_dx : 0;
  var dy  = (mf.notes_annotation_dy != null) ? mf.notes_annotation_dy : -30;
  DDS_CY.add({
    group: 'nodes',
    classes: 'dds-flow-note-ghost',
    data: {
      id: 'flow-note-' + flowId,
      flowId: flowId,
      mapFlowId: mapFlowId,
      label: flow.notes
    },
    position: { x: mid.x + dx, y: mid.y + dy }
  });
};

// ============================================================
// DDS_MAP.renderNoteGhosts — create/refresh ghost note nodes
// ============================================================

// ============================================================
// DDS_MAP.renderAnnotationGhosts — create/refresh annotation ghost nodes
// ============================================================

DDS_MAP.renderAnnotationGhosts = function(mapId) {
  if (!DDS_CY) return;
  // Remove existing annotation ghosts
  DDS_CY.$('node.dds-annotation-ghost').remove();

  var mapAnnotations = DDS_STORE.query('map_annotations', { map_id: mapId });
  mapAnnotations.forEach(function(ma) {
    var ann = DDS_STORE.query('annotations', { id: ma.annotation_id })[0];
    if (!ann) return;
    var annGhost = DDS_CY.add({
      group: 'nodes',
      classes: 'dds-annotation-ghost',
      data: {
        id: 'ann-' + ann.id,
        annotationId: ann.id,
        mapAnnotationId: ma.id,
        label: ann.notes || ''
      },
      position: { x: ma.x || 0, y: ma.y || 0 }
    });
    // Apply per-map font size if set
    if (ma.font_size) annGhost.style('font-size', ma.font_size + 'px');
  });
};

DDS_MAP.renderNoteGhosts = function(mapId) {
  if (!DDS_CY) return;

  // Remove all existing ghosts
  DDS_CY.$('node.dds-note-ghost').remove();

  var mapNodes = DDS_STORE.query('map_nodes', { map_id: mapId });
  mapNodes.forEach(function(mn) {
    if (!mn.note_visible) return;
    var node = DDS_STORE.query('nodes', { id: mn.node_id })[0];
    if (!node || !node.notes) return;
    var parentCy = DDS_CY.$('#n' + node.id);
    if (!parentCy.length) return;
    var pPos = parentCy.position();
    var dx = (mn.note_dx != null) ? mn.note_dx : 0;
    var dy = (mn.note_dy != null) ? mn.note_dy : 30;
    DDS_CY.add({
      group: 'nodes',
      classes: 'dds-note-ghost',
      data: {
        id: 'note-' + node.id,
        nodeId: node.id,
        mapNodeId: mn.id,
        label: node.notes
      },
      position: { x: pPos.x + dx, y: pPos.y + dy }
    });
  });
};
