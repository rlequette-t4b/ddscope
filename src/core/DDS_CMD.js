// JS: DDS_CMD — unified command layer (notes domain + Phase 2: lanes, annotations, settings)
// CommWise block: SCRIPT 1875
// Testability: store-dependent
// Depends on: DDS_STORE (SCRIPT 150), DDS_TRANSACTIONS (SCRIPT 1860), TX (SCRIPT 1865), DDS_MODEL (SCRIPT 1550)
// API documented: yes
//
// Bootstrap of the future unified command layer.
// Domains covered: notes (FEAT-002), swim lanes, annotations (delete),
// settings node/product types. Legacy helpers (DDS_NODES, DDS_ACTIONS, etc.)
// remain in place for domains not yet migrated.
//
// Signature:
//   DDS_CMD.execute(txKey, params, mapId, onSuccess?)
//   Returns: { ok: boolean, id?: integer }
// AUDITOR:LARGE_BLOCK_JUSTIFIED - unified command registry serving multiple domains atomically; splitting would break single-point command registration

var DDS_CMD = (function () {

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function _activeMapId() {
    return (window.DDS && DDS.state) ? DDS.state.currentMap : null;
  }

  // ---------------------------------------------------------------------------
  // Command registry
  // ---------------------------------------------------------------------------

  var _commands = {};

  function _register(txKey, fn) {
    _commands[txKey] = fn;
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
  // Maps domain — map deletion cascade (map_notes + all map-scoped tables)
  // ---------------------------------------------------------------------------

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
  // Public API
  // ---------------------------------------------------------------------------

  function execute(txKey, params, mapId, onSuccess) {
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
    execute: execute
  };

}());

window.DDS_CMD = DDS_CMD;
