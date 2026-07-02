// ============================================================
// DDS_LAYOUT — smart node placement
// ============================================================

var DDS_LAYOUT = {};

// --- Constants ---
DDS_LAYOUT.NODE_SIZE    = 70;   // estimated node bounding box (px) — used to derive grid + margin
DDS_LAYOUT.NODE_GAP     = 20;   // minimum gap between node edges
DDS_LAYOUT.FALLBACK_Y   = 80;   // vertical offset below swim-lane bounding box
DDS_LAYOUT.FALLBACK_STEP = 120; // horizontal shift step when fallback pos is occupied

// Derive grid step and margin from node size + gap
// GRID = node size + gap; MARGIN = half node size (centre stays inside lane)
// MIN_DIST = node size + gap (same as grid, so adjacent slots don't overlap)
Object.defineProperty(DDS_LAYOUT, 'GRID_X',   { get: function() { return DDS_LAYOUT.NODE_SIZE + DDS_LAYOUT.NODE_GAP; } });
Object.defineProperty(DDS_LAYOUT, 'GRID_Y',   { get: function() { return DDS_LAYOUT.NODE_SIZE + DDS_LAYOUT.NODE_GAP; } });
Object.defineProperty(DDS_LAYOUT, 'MARGIN',   { get: function() { return Math.round(DDS_LAYOUT.NODE_SIZE / 2); } });
Object.defineProperty(DDS_LAYOUT, 'MIN_DIST', { get: function() { return DDS_LAYOUT.NODE_SIZE + DDS_LAYOUT.NODE_GAP; } });

// Update NODE_SIZE from actual Cytoscape bounding box if nodes exist on the map
DDS_LAYOUT._calibrate = function() {
  if (!DDS_CY) return;
  var nodes = DDS_CY.nodes();
  if (nodes.length === 0) return;
  var bb = nodes.first().boundingBox();
  var size = Math.round(Math.max(bb.w, bb.h));
  if (size > 10) DDS_LAYOUT.NODE_SIZE = size;
};

// Returns true if (x, y) is too close to any existing node on the map.
DDS_LAYOUT._occupied = function(x, y, mapNodes) {
  var minDist = DDS_LAYOUT.MIN_DIST;
  for (var i = 0; i < mapNodes.length; i++) {
    var mn = mapNodes[i];
    var dx = (mn.x || 0) - x;
    var dy = (mn.y || 0) - y;
    if (Math.sqrt(dx * dx + dy * dy) < minDist) return true;
  }
  return false;
};

// Returns {x, y} for nodeId on mapId.
DDS_LAYOUT.placeNode = function(nodeId, mapId) {
  DDS_LAYOUT._calibrate(); // update NODE_SIZE from actual Cytoscape nodes if available

  var node      = DDS_STORE.query('nodes', { id: nodeId })[0];
  var mapNodes  = DDS_STORE.query('map_nodes', { map_id: mapId });
  var mapLanes  = DDS_STORE.query('map_swim_lanes', { map_id: mapId });

  // --- Case 1: swim-lane assigned and present on this map ---
  if (node && node.swim_lane_id) {
    var msl = null;
    for (var i = 0; i < mapLanes.length; i++) {
      if (parseInt(mapLanes[i].swim_lane_id) === parseInt(node.swim_lane_id)) { msl = mapLanes[i]; break; }
    }
    if (msl) {
      var lx = msl.x || 0;
      var ly = msl.y || 0;
      var lw = msl.width  || 200;
      var lh = msl.height || 300;
      var m  = DDS_LAYOUT.MARGIN;
      var gx = DDS_LAYOUT.GRID_X;
      var gy = DDS_LAYOUT.GRID_Y;

      // Collect nodes already in this swim-lane on this map
      var laneNodeIds = DDS_STORE.query('nodes', { swim_lane_id: msl.swim_lane_id })
        .map(function(n) { return n.id; });
      var laneMapNodes = mapNodes.filter(function(mn) {
        return laneNodeIds.indexOf(mn.node_id) !== -1;
      });

      var targetY  = Math.round(ly + lh / 2);  // always vertically centred
      var maxRight = Math.round(lx + lw - m);   // right boundary with margin

      // Unified logic: start from lx (lane left edge) if empty, or rightmost existing node
      var maxX = lx;
      laneMapNodes.forEach(function(mn) { if ((mn.x || 0) > maxX) maxX = mn.x || 0; });
      var targetX = Math.round(Math.min(maxX + gx, maxRight));
      return { x: targetX, y: targetY };
    }
  }

  // --- Case 2: fallback — below swim-lane bounding box ---
  if (mapLanes.length > 0) {
    var minX =  Infinity, maxX = -Infinity, maxY = -Infinity;
    mapLanes.forEach(function(sl) {
      var slX = sl.x || 0;
      var slY = sl.y || 0;
      var slW = sl.width  || 200;
      var slH = sl.height || 300;
      if (slX < minX) minX = slX;
      if (slX + slW > maxX) maxX = slX + slW;
      if (slY + slH > maxY) maxY = slY + slH;
    });
    var centerX = Math.round((minX + maxX) / 2);
    var baseY   = Math.round(maxY + DDS_LAYOUT.FALLBACK_Y);
    // Shift left until free
    var step = DDS_LAYOUT.FALLBACK_STEP;
    for (var k = 0; k < 20; k++) {
      var fx = centerX - k * step;
      if (!DDS_LAYOUT._occupied(fx, baseY, mapNodes)) return { x: fx, y: baseY };
    }
    return { x: centerX, y: baseY };
  }

  // --- Ultimate fallback: centre of current viewport ---
  var ext = DDS_CY ? DDS_CY.extent() : { x1: 0, y1: 0, x2: 600, y2: 400 };
  return {
    x: Math.round((ext.x1 + ext.x2) / 2),
    y: Math.round((ext.y1 + ext.y2) / 2)
  };
};
