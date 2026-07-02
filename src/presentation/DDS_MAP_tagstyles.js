// ============================================================
// DDS_MAP — tag style resolution + legend rendering
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - cohesive tag style + legend module

// Default node background color (matches CY_STYLE)
DDS_MAP.DEFAULT_NODE_COLOR = '#e2e8f0';

// Line width values for Fin / Normal / Épais
DDS_MAP.LINE_WIDTHS = { thin: 1, normal: 2, thick: 4 };

// Resolve the background color for a node based on its tags and tag_styles.
// Returns the color string, or DEFAULT_NODE_COLOR if no match.
DDS_MAP.resolveNodeColor = function(nodeId) {
  var node = DDS_STORE.query('nodes', { id: nodeId })[0];
  if (!node) return DDS_MAP.DEFAULT_NODE_COLOR;
  if (!node.tags || node.tags.length === 0) {
    if (node.type_code) {
      var nt = DDS_STORE.query('node_types', { code: node.type_code })[0];
      if (nt && nt.color) return nt.color;
    }
    return DDS_MAP.DEFAULT_NODE_COLOR;
  }
  var tagStyles = DDS_STORE.query('tag_styles');
  for (var i = 0; i < tagStyles.length; i++) {
    if (node.tags.indexOf(tagStyles[i].tag) !== -1) return tagStyles[i].color || DDS_MAP.DEFAULT_NODE_COLOR;
  }
  if (node.type_code) {
    var nodeType = DDS_STORE.query('node_types', { code: node.type_code })[0];
    if (nodeType && nodeType.color) return nodeType.color;
  }
  return DDS_MAP.DEFAULT_NODE_COLOR;
};

// Resolve the visual style for a flow edge based on its tags and tag_styles.
// Returns { line_color, line_style, line_width } — only defined fields from the first matching entry.
DDS_MAP.resolveFlowStyle = function(flowId) {
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  var result = {};
  if (!flow || !flow.tags || flow.tags.length === 0) return result;
  var tagStyles = DDS_STORE.query('tag_styles');
  for (var i = 0; i < tagStyles.length; i++) {
    var ts = tagStyles[i];
    if (flow.tags.indexOf(ts.tag) !== -1) {
      if (ts.line_color)  result.line_color  = ts.line_color;
      if (ts.line_style)  result.line_style  = ts.line_style;
      if (ts.line_width)  result.line_width  = DDS_MAP.LINE_WIDTHS[ts.line_width] || 2;
      return result;
    }
  }
  return result;
};

// Return #ffffff for dark backgrounds, #1a2130 for light ones.
DDS_MAP.resolveNodeTextColor = function(hexColor) {
  var c = hexColor ? hexColor.replace('#', '') : 'e2e8f0';
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  var r = parseInt(c.substring(0,2),16);
  var g = parseInt(c.substring(2,4),16);
  var b = parseInt(c.substring(4,6),16);
  // Relative luminance (WCAG)
  var luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance < 0.5 ? '#ffffff' : '#1a2130';
};

// Apply tag-based colors to all nodes currently on the Cytoscape canvas.
DDS_MAP.applyNodeColors = function() {
  if (!DDS_CY) return;
  DDS_CY.nodes().forEach(function(cyNode) {
    if (cyNode.hasClass('dds-note-ghost')) return;
    var nodeId = cyNode.data('nodeId');
    var color = DDS_MAP.resolveNodeColor(nodeId);
    var textColor = DDS_MAP.resolveNodeTextColor(color);
    cyNode.style('background-color', color);
    cyNode.style('color', textColor);
  });
};

