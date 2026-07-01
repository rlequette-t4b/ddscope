// JS: DDS_CMD — unified command layer (notes domain + Phase 2: lanes, annotations, settings + Phase 3: products, BOMs, demands + Phase 4: maps, project, add-product-on-map + Phase 5: nodes, flows, waypoint/drag persists, DDS_PANEL)
// CommWise block: SCRIPT 1875
// Testability: store-dependent
// Depends on: DDS_STORE (SCRIPT 150), DDS_TRANSACTIONS (SCRIPT 1860), TX (SCRIPT 1865), DDS_MODEL (SCRIPT 1550), DDS_LAYOUT (map placement, Phase 4 only)
// API documented: yes
//
// Bootstrap of the future unified command layer.
// Domains covered: notes (FEAT-002), swim lanes, annotations (delete),
// settings node/product types, products / BOMs / demands (Phase 3 tabular CRUD),
// maps create/rename/duplicate/delete, project rename, add-product-on-map (Phase 4),
// node/flow creation, flow reroute, waypoint/drag terminal persists, DDS_PANEL
// side panel (node/flow/lane fields, flow products, SKU tags, demand CRUD,
// demand map visibility) (Phase 5).
// Legacy helpers (DDS_NODES, DDS_ACTIONS, etc.) remain in place for domains
// not yet migrated.
//
// Signature:
//   DDS_CMD.execute(txKey, params, mapId, onSuccess?)
//   Returns: { ok: boolean, id?: integer }
//
// Observability (parallel to DDS_ACTIONS, added while both patterns coexist
// during migration — see DDScope_Commands.md §0):
//   DDS_CMD.addExecuteListener(fn) / removeExecuteListener(fn)
//   DDS_CMD.describe(commands) -> { index, label }[]
//   Listeners are notified at the START of execute(), before the command runs
//   (same as DDS_ACTIONS) so describe() can resolve names of records about to
//   be deleted. Notification payload: [{ type: txKey, params }] — a single-
//   element array, matching the shape DDS_ACTIONS_LOG already consumes.
// AUDITOR:LARGE_BLOCK_JUSTIFIED - unified command registry serving multiple domains atomically; splitting would break single-point command registration

