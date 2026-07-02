// ============================================================
// DDS_SWIMLANE_GROUP — swim-lane grouping logic
// ============================================================
// group_order format: 'X.Y' where X = group id, Y = position (left→right)
// Groups are always horizontal (lanes side by side).

var DDS_SWIMLANE_GROUP = {};

// Parse group_order string → { groupId, pos } or null
DDS_SWIMLANE_GROUP.parse = function(go) {
  if (!go) return null;
  var parts = String(go).split('.');
  if (parts.length !== 2) return null;
  return { groupId: parts[0], pos: parseFloat(parts[1]) };
};

// Get all map_swim_lanes for current map, grouped by group_order
DDS_SWIMLANE_GROUP.getGroups = function(mapId) {
  var all = DDS_STORE.query('map_swim_lanes', { map_id: mapId });
  var groups = {};
  all.forEach(function(msl) {
    if (!msl.group_order) return;
    var p = DDS_SWIMLANE_GROUP.parse(msl.group_order);
    if (!p) return;
    if (!groups[p.groupId]) groups[p.groupId] = [];
    groups[p.groupId].push({ msl: msl, pos: p.pos });
  });
  // Sort each group by pos
  Object.keys(groups).forEach(function(gid) {
    groups[gid].sort(function(a, b) { return a.pos - b.pos; });
  });
  return groups;
};

// Next available group ID for this map
DDS_SWIMLANE_GROUP.nextGroupId = function(mapId) {
  var groups = DDS_SWIMLANE_GROUP.getGroups(mapId);
  var ids = Object.keys(groups).map(Number).filter(function(n) { return !isNaN(n); });
  return ids.length === 0 ? 1 : Math.max.apply(null, ids) + 1;
};

// Snap two lanes into a group (or add dragged lane to existing group of target)
DDS_SWIMLANE_GROUP.snap = function(mapId, draggedMsl, targetMsl) {
  var targetParsed = DDS_SWIMLANE_GROUP.parse(targetMsl.group_order);
  var groupId;

  if (targetParsed) {
    // Target is already in a group — insert based on x position relative to group members
    groupId = targetParsed.groupId;
    var members = DDS_SWIMLANE_GROUP.getGroups(mapId)[groupId] || [];
    // Find insertion index: insert before the first member whose x > draggedMsl.x
    var insertBefore = members.length; // default: append at end
    for (var i = 0; i < members.length; i++) {
      if ((members[i].msl.x || 0) > (draggedMsl.x || 0)) {
        insertBefore = i;
        break;
      }
    }
    // Shift existing members with pos >= insertBefore + 1 up by 1
    for (var j = members.length - 1; j >= insertBefore; j--) {
      DDS_STORE.update('map_swim_lanes', { id: members[j].msl.id }, { group_order: groupId + '.' + (j + 2) });
    }
    DDS_STORE.update('map_swim_lanes', { id: draggedMsl.id }, { group_order: groupId + '.' + (insertBefore + 1) });
  } else {
    // Create new group — determine left/right based on x position
    groupId = DDS_SWIMLANE_GROUP.nextGroupId(mapId);
    if (draggedMsl.x < targetMsl.x) {
      DDS_STORE.update('map_swim_lanes', { id: draggedMsl.id }, { group_order: groupId + '.1' });
      DDS_STORE.update('map_swim_lanes', { id: targetMsl.id },  { group_order: groupId + '.2' });
    } else {
      DDS_STORE.update('map_swim_lanes', { id: targetMsl.id },  { group_order: groupId + '.1' });
      DDS_STORE.update('map_swim_lanes', { id: draggedMsl.id }, { group_order: groupId + '.2' });
    }
  }
};

