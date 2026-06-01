// ============================================================
// DDS_SKUS  helper facade (SKU CRUD via DDS_ACTIONS)
// Depends on: DDS_ACTIONS SCRIPT 1850, DDS_STORE SCRIPT 150
// ============================================================

window.DDS_SKUS = (function () {

  // --- Reads ---

  function getAll() {
    if (!DDS_STORE.getProject()) return [];
    return DDS_STORE.query('skus');
  }

  function getForNode(nodeId) {
    return DDS_STORE.query('skus', { node_id: parseInt(nodeId, 10) });
  }

  function getForProduct(productId) {
    return DDS_STORE.query('skus', { product_id: parseInt(productId, 10) });
  }

  function get(nodeId, productId) {
    var rows = DDS_STORE.query('skus', {
      node_id:    parseInt(nodeId, 10),
      product_id: parseInt(productId, 10)
    });
    return rows.length ? rows[0] : null;
  }

  // --- Writes (via DDS_ACTIONS) ---

  // add(nodeId, productId, fields?)
  // fields: { tags?, notes? }
  function add(nodeId, productId, fields) {
    return DDS_ACTIONS.execute([Object.assign(
      { type: 'add_sku', node_id: nodeId, product_id: productId },
      fields || {}
    )]);
  }

  // update(nodeId, productId, fields)
  // fields: { tags?, notes? }
  function update(nodeId, productId, fields) {
    return DDS_ACTIONS.execute([Object.assign(
      { type: 'update_sku', node_id: nodeId, product_id: productId },
      fields
    )]);
  }

  // remove(nodeId, productId)  cascade to demand handled by DDS_MODEL
  function remove(nodeId, productId) {
    return DDS_ACTIONS.execute([{ type: 'remove_sku', node_id: nodeId, product_id: productId }]);
  }

  return {
    getAll:       getAll,
    getForNode:   getForNode,
    getForProduct: getForProduct,
    get:          get,
    add:          add,
    update:       update,
    remove:       remove
  };

}());

export default window.DDS_SKUS;


