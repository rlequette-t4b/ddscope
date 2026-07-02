// ============================================================
// DDS_AI_CONTEXT — serialize project to AI Assistant context JSON
// Spec: DDScope_AI_Assistant.md §4. boms/bom_components/annotations added
// (Phase 6 gap-closing, DDS_CMD_Migration.md) — required for the AI to see
// what already exists once bom.* and annotation.* commands are in its
// vocabulary (DDS_CMD.getVocabularyText()).
// ============================================================

var DDS_AI_CONTEXT = {};

DDS_AI_CONTEXT.build = function() {
  if (!DDS_STORE.getProject()) throw new Error('No project open');
  var mapId = DDS_MAP.state.currentMapId;
  var p = DDS_STORE.getProject();

  var maps          = DDS_STORE.query('maps');
  var swimLanes     = DDS_STORE.query('swim_lanes');
  var nodeTypes     = DDS_STORE.query('node_types');
  var productTypes  = DDS_STORE.query('product_types');
  var nodes         = DDS_STORE.query('nodes');
  var products      = DDS_STORE.query('products');
  var flows         = DDS_STORE.query('flows');
  var skus          = DDS_STORE.query('skus');
  var demands       = DDS_STORE.query('demands');
  var boms          = DDS_STORE.query('boms');
  var bomComponents = DDS_STORE.query('bom_components');
  var annotations   = DDS_STORE.query('annotations');
  var mapNodes      = DDS_STORE.query('map_nodes',      { map_id: mapId });
  var mapFlows      = DDS_STORE.query('map_flows',      { map_id: mapId });
  var mapSwimLanes  = DDS_STORE.query('map_swim_lanes', { map_id: mapId });

  var mapRec = maps.find(function(m) { return m.id === mapId; });
  var activeMap = mapRec ? {
    id:            String(mapRec.id),
    name:          mapRec.name,
    node_ids:      mapNodes.map(function(r) { return String(r.node_id); }),
    flow_ids:      mapFlows.map(function(r) { return String(r.flow_id); }),
    swim_lane_ids: mapSwimLanes.map(function(r) { return String(r.swim_lane_id); })
  } : null;

  return {
    project:       { id: '1', name: p.project.name, description: p.project.description || '' },
    active_map:    activeMap,
    maps:          maps.map(function(m) { return { id: String(m.id), name: m.name, position: m.position }; }),
    swim_lanes:    swimLanes.map(function(sl) { return { id: String(sl.id), name: sl.name }; }),
    node_types:    nodeTypes.map(function(t) { return {
      code: t.code, label: t.label,
      is_default: !!t.is_default,
      is_product_node_default: !!t.is_product_node_default,
      default_swim_lane_id: t.default_swim_lane_id ? String(t.default_swim_lane_id) : null
    }; }),
    product_types: productTypes.map(function(t) { return { code: t.code, label: t.label, is_default: !!t.is_default }; }),
    nodes: nodes.map(function(n) { return {
      id: String(n.id), name: n.name || '', type_code: n.type_code || null,
      swim_lane_id: n.swim_lane_id ? String(n.swim_lane_id) : null,
      tags: Array.isArray(n.tags) ? n.tags : [], notes: n.notes || ''
    }; }),
    products: products.map(function(p2) { return {
      id: String(p2.id), name: p2.name || '', type_code: p2.type_code || null,
      tags: Array.isArray(p2.tags) ? p2.tags : [], notes: p2.notes || ''
    }; }),
    flows: flows.map(function(f) { return {
      id: String(f.id), source_id: String(f.source_node_id), target_id: String(f.target_node_id),
      product_ids: (f.product_ids || []).map(String),
      tags: Array.isArray(f.tags) ? f.tags : [],
      lead_time_value: f.lead_time_value || null, lead_time_unit: f.lead_time_unit || null,
      bidirectional: f.bidirectional === true,
      notes: f.notes || ''
    }; }),
    skus: skus.map(function(s) { return {
      node_id: String(s.node_id), product_id: String(s.product_id),
      tags: Array.isArray(s.tags) ? s.tags : [], notes: s.notes || ''
    }; }),
    demands: demands.map(function(d) { return {
      node_id: String(d.node_id), product_id: String(d.product_id),
      ctt_value: d.ctt_value != null ? d.ctt_value : null,
      ctt_unit: d.ctt_unit || null,
      demand_value: d.demand_value != null ? d.demand_value : null,
      demand_period: d.demand_period || null,
      notes: d.notes || ''
    }; }),
    boms: boms.map(function(b) { return {
      id: String(b.id), node_id: String(b.node_id),
      output_product_id: String(b.output_product_id), notes: b.notes || ''
    }; }),
    bom_components: bomComponents.map(function(c) { return {
      id: String(c.id), bom_id: String(c.bom_id), product_id: String(c.product_id),
      quantity: c.quantity != null ? c.quantity : null, notes: c.notes || ''
    }; }),
    annotations: annotations.map(function(a) { return {
      id: String(a.id), notes: a.notes || '',
      swim_lane_id: a.swim_lane_id ? String(a.swim_lane_id) : null,
      tags: Array.isArray(a.tags) ? a.tags : []
    }; })
  };
};