// Detach a lane from its group, splitting into two groups if lane is in the middle
DDS_SWIMLANE_GROUP.detach = function(mapId, msl) {
  var freshMsl = DDS_STORE.query('map_swim_lanes', { id: msl.id })[0];
  var parsed = DDS_SWIMLANE_GROUP.parse(freshMsl && freshMsl.group_order);
  if (!parsed) return;

  // Get all members sorted by pos, excluding the detached lane
  var allMembers = DDS_SWIMLANE_GROUP.getGroups(mapId)[parsed.groupId] || [];
  var detachedPos = parsed.pos;
  var left  = allMembers.filter(function(m) { return m.pos < detachedPos; });
  var right = allMembers.filter(function(m) { return m.pos > detachedPos; });

  // Detach the lane
  DDS_STORE.update('map_swim_lanes', { id: msl.id }, { group_order: null });

  // Left group: keep original groupId, solo → null
  if (left.length === 1) {
    DDS_STORE.update('map_swim_lanes', { id: left[0].msl.id }, { group_order: null });
  } else {
    left.forEach(function(m, i) {
      DDS_STORE.update('map_swim_lanes', { id: m.msl.id }, { group_order: parsed.groupId + '.' + (i + 1) });
    });
  }

  // Right group: new groupId if 2+ members, solo → null
  if (right.length === 1) {
    DDS_STORE.update('map_swim_lanes', { id: right[0].msl.id }, { group_order: null });
  } else if (right.length > 1) {
    var newGroupId = DDS_SWIMLANE_GROUP.nextGroupId(mapId);
    right.forEach(function(m, i) {
      DDS_STORE.update('map_swim_lanes', { id: m.msl.id }, { group_order: newGroupId + '.' + (i + 1) });
    });
  }
};

// Apply shared height and side-by-side x positions to a group
// skipY: if true, do not update y (used during resize to allow vertical drag)
DDS_SWIMLANE_GROUP.applyLayout = function(mapId, groupId, skipY) {
  var members = DDS_SWIMLANE_GROUP.getGroups(mapId)[groupId];
  if (!members || members.length < 2) return;
  var maxH = Math.max.apply(null, members.map(function(m) { return m.msl.height || 300; }));
  var anchorX = members[0].msl.x || 0;
  var anchorY = members[0].msl.y || 0;
  var cursor = anchorX;
  members.forEach(function(m) {
    var upd = { x: cursor, height: maxH };
    if (!skipY) upd.y = anchorY;
    DDS_STORE.update('map_swim_lanes', { id: m.msl.id }, upd);
    m.msl.x = cursor;
    if (!skipY) m.msl.y = anchorY;
    m.msl.height = maxH;
    cursor += (m.msl.width || 200);
  });
};

// Render group bounding boxes on the overlay
DDS_SWIMLANE_GROUP.renderGroupBoxes = function(mapId) {
  var overlay = document.getElementById('dds-swimlane-overlay');
  if (!overlay) return;
  overlay.querySelectorAll('.dds-swimlane-group-box').forEach(function(el) { el.remove(); });

  if (!DDS_CY) return;
  var pan = DDS_CY.pan(), zoom = DDS_CY.zoom();
  var groups = DDS_SWIMLANE_GROUP.getGroups(mapId);
  var pad = 6;

  Object.keys(groups).forEach(function(gid) {
    var members = groups[gid];
    if (members.length < 2) return;
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    members.forEach(function(m) {
      var msl = m.msl;
      x1 = Math.min(x1, msl.x || 0);
      y1 = Math.min(y1, msl.y || 0);
      x2 = Math.max(x2, (msl.x || 0) + (msl.width || 200));
      y2 = Math.max(y2, (msl.y || 0) + (msl.height || 300));
    });
    var box = document.createElement('div');
    box.className = 'dds-swimlane-group-box';
    box.style.left   = (pan.x + x1 * zoom - pad) + 'px';
    box.style.top    = (pan.y + y1 * zoom - pad) + 'px';
    box.style.width  = ((x2 - x1) * zoom + pad * 2) + 'px';
    box.style.height = ((y2 - y1) * zoom + pad * 2) + 'px';
    overlay.insertBefore(box, overlay.firstChild);
  });
};

// Find nearest lane to dragged lane (excluding itself), return it if within threshold
DDS_SWIMLANE_GROUP.findSnapCandidate = function(mapId, draggedMsl, thresholdPx) {
  var all = DDS_STORE.query('map_swim_lanes', { map_id: mapId });
  var zoom = DDS_CY ? DDS_CY.zoom() : 1;
  var thresh = thresholdPx / zoom; // convert screen px to canvas coords
  var best = null, bestDist = Infinity;
  all.forEach(function(msl) {
    if (msl.id === draggedMsl.id) return;
    // Distance between right edge of msl and left edge of dragged (or vice versa)
    var distRL = Math.abs((msl.x || 0) + (msl.width || 200) - (draggedMsl.x || 0));
    var distLR = Math.abs((draggedMsl.x || 0) + (draggedMsl.width || 200) - (msl.x || 0));
    var dist = Math.min(distRL, distLR);
    if (dist < thresh && dist < bestDist) {
      bestDist = dist;
      best = msl;
    }
  });
  return best;
};
