// JS: DDS_CMD — Unified command layer (notes domain bootstrap)
// CommWise block: SCRIPT 1866
// Testability: store-dependent
// Depends on: DDS_STORE (SCRIPT 150), DDS_TRANSACTIONS (SCRIPT 1860), DDS_TX (SCRIPT 1865)
// API documented: yes
//
// First domain: note_categories + notes (FEAT-002).
// Legacy helpers (DDS_NODES, DDS_FLOWS, etc.) and DDS_ACTIONS are untouched.
//
// Signature:
//   DDS_CMD.execute(txKey, params, mapId, onSuccess?)
//   Returns: { ok: boolean, id?: integer }

var DDS_CMD = (function () {

  // ------------------------------------------------------------------
  // Internal: command registry
  // Each command: { run(params, mapId) → { id? } }
  // ------------------------------------------------------------------

  var _commands = {};

  function _register(txKey, fn) {
    _commands[txKey] = { run: fn };
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  // Delete a note and cascade to its map_notes. Used by NOTE_DELETE
  // and NOTE_CATEGORY_DELETE to share the same cascade logic.
  function _deleteNote(noteId) {
    DDS_STORE.remove('map_notes', { note_id: noteId });
    DDS_STORE.remove('notes', { id: noteId });
  }

  // ------------------------------------------------------------------
  // Notes domain — note_categories
  // ------------------------------------------------------------------

  _register(DDS_TX.NOTE_CATEGORY_CREATE, function (params) {
    // params: { label, position? }
    var all = DDS_STORE.query('note_categories', null, { order: 'position.asc' });
    var position = (params.position !== undefined)
      ? params.position
      : (all.length ? all[all.length - 1].position + 1 : 0);

    var rows = DDS_STORE.insert('note_categories', {
      label:    params.label || '',
      position: position
    });
    return { id: rows[0].id };
  });

  _register(DDS_TX.NOTE_CATEGORY_UPDATE, function (params) {
    // params: { id, label?, position? }
    var updates = {};
    if (params.label    !== undefined) updates.label    = params.label;
    if (params.position !== undefined) updates.position = params.position;
    DDS_STORE.update('note_categories', { id: params.id }, updates);
    return {};
  });

  _register(DDS_TX.NOTE_CATEGORY_DELETE, function (params) {
    // params: { id }
    // Cascade: delete each note (and its map_notes) then delete the category
    var notes = DDS_STORE.query('notes', { category_id: params.id });
    notes.forEach(function (note) { _deleteNote(note.id); });
    DDS_STORE.remove('note_categories', { id: params.id });
    return {};
  });

  _register(DDS_TX.NOTE_CATEGORY_REORDER, function (params) {
    // params: { order: [{ id, position }] }
    (params.order || []).forEach(function (item) {
      DDS_STORE.update('note_categories', { id: item.id }, { position: item.position });
    });
    return {};
  });

  // ------------------------------------------------------------------
  // Notes domain — notes
  // ------------------------------------------------------------------

  _register(DDS_TX.NOTE_CREATE, function (params, mapId) {
    // params: { category_id, content, position? }
    // mapId is required — a note must be placed on a map at creation
    if (!mapId) {
      throw new Error('[DDS_CMD] NOTE_CREATE requires a mapId');
    }

    var siblings = DDS_STORE.query('notes', { category_id: params.category_id },
      { order: 'position.asc' });
    var position = (params.position !== undefined)
      ? params.position
      : (siblings.length ? siblings[siblings.length - 1].position + 1 : 0);

    var rows = DDS_STORE.insert('notes', {
      category_id: params.category_id,
      content:     params.content || '',
      position:    position
    });
    var noteId = rows[0].id;

    // Place the note on the active map
    DDS_STORE.insert('map_notes', { map_id: mapId, note_id: noteId });

    return { id: noteId };
  });

  _register(DDS_TX.NOTE_UPDATE, function (params) {
    // params: { id, content?, position? }
    var updates = {};
    if (params.content  !== undefined) updates.content  = params.content;
    if (params.position !== undefined) updates.position = params.position;
    DDS_STORE.update('notes', { id: params.id }, updates);
    return {};
  });

  _register(DDS_TX.NOTE_DELETE, function (params) {
    // params: { id }
    // Cascade: remove map_notes before deleting the note
    _deleteNote(params.id);
    return {};
  });

  _register(DDS_TX.NOTE_REORDER, function (params) {
    // params: { order: [{ id, position }] }
    (params.order || []).forEach(function (item) {
      DDS_STORE.update('notes', { id: item.id }, { position: item.position });
    });
    return {};
  });

  // ------------------------------------------------------------------
  // Maps domain — partial (map_notes cascade only)
  // ------------------------------------------------------------------

  _register(DDS_TX.MAP_DELETE, function (params) {
    // params: { id }
    // Cascade: remove all map-scoped records for this map.
    // Note: the last map cannot be deleted.
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
    return {};
  });

  // ------------------------------------------------------------------
  // Public: execute
  // ------------------------------------------------------------------

  function execute(txKey, params, mapId, onSuccess) {
    var cmd = _commands[txKey];
    if (!cmd) {
      DDS_TOOLS.log.error('[DDS_CMD] Unknown command: ' + txKey);
      return { ok: false };
    }

    var txId = DDS_TRANSACTIONS.begin(txKey);
    var result;
    try {
      result = cmd.run(params || {}, mapId);
      DDS_TRANSACTIONS.commit(txId);
    } catch (err) {
      DDS_TOOLS.log.error('[DDS_CMD] Command failed, rolling back: ' + txKey, err);
      DDS_TRANSACTIONS.rollback(txId);
      return { ok: false };
    }

    if (typeof onSuccess === 'function') {
      try {
        onSuccess(result);
      } catch (err) {
        // onSuccess errors do not affect the committed transaction
        DDS_TOOLS.log.warn('[DDS_CMD] onSuccess threw after commit: ' + txKey, err);
      }
    }

    return Object.assign({ ok: true }, result || {});
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return {
    execute: execute
  };

}());

window.DDS_CMD = DDS_CMD;

export default DDS_CMD;
