// ============================================================
// DDS_FLOWS  helper facade (flow CRUD via DDS_ACTIONS)
// Depends on: DDS_ACTIONS SCRIPT 1850, DDS_STORE SCRIPT 150
// ============================================================

window.DDS_FLOWS = (function () {

  // --- Reads ---

  function getAll() {
    if (!DDS_STORE.getProject()) return [];
    return DDS_STORE.query('flows');
  }

  function getById(flowId) {
    var rows = DDS_STORE.query('flows', { id: flowId });
    return rows.length ? rows[0] : null;
  }

  function getForNode(nodeId) {
    var id = parseInt(nodeId, 10);
    return DDS_STORE.query('flows').filter(function (f) {
      return f.source_node_id === id || f.target_node_id === id;
    });
  }

  // --- Writes (via DDS_ACTIONS) ---

  function create(fields) {
    // fields: { source_id, target_id, lead_time_value?, lead_time_unit?, tags?, notes? }
    return DDS_ACTIONS.execute([Object.assign({ type: 'add_flow' }, fields)]);
  }

  function update(flowId, fields) {
    // fields: { lead_time_value?, lead_time_unit?, tags?, notes? }
    return DDS_ACTIONS.execute([Object.assign({ type: 'update_flow', flow_id: flowId }, fields)]);
  }

  function deleteFn(flowId) {
    return DDS_ACTIONS.execute([{ type: 'delete_flow', flow_id: flowId }]);
  }

  function reroute(flowId, newSourceId, newTargetId) {
    var action = { type: 'reroute_flow', flow_id: flowId };
    if (newSourceId != null) action.new_source_id = newSourceId;
    if (newTargetId != null) action.new_target_id = newTargetId;
    return DDS_ACTIONS.execute([action]);
  }

  function addProduct(flowId, productId) {
    return DDS_ACTIONS.execute([{ type: 'add_product_to_flow', flow_id: flowId, product_id: productId }]);
  }

  function removeProduct(flowId, productId) {
    return DDS_ACTIONS.execute([{ type: 'remove_product_from_flow', flow_id: flowId, product_id: productId }]);
  }

  return {
    getAll:        getAll,
    getById:       getById,
    getForNode:    getForNode,
    create:        create,
    update:        update,
    delete:        deleteFn,
    reroute:       reroute,
    addProduct:    addProduct,
    removeProduct: removeProduct
  };

}());

export default window.DDS_FLOWS;


