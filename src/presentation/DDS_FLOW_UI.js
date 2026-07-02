// ============================================================
// DDS_FLOW_UI — flow handle overlay + rerouting
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive flow interaction pipeline

var DDS_FLOW_UI = {};

// ---- Internal state ----------------------------------------
var _fh = {
  handle:      null,   // the handle div element
  ghost:       null,   // the ghost canvas element
  dragging:    false,
  srcCyNode:   null,   // Cytoscape node being dragged from
  currentTarget: null  // Cytoscape node under cursor during drag
};

// ---- Direction helper --------------------------------------
DDS_FLOW_UI._direction = function() {
  var mapId = DDS_MAP.state.currentMapId;
  var map   = (DDS_MAP.state.maps || []).find(function(m) { return m.id === mapId; });
  return map ? (map.direction || 'right-left') : 'right-left';
};

// ---- Handle positioning ------------------------------------
// Returns {left, top} in canvas-wrap pixel coords for the handle
DDS_FLOW_UI._handlePos = function(cyNode) {
  if (!cyNode || !DDS_CY) return null;
  var bb  = cyNode.renderedBoundingBox();
  var dir = DDS_FLOW_UI._direction();
  // Offset: add Cytoscape container offset within canvas-wrap
  var cyEl  = document.getElementById('dds-cy');
  var wrapEl = document.querySelector('.dds-canvas-wrap');
  if (!cyEl || !wrapEl) return null;
  var cyRect   = cyEl.getBoundingClientRect();
  var wrapRect = wrapEl.getBoundingClientRect();
  var offX = cyRect.left - wrapRect.left;
  var offY = cyRect.top  - wrapRect.top;

  var midY  = offY + (bb.y1 + bb.y2) / 2;
  var edgeX = dir === 'left-right'
    ? offX + bb.x2 - 11   // right edge (flows go left→right)
    : offX + bb.x1 - 11;  // left edge (flows go right→left)
  return { left: edgeX, top: midY - 11 };
};

// ---- Create / remove handle --------------------------------
DDS_FLOW_UI.showHandle = function(cyNode) {
  DDS_FLOW_UI.removeHandle();
  var wrap = document.querySelector('.dds-canvas-wrap');
  if (!wrap) return;

  var pos = DDS_FLOW_UI._handlePos(cyNode);
  if (!pos) return;

  var h = document.createElement('div');
  h.className = 'dds-flow-handle';
  h.id = 'dds-flow-handle';
  h.title = 'Drag to create a flow';
  // right-left → handle on left, arrow points left (◄); left-right → handle on right, arrow points right (►)
  h.textContent = DDS_FLOW_UI._direction() === 'left-right' ? '►' : '◄';
  h.style.left = pos.left + 'px';
  h.style.top  = pos.top  + 'px';

  h.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    DDS_FLOW_UI._startDrag(e, cyNode);
  });

  // Prevent handle from intercepting mousedown intended for node drag
  h.addEventListener('mouseenter', function() {
    if (cyNode) cyNode.ungrabify();
  });
  h.addEventListener('mouseleave', function() {
    if (!_fh.dragging && cyNode) cyNode.grabify();
  });

  wrap.appendChild(h);
  _fh.handle = h;
};

DDS_FLOW_UI.removeHandle = function() {
  if (_fh.handle) { _fh.handle.remove(); _fh.handle = null; }
};

DDS_FLOW_UI.updateHandlePos = function() {
  if (!_fh.handle || !_fh.srcCyNode || _fh.dragging) return;
  var pos = DDS_FLOW_UI._handlePos(_fh.srcCyNode);
  if (!pos) return;
  _fh.handle.style.left = pos.left + 'px';
  _fh.handle.style.top  = pos.top  + 'px';
};

// ---- Ghost canvas ------------------------------------------
DDS_FLOW_UI._ensureGhostCanvas = function() {
  if (document.getElementById('dds-flow-ghost-canvas')) return;
  var wrap = document.querySelector('.dds-canvas-wrap');
  if (!wrap) return;
  var c = document.createElement('canvas');
  c.id = 'dds-flow-ghost-canvas';
  c.width  = wrap.offsetWidth;
  c.height = wrap.offsetHeight;
  wrap.appendChild(c);
  _fh.ghost = c;
};

