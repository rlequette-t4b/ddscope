// AUDITOR:LARGE_BLOCK_JUSTIFIED - Single cohesive map-visibility module.
// ============================================================
// DDS_ELEMENTS — add/remove elements from active map (all via DDS_STORE)
// ============================================================

var DDS_ELEMENTS = {};

DDS_ELEMENTS._mapId = function() { return DDS_MAP.state.currentMapId; };

DDS_ELEMENTS.nodeIdsOnMap = function() {
  return DDS_STORE.query('map_nodes', { map_id: DDS_ELEMENTS._mapId() }).map(function(r) { return r.node_id; });
};
DDS_ELEMENTS.flowIdsOnMap = function() {
  return DDS_STORE.query('map_flows', { map_id: DDS_ELEMENTS._mapId() }).map(function(r) { return r.flow_id; });
};
DDS_ELEMENTS.laneIdsOnMap = function() {
  return DDS_STORE.query('map_swim_lanes', { map_id: DDS_ELEMENTS._mapId() }).map(function(r) { return r.swim_lane_id; });
};
DDS_ELEMENTS.flowEligible = function(flow, nodeIdsOnMap) {
  return nodeIdsOnMap.includes(flow.source_node_id) && nodeIdsOnMap.includes(flow.target_node_id);
};

// ---- Add to map ----

DDS_ELEMENTS.addNode = function(nodeId) {
  var mapId = DDS_ELEMENTS._mapId();
  var pos = DDS_LAYOUT.placeNode(nodeId, mapId);
  var x = pos.x, y = pos.y;
  var rows = DDS_STORE.insert('map_nodes', { map_id: mapId, node_id: nodeId, x: x, y: y });
  var mapNodeId = rows[0].id;
  var node = DDS_STORE.query('nodes', { id: nodeId })[0];
  if (node && DDS_CY) {
    DDS_CY.add({ group: 'nodes', data: {
      id: 'n' + nodeId, nodeId: nodeId, mapNodeId: mapNodeId,
      label: node.name || '(unnamed)', shape: DDS_MAP.getShape(node.type_code), typeCode: node.type_code
    }, position: { x: x, y: y } });
    var emptyEl = document.getElementById('dds-map-empty');
    if (emptyEl) emptyEl.classList.add('dds-hidden');
  }
};

DDS_ELEMENTS.addFlow = function(flowId) {
  var mapId = DDS_ELEMENTS._mapId();
  DDS_STORE.insert('map_flows', { map_id: mapId, flow_id: flowId });
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  if (flow && DDS_CY) {
    DDS_CY.add({ group: 'edges', data: {
      id: 'e' + flowId, flowId: flowId,
      source: 'n' + flow.source_node_id, target: 'n' + flow.target_node_id,
      label: DDS_MAP.edgeLabel(flow)
    }});
  }
};

DDS_ELEMENTS.addLane = function(swimLaneId) {
  var mapId = DDS_ELEMENTS._mapId();
  var ext = DDS_CY ? DDS_CY.extent() : { x1: 0, y1: 0, x2: 600, y2: 400 };
  DDS_STORE.insert('map_swim_lanes', {
    map_id: mapId, swim_lane_id: swimLaneId,
    x: Math.round(ext.x1 + 20), y: Math.round(ext.y1 + 20),
    width: 200, height: 300, group_order: null
  });
  DDS_SWIMLANES.renderOverlay(mapId);
};

// ---- Remove from map ----

DDS_ELEMENTS.removeNode = function(nodeId) {
  var mapId = DDS_ELEMENTS._mapId();
  // Cascade: remove flows on this map where node is endpoint
  var affectedFlowIds = DDS_STORE.query('flows').filter(function(f) {
    return f.source_node_id === nodeId || f.target_node_id === nodeId;
  }).map(function(f) { return f.id; });
  if (affectedFlowIds.length > 0) {
    DDS_STORE.query('map_flows', { map_id: mapId }).filter(function(mf) {
      return affectedFlowIds.includes(mf.flow_id);
    }).forEach(function(mf) { DDS_STORE.remove('map_flows', { id: mf.id }); });
    if (DDS_CY) affectedFlowIds.forEach(function(fid) { DDS_CY.remove('#e' + fid); });
  }
  DDS_STORE.remove('map_nodes', { map_id: mapId, node_id: nodeId });
  if (DDS_CY) {
    DDS_CY.remove('#n' + nodeId);
    if (typeof DDS_FLOW_UI !== 'undefined') DDS_FLOW_UI.removeHandle();
  }
};

DDS_ELEMENTS.removeFlow = function(flowId) {
  DDS_STORE.remove('map_flows', { map_id: DDS_ELEMENTS._mapId(), flow_id: flowId });
  if (DDS_CY) DDS_CY.remove('#e' + flowId);
};

