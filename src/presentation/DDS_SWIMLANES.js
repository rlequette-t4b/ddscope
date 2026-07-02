// ============================================================
// DDS_SWIMLANES — overlay rendering + pan/zoom sync
// ============================================================

var DDS_SWIMLANES = {};

// Convert screen pixel delta to canvas coordinates
function _screenToCanvas(dx, dy) {
  var zoom = DDS_CY ? DDS_CY.zoom() : 1;
  return { dx: dx / zoom, dy: dy / zoom };
}

// Return all msl objects in the same group as msl (including itself), sorted by pos
function _getGroupMembers(mapId, msl) {
  var parsed = DDS_SWIMLANE_GROUP.parse(msl.group_order);
  if (!parsed) return [msl];
  var group = DDS_SWIMLANE_GROUP.getGroups(mapId)[parsed.groupId];
  if (!group) return [msl];
  return group.map(function(m) { return m.msl; });
}

// Snapshot node positions for a list of swim-lane ids
function _snapshotNodes(mapId, swimLaneIds) {
  var allNodes = DDS_STORE.query('nodes');
  var assignedNodeIds = allNodes
    .filter(function(n) { return swimLaneIds.indexOf(n.swim_lane_id) !== -1; })
    .map(function(n) { return n.id; });
  var snaps = {};
  DDS_STORE.query('map_nodes', { map_id: mapId }).forEach(function(mn) {
    if (assignedNodeIds.indexOf(mn.node_id) !== -1) {
      snaps[mn.id] = { mapNodeId: mn.id, nodeId: mn.node_id, x: mn.x || 0, y: mn.y || 0 };
    }
  });
  return snaps;
}