// Apply tag-based styles to all edges currently on the Cytoscape canvas.
// Only set inline styles when a tag match provides an explicit value.
// For unmatched properties, removeStyle() lets the stylesheet (including
// edge:selected) take effect without being overridden by inline values.
DDS_MAP.applyFlowStyles = function() {
  if (!DDS_CY) return;
  DDS_CY.edges().forEach(function(cyEdge) {
    var flowId = cyEdge.data('flowId');
    var style = DDS_MAP.resolveFlowStyle(flowId);
    if (style.line_color) {
      cyEdge.style('line-color',         style.line_color);
      cyEdge.style('target-arrow-color', style.line_color);
    } else {
      cyEdge.removeStyle('line-color');
      cyEdge.removeStyle('target-arrow-color');
    }
    if (style.line_style) {
      cyEdge.style('line-style', style.line_style);
    } else {
      cyEdge.removeStyle('line-style');
    }
    if (style.line_width) {
      cyEdge.style('width', style.line_width);
    } else {
      cyEdge.removeStyle('width');
    }
  });
};

// Build an inline SVG shape (28x28) for a given Cytoscape shape name and fill color.
DDS_MAP._legendShape = function(shape, color) {
  var s = shape || 'rectangle';
  var c = color || '#e2e8f0';
  var stroke = 'rgba(0,0,0,0.18)';
  var w = 28, h = 28, cx = 14, cy2 = 14, r = 11;
  var inner = '';
  if (s === 'ellipse') {
    inner = '<ellipse cx="' + cx + '" cy="' + cy2 + '" rx="' + r + '" ry="' + (r - 1) + '" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else if (s === 'diamond') {
    inner = '<polygon points="14,3 25,14 14,25 3,14" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else if (s === 'hexagon') {
    inner = '<polygon points="14,2 24,8 24,20 14,26 4,20 4,8" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else if (s === 'triangle') {
    inner = '<polygon points="14,2 26,26 2,26" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else if (s === 'barrel') {
    inner = '<rect x="4" y="6" width="20" height="16" rx="5" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else if (s === 'rhomboid') {
    inner = '<polygon points="7,4 27,4 21,24 1,24" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else if (s === 'star') {
    inner = '<polygon points="14,2 16.9,10.2 25.5,10.2 18.8,15.5 21.3,24 14,18.8 6.7,24 9.2,15.5 2.5,10.2 11.1,10.2" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  } else {
    inner = '<rect x="3" y="6" width="22" height="16" rx="3" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>';
  }
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
};

// Build an inline SVG flow sample (48x20) for a line style entry in the legend.
DDS_MAP._legendFlowSample = function(lineColor, lineStyle, lineWidth) {
  var c = lineColor || '#9ca3af';
  var w = lineWidth || 2;
  var dashArr = lineStyle === 'dashed' ? '6,3' : lineStyle === 'dotted' ? '2,3' : 'none';
  var d = dashArr !== 'none' ? ' stroke-dasharray="' + dashArr + '"' : '';
  return '<svg width="48" height="20" viewBox="0 0 48 20" xmlns="http://www.w3.org/2000/svg">' +
    '<line x1="4" y1="10" x2="38" y2="10" stroke="' + c + '" stroke-width="' + w + '"' + d + '/>' +
    '<polygon points="38,6 46,10 38,14" fill="' + c + '"/>' +
    '</svg>';
};

