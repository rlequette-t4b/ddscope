// ============================================================
// DDS_ANNOTATIONS — annotation CRUD helper facade
// ============================================================
// Spec: DDScope_DataModel.md §9, DDScope_Actions.md §3.8
// All writes go through DDS_ACTIONS.execute().
// Presentation-layer ops (map_annotations) are direct DDS_STORE calls.

var DDS_ANNOTATIONS = (function () {

  var api = {};

  // ------------------------------------------------------------------
  // create(fields) → annotation record
  // fields: { notes?, swim_lane_id?, tags? }
  // ------------------------------------------------------------------
  api.create = function (fields) {
    fields = fields || {};
    var result = DDS_ACTIONS.execute([{
      type: 'add_annotation',
      notes: fields.notes || '',
      swim_lane_id: fields.swim_lane_id || null,
      tags: fields.tags || []
    }]);
    if (result.failed) {
      console.error('[DDS_ANNOTATIONS] create failed', result.failed);
      return null;
    }
    var created = result.applied[0];
    return created._created_id
      ? DDS_STORE.query('annotations', { id: created._created_id })[0] || null
      : null;
  };

  // ------------------------------------------------------------------
  // update(annotationId, fields) → annotation record
  // fields: { notes?, swim_lane_id?, tags? }
  // ------------------------------------------------------------------
  api.update = function (annotationId, fields) {
    fields = fields || {};
    var action = { type: 'update_annotation', annotation_id: annotationId };
    if (fields.notes      !== undefined) action.notes         = fields.notes;
    if (fields.swim_lane_id !== undefined) action.swim_lane_id = fields.swim_lane_id;
    if (fields.tags       !== undefined) action.tags          = fields.tags;
    var result = DDS_ACTIONS.execute([action]);
    if (result.failed) {
      console.error('[DDS_ANNOTATIONS] update failed', result.failed);
      return null;
    }
    return DDS_STORE.query('annotations', { id: annotationId })[0] || null;
  };

  // ------------------------------------------------------------------
  // delete(annotationId) — cascades to map_annotations via DDS_MODEL
  // ------------------------------------------------------------------
  api.delete = function (annotationId) {
    var result = DDS_ACTIONS.execute([{ type: 'delete_annotation', annotation_id: annotationId }]);
    if (result.failed) {
      console.error('[DDS_ANNOTATIONS] delete failed', result.failed);
    }
  };

  // ------------------------------------------------------------------
  // Presentation layer: map_annotations
  // ------------------------------------------------------------------

  // Place annotation on a map at (x, y)
  api.showOnMap = function (annotationId, mapId, x, y) {
    var existing = DDS_STORE.query('map_annotations', { annotation_id: annotationId, map_id: mapId });
    if (existing.length > 0) return; // already on map
    DDS_STORE.insert('map_annotations', { map_id: mapId, annotation_id: annotationId, x: x || 0, y: y || 0 });
  };

  // Remove annotation from a specific map only
  api.hideFromMap = function (annotationId, mapId) {
    DDS_STORE.remove('map_annotations', { annotation_id: annotationId, map_id: mapId });
  };

  // Update canvas position on a specific map
  api.updatePosition = function (annotationId, mapId, x, y) {
    DDS_STORE.update('map_annotations', { annotation_id: annotationId, map_id: mapId }, { x: x, y: y });
  };

  // ------------------------------------------------------------------
  // Read helpers
  // ------------------------------------------------------------------

  api.getAll = function () {
    return DDS_STORE.query('annotations');
  };

  api.getById = function (annotationId) {
    return DDS_STORE.query('annotations', { id: annotationId })[0] || null;
  };

  api.getOnMap = function (mapId) {
    return DDS_STORE.query('map_annotations', { map_id: mapId });
  };

  return api;

}());
