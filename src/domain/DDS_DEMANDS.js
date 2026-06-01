// ============================================================
// DDS_DEMANDS  helper facade (demand CRUD via DDS_ACTIONS)
// Depends on: DDS_ACTIONS SCRIPT 1850, DDS_STORE SCRIPT 150
//
// Writes (functional layer) delegate to DDS_ACTIONS.execute().
// map_demands visibility operates on the presentation layer
// directly via DDS_STORE  outside DDS_ACTIONS scope (per spec).
// ============================================================

window.DDS_DEMANDS = (function () {

  // --- Reads ---

  function getAll() {
    if (!DDS_STORE.getProject()) return [];
    return DDS_STORE.query('demands');
  }

  function getForNode(nodeId) {
    return DDS_STORE.query('demands', { node_id: nodeId });
  }

  // Spec alias: get(nodeId, productId)
  function get(nodeId, productId) {
    return DDS_STORE.query('demands', { node_id: nodeId, product_id: productId })[0] || null;
  }

  // --- Writes (via DDS_ACTIONS) ---

  // create(nodeId, productId, fields?)
  // fields: { ctt_value?, ctt_unit?, demand_value?, demand_period?, notes? }
  // Guards against duplicate demand before emitting action.
  function create(nodeId, productId, fields) {
    var existing = get(nodeId, productId);
    if (existing) return { applied: [], failed: null };
    var action = Object.assign(
      { type: 'add_demand', node_id: nodeId, product_id: productId },
      fields || {}
    );
    return DDS_ACTIONS.execute([action]);
  }

  // update(nodeId, productId, fields)
  function update(nodeId, productId, fields) {
    var action = Object.assign(
      { type: 'update_demand', node_id: nodeId, product_id: productId },
      fields
    );
    return DDS_ACTIONS.execute([action]);
  }

  // delete(nodeId, productId)
  // Cascade to map_demands handled by DDS_MODEL via DDS_ACTIONS.
  function deleteDemand(nodeId, productId) {
    return DDS_ACTIONS.execute([{ type: 'delete_demand', node_id: nodeId, product_id: productId }]);
  }

  // --- Presentation layer  direct DDS_STORE (not via DDS_ACTIONS) ---

  function isVisibleOnMap(demandId, mapId) {
    return DDS_STORE.query('map_demands', { demand_id: demandId, map_id: mapId }).length > 0;
  }

  function showOnMap(demandId, mapId) {
    if (isVisibleOnMap(demandId, mapId)) return;
    DDS_STORE.insert('map_demands', { demand_id: demandId, map_id: mapId });
  }

  function hideFromMap(demandId, mapId) {
    DDS_STORE.remove('map_demands', { demand_id: demandId, map_id: mapId });
  }

  return {
    getAll:          getAll,
    getForNode:      getForNode,
    get:             get,
    create:          create,
    update:          update,
    delete:          deleteDemand,
    isVisibleOnMap:  isVisibleOnMap,
    showOnMap:       showOnMap,
    hideFromMap:     hideFromMap
  };

}());

export default window.DDS_DEMANDS;