// Render the legend overlay for the active map.
// Section 1: nodes — (node_type x tag) combinations.
// Section 2: flows — tag_styles entries with at least one flow attribute, present on the map.
DDS_MAP.renderLegend = function() {
  var el = document.getElementById('dds-legend');
  if (!el) return;

  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId || !DDS_STORE.getProject()) { el.innerHTML = ''; el.classList.add('dds-hidden'); return; }

  var mapRec = DDS_STORE.query('maps', { id: mapId })[0];
  var visible = !mapRec || mapRec.legend_visible !== false;
  if (!visible) { el.classList.add('dds-hidden'); return; }
  el.classList.remove('dds-hidden');

  var tagStyles = DDS_STORE.query('tag_styles');
  if (tagStyles.length === 0) { el.innerHTML = ''; el.classList.add('dds-hidden'); return; }

  var nodeTypes  = DDS_STORE.query('node_types');
  var typeByCode = {};
  nodeTypes.forEach(function(t) { typeByCode[t.code] = t; });

  // --- Node section ---
  var mapNodes = DDS_STORE.query('map_nodes', { map_id: mapId });
  var nodeIds  = mapNodes.map(function(mn) { return mn.node_id; });
  var nodes    = DDS_STORE.query('nodes').filter(function(n) { return nodeIds.indexOf(n.id) !== -1; });

  var tagStyleMap = {}; // tag -> { color, line_color, line_style, line_width }
  tagStyles.forEach(function(ts) { tagStyleMap[ts.tag] = ts; });

  // Group nodes by type_code, then matched tags
  var byType = {};
  nodes.forEach(function(n) {
    if (!n.type_code) return;
    (n.tags || []).forEach(function(tag) {
      if (!tagStyleMap[tag] || !tagStyleMap[tag].color) return;
      if (!byType[n.type_code]) byType[n.type_code] = {};
      byType[n.type_code][tag] = true;
    });
  });

  // --- Flow section ---
  var mapFlows = DDS_STORE.query('map_flows', { map_id: mapId });
  var flowIds  = mapFlows.map(function(mf) { return mf.flow_id; });
  var flows    = DDS_STORE.query('flows').filter(function(f) { return flowIds.indexOf(f.id) !== -1; });

  // tag_styles entries with at least one flow attribute (line_color, line_style, line_width)
  // that are matched by at least one flow on the map
  var flowTagsSeen = {}; // tag -> ts record
  flows.forEach(function(f) {
    (f.tags || []).forEach(function(tag) {
      var ts = tagStyleMap[tag];
      if (!ts) return;
      if (ts.line_color || ts.line_style || ts.line_width) {
        flowTagsSeen[tag] = ts;
      }
    });
  });

  var typeCodes = Object.keys(byType);
  var flowTags  = tagStyles.filter(function(ts) { return flowTagsSeen[ts.tag]; });

  if (typeCodes.length === 0 && flowTags.length === 0) {
    el.innerHTML = ''; el.classList.add('dds-hidden'); return;
  }

  var html = '<div class="dds-legend-title">Legend</div>';

  // Node entries grouped by type
  if (typeCodes.length > 0) {
    typeCodes.forEach(function(code) {
      var typeDef  = typeByCode[code];
      var typeLabel = typeDef ? (typeDef.label || code) : code;
      var shape    = typeDef ? (typeDef.shape || 'rectangle') : 'rectangle';
      html += '<div class="dds-legend-group-title">' + typeLabel + '</div>';
      tagStyles.forEach(function(ts) {
        if (!byType[code][ts.tag] || !ts.color) return;
        html += '<div class="dds-legend-entry">' +
          DDS_MAP._legendShape(shape, ts.color) +
          '<span>' + ts.tag + '</span></div>';
      });
    });
  }

  // Flow entries
  if (flowTags.length > 0) {
    html += '<div class="dds-legend-group-title">Flows</div>';
    flowTags.forEach(function(ts) {
      var lc = ts.line_color  || '#9ca3af';
      var ls = ts.line_style  || 'solid';
      var lw = DDS_MAP.LINE_WIDTHS[ts.line_width] || 2;
      html += '<div class="dds-legend-entry">' +
        DDS_MAP._legendFlowSample(lc, ls, lw) +
        '<span>' + ts.tag + '</span></div>';
    });
  }

  el.innerHTML = html;
};

