// ============================================================
// DDS_BOMS  helper facade (BOM CRUD via DDS_ACTIONS)
// Depends on: DDS_ACTIONS SCRIPT 1850, DDS_STORE SCRIPT 150
// ============================================================

window.DDS_BOMS = (function () {

  // --- Reads ---

  function getAll() {
    if (!DDS_STORE.getProject()) return [];
    return DDS_STORE.query('boms');
  }

  function getComponents(bomId) {
    return DDS_STORE.query('bom_components', { bom_id: bomId });
  }

  // --- Writes (via DDS_ACTIONS) ---

  // create(nodeId, outputProductId, components)
  // components: [{ product_id, quantity, notes? }]
  // Guards against duplicate BOM before emitting actions.
  function create(nodeId, outputProductId, components) {
    var existing = DDS_STORE.query('boms', { node_id: nodeId, output_product_id: outputProductId });
    if (existing.length > 0) throw new Error('A BOM for this node and output product already exists.');

    var actions = [
      { type: 'add_bom', id: 'new_bom_1', node_id: nodeId, output_product_id: outputProductId }
    ];

    if (components && components.length > 0) {
      components.filter(function (c) { return c.product_id; }).forEach(function (c) {
        actions.push({
          type: 'add_bom_component',
          bom_id: 'new_bom_1',
          product_id: c.product_id,
          quantity: c.quantity || 1,
          notes: c.notes || ''
        });
      });
    }

    return DDS_ACTIONS.execute(actions);
  }

  // updateComponents(bomId, components)
  // Diffs existing components against the new list:
  //   - removed: emit remove_bom_component
  //   - added:   emit add_bom_component
  //   - changed quantity/notes: emit update_bom_component
  function updateComponents(bomId, components) {
    var existing = DDS_STORE.query('bom_components', { bom_id: bomId });
    var incoming = (components || []).filter(function (c) { return c.product_id; });

    var existingMap = {};
    existing.forEach(function (c) { existingMap[c.product_id] = c; });

    var incomingMap = {};
    incoming.forEach(function (c) { incomingMap[c.product_id] = c; });

    var actions = [];

    // Removed
    existing.forEach(function (c) {
      if (!incomingMap[c.product_id]) {
        actions.push({ type: 'remove_bom_component', bom_id: bomId, product_id: c.product_id });
      }
    });

    // Added or updated
    incoming.forEach(function (c) {
      var prev = existingMap[c.product_id];
      if (!prev) {
        actions.push({
          type: 'add_bom_component',
          bom_id: bomId,
          product_id: c.product_id,
          quantity: c.quantity || 1,
          notes: c.notes || ''
        });
      } else {
        var qty = c.quantity || 1;
        var notes = c.notes || '';
        if (qty !== prev.quantity || notes !== (prev.notes || '')) {
          actions.push({
            type: 'update_bom_component',
            bom_id: bomId,
            product_id: c.product_id,
            quantity: qty,
            notes: notes
          });
        }
      }
    });

    if (actions.length === 0) return { applied: [], failed: null };
    return DDS_ACTIONS.execute(actions);
  }

  // delete(bomId)  cascade to bom_components handled by DDS_MODEL via DDS_ACTIONS
  function deleteBom(bomId) {
    return DDS_ACTIONS.execute([{ type: 'delete_bom', bom_id: bomId }]);
  }

  return {
    getAll: getAll,
    getComponents: getComponents,
    create: create,
    updateComponents: updateComponents,
    delete: deleteBom
  };

})();

export default window.DDS_BOMS;


