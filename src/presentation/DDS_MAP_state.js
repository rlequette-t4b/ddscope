// ============================================================
// DDS_MAP — state, Cytoscape style, helpers
// ============================================================

var DDS_CY = null;

var DDS_MAP = {
  state: {
    currentMapId: null,
    maps: [],
    cytoscapeReady: false
  }
};

DDS_MAP.CY_STYLE = [
  {
    selector: 'node',
    style: {
      'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center',
      'font-family': 'Inter, sans-serif', 'font-size': '13px', 'font-weight': '600',
      'color': '#1a2130', 'background-color': '#ffffff', 'border-color': '#6b7280',
      'border-width': 2, 'width': 63, 'height': 'label', 'shape': 'data(shape)',
      'text-wrap': 'wrap', 'text-max-width': '55px', 'padding': '8px'
    }
  },
  { selector: 'node:selected', style: { 'border-color': '#2e7d32', 'border-width': 3 } },
  {
    selector: 'node.dds-bfs-badge',
    style: {
      'label': 'data(label)',
      'font-size': 10,
      'font-style': 'normal',
      'font-weight': 'bold',
      'color': '#b45309',
      'text-valign': 'center',
      'text-halign': 'center',
      'background-color': '#fef3c7',
      'background-opacity': 0.92,
      'border-width': 1,
      'border-color': '#f59e0b',
      'border-opacity': 1,
      'width': 'label',
      'height': 'label',
      'padding': 4,
      'shape': 'round-rectangle',
      'selectable': false,
      'grabbable': false,
      'z-index': 10
    }
  },
  {
    selector: 'node.dds-annotation-ghost',
    style: {
      'label': 'data(label)',
      'font-style': 'italic',
      'font-size': '11px',
      'font-family': 'Inter, sans-serif',
      'font-weight': 'normal',
      'text-halign': 'center',
      'text-valign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': '220px',
      'background-opacity': 0,
      'border-width': 0,
      'shape': 'rectangle',
      'width': 'label',
      'height': 'label',
      'color': '#64748b',
      'selectable': true,
      'cursor': 'pointer'
    }
  },
  {
    selector: 'node.dds-note-ghost',
    style: {
      'label': 'data(label)',
      'font-style': 'italic',
      'font-size': '11px',
      'font-family': 'Inter, sans-serif',
      'color': '#64748b',
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': '200px',
      'background-opacity': 0,
      'border-width': 0,
      'width': 10,
      'height': 10,
      'shape': 'rectangle',
      'events': 'yes',
      'selectable': false
    }
  },
  {
    selector: 'node.dds-flow-note-ghost',
    style: {
      'label': 'data(label)',
      'font-style': 'italic',
      'font-size': '11px',
      'font-family': 'Inter, sans-serif',
      'color': '#64748b',
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': '200px',
      'background-opacity': 0,
      'border-width': 0,
      'width': 10,
      'height': 10,
      'shape': 'rectangle',
      'events': 'yes',
      'selectable': false
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 2, 'line-color': '#9ca3af', 'line-style': 'solid', 'target-arrow-color': '#9ca3af',
      'target-arrow-shape': 'triangle', 'curve-style': 'taxi', 'taxi-direction': 'horizontal', 'taxi-turn': '50%',
      'label': 'data(label)', 'font-size': '11px', 'color': '#6b7280',
      'text-background-color': '#f4f5f7', 'text-background-opacity': 1,
      'text-background-padding': '2px'
    }
  },
  { selector: 'edge:selected', style: { 'line-color': '#f97316', 'target-arrow-color': '#f97316', 'source-arrow-color': '#f97316', 'width': 4 } },
  { selector: 'edge[bidirectional="true"]', style: { 'source-arrow-shape': 'triangle', 'source-arrow-color': '#9ca3af' } }
];

DDS_MAP.DEFAULT_SHAPES = { 'SUPPLIER': 'diamond', 'PROD': 'rectangle', 'WH': 'hexagon', 'DC': 'ellipse', 'CUSTOMER': 'triangle' };

DDS_MAP.getShape = function(typeCode) {
  var types = DDS_STORE.query('node_types');
  var match = types.find(function(t) { return t.code === typeCode; });
  if (match && match.shape) return match.shape;
  return DDS_MAP.DEFAULT_SHAPES[typeCode] || 'rectangle';
};

DDS_MAP.edgeLabel = function(flow) {
  return ''; // Lead time not displayed on canvas (v1)
};