// Wire select/unselect handlers for inline highlight on nodes and edges.
// Called from DDS_MAP.initCy after DDS_CY is created.
// Inline styles set by applyNodeColors/applyFlowStyles take priority over the
// stylesheet selectors node:selected / edge:selected, so we manage highlight
// explicitly here: force highlight inline on select, restore tag-style on unselect.
DDS_MAP._wireSelectionStyles = function() {
  if (!DDS_CY) return;

  // ---- Edges --------------------------------------------------
  var EDGE_SEL_COLOR = '#2e7d32';
  var EDGE_SEL_WIDTH = 4;

  DDS_CY.on('select', 'edge', function(e) {
    var el = e.target;
    el.style('line-color',         EDGE_SEL_COLOR);
    el.style('target-arrow-color', EDGE_SEL_COLOR);
    el.style('width',              EDGE_SEL_WIDTH);
  });

  DDS_CY.on('unselect', 'edge', function(e) {
    var el = e.target;
    var s = DDS_MAP.resolveFlowStyle(el.data('flowId'));
    if (s.line_color) {
      el.style('line-color',         s.line_color);
      el.style('target-arrow-color', s.line_color);
    } else {
      el.removeStyle('line-color');
      el.removeStyle('target-arrow-color');
    }
    if (s.line_width) { el.style('width', s.line_width); } else { el.removeStyle('width'); }
    if (s.line_style) { el.style('line-style', s.line_style); } else { el.removeStyle('line-style'); }
  });

  // ---- Nodes --------------------------------------------------
  var NODE_SEL_COLOR = '#2e7d32';
  var NODE_SEL_WIDTH = 3;

  DDS_CY.on('select', 'node', function(e) {
    var el = e.target;
    if (el.hasClass('dds-note-ghost')) return;
    el.style('border-color', NODE_SEL_COLOR);
    el.style('border-width', NODE_SEL_WIDTH);
    // For transparent_bg nodes the border is hidden — restore visibility on select
    var nodeId = el.data('nodeId');
    var _sn = DDS_STORE.query('nodes', { id: nodeId })[0];
    var _snt = _sn && _sn.type_code ? DDS_STORE.query('node_types', { code: _sn.type_code })[0] : null;
    if (_snt && _snt.transparent_bg === true) el.style('border-opacity', 1);
  });

  DDS_CY.on('unselect', 'node', function(e) {
    var el = e.target;
    if (el.hasClass('dds-note-ghost')) return;
    el.removeStyle('border-color');
    el.removeStyle('border-width');
    // Restore hidden border for transparent_bg nodes
    var nodeId = el.data('nodeId');
    var _un = DDS_STORE.query('nodes', { id: nodeId })[0];
    var _unt = _un && _un.type_code ? DDS_STORE.query('node_types', { code: _un.type_code })[0] : null;
    if (_unt && _unt.transparent_bg === true) el.style('border-opacity', 0);
  });
};

// Toggle legend visibility and persist to the map record.
DDS_MAP.toggleLegend = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  var mapRec = DDS_STORE.query('maps', { id: mapId })[0];
  if (!mapRec) return;
  var newVal = mapRec.legend_visible === false ? true : false;
  DDS_STORE.update('maps', { id: mapId }, { legend_visible: newVal });
  DDS_MAP.renderLegend();
};

