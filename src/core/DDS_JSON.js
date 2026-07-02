// ============================================================
// DDS_JSON — Import from JSON (copy modes)
// ============================================================
// Export / Save are handled by DDS_STORE.save() / DDS_STORE.saveAs().
// This module handles importing another project's data into a new
// project in memory, with ID remapping and copy mode support.
// ============================================================

var DDS_JSON = {};

// Import a source project JSON into the current blank project in memory.
// copyMode: 'full' | 'lanes' | 'types'
// Returns the first map id created.
DDS_JSON.importFromJson = function(srcJson, copyMode) {
  var idMap = {};

  function mapId(type, oldId) {
    return (idMap[type] && idMap[type][oldId]) !== undefined
      ? idMap[type][oldId]
      : null;
  }

  function insertAndMap(table, records, type) {
    if (!records || records.length === 0) return;
    idMap[type] = idMap[type] || {};
    records.forEach(function(r) {
      var copy = Object.assign({}, r);
      var oldId = copy.id;
      delete copy.id;
      delete copy.created_at;
      delete copy.updated_at;
      delete copy.project_id;
      var inserted = DDS_STORE.insert(table, copy);
      idMap[type][oldId] = inserted[0].id;
    });
  }

  // 1. Always: types + tag_styles
  insertAndMap('node_types',    srcJson.node_types    || [], 'node_types');
  insertAndMap('product_types', srcJson.product_types || [], 'product_types');
  insertAndMap('tag_styles',    srcJson.tag_styles    || [], 'tag_styles');

  if (copyMode === 'types') {
    var m = DDS_STORE.insert('maps', { name: 'Map 1', position: 1, legend_visible: true });
    return m[0].id;
  }

  // 2. Swim-lanes
  insertAndMap('swim_lanes', srcJson.swim_lanes || [], 'swim_lanes');

  if (copyMode === 'lanes') {
    var srcMap0 = srcJson.maps && srcJson.maps[0];
    var mName = srcMap0 ? srcMap0.name : 'Map 1';
    var mRow = DDS_STORE.insert('maps', { name: mName, position: 1, legend_visible: true });
    var firstMapId = mRow[0].id;
    if (srcMap0) {
      var msl = (srcJson.map_swim_lanes || []).filter(function(r) { return r.map_id === srcMap0.id; });
      msl.forEach(function(r) {
        var sl = mapId('swim_lanes', r.swim_lane_id);
        if (sl) DDS_STORE.insert('map_swim_lanes', {
          map_id: firstMapId, swim_lane_id: sl,
          x: r.x, y: r.y, width: r.width, height: r.height, group_order: r.group_order
        });
      });
    }
    return firstMapId;
  }

  // 3. Full: nodes, products, flows, skus, boms, bom_components
  insertAndMap('nodes',    srcJson.nodes    || [], 'nodes');
  insertAndMap('products', srcJson.products || [], 'products');

  // Flows: remap FKs
  (srcJson.flows || []).forEach(function(f) {
    var row = DDS_STORE.insert('flows', {
      source_node_id:  mapId('nodes', f.source_node_id),
      target_node_id:  mapId('nodes', f.target_node_id),
      product_ids:     (f.product_ids || []).map(function(id) { return mapId('products', id); }).filter(function(id) { return id !== null; }),
      tags:            f.tags || [],
      lead_time_value: f.lead_time_value,
      lead_time_unit:  f.lead_time_unit,
      notes:           f.notes || ''
    });
    idMap['flows'] = idMap['flows'] || {};
    idMap['flows'][f.id] = row[0].id;
  });

  // SKUs
  (srcJson.skus || []).forEach(function(s) {
    var nid = mapId('nodes', s.node_id);
    var pid = mapId('products', s.product_id);
    if (nid && pid) DDS_STORE.insert('skus', { node_id: nid, product_id: pid, tags: s.tags || [], notes: s.notes || '' });
  });

  // BOMs
  (srcJson.boms || []).forEach(function(b) {
    var nid = mapId('nodes', b.node_id);
    var opid = mapId('products', b.output_product_id);
    if (nid && opid) {
      var bRow = DDS_STORE.insert('boms', { node_id: nid, output_product_id: opid });
      idMap['boms'] = idMap['boms'] || {};
      idMap['boms'][b.id] = bRow[0].id;
    }
  });
  (srcJson.bom_components || []).forEach(function(bc) {
    var bid = mapId('boms', bc.bom_id);
    var pid = mapId('products', bc.product_id);
    if (bid && pid) DDS_STORE.insert('bom_components', { bom_id: bid, product_id: pid, quantity: bc.quantity });
  });

  // Annotations (full copy only)
  insertAndMap('annotations', srcJson.annotations || [], 'annotations');

  // Note categories + notes (full copy only)
  insertAndMap('note_categories', srcJson.note_categories || [], 'note_categories');
  (srcJson.notes || []).forEach(function(n) {
    var cid = mapId('note_categories', n.category_id);
    if (cid) {
      var nRow = DDS_STORE.insert('notes', {
        category_id: cid,
        content:     n.content || '',
        position:    n.position || 0
      });
      idMap['notes'] = idMap['notes'] || {};
      idMap['notes'][n.id] = nRow[0].id;
    }
  });

  // Demands
  (srcJson.demands || []).forEach(function(d) {
    var nid = mapId('nodes', d.node_id);
    var pid = mapId('products', d.product_id);
    if (nid && pid) {
      var dRow = DDS_STORE.insert('demands', {
        node_id: nid, product_id: pid,
        ctt_value: d.ctt_value, ctt_unit: d.ctt_unit,
        demand_value: d.demand_value, demand_period: d.demand_period,
        notes: d.notes || ''
      });
      idMap['demands'] = idMap['demands'] || {};
      idMap['demands'][d.id] = dRow[0].id;
    }
  });

  // Maps + map-scoped entities
  var firstNewMapId = null;
  (srcJson.maps || []).forEach(function(srcMap) {
    var mRow = DDS_STORE.insert('maps', { name: srcMap.name, position: srcMap.position, legend_visible: srcMap.legend_visible !== false });
    var newMapId = mRow[0].id;
    if (!firstNewMapId) firstNewMapId = newMapId;

    (srcJson.map_nodes || []).filter(function(r) { return r.map_id === srcMap.id; }).forEach(function(r) {
      var nid = mapId('nodes', r.node_id);
      if (nid) DDS_STORE.insert('map_nodes', { map_id: newMapId, node_id: nid, x: r.x, y: r.y });
    });
    (srcJson.map_flows || []).filter(function(r) { return r.map_id === srcMap.id; }).forEach(function(r) {
      var fid = mapId('flows', r.flow_id);
      if (fid) DDS_STORE.insert('map_flows', { map_id: newMapId, flow_id: fid });
    });
    (srcJson.map_swim_lanes || []).filter(function(r) { return r.map_id === srcMap.id; }).forEach(function(r) {
      var sl = mapId('swim_lanes', r.swim_lane_id);
      if (sl) DDS_STORE.insert('map_swim_lanes', {
        map_id: newMapId, swim_lane_id: sl,
        x: r.x, y: r.y, width: r.width, height: r.height, group_order: r.group_order
      });
    });
    (srcJson.map_annotations || []).filter(function(r) { return r.map_id === srcMap.id; }).forEach(function(r) {
      var aid = mapId('annotations', r.annotation_id);
      if (aid) DDS_STORE.insert('map_annotations', { map_id: newMapId, annotation_id: aid, x: r.x, y: r.y });
    });
    (srcJson.map_demands || []).filter(function(r) { return r.map_id === srcMap.id; }).forEach(function(r) {
      var did = mapId('demands', r.demand_id);
      if (did) DDS_STORE.insert('map_demands', { map_id: newMapId, demand_id: did });
    });
    (srcJson.map_notes || []).filter(function(r) { return r.map_id === srcMap.id; }).forEach(function(r) {
      var nid = mapId('notes', r.note_id);
      if (nid) DDS_STORE.insert('map_notes', { map_id: newMapId, note_id: nid });
    });
  });

  if (!firstNewMapId) {
    var mr = DDS_STORE.insert('maps', { name: 'Map 1', position: 1, legend_visible: true });
    firstNewMapId = mr[0].id;
  }
  return firstNewMapId;
};
