// JS: DDS_CMD — unified command layer (notes domain + Phase 2: lanes, annotations, settings + Phase 3: products, BOMs, demands + Phase 4: maps, project, add-product-on-map)
// CommWise block: SCRIPT 1875
// Testability: store-dependent
// Depends on: DDS_STORE (SCRIPT 150), DDS_TRANSACTIONS (SCRIPT 1860), TX (SCRIPT 1865), DDS_MODEL (SCRIPT 1550), DDS_LAYOUT (map placement, Phase 4 only)
// API documented: yes
//
// Bootstrap of the future unified command layer.
// Domains covered: notes (FEAT-002), swim lanes, annotations (delete),
// settings node/product types, products / BOMs / demands (Phase 3 tabular CRUD),
// maps create/rename/duplicate/delete, project rename, add-product-on-map (Phase 4).
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
//
// SRC MIRROR NOTE (2026-07-02): resynced against the live CommWise app
// (SCRIPT 1875, revision #28180) — this mirror had drifted significantly
// behind live: missing executeList()/getVocabularyText()/_VOCAB (Phase 6
// Steps 1-3), TX.ANNOTATION_CREATE/UPDATE, standalone TX.SKU_ADD/REMOVE,
// TX.BOM_COMPONENT_ADD/UPDATE/REMOVE (Phase 6 Step 2), the full-delete
// domain (TX.NODE_DELETE/FLOW_DELETE/MAP_REMOVE_*/MULTI_DELETE, Phase 5
// §3.4), and describe()'s gap-closing cases. Also carries the fix for the
// AI-string-id bug (parseInt on source_id/target_id/new_source_id/
// new_target_id/product_id/swim_lane_id) — see DDScope_Commands.md v1.13.

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

  // _entityLabel / _flowEndpointNames / _bomNodeName — shared by describe()
  // for both real records and 'new_*' temporary ids referenced by an
  // in-progress AI plan (Phase 6 — DDS_CMD_Migration.md). Mirrors the
  // newLabelMap pattern from the legacy DDS_ACTIONS.describe().
  function _entityLabel(table, id, newLabelMap) {
    if (typeof id === 'string' && id.indexOf('new_') === 0) {
      return (newLabelMap && newLabelMap[id]) || id;
    }
    var rec = _rec(table, id);
    if (!rec) return table + '#' + id;
    if (rec.name) return rec.name;
    if (rec.label) return rec.label;
    if (rec.notes) return _truncate(rec.notes, 30);
    return table + '#' + id;
  }

  function _flowEndpointNames(flowId, newLabelMap) {
    var flow = _rec('flows', flowId);
    if (!flow) return { src: 'flow#' + flowId, tgt: '?' };
    return {
      src: _entityLabel('nodes', flow.source_node_id, newLabelMap),
      tgt: _entityLabel('nodes', flow.target_node_id, newLabelMap)
    };
  }

  function _bomNodeName(bomId) {
    var bom = _rec('boms', bomId);
    if (!bom) return 'bom#' + bomId;
    return _entityLabel('nodes', bom.node_id, {});
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

  // TX.ANNOTATION_CREATE (Phase 6 Step 2 gap-closing — DDS_CMD_Migration.md)
  // params: { notes?: string, swim_lane_id?: integer|null, tags?: array }
  // Mirrors the legacy 'add_annotation' DDS_ACTIONS case: creates the
  // annotations record only. Map placement is intentionally NOT done here —
  // an annotation is never automatically placed on any map; that is a
  // presentation-layer operation performed by the UI (DDS_ELEMENTS.addAnnotation),
  // same as the AI flow's onSuccess handling (see DDScope_AI_Assistant.md §4).
  _register(TX.ANNOTATION_CREATE, function (params) {
    var inserted = DDS_STORE.insert('annotations', [{
      notes:        params.notes || '',
      swim_lane_id: params.swim_lane_id ? parseInt(params.swim_lane_id, 10) : null,
      tags:         params.tags || []
    }]);
    DDS_STORE.markDirty();
    return { ok: true, id: inserted[0].id };
  });

  // TX.ANNOTATION_UPDATE (Phase 6 Step 2 gap-closing — DDS_CMD_Migration.md)
  // params: { id: integer, notes?: string, swim_lane_id?: integer|null, tags?: array }
  _register(TX.ANNOTATION_UPDATE, function (params) {
    var updates = {};
    if (params.notes        !== undefined) { updates.notes        = params.notes; }
    if (params.swim_lane_id !== undefined) { updates.swim_lane_id = params.swim_lane_id ? parseInt(params.swim_lane_id, 10) : null; }
    if (params.tags         !== undefined) { updates.tags         = params.tags; }
    DDS_STORE.update('annotations', { id: params.id }, updates);
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
  // BOM components — unitary commands (Phase 6 Step 2 gap-closing —
  // DDS_CMD_Migration.md). New TX keys alongside the existing
  // BOM_UPDATE_COMPONENTS (full-list diff, still used by the table UI modal).
  // These exist for the AI vocabulary, which reasons in single-component
  // steps rather than re-emitting a full component list per edit — decision
  // made in favour of unitary keys, per the docs' own leaning.
  // ---------------------------------------------------------------------------

  // TX.BOM_COMPONENT_ADD
  // params: { bom_id: integer, product_id: integer, quantity?: number, notes?: string }
  _register(TX.BOM_COMPONENT_ADD, function (params) {
    DDS_STORE.insert('bom_components', [{
      bom_id:     params.bom_id,
      product_id: params.product_id,
      quantity:   params.quantity !== undefined ? params.quantity : 1,
      notes:      params.notes || ''
    }]);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.BOM_COMPONENT_UPDATE
  // params: { bom_id: integer, product_id: integer, quantity?: number, notes?: string }
  _register(TX.BOM_COMPONENT_UPDATE, function (params) {
    var updates = {};
    if (params.quantity !== undefined) { updates.quantity = params.quantity; }
    if (params.notes    !== undefined) { updates.notes    = params.notes; }
    DDS_STORE.update('bom_components', { bom_id: params.bom_id, product_id: params.product_id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.BOM_COMPONENT_REMOVE
  // params: { bom_id: integer, product_id: integer }
  _register(TX.BOM_COMPONENT_REMOVE, function (params) {
    DDS_STORE.remove('bom_components', { bom_id: params.bom_id, product_id: params.product_id });
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
  // FIX (2026-07-02, DDScope_Commands.md v1.13): source_id/target_id are
  // coerced via parseInt — AI-supplied ids arrive as strings
  // (DDScope_AI_Assistant.md §4) and, left uncoerced, broke the strict ===
  // node-lookup in DDS_MAP.loadMap (SCRIPT 1000), silently excluding the
  // flow from the map even though it was correctly created and logged.
  _register(TX.FLOW_CREATE, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] FLOW_CREATE requires a mapId');
    var inserted = DDS_STORE.insert('flows', [{
      source_node_id:  parseInt(params.source_id, 10),
      target_node_id:  parseInt(params.target_id, 10),
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
  // FIX (2026-07-02, DDScope_Commands.md v1.13): same parseInt coercion as
  // TX.FLOW_CREATE — see comment there.
  _register(TX.FLOW_REROUTE, function (params) {
    var updates = {};
    if (params.new_source_id) { updates.source_node_id = parseInt(params.new_source_id, 10); }
    if (params.new_target_id) { updates.target_node_id = parseInt(params.new_target_id, 10); }
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
  // FIX (2026-07-02, DDScope_Commands.md v1.13): swim_lane_id coerced via
  // parseInt — same class of bug as TX.FLOW_CREATE, aligned with the pattern
  // already used by TX.ANNOTATION_CREATE/UPDATE.
  _register(TX.NODE_UPDATE, function (params, mapId) {
    var nodeUpdates = {};
    ['name', 'type_code', 'swim_lane_id', 'notes', 'tags'].forEach(function (f) {
      if (params[f] !== undefined) { nodeUpdates[f] = params[f]; }
    });
    if (nodeUpdates.swim_lane_id !== undefined) {
      nodeUpdates.swim_lane_id = nodeUpdates.swim_lane_id === null ? null : parseInt(nodeUpdates.swim_lane_id, 10);
    }
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
  // note — TX.SKU_ADD is unused at the legacy UI level). Never removes an
  // existing SKU.
  // FIX (2026-07-02, DDScope_Commands.md v1.13): product_id coerced via
  // parseInt — an uncoerced string failed the indexOf() lookup against
  // flow.product_ids.map(Number), silently duplicating the id on repeated
  // AI-driven calls instead of being recognised as already present.
  _register(TX.FLOW_ADD_PRODUCT, function (params) {
    var flow = _rec('flows', params.flow_id);
    if (!flow) throw new Error('[DDS_CMD] Flow not found');
    var productId  = parseInt(params.product_id, 10);
    var productIds = Array.isArray(flow.product_ids) ? flow.product_ids.map(Number) : [];
    if (productIds.indexOf(productId) === -1) {
      productIds.push(productId);
      DDS_STORE.update('flows', { id: params.flow_id }, { product_ids: productIds });
    }

    [flow.source_node_id, flow.target_node_id].forEach(function (nodeId) {
      var existing = DDS_STORE.query('skus', { node_id: nodeId, product_id: productId });
      if (existing.length === 0) {
        DDS_STORE.insert('skus', [{ node_id: nodeId, product_id: productId, tags: [], notes: '' }]);
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
  // references the product. See §3.3 gap note — TX.SKU_REMOVE is unused at
  // the legacy UI level.
  // FIX (2026-07-02, DDScope_Commands.md v1.13): same parseInt coercion as
  // TX.FLOW_ADD_PRODUCT — see comment there.
  _register(TX.FLOW_REMOVE_PRODUCT, function (params) {
    var flow = _rec('flows', params.flow_id);
    if (!flow) throw new Error('[DDS_CMD] Flow not found');
    var productId  = parseInt(params.product_id, 10);
    var productIds = Array.isArray(flow.product_ids) ? flow.product_ids.map(Number) : [];
    var idx = productIds.indexOf(productId);
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
          Array.isArray(f.product_ids) && f.product_ids.map(Number).indexOf(productId) !== -1;
      });
      if (stillNeeded) return;

      DDS_STORE.remove('skus', { node_id: nodeId, product_id: productId });
    });

    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.SKU_ADD (Phase 6 Step 2 gap-closing — DDS_CMD_Migration.md)
  // params: { node_id: integer, product_id: integer, tags?: array, notes?: string }
  // Standalone SKU creation for the AI vocabulary — the legacy UI call sites
  // only ever create a SKU as a side effect of FLOW_ADD_PRODUCT, but the AI
  // needs to create a bare SKU (e.g. product stored at a node with no flow
  // yet). Guards against a duplicate (same node_id + product_id) by no-oping
  // rather than throwing, since a retried AI plan should not fail.
  _register(TX.SKU_ADD, function (params) {
    var existing = DDS_STORE.query('skus', { node_id: params.node_id, product_id: params.product_id });
    if (existing.length > 0) { return { ok: true }; }
    DDS_STORE.insert('skus', [{
      node_id:    params.node_id,
      product_id: params.product_id,
      tags:       params.tags || [],
      notes:      params.notes || ''
    }]);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.SKU_UPDATE
  // params: { node_id: integer, product_id: integer, tags?: array, notes?: string }
  // The legacy side-panel SKU row only edits tags; notes is exposed here for
  // the AI vocabulary (Phase 6 Step 2 gap-closing — DDS_CMD_Migration.md).
  _register(TX.SKU_UPDATE, function (params) {
    var updates = {};
    if (params.tags  !== undefined) { updates.tags  = params.tags; }
    if (params.notes !== undefined) { updates.notes = params.notes; }
    DDS_STORE.update('skus', { node_id: params.node_id, product_id: params.product_id }, updates);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.SKU_REMOVE (Phase 6 Step 2 gap-closing — DDS_CMD_Migration.md)
  // params: { node_id: integer, product_id: integer }
  // Delegates to DDS_MODEL.removeSku — same cascade as the legacy
  // 'remove_sku' DDS_ACTIONS case (removes dependent demands/map_demands).
  _register(TX.SKU_REMOVE, function (params) {
    DDS_MODEL.removeSku(params.node_id, params.product_id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Nodes / Flows domain — full delete (Phase 5, DDS_CMD_Migration.md §3.4)
  // ---------------------------------------------------------------------------

  // TX.NODE_DELETE
  // params: { id: integer }
  // Cascade: delegates to DDS_MODEL.deleteNode (flows, skus, boms, demands,
  // map_nodes across all maps, orphan product cleanup, Cytoscape removal —
  // same cascade already used by the legacy 'delete_node' DDS_ACTIONS case).
  _register(TX.NODE_DELETE, function (params) {
    DDS_MODEL.deleteNode(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.FLOW_DELETE
  // params: { id: integer }
  // Cascade: delegates to DDS_MODEL.deleteFlow (map_flows across all maps).
  // NOTE: no SKU cleanup — matches existing behaviour of the legacy
  // 'delete_flow' DDS_ACTIONS case. The DDS_REMOVE confirmation modal's
  // "orphan SKU(s) will be deleted" text is display-only and does not
  // reflect an actual cleanup step; pre-existing gap, out of scope here.
  _register(TX.FLOW_DELETE, function (params) {
    DDS_MODEL.deleteFlow(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Map presentation — remove from map only (Phase 5, DDS_CMD_Migration.md §3.4)
  // TX.MAP_REMOVE_NODE covers both the single-element and the multi-selection
  // map-only removal rows in the inventory — same TX key, unified params
  // shape: always an items array (one entry for the single-element case).
  // ---------------------------------------------------------------------------

  // TX.MAP_REMOVE_NODE
  // params: { items: [{ type: 'node'|'edge', id: integer }] }
  // mapId: required — the active map to remove from.
  // Delegates to DDS_ELEMENTS.removeNode/removeFlow, which already cascade
  // map-scoped flows and handle their own Cytoscape cleanup.
  _register(TX.MAP_REMOVE_NODE, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_REMOVE_NODE requires a mapId');
    (params.items || []).forEach(function (item) {
      if (item.type === 'node') DDS_ELEMENTS.removeNode(item.id);
      else if (item.type === 'edge') DDS_ELEMENTS.removeFlow(item.id);
    });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_REMOVE_FLOW
  // params: { id: integer } — mapId required.
  _register(TX.MAP_REMOVE_FLOW, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_REMOVE_FLOW requires a mapId');
    DDS_ELEMENTS.removeFlow(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_REMOVE_ANNOTATION
  // params: { id: integer } — mapId required.
  _register(TX.MAP_REMOVE_ANNOTATION, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_REMOVE_ANNOTATION requires a mapId');
    DDS_ELEMENTS.removeAnnotation(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // TX.MAP_REMOVE_LANE
  // params: { id: integer } — mapId required.
  // Gap found during Phase 5 §3.4 migration (see DDScope_Commands.md §3.4):
  // the DDS_REMOVE lane modal has always supported "map only" removal
  // (DDS_ELEMENTS.removeLane), but this row was never in the TX catalogue
  // or the DDS_CMD_Migration.md §3.4 inventory. Added here rather than left
  // silently unreachable now that dispatch is keyed on txKey.
  _register(TX.MAP_REMOVE_LANE, function (params, mapId) {
    if (!mapId) throw new Error('[DDS_CMD] MAP_REMOVE_LANE requires a mapId');
    DDS_ELEMENTS.removeLane(params.id);
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // Multi-selection — full delete (Phase 5, DDS_CMD_Migration.md §3.4)
  // ---------------------------------------------------------------------------

  // TX.MULTI_DELETE
  // params: { items: [{ type: 'node'|'edge'|'annotation', id: integer }] }
  // Ports the legacy DDS_REMOVE.execute() multi-selection branch verbatim:
  // annotations first (no cascade), then nodes (cascade handles connected
  // flows via DDS_MODEL.deleteNode), then standalone flows not already
  // removed by a node cascade.
  _register(TX.MULTI_DELETE, function (params) {
    var items = params.items || [];
    items.forEach(function (item) {
      if (item.type === 'annotation') DDS_MODEL.deleteAnnotation(item.id);
    });
    var deletedNodeIds = {};
    items.forEach(function (item) {
      if (item.type === 'node') {
        DDS_MODEL.deleteNode(item.id);
        deletedNodeIds[item.id] = true;
      }
    });
    items.forEach(function (item) {
      if (item.type === 'edge') {
        var flow = DDS_STORE.query('flows', { id: item.id })[0];
        if (!flow) return; // already removed via node cascade
        if (!deletedNodeIds[flow.source_node_id] && !deletedNodeIds[flow.target_node_id]) {
          DDS_MODEL.deleteFlow(item.id);
        }
      }
    });
    DDS_STORE.markDirty();
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // describe(commands) -> { index, label }[]
  // commands: [{ type: txKey, params }] — same shape passed to listeners.
  // ---------------------------------------------------------------------------

  function describe(commands) {
    // Pass 1 — collect 'new_*' labels so an in-progress AI plan can describe
    // commands that reference entities created earlier in the same plan
    // (mirrors the legacy DDS_ACTIONS.describe() newLabelMap pattern).
    var newLabelMap = {};
    commands.forEach(function (entry) {
      if (!entry.id || String(entry.id).indexOf('new_') !== 0) return;
      var p = entry.params || {};
      var lbl = p.name;
      if (!lbl) {
        if (entry.type === TX.FLOW_CREATE) { lbl = 'new flow'; }
        else if (entry.type === TX.BOM_CREATE) { lbl = 'new BOM'; }
        else { lbl = entry.id; }
      }
      newLabelMap[entry.id] = lbl;
    });

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

          // --- Gap-closing additions (Phase 6 — DDS_CMD_Migration.md): full
          // registry coverage so both the AI plan panel and the Actions Log
          // panel can describe every command, not just the Phase 1-2 subset. ---

          case TX.NODE_CREATE:
            label = 'Add node "' + (params.name || '?') + '"';
            break;
          case TX.NODE_UPDATE:
            label = 'Update node "' + _entityLabel('nodes', params.id, newLabelMap) + '"';
            break;
          case TX.NODE_DELETE:
            label = 'Delete node "' + _entityLabel('nodes', params.id, newLabelMap) + '"';
            break;

          case TX.FLOW_CREATE:
            var _fcArrow = params.bidirectional ? ' ↔ ' : ' → ';
            label = 'Add flow ' + _entityLabel('nodes', params.source_id, newLabelMap) + _fcArrow + _entityLabel('nodes', params.target_id, newLabelMap);
            break;
          case TX.FLOW_UPDATE:
            var _fuEp = _flowEndpointNames(params.id, newLabelMap);
            label = 'Update flow ' + _fuEp.src + ' → ' + _fuEp.tgt;
            break;
          case TX.FLOW_DELETE:
            var _fdEp = _flowEndpointNames(params.id, newLabelMap);
            label = 'Delete flow ' + _fdEp.src + ' → ' + _fdEp.tgt;
            break;
          case TX.FLOW_REROUTE:
            var _frEp  = _flowEndpointNames(params.flow_id, newLabelMap);
            var _frSrc = params.new_source_id ? _entityLabel('nodes', params.new_source_id, newLabelMap) : _frEp.src;
            var _frTgt = params.new_target_id ? _entityLabel('nodes', params.new_target_id, newLabelMap) : _frEp.tgt;
            label = 'Reroute flow: ' + _frSrc + ' → ' + _frTgt;
            break;
          case TX.FLOW_ADD_PRODUCT:
            var _fapEp = _flowEndpointNames(params.flow_id, newLabelMap);
            label = 'Add product "' + _entityLabel('products', params.product_id, newLabelMap) + '" to flow ' + _fapEp.src + ' → ' + _fapEp.tgt;
            break;
          case TX.FLOW_REMOVE_PRODUCT:
            var _frpEp = _flowEndpointNames(params.flow_id, newLabelMap);
            label = 'Remove product "' + _entityLabel('products', params.product_id, newLabelMap) + '" from flow ' + _frpEp.src + ' → ' + _frpEp.tgt;
            break;

          case TX.PRODUCT_CREATE:
            label = 'Add product "' + (params.name || '?') + '"';
            break;
          case TX.PRODUCT_UPDATE:
            label = 'Update product "' + _entityLabel('products', params.id, newLabelMap) + '"';
            break;
          case TX.PRODUCT_DELETE:
            label = 'Delete product "' + _entityLabel('products', params.id, newLabelMap) + '"';
            break;

          case TX.SKU_ADD:
            label = 'Add SKU: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" × product "' + _entityLabel('products', params.product_id, newLabelMap) + '"';
            break;
          case TX.SKU_UPDATE:
            label = 'Update SKU: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" × product "' + _entityLabel('products', params.product_id, newLabelMap) + '"';
            break;
          case TX.SKU_REMOVE:
            label = 'Remove SKU: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" × product "' + _entityLabel('products', params.product_id, newLabelMap) + '"';
            break;

          case TX.BOM_CREATE:
            label = 'Add BOM: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" → output "' + _entityLabel('products', params.output_product_id, newLabelMap) + '"';
            break;
          case TX.BOM_UPDATE_COMPONENTS:
            label = 'Update BOM components on node "' + _bomNodeName(params.bom_id) + '"';
            break;
          case TX.BOM_DELETE:
            label = 'Delete BOM on node "' + _bomNodeName(params.id) + '"';
            break;
          case TX.BOM_COMPONENT_ADD:
            label = 'Add BOM component: "' + _entityLabel('products', params.product_id, newLabelMap) + '" × ' + (params.quantity || 1) + ' to BOM on "' + _bomNodeName(params.bom_id) + '"';
            break;
          case TX.BOM_COMPONENT_UPDATE:
            label = 'Update BOM component "' + _entityLabel('products', params.product_id, newLabelMap) + '" on "' + _bomNodeName(params.bom_id) + '"';
            break;
          case TX.BOM_COMPONENT_REMOVE:
            label = 'Remove BOM component "' + _entityLabel('products', params.product_id, newLabelMap) + '" from "' + _bomNodeName(params.bom_id) + '"';
            break;

          case TX.DEMAND_CREATE:
            label = 'Add demand: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" × product "' + _entityLabel('products', params.product_id, newLabelMap) + '"';
            break;
          case TX.DEMAND_UPDATE:
            label = 'Update demand: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" × product "' + _entityLabel('products', params.product_id, newLabelMap) + '"';
            break;
          case TX.DEMAND_DELETE:
            label = 'Delete demand: node "' + _entityLabel('nodes', params.node_id, newLabelMap) + '" × product "' + _entityLabel('products', params.product_id, newLabelMap) + '"';
            break;

          case TX.ANNOTATION_CREATE:
            var _annNotes = (params.notes || '').trim();
            label = _annNotes.length > 0 ? 'Add annotation "' + _truncate(_annNotes, 30) + '"' : 'Add annotation';
            break;
          case TX.ANNOTATION_UPDATE:
            label = 'Update annotation "' + _entityLabel('annotations', params.id, newLabelMap) + '"';
            break;

          case TX.MAP_CREATE:
            label = 'Add map "' + (params.name || '?') + '"';
            break;
          case TX.MAP_RENAME:
            label = 'Rename map to "' + (params.name || '?') + '"';
            break;
          case TX.MAP_DUPLICATE:
            var _srcMap = _rec('maps', params.source_id);
            label = 'Duplicate map "' + (_srcMap ? _srcMap.name : '?') + '"';
            break;

          case TX.PROJECT_RENAME:
            label = 'Rename project to "' + (params.name || '?') + '"';
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
  // AI vocabulary — _VOCAB + getVocabularyText() (Phase 6 Step 3 —
  // DDS_CMD_Migration.md). Replaces DDS_ACTIONS.ACTIONS / getVocabularyText()
  // as the source of truth for the AI system prompt.
  //
  // Design note: the aspirational design in DDScope_Commands.md §0.4 calls
  // for attaching required/optional/notes directly next to each
  // _register(...) call. In practice that would mean touching every one of
  // the ~35 existing _register calls in this file — high mechanical risk for
  // a single-block live edit with no behavioural gain over a single
  // co-located schema table. _VOCAB below stays in this same module (still
  // the single source of truth getVocabularyText() reads from) but as one
  // object rather than N inline attachments — documented deviation.
  //
  // Scope: only commands the AI is allowed to emit (DDScope_AI_Assistant.md
  // §2/§3 — v1 exclusions: map-scoped, type management, lane deletion,
  // notes). Map/project/settings/note commands are UI-only, absent here.
  // ---------------------------------------------------------------------------

  var _VOCAB = {};

  _VOCAB[TX.NODE_CREATE] = {
    required: ['name'],
    optional: ['type_code', 'swim_lane_id', 'tags', 'notes'],
    notes: [
      'x, y are NOT accepted — canvas position is map-specific and set manually.',
      'include "id": "new_node_N" in this command when referenced by params in later commands in the same plan.',
      'PRODUCT-NODE PATTERN (default behaviour): whenever a new product is mentioned, apply the product-node pattern — create a node (name = product name, type = is_product_node_default, swim_lane_id = default_swim_lane_id unless specified by the user) and emit sku.add for the node × product pair. Also emit flow.create if the product is described as a source or destination.',
      'EXCEPTION — flow.add_product only: when the user explicitly asks to add a product to an existing flow between two existing non-product nodes (both endpoints already exist and neither represents a product), use flow.add_product instead. Do NOT create a node for the product in this case.',
      'In all other cases — new product, product as a flow endpoint, product placed in a lane — apply the product-node pattern.'
    ]
  };
  _VOCAB[TX.NODE_UPDATE] = { required: ['id'], optional: ['name', 'type_code', 'swim_lane_id', 'tags', 'notes'], notes: [] };
  _VOCAB[TX.NODE_DELETE] = {
    required: ['id'], optional: [],
    notes: [
      'implicitly removes all flows where this node is source or target, all SKUs for this node, and all demands for this node.',
      'List all implied cascade commands explicitly in the commands array.'
    ]
  };

  _VOCAB[TX.FLOW_CREATE] = {
    required: ['source_id', 'target_id'],
    optional: ['lead_time_value', 'lead_time_unit', 'bidirectional', 'tags', 'notes'],
    notes: [
      'a flow with no products is valid.',
      'bidirectional (boolean, default false) — when true, the flow is rendered with arrowheads at both ends. Use for symmetric exchanges. Same products and lead time apply in both directions. Do not create two flows for a bidirectional exchange.',
      'include "id": "new_flow_N" in this command when referenced by later commands in the same plan.'
    ]
  };
  _VOCAB[TX.FLOW_UPDATE] = { required: ['id'], optional: ['lead_time_value', 'lead_time_unit', 'bidirectional', 'tags', 'notes'], notes: [] };
  _VOCAB[TX.FLOW_DELETE] = { required: ['id'], optional: [], notes: [] };
  _VOCAB[TX.FLOW_REROUTE] = { required: ['flow_id'], optional: ['new_source_id', 'new_target_id'], notes: ['at least one of new_source_id or new_target_id is required.'] };
  _VOCAB[TX.FLOW_ADD_PRODUCT] = { required: ['flow_id', 'product_id'], optional: [], notes: [] };
  _VOCAB[TX.FLOW_REMOVE_PRODUCT] = { required: ['flow_id', 'product_id'], optional: [], notes: [] };

  _VOCAB[TX.PRODUCT_CREATE] = { required: ['name'], optional: ['type_code', 'tags', 'notes'], notes: ['include "id": "new_product_N" in this command when referenced by later commands in the same plan.'] };
  _VOCAB[TX.PRODUCT_UPDATE] = { required: ['id'], optional: ['name', 'type_code', 'tags', 'notes'], notes: [] };
  _VOCAB[TX.PRODUCT_DELETE] = {
    required: ['id'], optional: [],
    notes: [
      'implicitly removes the product from all flows, all SKUs, and all demands associated with those SKUs.',
      'List all implied cascade commands explicitly in the commands array.'
    ]
  };

  _VOCAB[TX.SKU_ADD] = { required: ['node_id', 'product_id'], optional: ['tags', 'notes'], notes: ['tags express the nature of the association (e.g. "buffer", "stock", "transit").'] };
  _VOCAB[TX.SKU_UPDATE] = { required: ['node_id', 'product_id'], optional: ['tags', 'notes'], notes: [] };
  _VOCAB[TX.SKU_REMOVE] = { required: ['node_id', 'product_id'], optional: [], notes: [] };

  _VOCAB[TX.LANE_CREATE] = { required: ['name'], optional: ['color'], notes: ['include "id": "new_lane_N" in this command when referenced by later commands in the same plan.'] };
  _VOCAB[TX.LANE_UPDATE] = { required: ['id'], optional: ['name', 'color'], notes: [] };

  _VOCAB[TX.BOM_CREATE] = {
    required: ['node_id', 'output_product_id'], optional: ['notes', 'components'],
    notes: [
      'include "id": "new_bom_N" when referenced by subsequent bom_component.add commands.',
      'verify that output_product_id exists as a SKU on the node. If not, propose sku.add first.',
      'components (optional array of { product_id, quantity, notes }) may be supplied inline at creation instead of separate bom_component.add commands.'
    ]
  };
  _VOCAB[TX.BOM_DELETE] = { required: ['id'], optional: [], notes: ['implicitly removes all bom_components for this BOM. State the cascade explicitly in reasoning.'] };
  _VOCAB[TX.BOM_COMPONENT_ADD] = { required: ['bom_id', 'product_id', 'quantity'], optional: ['notes'], notes: ['verify that product_id exists as a SKU on the node owning the BOM. If not, propose sku.add first.'] };
  _VOCAB[TX.BOM_COMPONENT_UPDATE] = { required: ['bom_id', 'product_id'], optional: ['quantity', 'notes'], notes: [] };
  _VOCAB[TX.BOM_COMPONENT_REMOVE] = { required: ['bom_id', 'product_id'], optional: [], notes: [] };

  _VOCAB[TX.DEMAND_CREATE] = {
    required: ['node_id', 'product_id'], optional: ['ctt_value', 'ctt_unit', 'demand_value', 'demand_period', 'notes'],
    notes: [
      'verify that the SKU (node_id × product_id) exists before emitting. If absent, propose sku.add first.',
      'ctt_unit and demand_period accept: hours, days, weeks, months, years.'
    ]
  };
  _VOCAB[TX.DEMAND_UPDATE] = { required: ['node_id', 'product_id'], optional: ['ctt_value', 'ctt_unit', 'demand_value', 'demand_period', 'notes'], notes: [] };
  _VOCAB[TX.DEMAND_DELETE] = { required: ['node_id', 'product_id'], optional: [], notes: ['cascades to map_demands. State explicitly in reasoning.'] };

  _VOCAB[TX.ANNOTATION_CREATE] = {
    required: [], optional: ['notes', 'swim_lane_id', 'tags'],
    notes: [
      'x, y are NOT accepted — canvas position is map-specific and set by the UI after creation.',
      'The annotation is NOT automatically placed on any map — map placement is a presentation-layer operation performed by the UI.',
      'include "id": "new_annotation_N" when referenced by subsequent commands in the same plan.'
    ]
  };
  _VOCAB[TX.ANNOTATION_UPDATE] = { required: ['id'], optional: ['notes', 'swim_lane_id', 'tags'], notes: [] };
  _VOCAB[TX.ANNOTATION_DELETE] = { required: ['id'], optional: [], notes: ['cascades to all map_annotations records for this annotation. State the cascade explicitly in reasoning.'] };

  function getVocabularyText() {
    var lines = [];

    var sections = [
      { title: 'NODES',      keys: [TX.NODE_CREATE, TX.NODE_UPDATE, TX.NODE_DELETE] },
      { title: 'FLOWS',      keys: [TX.FLOW_CREATE, TX.FLOW_UPDATE, TX.FLOW_DELETE, TX.FLOW_REROUTE, TX.FLOW_ADD_PRODUCT, TX.FLOW_REMOVE_PRODUCT] },
      { title: 'PRODUCTS',   keys: [TX.PRODUCT_CREATE, TX.PRODUCT_UPDATE, TX.PRODUCT_DELETE] },
      { title: 'SKUs',       keys: [TX.SKU_ADD, TX.SKU_UPDATE, TX.SKU_REMOVE] },
      { title: 'SWIM-LANES', keys: [TX.LANE_CREATE, TX.LANE_UPDATE] },
      { title: 'BOMs',       keys: [TX.BOM_CREATE, TX.BOM_DELETE, TX.BOM_COMPONENT_ADD, TX.BOM_COMPONENT_UPDATE, TX.BOM_COMPONENT_REMOVE] },
      { title: 'DEMANDS',      keys: [TX.DEMAND_CREATE, TX.DEMAND_UPDATE, TX.DEMAND_DELETE] },
      { title: 'ANNOTATIONS',  keys: [TX.ANNOTATION_CREATE, TX.ANNOTATION_UPDATE, TX.ANNOTATION_DELETE] }
    ];

    lines.push('COMMAND FORMAT: each command is a JSON object with a "type" field (required — the exact key shown below, e.g. "node.create") plus a "params" object holding the domain fields, and an optional "id" field for temporary reference.');
    lines.push('Example: {"type": "node.create", "params": {"name": "Supplier A"}}');
    lines.push('NEVER use "action" or any other key for the discriminant — only "type" is accepted, and domain fields belong inside "params", never at the top level.');
    lines.push('');

    sections.forEach(function (section) {
      lines.push('--- ' + section.title + ' ---');
      lines.push('');
      section.keys.forEach(function (key) {
        var def = _VOCAB[key];
        if (!def) return;
        lines.push(key);
        if (def.required.length) lines.push('  Required : ' + def.required.join(', '));
        if (def.optional.length) lines.push('  Optional : ' + def.optional.join(', '));
        def.notes.forEach(function (note) {
          lines.push('  Note     : ' + note);
        });
        lines.push('');
      });
    });

    lines.push('Note: swim_lane deletion is excluded from v1 of the AI assistant.');
    lines.push('Note: node_type and product_type creation are excluded from v1.');
    lines.push('Note: map management and map visibility (maps, map_nodes, map_flows, map_swim_lanes, map_demands) are excluded from v1. Do not emit commands on these entities.');
    lines.push('Note: project-specific instructions and notes/note_categories are managed separately and are not part of this command vocabulary.');

    return lines.join(String.fromCharCode(10));
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

  // ---------------------------------------------------------------------------
  // executeList(commands, mapId, onSuccess?) — AI batch entry point
  // (DDS_CMD_Migration.md Phase 6, Step 1)
  //
  // commands: [{ type: TX.KEY, params: {}, id?: 'new_X' }]
  // Runs the whole list inside ONE transaction (TX.AI_APPLY_ACTIONS) — not one
  // transaction per command, so the batch is a single undo/redo entry, same
  // guarantee as any other single user interaction (§1.1 rule: "a single
  // run() per user interaction, even when multiple helpers are chained").
  // Stops at the first failure and rolls back everything applied so far in
  // the batch. Cross-command temporary-id resolution mirrors
  // DDS_ACTIONS._resolveAction/_resolveId (SCRIPT 1850), generalised: instead
  // of each action case manually doing `newIdMap[raw.id] = inserted[0].id`,
  // every DDS_CMD command already returns { id } on insert, so the mapping
  // is done once here from entry.id -> result.id after each command runs.
  // ---------------------------------------------------------------------------

  function _resolveId(value, newIdMap) {
    if (typeof value === 'string' && value.indexOf('new_') === 0) {
      return newIdMap[value] !== undefined ? newIdMap[value] : value;
    }
    return value;
  }

  function _resolveParams(params, newIdMap) {
    var resolved = {};
    for (var key in params) {
      if (!params.hasOwnProperty(key)) continue;
      var val = params[key];
      if (typeof val === 'string') {
        resolved[key] = _resolveId(val, newIdMap);
      } else if (Array.isArray(val)) {
        resolved[key] = val.map(function (v) {
          return typeof v === 'string' ? _resolveId(v, newIdMap) : v;
        });
      } else if (val && typeof val === 'object') {
        resolved[key] = _resolveParams(val, newIdMap); // nested objects (e.g. SETTINGS_* "fields")
      } else {
        resolved[key] = val;
      }
    }
    return resolved;
  }

  function executeList(commands, mapId, onSuccess) {
    commands = commands || [];
    _notifyExecuteListeners(commands);

    var txId    = DDS_TRANSACTIONS.begin(TX.AI_APPLY_ACTIONS);
    var applied = [];
    var newIdMap = {};

    for (var i = 0; i < commands.length; i++) {
      var entry = commands[i];
      var cmd   = _commands[entry.type];
      if (!cmd) {
        DDS_TOOLS.log.error('DDS_CMD.executeList: unknown command', entry.type);
        DDS_TRANSACTIONS.rollback(txId);
        return { ok: false, applied: applied, failed: { type: entry.type, params: entry.params, _error: 'Unknown command: ' + entry.type } };
      }
      var resolvedParams = _resolveParams(entry.params || {}, newIdMap);
      var result;
      try {
        result = cmd(resolvedParams, mapId || null);
      } catch (e) {
        DDS_TOOLS.log.error('DDS_CMD.executeList: error in command', entry.type, e);
        DDS_TRANSACTIONS.rollback(txId);
        return { ok: false, applied: applied, failed: { type: entry.type, params: resolvedParams, _error: e.message || String(e) } };
      }
      if (entry.id && result && result.id !== undefined) {
        newIdMap[entry.id] = result.id;
      }
      applied.push({ type: entry.type, params: resolvedParams, result: result });
    }

    DDS_TRANSACTIONS.commit(txId);

    if (typeof onSuccess === 'function') {
      try { onSuccess(applied); } catch (e) {
        DDS_TOOLS.log.warn('DDS_CMD.executeList: onSuccess threw', e);
      }
    }

    return { ok: true, applied: applied };
  }

  return {
    execute: execute,
    executeList: executeList,
    describe: describe,
    getVocabularyText: getVocabularyText,
    addExecuteListener: addExecuteListener,
    removeExecuteListener: removeExecuteListener
  };

}());

window.DDS_CMD = DDS_CMD;

// ESM export for Vitest compatibility
export default DDS_CMD;