var DDS_CMD = (function () {

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function _activeMapId() {
    return (window.DDS && DDS.state) ? DDS.state.currentMap : null;
  }

  function _rec(table, id) {
    var recs = DDS_STORE.query(table, { id: parseInt(id, 10) });
    return recs.length ? recs[0] : null;
  }

  function _truncate(str, n) {
    str = (str || '').trim();
    return str.length > n ? str.substring(0, n) + '…' : str;
  }

  // ---------------------------------------------------------------------------
  // Command registry
  // ---------------------------------------------------------------------------

  var _commands = {};

  function _register(txKey, fn) {
    _commands[txKey] = fn;
  }

  // ---------------------------------------------------------------------------
  // Execute listeners — notified at the start of execute(), before the command
  // runs (mirrors DDS_ACTIONS). Payload: [{ type: txKey, params }].
  // ---------------------------------------------------------------------------

  var _executeListeners = [];

  function addExecuteListener(fn) {
    if (typeof fn === 'function' && _executeListeners.indexOf(fn) === -1) {
      _executeListeners.push(fn);
    }
  }

  function removeExecuteListener(fn) {
    var idx = _executeListeners.indexOf(fn);
    if (idx !== -1) _executeListeners.splice(idx, 1);
  }

  function _notifyExecuteListeners(commands) {
    for (var i = 0; i < _executeListeners.length; i++) {
      try { _executeListeners[i](commands); } catch (e) {
        console.warn('[DDS_CMD] execute listener error', e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Notes domain — note_categories
  // ---------------------------------------------------------------------------

  // TX.NOTE_CATEGORY_CREATE
  // params: { label: string, position?: integer }
  _register(TX.NOTE_CATEGORY_CREATE, function (params) {
    var label    = params.label || '';
    var rows     = DDS_STORE.query('note_categories');
    var position = (params.position !== undefined) ? params.position : rows.length;
    var inserted = DDS_STORE.insert('note_categories', [{ label: label, position: position }]);
    DDS_STORE.markDirty();
    return { ok: true, id: inserted[0].id };
  });

  // TX.NOTE_CATEGORY_UPDATE
  // params: { id: integer, label?: string, position?: integer }
  _register(TX.NOTE_CATEGORY_UPDATE, function (params) {
    var updates = {};
    if (params.label    !== undefined) { updates.label    = params.label; }
    if (params.position !== undefined) { updates.position = params.position; }
    DDS_STORE.update('note_categories', { id: params.id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.NOTE_CATEGORY_DELETE
  // params: { id: integer }
  // Cascade: delete each note (and its map_notes), then delete the category.
  _register(TX.NOTE_CATEGORY_DELETE, function (params) {
    var notes = DDS_STORE.query('notes', { category_id: params.id });
    notes.forEach(function (note) {
      DDS_STORE.remove('map_notes', { note_id: note.id });
    });
    DDS_STORE.remove('notes', { category_id: params.id });
    DDS_STORE.remove('note_categories', { id: params.id });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.NOTE_CATEGORY_REORDER
  // params: { order: [{ id: integer, position: integer }] }
  _register(TX.NOTE_CATEGORY_REORDER, function (params) {
    (params.order || []).forEach(function (item) {
      DDS_STORE.update('note_categories', { id: item.id }, { position: item.position });
    });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Notes domain — notes
  // ---------------------------------------------------------------------------

  // TX.NOTE_CREATE
  // params: { category_id: integer, content: string, position?: integer }
  // mapId: if non-null, creates a map_notes record; falls back to _activeMapId().
  _register(TX.NOTE_CREATE, function (params, mapId) {
    var existing = DDS_STORE.query('notes', { category_id: params.category_id });
    var position = (params.position !== undefined) ? params.position : existing.length;
    var inserted = DDS_STORE.insert('notes', [{
      category_id: params.category_id,
      content:     params.content || '',
      position:    position
    }]);
    var noteId    = inserted[0].id;
    var targetMap = mapId || _activeMapId();
    if (targetMap) {
      DDS_STORE.insert('map_notes', [{ map_id: targetMap, note_id: noteId }]);
    }
    DDS_STORE.markDirty();
    return { ok: true, id: noteId };
  });

  // TX.NOTE_UPDATE
  // params: { id: integer, content?: string, position?: integer }
  _register(TX.NOTE_UPDATE, function (params) {
    var updates = {};
    if (params.content  !== undefined) { updates.content  = params.content; }
    if (params.position !== undefined) { updates.position = params.position; }
    DDS_STORE.update('notes', { id: params.id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.NOTE_DELETE
  // params: { id: integer }
  // Cascade: remove map_notes before deleting the note.
  _register(TX.NOTE_DELETE, function (params) {
    DDS_STORE.remove('map_notes', { note_id: params.id });
    DDS_STORE.remove('notes', { id: params.id });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.NOTE_REORDER
  // params: { order: [{ id: integer, position: integer }] }
  _register(TX.NOTE_REORDER, function (params) {
    (params.order || []).forEach(function (item) {
      DDS_STORE.update('notes', { id: item.id }, { position: item.position });
    });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Maps domain — create / rename / duplicate / delete (Phase 4, MAP_DELETE pre-existing)
  // ---------------------------------------------------------------------------

  // TX.MAP_CREATE
  // params: { name?: string, direction?: string }
  _register(TX.MAP_CREATE, function (params) {
    var n = DDS_STORE.query('maps').length + 1;
    var inserted = DDS_STORE.insert('maps', [{
      name:      params.name || ('Map ' + n),
      position:  n,
      direction: params.direction || 'right-left'
    }]);
    DDS_STORE.markDirty();
    return { ok: true, id: inserted[0].id };
  });

  // TX.MAP_RENAME
  // params: { id: integer, name: string }
  _register(TX.MAP_RENAME, function (params) {
    DDS_STORE.update('maps', { id: params.id }, { name: params.name });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_DUPLICATE
  // params: { source_id: integer }
  // Copies map-scoped rows: map_nodes, map_flows, map_swim_lanes, map_annotations.
  // NOTE: map_notes and map_demands are intentionally not duplicated here —
  // this mirrors the legacy inline DDS_MAP_UI.duplicateMap implementation being
  // replaced (pre-existing gap, out of scope for this migration; see Journal).
  _register(TX.MAP_DUPLICATE, function (params) {
    var srcMap = _rec('maps', params.source_id);
    if (!srcMap) throw new Error('[DDS_CMD] Source map not found');
    var n = DDS_STORE.query('maps').length + 1;
    var inserted = DDS_STORE.insert('maps', [{
      name: srcMap.name + ' (copy)', position: n, direction: srcMap.direction || 'right-left'
    }]);
    var newMapId = inserted[0].id;

    DDS_STORE.query('map_nodes', { map_id: srcMap.id }).forEach(function (r) {
      DDS_STORE.insert('map_nodes', [{ map_id: newMapId, node_id: r.node_id, x: r.x, y: r.y }]);
    });
    DDS_STORE.query('map_flows', { map_id: srcMap.id }).forEach(function (r) {
      DDS_STORE.insert('map_flows', [{ map_id: newMapId, flow_id: r.flow_id }]);
    });
    DDS_STORE.query('map_swim_lanes', { map_id: srcMap.id }).forEach(function (r) {
      DDS_STORE.insert('map_swim_lanes', [{
        map_id: newMapId, swim_lane_id: r.swim_lane_id,
        x: r.x, y: r.y, width: r.width, height: r.height, group_order: r.group_order
      }]);
    });
    DDS_STORE.query('map_annotations', { map_id: srcMap.id }).forEach(function (r) {
      DDS_STORE.insert('map_annotations', [{ map_id: newMapId, annotation_id: r.annotation_id, x: r.x, y: r.y }]);
    });

    DDS_STORE.markDirty();
    return { ok: true, id: newMapId };
  });

  // TX.MAP_DELETE
  // params: { id: integer }
  // Cascade: remove all map-scoped records. The last map cannot be deleted.
  _register(TX.MAP_DELETE, function (params) {
    var maps = DDS_STORE.query('maps');
    if (maps.length <= 1) {
      throw new Error('[DDS_CMD] Cannot delete the last map');
    }
    DDS_STORE.remove('map_notes',       { map_id: params.id });
    DDS_STORE.remove('map_nodes',       { map_id: params.id });
    DDS_STORE.remove('map_flows',       { map_id: params.id });
    DDS_STORE.remove('map_swim_lanes',  { map_id: params.id });
    DDS_STORE.remove('map_demands',     { map_id: params.id });
    DDS_STORE.remove('map_annotations', { map_id: params.id });
    DDS_STORE.remove('maps',            { id: params.id });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Swim lanes domain (Phase 2)
  // ---------------------------------------------------------------------------

  // TX.LANE_CREATE
  // params: { name: string, color?: string }
  _register(TX.LANE_CREATE, function (params) {
    var inserted = DDS_STORE.insert('swim_lanes', [{
      name:  params.name || '',
      color: params.color || '#6b7280'
    }]);
    DDS_STORE.markDirty();
    return { ok: true, id: inserted[0].id };
  });

  // TX.LANE_UPDATE
  // params: { id: integer, name?: string, color?: string }
  _register(TX.LANE_UPDATE, function (params) {
    var updates = {};
    if (params.name  !== undefined) { updates.name  = params.name; }
    if (params.color !== undefined) { updates.color = params.color; }
    DDS_STORE.update('swim_lanes', { id: params.id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.LANE_DELETE
  // params: { id: integer }
  // Cascade: delegates to DDS_MODEL.deleteSwimLane (deletes all assigned
  // nodes with their full cascade, all map_swim_lanes references, clears
  // default_swim_lane_id on affected node_types).
  _register(TX.LANE_DELETE, function (params) {
    DDS_MODEL.deleteSwimLane(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Annotations domain (Phase 2)
  // ---------------------------------------------------------------------------

  // TX.ANNOTATION_DELETE
  // params: { id: integer }
  // Cascade: delegates to DDS_MODEL.deleteAnnotation (removes map_annotations
  // across all maps, then the annotations record).
  _register(TX.ANNOTATION_DELETE, function (params) {
    DDS_MODEL.deleteAnnotation(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Settings domain (Phase 2) — node types / product types
  // Single TX key covers both create (no id) and update (id present).
  // forceInsert: true forces an insert even when id is present — mirrors
  // the "Save as New" button in the Settings modal (edit mode, insert a
  // new record instead of updating the one being edited).
  // Single-default and single-product-node-default rules are enforced
  // here, inside the same transaction, so undo restores the previous
  // default flags atomically together with the saved record.
  // ---------------------------------------------------------------------------

  // TX.SETTINGS_NODE_TYPE
  // params: { id?: integer, forceInsert?: boolean, fields: {
  //   code, label, shape, is_default, color, default_swim_lane_id,
  //   is_product_node_default, icon_key, label_position, transparent_bg
  // } }
  _register(TX.SETTINGS_NODE_TYPE, function (params) {
    var fields = params.fields || {};
    if (fields.is_default) {
      DDS_STORE.update('node_types', {}, { is_default: false });
    }
    if (fields.is_product_node_default) {
      DDS_STORE.update('node_types', {}, { is_product_node_default: false });
    }
    var doInsert = !params.id || params.forceInsert;
    if (doInsert) {
      var inserted = DDS_STORE.insert('node_types', [fields]);
      DDS_STORE.markDirty();
      return { ok: true, id: inserted[0].id };
    }
    DDS_STORE.update('node_types', { id: params.id }, fields);
    DDS_STORE.markDirty();
    return { ok: true, id: params.id };
  });

  // TX.SETTINGS_PRODUCT_TYPE
  // params: { id?: integer, forceInsert?: boolean, fields: {
  //   code, label, shape, is_default, color
  // } }
  _register(TX.SETTINGS_PRODUCT_TYPE, function (params) {
    var fields = params.fields || {};
    if (fields.is_default) {
      DDS_STORE.update('product_types', {}, { is_default: false });
    }
    var doInsert = !params.id || params.forceInsert;
    if (doInsert) {
      var inserted = DDS_STORE.insert('product_types', [fields]);
      DDS_STORE.markDirty();
      return { ok: true, id: inserted[0].id };
    }
    DDS_STORE.update('product_types', { id: params.id }, fields);
    DDS_STORE.markDirty();
    return { ok: true, id: params.id };
  });

  // ---------------------------------------------------------------------------
  // Products domain (Phase 3 — tabular CRUD)
  // ---------------------------------------------------------------------------

  // TX.PRODUCT_CREATE
  // params: { name: string, type_code?: string, tags?: array, notes?: string }
  _register(TX.PRODUCT_CREATE, function (params) {
    var inserted = DDS_STORE.insert('products', [{
      name:      params.name || '',
      type_code: params.type_code || null,
      tags:      params.tags || [],
      notes:     params.notes || ''
    }]);
    DDS_STORE.markDirty();
    return { ok: true, id: inserted[0].id };
  });

  // TX.PRODUCT_UPDATE
  // params: { id: integer, name?: string, type_code?: string, tags?: array, notes?: string }
  _register(TX.PRODUCT_UPDATE, function (params) {
    var updates = {};
    if (params.name      !== undefined) { updates.name      = params.name; }
    if (params.type_code !== undefined) { updates.type_code = params.type_code; }
    if (params.tags      !== undefined) { updates.tags      = params.tags; }
    if (params.notes     !== undefined) { updates.notes     = params.notes; }
    DDS_STORE.update('products', { id: params.id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.PRODUCT_DELETE
  // params: { id: integer }
  // Cascade: delegates to DDS_MODEL.deleteProduct (removes product-nodes,
  // strips the product from flows[].product_ids, deletes demands + map_demands,
  // deletes skus, deletes/prunes boms and bom_components, deletes the product).
  _register(TX.PRODUCT_DELETE, function (params) {
    DDS_MODEL.deleteProduct(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // BOMs domain (Phase 3 — tabular CRUD)
  // ---------------------------------------------------------------------------

  // TX.BOM_CREATE
  // params: { node_id: integer, output_product_id: integer, notes?: string,
  //           components?: [{ product_id: integer, quantity?: number, notes?: string }] }
  // Guards against a duplicate BOM (same node_id + output_product_id) — throws,
  // which rolls back the transaction and yields { ok: false } from execute().
  _register(TX.BOM_CREATE, function (params) {
    var existing = DDS_STORE.query('boms', { node_id: params.node_id, output_product_id: params.output_product_id });
    if (existing.length > 0) {
      throw new Error('[DDS_CMD] A BOM for this node and output product already exists');
    }
    var inserted = DDS_STORE.insert('boms', [{
      node_id:           params.node_id,
      output_product_id: params.output_product_id,
      notes:             params.notes || ''
    }]);
    var bomId = inserted[0].id;
    (params.components || []).filter(function (c) { return c.product_id; }).forEach(function (c) {
      DDS_STORE.insert('bom_components', [{
        bom_id:     bomId,
        product_id: c.product_id,
        quantity:   c.quantity || 1,
        notes:      c.notes || ''
      }]);
    });
    DDS_STORE.markDirty();
    return { ok: true, id: bomId };
  });

  // TX.BOM_UPDATE_COMPONENTS
  // params: { bom_id: integer, components: [{ product_id, quantity?, notes? }] }
  // Diffs existing bom_components against the incoming list: removes components
  // no longer present, inserts new ones, updates quantity/notes on changed ones.
  // Does not touch the bom's own fields (output_product_id, notes) — those are
  // out of scope for this call site.
  _register(TX.BOM_UPDATE_COMPONENTS, function (params) {
    var bomId    = params.bom_id;
    var existing = DDS_STORE.query('bom_components', { bom_id: bomId });
    var incoming = (params.components || []).filter(function (c) { return c.product_id; });

    var existingMap = {};
    existing.forEach(function (c) { existingMap[c.product_id] = c; });
    var incomingMap = {};
    incoming.forEach(function (c) { incomingMap[c.product_id] = c; });

    existing.forEach(function (c) {
      if (!incomingMap[c.product_id]) {
        DDS_STORE.remove('bom_components', { bom_id: bomId, product_id: c.product_id });
      }
    });

    incoming.forEach(function (c) {
      var prev  = existingMap[c.product_id];
      var qty   = c.quantity || 1;
      var notes = c.notes || '';
      if (!prev) {
        DDS_STORE.insert('bom_components', [{ bom_id: bomId, product_id: c.product_id, quantity: qty, notes: notes }]);
      } else if (qty !== prev.quantity || notes !== (prev.notes || '')) {
        DDS_STORE.update('bom_components', { bom_id: bomId, product_id: c.product_id }, { quantity: qty, notes: notes });
      }
    });

    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.BOM_DELETE
  // params: { id: integer }
  // Cascade: delegates to DDS_MODEL.deleteBom (removes all bom_components,
  // then the bom record).
  _register(TX.BOM_DELETE, function (params) {
    DDS_MODEL.deleteBom(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Demands domain (Phase 3 — tabular CRUD)
  // TX.DEMAND_CREATE is not registered here — no table-driven create call site
  // in Phase 3 (see DDS_CMD_Migration.md §3); demand creation happens via the
  // SKU_ADD side-panel flow, scheduled for Phase 5.
  // ---------------------------------------------------------------------------

  // TX.DEMAND_UPDATE
  // params: { node_id: integer, product_id: integer, ctt_value?, ctt_unit?,
  //           demand_value?, demand_period?, notes? }
  _register(TX.DEMAND_UPDATE, function (params) {
    var updates = {};
    ['ctt_value', 'ctt_unit', 'demand_value', 'demand_period', 'notes'].forEach(function (f) {
      if (params[f] !== undefined) { updates[f] = params[f]; }
    });
    DDS_STORE.update('demands', { node_id: params.node_id, product_id: params.product_id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.DEMAND_DELETE
  // params: { node_id: integer, product_id: integer }
  // Cascade: delegates to DDS_MODEL.deleteDemand (removes map_demands and
  // resets CTT geometry on map_nodes when no demand remains for the node).
  _register(TX.DEMAND_DELETE, function (params) {
    DDS_MODEL.deleteDemand(params.node_id, params.product_id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.DEMAND_CREATE
  // params: { node_id: integer, product_id: integer, ctt_value?, ctt_unit?,
  //           demand_value?, demand_period?, notes? }
  // Guards against a duplicate demand (same node_id + product_id) — mirrors
  // the legacy DDS_DEMANDS.create() guard, silently no-ops instead of
  // throwing (matches legacy: returns the existing record's id, no error
  // surfaced to the UI). Side-panel "+ Demand" button call site
  // (DDScope_Commands.md §3.3, extended scope).
  _register(TX.DEMAND_CREATE, function (params) {
    var existing = DDS_STORE.query('demands', { node_id: params.node_id, product_id: params.product_id });
    if (existing.length > 0) { return { ok: true, id: existing[0].id }; }
    var inserted = DDS_STORE.insert('demands', [{
      node_id:       params.node_id,
      product_id:    params.product_id,
      ctt_value:     params.ctt_value !== undefined ? params.ctt_value : null,
      ctt_unit:      params.ctt_unit || null,
      demand_value:  params.demand_value !== undefined ? params.demand_value : null,
      demand_period: params.demand_period || null,
      notes:         params.notes || ''
    }]);
    DDS_STORE.markDirty();
    return { ok: true, id: inserted[0].id };
  });

  // ---------------------------------------------------------------------------
  // Map presentation — demand visibility (Phase 5 — DDS_CMD_Migration.md §3.3,
  // extended scope). Presentation-only toggle, no functional-table mutation.
  // ---------------------------------------------------------------------------

  // TX.MAP_SHOW_DEMAND
  // params: { demand_id: integer } — mapId (3rd execute() arg) required.
  _register(TX.MAP_SHOW_DEMAND, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_SHOW_DEMAND requires a mapId');
    var existing = DDS_STORE.query('map_demands', { demand_id: params.demand_id, map_id: mapId });
    if (existing.length === 0) {
      DDS_STORE.insert('map_demands', [{ demand_id: params.demand_id, map_id: mapId }]);
    }
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_HIDE_DEMAND
  // params: { demand_id: integer } — mapId (3rd execute() arg) required.
  _register(TX.MAP_HIDE_DEMAND, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_HIDE_DEMAND requires a mapId');
    DDS_STORE.remove('map_demands', { demand_id: params.demand_id, map_id: mapId });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Project domain (Phase 4)
  // ---------------------------------------------------------------------------

  // TX.PROJECT_RENAME
  // params: { name: string, description?: string }
  // KNOWN LIMITATION: project.name/description live on a singleton object
  // (DDS_STORE.getProject().project), not a DDS_STORE table row — DDS_STORE's
  // delta/undo mechanism (_addChange) only instruments table-array mutations
  // via insert/update/remove. This command mutates the singleton object
  // directly, same as the legacy call site it replaces, so it is NOT captured
  // by undo/redo. Pre-existing architectural gap, out of scope for this
  // migration — flagged for a future DDS_STORE change if project-level undo
  // is ever required.
  _register(TX.PROJECT_RENAME, function (params) {
    var proj = DDS_STORE.getProject();
    if (!proj) return { ok: false };
    proj.project.name        = params.name;
    proj.project.description = params.description || '';
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Map presentation — combined operations (Phase 4)
  // ---------------------------------------------------------------------------

  // TX.MAP_ADD_PRODUCT_NODE
  // params: { product_id?: integer, product_name?: string, product_type_code?: string,
  //           swim_lane_id?: integer|null }
  // mapId (2nd arg to execute) is required — map-scoped creation.
  // Combined operation ported from the legacy DDS_NODE_UI._doAddProductSave
  // inline flow: resolve-or-create product, resolve the product-node-default
  // node type, create the node, place it (DDS_LAYOUT.placeNode — pure position
  // computation over map_nodes data, no Cytoscape mutation, same as the
  // still-legacy NODE_CREATE call site in DDS_NODE_UI._doSave), insert
  // map_node, then create the SKU linking node + product.
  _register(TX.MAP_ADD_PRODUCT_NODE, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_ADD_PRODUCT_NODE requires a mapId');

    // 1. Resolve or create product
    var productId, productName;
    if (params.product_id) {
      var existingProduct = _rec('products', params.product_id);
      productId = params.product_id;
      productName = existingProduct ? existingProduct.name : (params.product_name || '');
    } else {
      var prodInserted = DDS_STORE.insert('products', [{
        name: params.product_name || '', type_code: params.product_type_code || null,
        tags: [], notes: ''
      }]);
      productId = prodInserted[0].id;
      productName = params.product_name || '';
    }

    // 2. Resolve node type — product-node-default, falling back to default/first
    var types = DDS_STORE.query('node_types');
    var nodeType = types.find(function (t) { return t.is_product_node_default; })
      || types.find(function (t) { return t.is_default; })
      || types[0]
      || null;
    var typeCode = nodeType ? nodeType.code : null;

    // 3. Create node
    var nodeInserted = DDS_STORE.insert('nodes', [{
      name: productName, type_code: typeCode,
      swim_lane_id: params.swim_lane_id || null, tags: [], notes: ''
    }]);
    var nodeId = nodeInserted[0].id;

    // 4. Canvas position (pure computation — no Cytoscape mutation)
    var pos = DDS_LAYOUT.placeNode(nodeId, mapId);
    var x = pos ? pos.x : 200;
    var y = pos ? pos.y : 200;

    // 5. Insert map_node
    var mnRows = DDS_STORE.insert('map_nodes', [{ map_id: mapId, node_id: nodeId, x: x, y: y }]);

    // 6. Create SKU linking node + product
    DDS_STORE.insert('skus', [{ node_id: nodeId, product_id: productId, tags: [], notes: '' }]);

    DDS_STORE.markDirty();
    return {
      ok: true, id: nodeId, nodeId: nodeId, mapNodeId: mnRows[0].id,
      name: productName, typeCode: typeCode, x: x, y: y
    };
  });

  // ---------------------------------------------------------------------------
  // Nodes domain (Phase 5 — DDS_CMD_Migration.md)
  // ---------------------------------------------------------------------------

  // TX.NODE_CREATE
  // params: { name: string, type_code?: string, swim_lane_id?: integer,
  //           tags?: array, notes?: string }
  // mapId: optional. When present, places the node on the canvas
  // (DDS_LAYOUT.placeNode) and inserts a map_nodes row — mirrors the legacy
  // DDS_NODE_UI._doSave modal call site. When absent (table-driven creation
  // via DDS_NODES_UI), the node is added to the functional model only and
  // not placed on any map — mirrors the legacy DDS_NODES_UI._doSave call
  // site, which never wrapped this in DDS_TX_HELPER.run to begin with (gap
  // discovered during Phase 5, same class as the §3.3/§3.6 miscategorizations
  // found in Phases 2 and 4 — see DDScope_Commands.md §3.8).
  _register(TX.NODE_CREATE, function (params, mapId) {
    var inserted = DDS_STORE.insert('nodes', [{
      name:         params.name || '',
      type_code:    params.type_code || null,
      swim_lane_id: params.swim_lane_id || null,
      tags:         params.tags || [],
      notes:        params.notes || ''
    }]);
    var nodeId = inserted[0].id;
    var result = { ok: true, id: nodeId, nodeId: nodeId };

    if (mapId) {
      var pos = DDS_LAYOUT.placeNode(nodeId, mapId);
      var x = pos ? pos.x : 200;
      var y = pos ? pos.y : 200;
      var mnRows = DDS_STORE.insert('map_nodes', [{ map_id: mapId, node_id: nodeId, x: x, y: y }]);
      result.mapNodeId = mnRows[0].id;
      result.x = x;
      result.y = y;
    }

    DDS_STORE.markDirty();
    return result;
  });

  // ---------------------------------------------------------------------------
  // Flows domain (Phase 5 — DDS_CMD_Migration.md)
  // ---------------------------------------------------------------------------

  // TX.FLOW_CREATE
  // params: { source_id: integer, target_id: integer, product_ids?: array,
  //           tags?: array, lead_time_value?: number, lead_time_unit?: string,
  //           bidirectional?: boolean, notes?: string }
  // mapId: required — map-scoped creation (inserts a map_flows row), mirrors
  // the legacy DDS_FLOW_UI.createFlow drag-to-create flow.
  _register(TX.FLOW_CREATE, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] FLOW_CREATE requires a mapId');
    var inserted = DDS_STORE.insert('flows', [{
      source_node_id:  params.source_id,
      target_node_id:  params.target_id,
      product_ids:     params.product_ids || [],
      tags:            params.tags || [],
      lead_time_value: params.lead_time_value !== undefined ? params.lead_time_value : null,
      lead_time_unit:  params.lead_time_unit || null,
      bidirectional:   params.bidirectional === true,
      notes:           params.notes || ''
    }]);
    var flowId = inserted[0].id;
    var mfRows = DDS_STORE.insert('map_flows', [{ map_id: mapId, flow_id: flowId }]);
    DDS_STORE.markDirty();
    return { ok: true, id: flowId, flowId: flowId, mapFlowId: mfRows[0].id };
  });

  // TX.FLOW_REROUTE
  // params: { flow_id: integer, new_source_id?: integer, new_target_id?: integer }
  // At least one of new_source_id / new_target_id is expected — mirrors the
  // legacy DDS_FLOWS.reroute(flowId, newSourceId, newTargetId) signature.
  _register(TX.FLOW_REROUTE, function (params) {
    var updates = {};
    if (params.new_source_id) { updates.source_node_id = params.new_source_id; }
    if (params.new_target_id) { updates.target_node_id = params.new_target_id; }
    DDS_STORE.update('flows', { id: params.flow_id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Map presentation — waypoint (Phase 5)
  // ---------------------------------------------------------------------------

  // TX.MAP_MOVE_WAYPOINT
  // params: { map_flow_id: integer, waypoint_pct: number }
  // Persists the taxi-turn bend position on a map_flows row. Covers both the
  // waypoint drag (mouseup) and the double-click reset (waypoint_pct: 0.5)
  // call sites in DDS_FLOW_UI.
  _register(TX.MAP_MOVE_WAYPOINT, function (params) {
    DDS_STORE.update('map_flows', { id: params.map_flow_id }, { waypoint_pct: params.waypoint_pct });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Map presentation — drag terminal-event persists (Phase 5, §1.4 pattern)
  // ---------------------------------------------------------------------------

  // TX.MAP_MOVE_NODE
  // params: { map_node_id: integer, x: number, y: number }
  // Persists node canvas position on dragfree. CTT overlay sync, note-ghost
  // reposition, and auto-layout trigger stay in the caller's onSuccess — pure
  // presentation-layer side effects.
  _register(TX.MAP_MOVE_NODE, function (params) {
    DDS_STORE.update('map_nodes', { id: params.map_node_id }, { x: params.x, y: params.y });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_MOVE_NOTE_GHOST
  // params: { map_node_id: integer, note_dx: number, note_dy: number }
  _register(TX.MAP_MOVE_NOTE_GHOST, function (params) {
    DDS_STORE.update('map_nodes', { id: params.map_node_id }, { note_dx: params.note_dx, note_dy: params.note_dy });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_MOVE_ANNOTATION
  // params: { map_annotation_id: integer, x: number, y: number }
  _register(TX.MAP_MOVE_ANNOTATION, function (params) {
    DDS_STORE.update('map_annotations', { id: params.map_annotation_id }, { x: params.x, y: params.y });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // DDS_PANEL domain (Phase 5 — DDS_CMD_Migration.md §3.3)
  // ---------------------------------------------------------------------------

  // TX.NODE_UPDATE
  // params: { id: integer, name?, type_code?, swim_lane_id?, notes?, tags?,
  //           note_visible?, label_position? }
  // Node-table fields (name, type_code, swim_lane_id, notes, tags) update the
  // `nodes` record. note_visible / label_position are map_nodes presentation
  // fields, updated on the map_nodes row for `mapId` (3rd execute() arg,
  // falls back to _activeMapId()) when present. Mirrors the legacy
  // DDS_PANEL.openNode() call sites, which all share TX.NODE_UPDATE
  // regardless of which single field changed (name blur, type change,
  // swim-lane change, notes blur, tags edit, show-note-on-map toggle,
  // label-position override) — one TX per field-level interaction, same key
  // throughout. NOTE: TX.NODE_ASSIGN_LANE exists in the catalogue but is
  // unused — the legacy swim-lane <select> has always gone through
  // TX.NODE_UPDATE, not a dedicated assign-to-lane action.
  _register(TX.NODE_UPDATE, function (params, mapId) {
    var nodeUpdates = {};
    ['name', 'type_code', 'swim_lane_id', 'notes', 'tags'].forEach(function (f) {
      if (params[f] !== undefined) { nodeUpdates[f] = params[f]; }
    });
    if (Object.keys(nodeUpdates).length > 0) {
      DDS_STORE.update('nodes', { id: params.id }, nodeUpdates);
    }

    if (params.note_visible !== undefined || params.label_position !== undefined) {
      var targetMap = mapId || _activeMapId();
      if (targetMap) {
        var mnUpdates = {};
        if (params.note_visible   !== undefined) { mnUpdates.note_visible   = params.note_visible; }
        if (params.label_position !== undefined) { mnUpdates.label_position = params.label_position; }
        DDS_STORE.update('map_nodes', { map_id: targetMap, node_id: params.id }, mnUpdates);
      }
    }

    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.FLOW_UPDATE
  // params: { id: integer, lead_time_value?, lead_time_unit?, notes?,
  //           bidirectional?, tags?, show_notes_label?, notes_as_annotation?,
  //           layout_direction_inverted?, layout_offset?, curve_style? }
  // Flow-table fields (lead_time_value, lead_time_unit, notes, bidirectional,
  // tags) update the `flows` record. Presentation fields (show_notes_label,
  // notes_as_annotation, layout_direction_inverted, layout_offset,
  // curve_style) update the map_flows row for `mapId`. Mirrors the legacy
  // DDS_PANEL.openFlow() call sites, all sharing TX.FLOW_UPDATE regardless of
  // which single field changed.
  _register(TX.FLOW_UPDATE, function (params, mapId) {
    var flowUpdates = {};
    ['lead_time_value', 'lead_time_unit', 'notes', 'bidirectional', 'tags'].forEach(function (f) {
      if (params[f] !== undefined) { flowUpdates[f] = params[f]; }
    });
    if (Object.keys(flowUpdates).length > 0) {
      DDS_STORE.update('flows', { id: params.id }, flowUpdates);
    }

    var mfFields = ['show_notes_label', 'notes_as_annotation', 'layout_direction_inverted', 'layout_offset', 'curve_style'];
    var hasMfUpdate = mfFields.some(function (f) { return params[f] !== undefined; });
    if (hasMfUpdate) {
      var targetMap = mapId || _activeMapId();
      if (targetMap) {
        var mfUpdates = {};
        mfFields.forEach(function (f) {
          if (params[f] !== undefined) { mfUpdates[f] = params[f]; }
        });
        DDS_STORE.update('map_flows', { map_id: targetMap, flow_id: params.id }, mfUpdates);
      }
    }

    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.FLOW_ADD_PRODUCT
  // params: { flow_id: integer, product_id: integer }
  // Adds product_id to flows.product_ids, then ensures a SKU exists on both
  // flow endpoints (source and target node) — mirrors the legacy
  // DDS_PRODUCTS.syncFlowSkus() / ensureSku() cascade, ported inline since no
  // standalone SKU_ADD call site exists (see DDScope_Commands.md §3.3 gap
  // note — TX.SKU_ADD is unused). Never removes an existing SKU.
  _register(TX.FLOW_ADD_PRODUCT, function (params) {
    var flow = _rec('flows', params.flow_id);
    if (!flow) throw new Error('[DDS_CMD] Flow not found');
    var productIds = Array.isArray(flow.product_ids) ? flow.product_ids.map(Number) : [];
    if (productIds.indexOf(params.product_id) === -1) {
      productIds.push(params.product_id);
      DDS_STORE.update('flows', { id: params.flow_id }, { product_ids: productIds });
    }

    [flow.source_node_id, flow.target_node_id].forEach(function (nodeId) {
      var existing = DDS_STORE.query('skus', { node_id: nodeId, product_id: params.product_id });
      if (existing.length === 0) {
        DDS_STORE.insert('skus', [{ node_id: nodeId, product_id: params.product_id, tags: [], notes: '' }]);
      }
    });

    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.FLOW_REMOVE_PRODUCT
  // params: { flow_id: integer, product_id: integer }
  // Removes product_id from flows.product_ids, then cleans up SKUs on both
  // flow endpoints that are no longer needed — mirrors DDS_PRODUCTS.cleanSku():
  // a SKU is kept if its node is the product-node-default type (owns its SKU
  // independently of flows), or if any other flow touching that node still
  // references the product. See §3.3 gap note — TX.SKU_REMOVE is unused.
  _register(TX.FLOW_REMOVE_PRODUCT, function (params) {
    var flow = _rec('flows', params.flow_id);
    if (!flow) throw new Error('[DDS_CMD] Flow not found');
    var productIds = Array.isArray(flow.product_ids) ? flow.product_ids.map(Number) : [];
    var idx = productIds.indexOf(params.product_id);
    if (idx !== -1) {
      productIds.splice(idx, 1);
      DDS_STORE.update('flows', { id: params.flow_id }, { product_ids: productIds });
    }

    var productNodeType = DDS_STORE.query('node_types').find(function (t) { return t.is_product_node_default; });

    [flow.source_node_id, flow.target_node_id].forEach(function (nodeId) {
      var node = _rec('nodes', nodeId);
      if (productNodeType && node && node.type_code === productNodeType.code) return; // product-node owns its SKU

      var stillNeeded = DDS_STORE.query('flows').some(function (f) {
        return (f.source_node_id === nodeId || f.target_node_id === nodeId) &&
          Array.isArray(f.product_ids) && f.product_ids.map(Number).indexOf(params.product_id) !== -1;
      });
      if (stillNeeded) return;

      DDS_STORE.remove('skus', { node_id: nodeId, product_id: params.product_id });
    });

    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.SKU_UPDATE
  // params: { node_id: integer, product_id: integer, tags? }
  // Only tags are edited from the SKU row in the node panel (legacy call
  // site scope) — notes are not exposed there.
  _register(TX.SKU_UPDATE, function (params) {
    var updates = {};
    if (params.tags !== undefined) { updates.tags = params.tags; }
    DDS_STORE.update('skus', { node_id: params.node_id, product_id: params.product_id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // describe(commands) -> { index, label }[]
  // commands: [{ type: txKey, params }] — same shape passed to listeners.
  // ---------------------------------------------------------------------------

  function describe(commands) {
    return commands.map(function (entry, index) {
      var type   = entry.type;
      var params = entry.params || {};
      var label;
      try {
        switch (type) {
          case TX.NOTE_CATEGORY_CREATE:
            label = 'Add note category "' + (params.label || '?') + '"';
            break;
          case TX.NOTE_CATEGORY_UPDATE:
            var cat = _rec('note_categories', params.id);
            label = 'Update note category "' + (cat ? cat.label : '?') + '"';
            break;
          case TX.NOTE_CATEGORY_DELETE:
            var catDel = _rec('note_categories', params.id);
            label = 'Delete note category "' + (catDel ? catDel.label : '?') + '"';
            break;
          case TX.NOTE_CATEGORY_REORDER:
            label = 'Reorder note categories';
            break;
          case TX.NOTE_CREATE:
            label = 'Add note "' + _truncate(params.content, 30) + '"';
            break;
          case TX.NOTE_UPDATE:
            var note = _rec('notes', params.id);
            label = 'Update note "' + _truncate(note ? note.content : (params.content || ''), 30) + '"';
            break;
          case TX.NOTE_DELETE:
            var noteDel = _rec('notes', params.id);
            label = 'Delete note "' + _truncate(noteDel ? noteDel.content : '', 30) + '"';
            break;
          case TX.NOTE_REORDER:
            label = 'Reorder notes';
            break;
          case TX.MAP_DELETE:
            var map = _rec('maps', params.id);
            label = 'Delete map "' + (map ? map.name : '?') + '"';
            break;
          case TX.LANE_CREATE:
            label = 'Add swim-lane "' + (params.name || '?') + '"';
            break;
          case TX.LANE_UPDATE:
            var lane = _rec('swim_lanes', params.id);
            label = 'Update swim-lane "' + (lane ? lane.name : '?') + '"';
            break;
          case TX.LANE_DELETE:
            var laneDel = _rec('swim_lanes', params.id);
            label = 'Delete swim-lane "' + (laneDel ? laneDel.name : '?') + '"';
            break;
          case TX.ANNOTATION_DELETE:
            var ann = _rec('annotations', params.id);
            label = 'Delete annotation "' + _truncate(ann ? ann.notes : '', 30) + '"';
            break;
          case TX.SETTINGS_NODE_TYPE:
            var ntFields = params.fields || {};
            label = 'Save node type "' + (ntFields.label || ntFields.code || '?') + '"';
            break;
          case TX.SETTINGS_PRODUCT_TYPE:
            var ptFields = params.fields || {};
            label = 'Save product type "' + (ptFields.label || ptFields.code || '?') + '"';
            break;
          default:
            label = 'Unknown command: ' + type;
        }
      } catch (e) {
        label = 'Command ' + (index + 1) + ' (' + type + ')';
      }
      return { index: index, label: label };
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function execute(txKey, params, mapId, onSuccess) {
    _notifyExecuteListeners([{ type: txKey, params: params || {} }]);
    var cmd = _commands[txKey];
    if (!cmd) {
      DDS_TOOLS.log.error('DDS_CMD.execute: unknown command', txKey);
      return { ok: false };
    }
    var txId = DDS_TRANSACTIONS.begin(txKey);
    var result;
    try {
      result = cmd(params || {}, mapId || null);
      DDS_TRANSACTIONS.commit(txId);
    } catch (e) {
      DDS_TOOLS.log.error('DDS_CMD.execute: error in command', txKey, e);
      DDS_TRANSACTIONS.rollback(txId);
      return { ok: false };
    }
    if (typeof onSuccess === 'function') {
      try { onSuccess(result); } catch (e) {
        DDS_TOOLS.log.warn('DDS_CMD.execute: onSuccess threw', e);
      }
    }
    return result || { ok: true };
  }

  return {
    execute: execute,
    describe: describe,
    addExecuteListener: addExecuteListener,
    removeExecuteListener: removeExecuteListener
  };

}());

window.DDS_CMD = DDS_CMD;

// ESM export for Vitest compatibility
export default DDS_CMD;