// ---- Annotations ----

DDS_ELEMENTS.annotationIdsOnMap = function() {
  return DDS_STORE.query('map_annotations', { map_id: DDS_ELEMENTS._mapId() }).map(function(r) { return r.annotation_id; });
};

DDS_ELEMENTS.addAnnotation = function(annotationId) {
  var mapId = DDS_ELEMENTS._mapId();

  // Place using DDS_LAYOUT-like logic (mirrors placeNode algorithm)
  var ann      = DDS_STORE.query('annotations', { id: annotationId })[0];
  var mapLanes = DDS_STORE.query('map_swim_lanes', { map_id: mapId });
  var mapNodes = DDS_STORE.query('map_nodes', { map_id: mapId });
  var gx       = DDS_LAYOUT ? DDS_LAYOUT.GRID_X : 90;
  var px = 0, py = 0;

  // Case 1: annotation has a swim-lane assigned and it is on this map
  var placed = false;
  if (ann && ann.swim_lane_id) {
    var msl = null;
    for (var i = 0; i < mapLanes.length; i++) {
      if (parseInt(mapLanes[i].swim_lane_id) === parseInt(ann.swim_lane_id)) { msl = mapLanes[i]; break; }
    }
    if (msl) {
      var lx = msl.x || 0;
      var ly = msl.y || 0;
      var lw = msl.width  || 200;
      var lh = msl.height || 300;
      var m  = DDS_LAYOUT ? DDS_LAYOUT.MARGIN : 35;
      // Collect existing nodes in this lane to find rightmost x
      var laneNodeIds = DDS_STORE.query('nodes', { swim_lane_id: ann.swim_lane_id }).map(function(n) { return n.id; });
      var laneMapNodes = mapNodes.filter(function(mn) { return laneNodeIds.indexOf(mn.node_id) !== -1; });
      var maxX = lx;
      laneMapNodes.forEach(function(mn) { if ((mn.x || 0) > maxX) maxX = mn.x || 0; });
      px = Math.round(Math.min(maxX + gx, lx + lw - m));
      py = Math.round(ly + lh / 2);
      placed = true;
    }
  }

  // Case 2: no lane (or lane absent from map) — below swim-lane bounding box
  if (!placed && mapLanes.length > 0) {
    var minX =  Infinity, maxX2 = -Infinity, maxY = -Infinity;
    mapLanes.forEach(function(sl) {
      var slX = sl.x || 0, slY = sl.y || 0, slW = sl.width || 200, slH = sl.height || 300;
      if (slX < minX) minX = slX;
      if (slX + slW > maxX2) maxX2 = slX + slW;
      if (slY + slH > maxY) maxY = slY + slH;
    });
    px = Math.round((minX + maxX2) / 2);
    py = Math.round(maxY + (DDS_LAYOUT ? DDS_LAYOUT.FALLBACK_Y : 80));
    placed = true;
  }

  // Case 3: no lanes at all — viewport centre
  if (!placed) {
    if (DDS_CY) {
      var ext = DDS_CY.extent();
      px = Math.round((ext.x1 + ext.x2) / 2);
      py = Math.round((ext.y1 + ext.y2) / 2);
    }
  }

  DDS_ANNOTATIONS.showOnMap(annotationId, mapId, px, py);
  // Render ghost on canvas
  if (typeof DDS_MAP !== 'undefined' && DDS_MAP.renderAnnotationGhosts) {
    DDS_MAP.renderAnnotationGhosts(mapId);
  }
};

DDS_ELEMENTS.removeAnnotation = function(annotationId) {
  var mapId = DDS_ELEMENTS._mapId();
  DDS_ANNOTATIONS.hideFromMap(annotationId, mapId);
  if (DDS_CY) {
    var ghost = DDS_CY.$('#ann-' + annotationId);
    if (ghost && ghost.length) ghost.remove();
  }
};

DDS_ELEMENTS.removeLane = function(swimLaneId) {
  var mapId = DDS_ELEMENTS._mapId();
  // Cascade: remove all nodes assigned to this swim-lane that are on this map
  var assignedNodeIds = DDS_STORE.query('nodes', { swim_lane_id: swimLaneId }).map(function(n) { return n.id; });
  var nodeIdsOnMap = DDS_STORE.query('map_nodes', { map_id: mapId }).map(function(mn) { return mn.node_id; });
  assignedNodeIds.filter(function(nid) { return nodeIdsOnMap.includes(nid); }).forEach(function(nid) {
    DDS_ELEMENTS.removeNode(nid);
  });
  // Remove swim-lane from map
  DDS_STORE.remove('map_swim_lanes', { map_id: mapId, swim_lane_id: swimLaneId });
  var div = document.querySelector('.dds-swimlane[data-swim-lane-id="' + swimLaneId + '"]');
  if (div) div.remove();
};
