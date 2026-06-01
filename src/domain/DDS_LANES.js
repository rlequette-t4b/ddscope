// ============================================================
// DDS_LANES — helper facade (swim-lane CRUD via DDS_ACTIONS)
// ============================================================
// Helper facade for swim-lane operations.
// UI modules call this module for all swim-lane writes.
// delete() is a cascade operation routed via DDS_MODEL.deleteSwimLane
// (removes all assigned nodes + full cascade, all map_swim_lanes
// references, and clears default_swim_lane_id on affected node_types).
//
// Note: map_swim_lanes (canvas geometry per map) is managed by the
// presentation layer (DDS_SWIMLANES) via direct DDS_STORE calls —
// outside this helper's scope.
//
// Depends on: DDS_ACTIONS  SCRIPT 1850
//             DDS_STORE    SCRIPT 150
// ============================================================

var DDS_LANES = (function () {

  var api = {};

  // ------------------------------------------------------------------
  // create(fields) → record
  // fields: { name, color? }
  // Inserts a new swim-lane via DDS_ACTIONS.
  // Returns the inserted record (with generated id), or null on failure.
  // ------------------------------------------------------------------
  api.create = function (fields) {
    var action = { type: 'add_swim_lane', name: fields.name };
    if (fields.color) action.color = fields.color;
    // Assign a temporary id so callers can retrieve the created record
    action.id = 'new_lane_1';
    var result = DDS_ACTIONS.execute([action]);
    if (result.failed) {
      console.error('[DDS_LANES] create failed:', result.failed);
      return null;
    }
    // Return the newly inserted record from the store
    var applied = result.applied[0];
    if (applied && applied._created_id != null) {
      return DDS_STORE.query('swim_lanes', { id: applied._created_id })[0] || null;
    }
    return null;
  };

  // ------------------------------------------------------------------
  // update(laneId, fields) → record
  // fields: { name?, color? }
  // Updates an existing swim-lane via DDS_ACTIONS.
  // Returns the updated record, or null on failure.
  // ------------------------------------------------------------------
  api.update = function (laneId, fields) {
    var action = Object.assign({ type: 'update_swim_lane', swim_lane_id: laneId }, fields);
    var result = DDS_ACTIONS.execute([action]);
    if (result.failed) {
      console.error('[DDS_LANES] update failed:', result.failed);
      return null;
    }
    return DDS_STORE.query('swim_lanes', { id: laneId })[0] || null;
  };

  // ------------------------------------------------------------------
  // delete(laneId) → void
  // Full cascade via DDS_MODEL.deleteSwimLane:
  //   - deletes all nodes assigned to this lane (with their full cascade)
  //   - removes all map_swim_lanes references across all maps
  //   - clears default_swim_lane_id on affected node_types
  //   - deletes the swim_lanes record
  // Note: DDS_ACTIONS routes delete_swim_lane to DDS_MODEL internally.
  // ------------------------------------------------------------------
  api.delete = function (laneId) {
    // Bypass DDS_ACTIONS vocabulary (swim-lane deletion is excluded from v1
    // action vocabulary per DDScope_Actions.md §5) and call DDS_MODEL directly,
    // consistent with DDS_REMOVE which also calls DDS_MODEL for full deletes.
    if (typeof DDS_MODEL !== 'undefined' && typeof DDS_MODEL.deleteSwimLane === 'function') {
      DDS_MODEL.deleteSwimLane(laneId);
    } else {
      console.error('[DDS_LANES] DDS_MODEL.deleteSwimLane not available');
    }
  };

  // ------------------------------------------------------------------
  // getAll() → swim_lane[]
  // ------------------------------------------------------------------
  api.getAll = function () {
    return DDS_STORE.query('swim_lanes');
  };

  // ------------------------------------------------------------------
  // getById(laneId) → swim_lane | null
  // ------------------------------------------------------------------
  api.getById = function (laneId) {
    return DDS_STORE.query('swim_lanes', { id: laneId })[0] || null;
  };

  return api;

}());

export default DDS_LANES;