// Apply full visual style (color + icon + label position) to a single Cytoscape node.
// Reads icon_key, label_position, transparent_bg from the node's node_type.
// Falls back to color-only when icon_key is absent or unresolved.
DDS_MAP.applyNodeStyle = function(cyNode) {
  if (!cyNode || cyNode.hasClass('dds-note-ghost')) return;
  var nodeId = cyNode.data('nodeId');
  var color  = DDS_MAP.resolveNodeColor(nodeId);

  var node = DDS_STORE.query('nodes', { id: nodeId })[0];
  var nt   = node && node.type_code ? DDS_STORE.query('node_types', { code: node.type_code })[0] : null;

  // map_node label_position overrides the node type when set
  var _mapId  = DDS_MAP.state && DDS_MAP.state.currentMapId;
  var _mnRec  = _mapId ? DDS_STORE.query('map_nodes', { map_id: _mapId, node_id: nodeId })[0] : null;

  var iconKey      = nt ? (nt.icon_key      || null)    : null;
  var labelPos     = (_mnRec && _mnRec.label_position)
    ? _mnRec.label_position
    : (nt ? (nt.label_position || 'center') : 'center');
  var transparentBg = nt ? (nt.transparent_bg === true)  : false;

  // Label position
  var valign, marginY, textColor;
  if (labelPos === 'below') {
    valign = 'bottom'; marginY = 8; textColor = '#222222';
  } else if (labelPos === 'above') {
    valign = 'top'; marginY = -8; textColor = '#222222';
  } else {
    valign = 'center'; marginY = 0; textColor = DDS_MAP.resolveNodeTextColor(color);
  }
  cyNode.style('text-valign',   valign);
  cyNode.style('text-margin-y', marginY);
  cyNode.style('color',         textColor);

  // Fixed size when label is outside the shape (below/above) AND an icon is present.
  // Shape-only nodes (no icon_key) keep their natural dimensions to preserve aspect ratio.
  if ((labelPos === 'below' || labelPos === 'above') && iconKey) {
    cyNode.style('width',  40);
    cyNode.style('height', 40);
  } else {
    cyNode.removeStyle('width');
    cyNode.removeStyle('height');
  }

  // Icon + background
  var dataUrl = iconKey && window.DDS_ICONS ? DDS_ICONS.toDataUrl(iconKey, transparentBg ? color : null) : null;

  if (dataUrl) {
    if (transparentBg) {
      cyNode.style('background-color',   '#ffffff');
      cyNode.style('background-opacity', 0);
      cyNode.style('border-width',       0);
      cyNode.style('border-opacity',     0);
    } else {
      cyNode.style('background-color',   color);
      cyNode.style('background-opacity', 1);
      cyNode.removeStyle('border-width');
      cyNode.removeStyle('border-opacity');
    }
    cyNode.style('background-image',   dataUrl);
    cyNode.style('background-fit',     'contain');
    cyNode.style('background-clip',    'none');
  } else {
    cyNode.style('background-image',   'none');
    cyNode.style('background-opacity', 1);
    cyNode.style('background-color',   color);
    cyNode.removeStyle('border-width');
    cyNode.removeStyle('border-opacity');
  }
};

// Apply full visual style to all nodes on the Cytoscape canvas.
// Replaces the former applyNodeColors(). Called at end of loadMap and on tag_styles change.
DDS_MAP.applyAllNodeStyles = function() {
  if (!DDS_CY) return;
  DDS_CY.nodes().forEach(function(cyNode) {
    DDS_MAP.applyNodeStyle(cyNode);
  });
};

// Keep applyNodeColors as an alias for backwards compatibility.
DDS_MAP.applyNodeColors = DDS_MAP.applyAllNodeStyles;

// Remove all BFS rank badge ghost nodes from the canvas.
DDS_MAP.clearBfsRankBadges = function() {
  if (!DDS_CY) return;
  DDS_CY.$('node.dds-bfs-badge').remove();
};

// Render BFS rank badges as ghost nodes above each swim-lane node that has stored ranks.
// Badges are only shown when the show_bfs_ranks debug setting is active.
// Nodes without bfs_rank_min (layout not yet run) are silently skipped.
DDS_MAP.renderBfsRankBadges = function(mapId) {
  if (!DDS_CY || !mapId) return;
  DDS_MAP.clearBfsRankBadges();
  var mapNodes = DDS_STORE.query('map_nodes', { map_id: mapId });
  mapNodes.forEach(function(mn) {
    if (mn.bfs_rank_min == null) return;
    var parentCy = DDS_CY.$('#n' + mn.node_id);
    if (!parentCy.length) return;
    var pPos  = parentCy.position();
    var label = mn.bfs_rank_min === mn.bfs_rank_max
      ? String(mn.bfs_rank_min)
      : mn.bfs_rank_min + '-' + mn.bfs_rank_max;
    DDS_CY.add({
      group: 'nodes',
      classes: 'dds-bfs-badge',
      data: {
        id: 'bfs-' + mn.node_id,
        nodeId: mn.node_id,
        mapNodeId: mn.id,
        label: label
      },
      position: { x: pPos.x, y: pPos.y - 36 }
    });
  });
};
