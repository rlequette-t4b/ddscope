// ============================================================
// DDS_PRODUCTS  helper facade (product CRUD via DDS_ACTIONS)
// Depends on: DDS_ACTIONS SCRIPT 1850, DDS_STORE SCRIPT 150
// ============================================================

window.DDS_PRODUCTS = (function () {

  // --- Reads ---

  function getAll() {
    if (!DDS_STORE.getProject()) return [];
    return DDS_STORE.query('products');
  }

  function getById(productId) {
    var rows = DDS_STORE.query('products', { id: parseInt(productId, 10) });
    return rows.length ? rows[0] : null;
  }

  // --- Writes (via DDS_ACTIONS) ---

  // create(fields)
  // fields: { name, type_code?, tags?, notes? }
  // Returns { applied, failed }  applied[0]._created_id = new product id.
  function create(fields) {
    return DDS_ACTIONS.execute([Object.assign({ type: 'add_product' }, fields)]);
  }

  // update(productId, fields)
  // fields: { name?, type_code?, tags?, notes? }
  function update(productId, fields) {
    return DDS_ACTIONS.execute([Object.assign({ type: 'update_product', product_id: productId }, fields)]);
  }

  // delete(productId)  cascade handled by DDS_MODEL via DDS_ACTIONS
  function deleteFn(productId) {
    return DDS_ACTIONS.execute([{ type: 'delete_product', product_id: productId }]);
  }

  // --- SKU sync utilities (UI-layer helpers, not part of the action vocabulary) ---
  // These methods remain here as they encode UI behaviour beyond the data model spec.

  function ensureSku(nodeId, productId) {
    var existing = DDS_STORE.query('skus', { node_id: nodeId, product_id: productId });
    if (existing.length > 0) return;
    DDS_SKUS.add(nodeId, productId);
  }

  function cleanSku(nodeId, productId) {
    // Never remove the SKU of a product-node  it owns its SKU independently of flows
    var productNodeType = DDS_STORE.query('node_types').find(function (t) { return t.is_product_node_default; });
    if (productNodeType) {
      var node = DDS_STORE.query('nodes', { id: nodeId })[0];
      if (node && node.type_code === productNodeType.code) return;
    }
    var stillNeeded = DDS_STORE.query('flows').some(function (f) {
      return (f.source_node_id === nodeId || f.target_node_id === nodeId) &&
        Array.isArray(f.product_ids) && f.product_ids.map(Number).includes(productId);
    });
    if (stillNeeded) return;
    DDS_SKUS.remove(nodeId, productId);
  }

  function syncFlowSkus(flow, oldIds, newIds) {
    var srcId = flow.source_node_id, tgtId = flow.target_node_id;
    var added   = newIds.filter(function (id) { return oldIds.indexOf(id) === -1; });
    var removed = oldIds.filter(function (id) { return newIds.indexOf(id) === -1; });
    added.forEach(function (pid) {
      ensureSku(srcId, pid);
      ensureSku(tgtId, pid);
    });
    removed.forEach(function (pid) {
      cleanSku(srcId, pid);
      cleanSku(tgtId, pid);
    });
  }

  return {
    getAll:        getAll,
    getById:       getById,
    create:        create,
    update:        update,
    delete:        deleteFn,
    ensureSku:     ensureSku,
    cleanSku:      cleanSku,
    syncFlowSkus:  syncFlowSkus
  };

}());

export default window.DDS_PRODUCTS;


