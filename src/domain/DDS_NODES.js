// ============================================================
// DDS_NODES  helper facade (node CRUD via DDS_ACTIONS)
// Depends on: DDS_ACTIONS SCRIPT 1850, DDS_STORE SCRIPT 150
// ============================================================

window.DDS_NODES = (function () {

  // --- Reads ---

  function getAll() {
    if (!DDS_STORE.getProject()) return [];
    return DDS_STORE.query('nodes');
  }

  function getById(nodeId) {
    var rows = DDS_STORE.query('nodes', { id: parseInt(nodeId, 10) });
    return rows.length ? rows[0] : null;
  }

  // --- Writes (via DDS_ACTIONS) ---

  // create(fields)
  // fields: { name, type_code?, swim_lane_id?, tags?, notes? }
  // Returns { applied, failed }  applied[0]._created_id = new node id.
  function create(fields) {
    return DDS_ACTIONS.execute([Object.assign({ type: 'add_node' }, fields)]);
  }

  // update(nodeId, fields)
  // fields: { name?, type_code?, swim_lane_id?, tags?, notes? }
  function update(nodeId, fields) {
    return DDS_ACTIONS.execute([Object.assign({ type: 'update_node', node_id: nodeId }, fields)]);
  }

  // delete(nodeId)  cascade handled by DDS_MODEL via DDS_ACTIONS
  function deleteFn(nodeId) {
    return DDS_ACTIONS.execute([{ type: 'delete_node', node_id: nodeId }]);
  }

  // assignToLane(nodeId, swimLaneId)
  function assignToLane(nodeId, swimLaneId) {
    return DDS_ACTIONS.execute([{ type: 'assign_node_to_lane', node_id: nodeId, swim_lane_id: swimLaneId }]);
  }

  return {
    getAll:       getAll,
    getById:      getById,
    create:       create,
    update:       update,
    delete:       deleteFn,
    assignToLane: assignToLane
  };

}());

export default window.DDS_NODES;