DDS_FLOW_UI._clearGhost = function() {
  var c = document.getElementById('dds-flow-ghost-canvas');
  if (!c) return;
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
};

DDS_FLOW_UI._drawGhost = function(x1, y1, x2, y2) {
  var c = document.getElementById('dds-flow-ghost-canvas');
  if (!c) return;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'var(--dds-accent, #2e7d32)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  // Arrowhead
  var angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 12 * Math.cos(angle - 0.4), y2 - 12 * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - 12 * Math.cos(angle + 0.4), y2 - 12 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = 'var(--dds-accent, #2e7d32)';
  ctx.fill();
  ctx.setLineDash([]);
};

// ---- Drag logic --------------------------------------------
DDS_FLOW_UI._startDrag = function(e, cyNode) {
  _fh.dragging    = true;
  _fh.srcCyNode   = cyNode;
  _fh.currentTarget = null;

  DDS_FLOW_UI._ensureGhostCanvas();

  // Starting point: centre of handle in canvas-wrap coords
  var wrap     = document.querySelector('.dds-canvas-wrap');
  var wrapRect = wrap.getBoundingClientRect();
  var startX   = e.clientX - wrapRect.left;
  var startY   = e.clientY - wrapRect.top;

  function onMove(ev) {
    var mx = ev.clientX - wrapRect.left;
    var my = ev.clientY - wrapRect.top;
    DDS_FLOW_UI._drawGhost(startX + 11, startY + 11, mx, my);

    // Highlight node under cursor via Cytoscape
    var cyRect = document.getElementById('dds-cy').getBoundingClientRect();
    var cx = ev.clientX - cyRect.left;
    var cy_y = ev.clientY - cyRect.top;
    var pan  = DDS_CY.pan(), zoom = DDS_CY.zoom();
    var modelX = (cx - pan.x) / zoom;
    var modelY = (cy_y - pan.y) / zoom;

    DDS_CY.nodes().removeClass('dds-flow-target');
    _fh.currentTarget = null;
    DDS_CY.nodes().forEach(function(n) {
      if (n.id() === cyNode.id()) return;
      var bb = n.boundingBox();
      if (modelX >= bb.x1 && modelX <= bb.x2 && modelY >= bb.y1 && modelY <= bb.y2) {
        n.addClass('dds-flow-target');
        _fh.currentTarget = n;
      }
    });
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    DDS_FLOW_UI._clearGhost();
    DDS_CY.nodes().removeClass('dds-flow-target');
    _fh.dragging = false;
    if (_fh.srcCyNode) _fh.srcCyNode.grabify();

    if (_fh.currentTarget) {
      DDS_FLOW_UI.createFlow(_fh.srcCyNode, _fh.currentTarget);
    }
    _fh.currentTarget = null;
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
};

// ---- Flow creation -----------------------------------------
DDS_FLOW_UI.createFlow = function(sourceCyNode, targetCyNode) {
  var mapId     = DDS_MAP.state.currentMapId;
  var srcNodeId = sourceCyNode.data('nodeId');
  var tgtNodeId = targetCyNode.data('nodeId');

  DDS_CMD.execute(TX.FLOW_CREATE, {
    source_id: srcNodeId, target_id: tgtNodeId
  }, mapId, function(cmdResult) {
    var edge = DDS_CY.add({ group: 'edges', data: {
      id: 'e' + cmdResult.flowId, flowId: cmdResult.flowId, mapFlowId: cmdResult.mapFlowId,
      source: sourceCyNode.id(), target: targetCyNode.id(),
      label: ''
    }});
    if (typeof DDS_PANEL !== 'undefined') DDS_PANEL.openFlow(edge);
    DDS_MAP.triggerAutoLayout();
  });
};

// ---- Rerouting — draggable endpoint handles ----------------
// Blue handle = source endpoint, purple handle = target endpoint.
// On edge select: two handles appear centred on source/target nodes.
// Drag a handle to another node → reroutes that endpoint.
// Release in empty space → cancels (no change).

var _rh = {
  srcHandle: null,
  tgtHandle: null,
  cyEdge:    null
};

DDS_FLOW_UI._rerouteHandlePos = function(cyNode, isSource, cyEdge) {
  // Use Cytoscape's exact rendered endpoint coordinates when an edge is provided.
  // sourceEndpoint() / targetEndpoint() return model coords → convert to screen.
  if (!cyNode || !DDS_CY) return null;
  var cyEl   = document.getElementById('dds-cy');
  var wrapEl = document.querySelector('.dds-canvas-wrap');
  if (!cyEl || !wrapEl) return null;
  var cyRect   = cyEl.getBoundingClientRect();
  var wrapRect = wrapEl.getBoundingClientRect();
  var offX = cyRect.left - wrapRect.left;
  var offY = cyRect.top  - wrapRect.top;

  if (cyEdge) {
    // Convert model coords to rendered (screen) coords
    var pan  = DDS_CY.pan();
    var zoom = DDS_CY.zoom();
    var ep   = isSource ? cyEdge.sourceEndpoint() : cyEdge.targetEndpoint();
    if (ep) {
      return {
        x: offX + ep.x * zoom + pan.x,
        y: offY + ep.y * zoom + pan.y
      };
    }
  }

  // Fallback: bord du nœud selon direction map
  var bb  = cyNode.renderedBoundingBox();
  var dir = DDS_FLOW_UI._direction();
  var edgeX;
  if (dir === 'left-right') {
    edgeX = isSource ? offX + bb.x2 : offX + bb.x1;
  } else {
    edgeX = isSource ? offX + bb.x1 : offX + bb.x2;
  }
  return { x: edgeX, y: offY + (bb.y1 + bb.y2) / 2 };
};

DDS_FLOW_UI._makeRerouteHandle = function(cls, cyEdge, isSource) {
  var wrap = document.querySelector('.dds-canvas-wrap');
  if (!wrap) return null;

  var fixedNode  = isSource ? cyEdge.source() : cyEdge.target();
  var otherNode  = isSource ? cyEdge.target() : cyEdge.source();
  var pos = DDS_FLOW_UI._rerouteHandlePos(fixedNode, isSource, cyEdge);
  if (!pos) return null;

  var h = document.createElement('div');
  h.className = 'dds-reroute-handle ' + cls;
  h.title = isSource ? 'Drag to reroute source' : 'Drag to reroute target';
  h.style.left = (pos.x - 9) + 'px';
  h.style.top  = (pos.y - 9) + 'px';

  h.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    var wrap     = document.querySelector('.dds-canvas-wrap');
    var wrapRect = wrap.getBoundingClientRect();

    // Disable Cytoscape pan during drag
    if (DDS_CY) DDS_CY.userPanningEnabled(false);

    DDS_FLOW_UI._ensureGhostCanvas();
    // Ghost starts from the opposite (fixed) endpoint
    var oppositePos = DDS_FLOW_UI._rerouteHandlePos(otherNode, !isSource, cyEdge);
    var startX = oppositePos ? oppositePos.x : e.clientX - wrapRect.left;
    var startY = oppositePos ? oppositePos.y : e.clientY - wrapRect.top;

    // Highlight valid target nodes (all except the fixed opposite endpoint)
    DDS_CY.nodes().forEach(function(n) {
      if (n.hasClass('dds-note-ghost')) return;
      if (n.id() !== otherNode.id()) n.addClass('dds-flow-target');
    });

    var hoveredNode = null;

    function onMove(ev) {
      var mx = ev.clientX - wrapRect.left;
      var my = ev.clientY - wrapRect.top;
      DDS_FLOW_UI._drawGhost(startX, startY, mx, my);
      h.style.left = (mx - 9) + 'px';
      h.style.top  = (my - 9) + 'px';

      // Detect node under cursor
      var cyEl   = document.getElementById('dds-cy');
      var cyRect = cyEl.getBoundingClientRect();
      var cx     = ev.clientX - cyRect.left;
      var cy_y   = ev.clientY - cyRect.top;
      var pan    = DDS_CY.pan(), zoom = DDS_CY.zoom();
      var modelX = (cx - pan.x) / zoom;
      var modelY = (cy_y - pan.y) / zoom;

      DDS_CY.nodes().removeClass('dds-flow-active-target');
      hoveredNode = null;
      DDS_CY.nodes().forEach(function(n) {
        if (n.hasClass('dds-note-ghost')) return;
        if (n.id() === otherNode.id()) return;
        var bb = n.boundingBox();
        if (modelX >= bb.x1 && modelX <= bb.x2 && modelY >= bb.y1 && modelY <= bb.y2) {
          n.addClass('dds-flow-active-target');
          hoveredNode = n;
        }
      });
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      DDS_FLOW_UI._clearGhost();
      DDS_CY.nodes().removeClass('dds-flow-target dds-flow-active-target');
      if (DDS_CY) DDS_CY.userPanningEnabled(true);

      if (hoveredNode) {
        var flowId    = cyEdge.data('flowId');
        var newNodeId = hoveredNode.data('nodeId');
        var newCyId   = hoveredNode.id();
        DDS_CMD.execute(TX.FLOW_REROUTE, {
          flow_id: flowId,
          new_source_id: isSource ? newNodeId : undefined,
          new_target_id: isSource ? undefined : newNodeId
        }, null, function(cmdResult) {
          if (isSource) {
            cyEdge.move({ source: newCyId });
          } else {
            cyEdge.move({ target: newCyId });
          }
          DDS_FLOW_UI._removeRerouteHandles();
          DDS_FLOW_UI._showRerouteHandles(cyEdge);
          if (typeof DDS_PANEL !== 'undefined') DDS_PANEL.openFlow(cyEdge);
          DDS_MAP.triggerAutoLayout();
        });
      } else {
        // Cancelled — snap handle back to node position
        var snapPos = DDS_FLOW_UI._rerouteHandlePos(fixedNode, isSource, cyEdge);
        if (snapPos) {
          h.style.left = (snapPos.x - 9) + 'px';
          h.style.top  = (snapPos.y - 9) + 'px';
        }
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  wrap.appendChild(h);
  return h;
};

DDS_FLOW_UI._showRerouteHandles = function(cyEdge) {
  DDS_FLOW_UI._removeRerouteHandles();
  _rh.cyEdge    = cyEdge;
  _rh.srcHandle = DDS_FLOW_UI._makeRerouteHandle('src', cyEdge, true);
  _rh.tgtHandle = DDS_FLOW_UI._makeRerouteHandle('tgt', cyEdge, false);
};

DDS_FLOW_UI._removeRerouteHandles = function() {
  if (_rh.srcHandle) { _rh.srcHandle.remove(); _rh.srcHandle = null; }
  if (_rh.tgtHandle) { _rh.tgtHandle.remove(); _rh.tgtHandle = null; }
  _rh.cyEdge = null;
};

DDS_FLOW_UI._updateRerouteHandlesPos = function() {
  if (!_rh.cyEdge) return;
  var srcPos = DDS_FLOW_UI._rerouteHandlePos(_rh.cyEdge.source(), true,  _rh.cyEdge);
  var tgtPos = DDS_FLOW_UI._rerouteHandlePos(_rh.cyEdge.target(), false, _rh.cyEdge);
  if (_rh.srcHandle && srcPos) {
    _rh.srcHandle.style.left = (srcPos.x - 9) + 'px';
    _rh.srcHandle.style.top  = (srcPos.y - 9) + 'px';
  }
  if (_rh.tgtHandle && tgtPos) {
    _rh.tgtHandle.style.left = (tgtPos.x - 9) + 'px';
    _rh.tgtHandle.style.top  = (tgtPos.y - 9) + 'px';
  }
};

DDS_FLOW_UI.initRerouting = function() {
  if (!DDS_CY) return;
  DDS_CY.on('select', 'edge', function(e) {
    DDS_FLOW_UI._showRerouteHandles(e.target);
  });
  DDS_CY.on('unselect', 'edge', function() {
    DDS_FLOW_UI._removeRerouteHandles();
  });
  DDS_CY.on('pan zoom', function() {
    DDS_FLOW_UI._updateRerouteHandlesPos();
  });
  DDS_CY.on('drag dragfree', 'node', function() {
    DDS_FLOW_UI._updateRerouteHandlesPos();
  });
};

// ---- Cytoscape node selection → show/hide handle -----------
DDS_FLOW_UI.initHandles = function() {
  if (!DDS_CY) return;

  DDS_CY.on('select', 'node', function(e) {
    if (e.target.hasClass('dds-note-ghost')) return;
    _fh.srcCyNode = e.target;
    DDS_FLOW_UI.showHandle(e.target);
  });

  DDS_CY.on('unselect', 'node', function() {
    if (_fh.dragging) return;
    DDS_FLOW_UI.removeHandle();
    _fh.srcCyNode = null;
  });

  // Keep handle in sync on pan/zoom/drag
  DDS_CY.on('pan zoom', function() { DDS_FLOW_UI.updateHandlePos(); });
  DDS_CY.on('drag dragfree', 'node', function(e) {
    if (_fh.srcCyNode && e.target.id() === _fh.srcCyNode.id()) {
      DDS_FLOW_UI.updateHandlePos();
    }
  });

  // Style for hover target
  DDS_CY.style()
    .selector('node.dds-flow-target').style({
      'border-color': 'var(--dds-accent, #2e7d32)',
      'border-width': 3,
      'border-style': 'dashed'
    })
    .update();
};

// ---- Waypoint handle (taxi-turn control) -------------------
// Shows a draggable handle on the taxi bend of the selected edge.
// Drag moves the bend horizontally (updates taxi-turn + persists waypoint_pct).
// Double-click resets to 50%.

var _wh = {
  handle:  null,   // div element
  cyEdge:  null    // currently selected edge
};

DDS_FLOW_UI._waypointPos = function(cyEdge) {
  // Compute the screen position of the taxi bend midpoint
  if (!cyEdge || !DDS_CY) return null;
  var src = cyEdge.source();
  var tgt = cyEdge.target();
  if (!src || !tgt) return null;

  var srcBB = src.renderedBoundingBox();
  var tgtBB = tgt.renderedBoundingBox();
  var pct   = parseFloat(cyEdge.style('taxi-turn')) / 100;
  if (isNaN(pct)) pct = 0.5;

  var cyEl   = document.getElementById('dds-cy');
  var wrapEl = document.querySelector('.dds-canvas-wrap');
  if (!cyEl || !wrapEl) return null;
  var cyRect   = cyEl.getBoundingClientRect();
  var wrapRect = wrapEl.getBoundingClientRect();
  var offX = cyRect.left - wrapRect.left;
  var offY = cyRect.top  - wrapRect.top;

  var srcMidX = offX + (srcBB.x1 + srcBB.x2) / 2;
  var tgtMidX = offX + (tgtBB.x1 + tgtBB.x2) / 2;
  var srcMidY = offY + (srcBB.y1 + srcBB.y2) / 2;
  var tgtMidY = offY + (tgtBB.y1 + tgtBB.y2) / 2;

  // Taxi bend X = interpolate between source and target X by pct
  var bendX = srcMidX + (tgtMidX - srcMidX) * pct;
  // Bend Y = midpoint between the two horizontal segments
  var bendY = (srcMidY + tgtMidY) / 2;

  return { x: bendX, y: bendY };
};

DDS_FLOW_UI._showWaypointHandle = function(cyEdge) {
  DDS_FLOW_UI._removeWaypointHandle();
  var wrap = document.querySelector('.dds-canvas-wrap');
  if (!wrap) return;
  var pos = DDS_FLOW_UI._waypointPos(cyEdge);
  if (!pos) return;

  var h = document.createElement('div');
  h.className = 'dds-waypoint-handle';
  h.id = 'dds-waypoint-handle';
  h.title = 'Drag to adjust bend · Double-click to reset';
  h.style.left = (pos.x - 8) + 'px';
  h.style.top  = (pos.y - 8) + 'px';
  _wh.cyEdge = cyEdge;

  // Drag: move bend horizontally
  h.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    var wrap     = document.querySelector('.dds-canvas-wrap');
    var wrapRect = wrap.getBoundingClientRect();
    var cyEl     = document.getElementById('dds-cy');
    var cyRect   = cyEl.getBoundingClientRect();
    var offX     = cyRect.left - wrapRect.left;

    var src    = cyEdge.source();
    var tgt    = cyEdge.target();
    var srcBB  = src.renderedBoundingBox();
    var tgtBB  = tgt.renderedBoundingBox();
    var srcMidX = offX + (srcBB.x1 + srcBB.x2) / 2;
    var tgtMidX = offX + (tgtBB.x1 + tgtBB.x2) / 2;
    var rangeX  = tgtMidX - srcMidX;
    var _lastPct = cyEdge.data('waypointPct') != null ? cyEdge.data('waypointPct') : 0.5;

    function onMove(ev) {
      if (Math.abs(rangeX) < 1) return;
      var mx  = ev.clientX - wrapRect.left;
      var pct = (mx - srcMidX) / rangeX;
      pct = Math.max(0.05, Math.min(0.95, pct));
      _lastPct = pct;
      cyEdge.style('taxi-turn', Math.round(pct * 100) + '%');
      // Move handle in real time
      var newPos = DDS_FLOW_UI._waypointPos(cyEdge);
      if (newPos) {
        h.style.left = (newPos.x - 8) + 'px';
        h.style.top  = (newPos.y - 8) + 'px';
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      // Persist using _lastPct captured during drag — avoids reading cyEdge.style()
      // which may return a computed value (px) rather than the percentage we set.
      var mapFlowId = cyEdge.data('mapFlowId');
      if (mapFlowId) {
        DDS_CMD.execute(TX.MAP_MOVE_WAYPOINT, { map_flow_id: mapFlowId, waypoint_pct: _lastPct }, null, function(cmdResult) {
          cyEdge.data('waypointPct', _lastPct);
        });
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  // Double-click: reset to 50%
  h.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    cyEdge.style('taxi-turn', '50%');
    var mapFlowId = cyEdge.data('mapFlowId');
    if (mapFlowId) {
      DDS_CMD.execute(TX.MAP_MOVE_WAYPOINT, { map_flow_id: mapFlowId, waypoint_pct: 0.5 }, null, function(cmdResult) {
        cyEdge.data('waypointPct', 0.5);
        var newPos = DDS_FLOW_UI._waypointPos(cyEdge);
        if (newPos) {
          h.style.left = (newPos.x - 8) + 'px';
          h.style.top  = (newPos.y - 8) + 'px';
        }
      });
    }
  });

  wrap.appendChild(h);
  _wh.handle = h;
};

DDS_FLOW_UI._removeWaypointHandle = function() {
  if (_wh.handle) { _wh.handle.remove(); _wh.handle = null; }
  _wh.cyEdge = null;
};

DDS_FLOW_UI._updateWaypointHandlePos = function() {
  if (!_wh.handle || !_wh.cyEdge) return;
  var pos = DDS_FLOW_UI._waypointPos(_wh.cyEdge);
  if (!pos) return;
  _wh.handle.style.left = (pos.x - 8) + 'px';
  _wh.handle.style.top  = (pos.y - 8) + 'px';
};

DDS_FLOW_UI.initWaypointHandle = function() {
  if (!DDS_CY) return;
  DDS_CY.on('select', 'edge', function(e) {
    _wh.cyEdge = e.target;
    // Only show waypoint handle for taxi edges
    var cs = e.target.data('curveStyle') || 'taxi';
    if (cs === 'taxi') DDS_FLOW_UI._showWaypointHandle(e.target);
  });
  DDS_CY.on('unselect', 'edge', function() {
    DDS_FLOW_UI._removeWaypointHandle();
  });
  DDS_CY.on('pan zoom', function() {
    DDS_FLOW_UI._updateWaypointHandlePos();
  });
  DDS_CY.on('drag dragfree', 'node', function() {
    DDS_FLOW_UI._updateWaypointHandlePos();
  });
};

// ---- Entry point -------------------------------------------
DDS_FLOW_UI.init = function() {
  DDS_FLOW_UI.initHandles();
  DDS_FLOW_UI.initRerouting();
  DDS_FLOW_UI.initWaypointHandle();
};

DDS_FLOW_UI.bindEvents = function() {}; // wired via DDS_MAP.initCy