// Attach drag on header + resize on handle
function _bindSwimLaneInteractions(div, msl) {
  var overlay = document.getElementById('dds-swimlane-overlay');
  var header = div.querySelector('.dds-swimlane-header');
  var handle = div.querySelector('.dds-swimlane-resize');

  // --- Drag (+ click to open panel if no significant movement) ---
  header.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var startX = e.clientX, startY = e.clientY;
    var _moved = false;
    var mapId = DDS_MAP.state.currentMapId;
    // Open transaction before onMove touches msl/mn directly
    var _txId = DDS_TRANSACTIONS.begin(TX.MAP_RESIZE_LANE);

    // Snapshot all lanes in the group
    var groupMembers = _getGroupMembers(mapId, msl);
    var laneSnapshots = {};
    groupMembers.forEach(function(m) {
      laneSnapshots[m.id] = { msl: m, origX: m.x || 0, origY: m.y || 0 };
    });
    // Capture original lane values BEFORE begin (onMove mutates msl directly)
    var _laneOrigValues = {};
    groupMembers.forEach(function(m) {
      _laneOrigValues[m.id] = { x: m.x || 0, y: m.y || 0 };
    });
    // Snapshot nodes for all group lanes (used in normal drag)
    var nodeSnapshots = _snapshotNodes(mapId, groupMembers.map(function(m) { return m.swim_lane_id; }));
    // Snapshot nodes for dragged lane only (used in SHIFT drag)
    var ownNodeSnapshots = _snapshotNodes(mapId, [msl.swim_lane_id]);

    // Snapshot annotation positions for group lanes (normal drag)
    var annSnapshots = {};
    var draggedLaneIds = groupMembers.map(function(m) { return m.swim_lane_id; });
    DDS_STORE.query('annotations').filter(function(a) {
      return draggedLaneIds.indexOf(a.swim_lane_id) !== -1;
    }).forEach(function(ann) {
      var ma = DDS_STORE.query('map_annotations', { map_id: mapId, annotation_id: ann.id })[0];
      if (!ma) return;
      annSnapshots[ann.id] = { annotationId: ann.id, mapAnnotationId: ma.id, x: ma.x || 0, y: ma.y || 0 };
    });
    // Snapshot annotation positions for dragged lane only (SHIFT drag)
    var ownAnnSnapshots = {};
    DDS_STORE.query('annotations').filter(function(a) {
      return a.swim_lane_id === msl.swim_lane_id;
    }).forEach(function(ann) {
      var ma = DDS_STORE.query('map_annotations', { map_id: mapId, annotation_id: ann.id })[0];
      if (!ma) return;
      ownAnnSnapshots[ann.id] = { annotationId: ann.id, mapAnnotationId: ma.id, x: ma.x || 0, y: ma.y || 0 };
    });

    var _snapCandidate = null;

    function onMove(e) {
      if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) _moved = true;
      var delta = _screenToCanvas(e.clientX - startX, e.clientY - startY);
      if (e.shiftKey) {
        // SHIFT: move only the dragged lane + its own nodes
        msl.x = laneSnapshots[msl.id].origX + delta.dx;
        msl.y = laneSnapshots[msl.id].origY + delta.dy;
        Object.values(ownNodeSnapshots).forEach(function(snap) {
          var newX = snap.x + delta.dx;
          var newY = snap.y + delta.dy;
          var mn = DDS_STORE.query('map_nodes', { id: snap.mapNodeId })[0];
          if (mn) { mn.x = newX; mn.y = newY; }
          var cyNode = DDS_CY && DDS_CY.getElementById('n' + snap.nodeId);
          if (cyNode && cyNode.length) cyNode.position({ x: newX, y: newY });
          // Translate attached note ghost (SHIFT drag)
          if (DDS_CY) {
            var noteGhost = DDS_CY.$('#note-' + snap.nodeId);
            if (noteGhost.length) {
              var dx3 = mn ? (mn.note_dx != null ? mn.note_dx : 0) : 0;
              var dy3 = mn ? (mn.note_dy != null ? mn.note_dy : 30) : 30;
              noteGhost.position({ x: newX + dx3, y: newY + dy3 });
            }
          }
        });
        // Translate flow note ghosts for flows between SHIFT-moved nodes
        if (DDS_CY) {
          var shiftMovedNodeIds = Object.values(ownNodeSnapshots).map(function(s) { return s.nodeId; });
          DDS_CY.nodes('.dds-flow-note-ghost').forEach(function(ghost) {
            var flowId = ghost.data('flowId');
            var cyEdge = DDS_CY.$('#e' + flowId);
            if (!cyEdge.length) return;
            var srcId = cyEdge.data('source').replace('n', '');
            var tgtId = cyEdge.data('target').replace('n', '');
            if (shiftMovedNodeIds.indexOf(parseInt(srcId)) === -1 && shiftMovedNodeIds.indexOf(parseInt(tgtId)) === -1) return;
            var mid = cyEdge.midpoint();
            var mapFlowId = ghost.data('mapFlowId');
            var mf = mapFlowId ? DDS_STORE.query('map_flows', { id: mapFlowId })[0] : null;
            var adx = mf ? (mf.notes_annotation_dx != null ? mf.notes_annotation_dx : 0) : 0;
            var ady = mf ? (mf.notes_annotation_dy != null ? mf.notes_annotation_dy : -30) : -30;
            ghost.position({ x: mid.x + adx, y: mid.y + ady });
          });
        }
        // Translate annotation ghosts assigned to the SHIFT-dragged lane
        if (DDS_CY) {
          Object.values(ownAnnSnapshots).forEach(function(snap) {
            var newX = snap.x + delta.dx;
            var newY = snap.y + delta.dy;
            var ma = DDS_STORE.query('map_annotations', { id: snap.mapAnnotationId })[0];
            if (ma) { ma.x = newX; ma.y = newY; }
            var annGhost = DDS_CY.$('#ann-' + snap.annotationId);
            if (annGhost.length) annGhost.position({ x: newX, y: newY });
          });
        }
      } else {
        // Normal drag: move all lanes in group + their nodes
        Object.values(laneSnapshots).forEach(function(snap) {
          snap.msl.x = snap.origX + delta.dx;
          snap.msl.y = snap.origY + delta.dy;
        });
        Object.values(nodeSnapshots).forEach(function(snap) {
          var newX = snap.x + delta.dx;
          var newY = snap.y + delta.dy;
          var mn = DDS_STORE.query('map_nodes', { id: snap.mapNodeId })[0];
          if (mn) { mn.x = newX; mn.y = newY; }
          var cyNode = DDS_CY && DDS_CY.getElementById('n' + snap.nodeId);
          if (cyNode && cyNode.length) cyNode.position({ x: newX, y: newY });
          // Translate attached note ghost
          if (DDS_CY) {
            var noteGhost = DDS_CY.$('#note-' + snap.nodeId);
            if (noteGhost.length) {
              var dx2 = mn ? (mn.note_dx != null ? mn.note_dx : 0) : 0;
              var dy2 = mn ? (mn.note_dy != null ? mn.note_dy : 30) : 30;
              noteGhost.position({ x: newX + dx2, y: newY + dy2 });
            }
          }
        });
        // Translate flow note ghosts for flows between moved nodes
        if (DDS_CY) {
          var movedNodeIds = Object.values(nodeSnapshots).map(function(s) { return s.nodeId; });
          DDS_CY.nodes('.dds-flow-note-ghost').forEach(function(ghost) {
            var flowId = ghost.data('flowId');
            var cyEdge = DDS_CY.$('#e' + flowId);
            if (!cyEdge.length) return;
            var srcId = cyEdge.data('source').replace('n', '');
            var tgtId = cyEdge.data('target').replace('n', '');
            if (movedNodeIds.indexOf(parseInt(srcId)) === -1 && movedNodeIds.indexOf(parseInt(tgtId)) === -1) return;
            var mid = cyEdge.midpoint();
            var mapFlowId = ghost.data('mapFlowId');
            var mf = mapFlowId ? DDS_STORE.query('map_flows', { id: mapFlowId })[0] : null;
            var adx = mf ? (mf.notes_annotation_dx != null ? mf.notes_annotation_dx : 0) : 0;
            var ady = mf ? (mf.notes_annotation_dy != null ? mf.notes_annotation_dy : -30) : -30;
            ghost.position({ x: mid.x + adx, y: mid.y + ady });
          });
        }
        // Translate annotation ghosts assigned to any of the dragged lanes (normal drag)
        if (DDS_CY) {
          Object.values(annSnapshots).forEach(function(snap) {
            var newX = snap.x + delta.dx;
            var newY = snap.y + delta.dy;
            var ma = DDS_STORE.query('map_annotations', { id: snap.mapAnnotationId })[0];
            if (ma) { ma.x = newX; ma.y = newY; }
            var annGhost = DDS_CY.$('#ann-' + snap.annotationId);
            if (annGhost.length) annGhost.position({ x: newX, y: newY });
          });
        }
      }
      DDS_SWIMLANES.syncOverlay();
      // SHIFT: highlight snap candidate (only for ungrouped lanes)
      if (e.shiftKey && !DDS_SWIMLANE_GROUP.parse(msl.group_order)) {
        _snapCandidate = DDS_SWIMLANE_GROUP.findSnapCandidate(mapId, msl, 40);
        overlay.querySelectorAll('.dds-swimlane').forEach(function(d) { d.classList.remove('dds-swimlane-highlight'); });
        if (_snapCandidate) {
          var candDiv = overlay.querySelector('[data-map-swim-lane-id="' + _snapCandidate.id + '"]');
          if (candDiv) candDiv.classList.add('dds-swimlane-highlight');
        }
      } else {
        _snapCandidate = null;
      }
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      overlay.querySelectorAll('.dds-swimlane').forEach(function(d) { d.classList.remove('dds-swimlane-highlight'); });
      // Click (no drag) → rollback + open swim-lane panel
      if (!_moved) {
        DDS_TRANSACTIONS.rollback(_txId);
        if (typeof DDS_PANEL !== 'undefined') DDS_PANEL.openLane(msl.swim_lane_id);
        return;
      }
      // Persist lane + node positions.
      // onMove mutated msl.x/y directly — restore originals first so _addChange
      // captures the correct backup, then update to the new (current) values.
      Object.values(laneSnapshots).forEach(function(snap) {
        var orig = _laneOrigValues[snap.msl.id];
        var newX = snap.msl.x, newY = snap.msl.y;
        snap.msl.x = orig.x; snap.msl.y = orig.y; // restore for _addChange
        DDS_STORE.update('map_swim_lanes', { id: snap.msl.id }, { x: newX, y: newY });
      });
      Object.values(nodeSnapshots).forEach(function(snap) {
        var mn = DDS_STORE.query('map_nodes', { id: snap.mapNodeId })[0];
        if (mn) {
          var origX = snap.x, origY = snap.y;
          var newX = mn.x, newY = mn.y;
          mn.x = origX; mn.y = origY; // restore for _addChange
          DDS_STORE.update('map_nodes', { id: snap.mapNodeId }, { x: newX, y: newY });
        }
      });
      DDS_TRANSACTIONS.commit(_txId);
      // SHIFT: snap (ungrouped) or detach (grouped)
      if (e.shiftKey) {
        var parsed = DDS_SWIMLANE_GROUP.parse(msl.group_order);
        if (parsed) {
          DDS_SWIMLANE_GROUP.detach(mapId, msl);
        } else if (_snapCandidate) {
          DDS_SWIMLANE_GROUP.snap(mapId, msl, _snapCandidate);
          var freshMsl = DDS_STORE.query('map_swim_lanes', { id: msl.id })[0];
          var freshParsed = freshMsl && DDS_SWIMLANE_GROUP.parse(freshMsl.group_order);
          if (freshParsed) DDS_SWIMLANE_GROUP.applyLayout(mapId, freshParsed.groupId);
        }
        DDS_MAP.loadMap(mapId);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // --- Resize ---
  handle.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var startX = e.clientX, startY = e.clientY;
    var origW = msl.width || 200, origH = msl.height || 300;
    var mapId = DDS_MAP.state.currentMapId;
    // Capture original values of all group members BEFORE begin + onMove mutate them
    var parsed0 = DDS_SWIMLANE_GROUP.parse(msl.group_order);
    var _resizeMembers = parsed0 ? _getGroupMembers(mapId, msl) : [msl];
    var _resizeOrigValues = {};
    _resizeMembers.forEach(function(m) {
      _resizeOrigValues[m.id] = { x: m.x || 0, y: m.y || 0, width: m.width || 200, height: m.height || 300 };
    });
    // Open transaction before onMove touches msl directly
    var _txId = DDS_TRANSACTIONS.begin(TX.MAP_RESIZE_LANE);

    function onMove(e) {
      var delta = _screenToCanvas(e.clientX - startX, e.clientY - startY);
      msl.width  = Math.max(80,  origW + delta.dx);
      msl.height = Math.max(60, origH + delta.dy);
      var parsed = DDS_SWIMLANE_GROUP.parse(msl.group_order);
      if (parsed) {
        // Propagate dragged lane height to all members + reflow x positions
        var grpMembers = _getGroupMembers(mapId, msl);
        var anchorX = grpMembers[0].x || 0;
        var cursor = anchorX;
        grpMembers.forEach(function(m) {
          m.height = msl.height;
          m.x = cursor;
          cursor += (m.width || 200);
        });
      }
      DDS_SWIMLANES.syncOverlay();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      var parsed = DDS_SWIMLANE_GROUP.parse(msl.group_order);
      // Persist — restore originals first so _addChange captures correct backup,
      // then update to the new (current msl) values.
      if (parsed) {
        DDS_SWIMLANE_GROUP.applyLayout(mapId, parsed.groupId);
        _getGroupMembers(mapId, msl).forEach(function(m) {
          var orig = _resizeOrigValues[m.id];
          var newX = m.x, newY = m.y, newW = m.width, newH = m.height;
          if (orig) { m.x = orig.x; m.y = orig.y; m.width = orig.width; m.height = orig.height; }
          DDS_STORE.update('map_swim_lanes', { id: m.id }, { x: newX, y: newY, width: newW, height: newH });
        });
      } else {
        var orig = _resizeOrigValues[msl.id];
        var newW = msl.width, newH = msl.height;
        if (orig) { msl.width = orig.width; msl.height = orig.height; }
        DDS_STORE.update('map_swim_lanes', { id: msl.id }, { width: newW, height: newH });
      }
      DDS_TRANSACTIONS.commit(_txId);
      DDS_SWIMLANES.syncOverlay();
      DDS_MAP.triggerAutoLayout();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

DDS_SWIMLANES.renderOverlay = async function(mapId) {
  var overlay = document.getElementById('dds-swimlane-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';

  var mapSwimLanes = DDS_STORE.query('map_swim_lanes', { map_id: mapId });
  var swimLaneById = {};
  DDS_STORE.query('swim_lanes').forEach(function(sl) { swimLaneById[sl.id] = sl; });

  if (mapSwimLanes.length === 0) return;

  mapSwimLanes.forEach(function(msl) {
    var sl = swimLaneById[msl.swim_lane_id];
    if (!sl) return;
    var color = sl.color || '#6b7280';

    var div = document.createElement('div');
    div.className = 'dds-swimlane';
    div.dataset.swimLaneId = sl.id;
    div.dataset.mapSwimLaneId = msl.id;
    div.style.borderColor = color;

    var header = document.createElement('div');
    header.className = 'dds-swimlane-header';
    header.style.background = color;
    header.style.opacity = '0.75';
    header.style.color = DDS_MAP.resolveNodeTextColor(color);
    header.textContent = sl.name || '';

    var body = document.createElement('div');
    body.className = 'dds-swimlane-body';
    body.style.background = color;
    body.style.opacity = '0.08';

    var resizeHandle = document.createElement('div');
    resizeHandle.className = 'dds-swimlane-resize';

    div.appendChild(header);
    div.appendChild(body);
    div.appendChild(resizeHandle);
    overlay.appendChild(div);

    _bindSwimLaneInteractions(div, msl);
  });

  DDS_SWIMLANES.syncOverlay();
};

DDS_SWIMLANES.syncOverlay = function() {
  if (!DDS_CY) return;
  var pan  = DDS_CY.pan();
  var zoom = DDS_CY.zoom();
  var overlay = document.getElementById('dds-swimlane-overlay');
  if (!overlay) return;

  var mapId = DDS_MAP.state.currentMapId;
  var mapSwimLanes = DDS_STORE.query('map_swim_lanes', { map_id: mapId });
  var mslById = {};
  mapSwimLanes.forEach(function(msl) { mslById[msl.id] = msl; });

  overlay.querySelectorAll('.dds-swimlane').forEach(function(div) {
    var mslId = parseInt(div.dataset.mapSwimLaneId);
    var msl = mslById[mslId];
    if (!msl) return;
    div.style.left   = (pan.x + (msl.x || 0) * zoom) + 'px';
    div.style.top    = (pan.y + (msl.y || 0) * zoom) + 'px';
    div.style.width  = ((msl.width  || 200) * zoom) + 'px';
    div.style.height = ((msl.height || 300) * zoom) + 'px';
  });
};
