// AUDITOR:LARGE_BLOCK_JUSTIFIED - complete integrity API, all operations must be co-located.
// ============================================================
// DDS_MODEL — functional integrity layer
// ============================================================
// Authoritative runtime implementation of DDScope_DataModel.md §17.
// The ONLY module allowed to perform cascade deletions on the
// functional model. DDS_STORE is the data layer; DDS_MODEL is
// the business rules layer above it.
//
// v1 strategy: thin facade delegating to existing modules.
// Migration to direct DDS_STORE calls happened progressively as
// DDS_PRODUCTS / DDS_BOMS / DDS_DEMANDS were deprecated. As of
// 2026-07-02, DDS_MODEL owns SKU lifecycle logic directly
// (ensureSku/cleanupSku, below) — DDS_PRODUCTS is no longer a dependency.
//
// Depends on: DDS_STORE (SCRIPT 150) only.
// ============================================================

var DDS_MODEL = (function () {

  var api = {};

  // ------------------------------------------------------------------
  // deleteNode
  // Deletes a node with full cascade:
  //   flows (source or target) + map_flows across all maps
  //   skus for this node
  //   boms for this node + bom_components
  //   demands for this node + map_demands
  //   map_nodes across all maps
  //   the nodes record
  // ------------------------------------------------------------------
  api.deleteNode = function (nodeId) {
    // Detect product-node before deletion for orphan product cleanup
    var productNodeType = DDS_STORE.query('node_types').find(function (t) { return t.is_product_node_default; });
    var productIdsToCheck = [];
    if (productNodeType) {
      var thisNode = DDS_STORE.query('nodes', { id: nodeId })[0];
      if (thisNode && thisNode.type_code === productNodeType.code) {
        DDS_STORE.query('skus', { node_id: nodeId }).forEach(function (sku) {
          productIdsToCheck.push(sku.product_id);
        });
      }
    }
    // Cascade: flows + map_flows + SKU cleanup.
    // SKU cleanup runs AFTER every flow is removed from the store (not
    // per-flow inline) — cleanupSku's "still referenced by another flow"
    // check queries DDS_STORE live, so checking before removal would always
    // find the very flow being deleted and never actually clean up the
    // surviving endpoint's SKU (fixed 2026-07-02 — see cleanupSku below).
    var flows = DDS_STORE.query('flows').filter(function (f) {
      return f.source_node_id === nodeId || f.target_node_id === nodeId;
    });
    var skuCleanupPairs = [];
    flows.forEach(function (f) {
      (f.product_ids || []).forEach(function (pid) {
        skuCleanupPairs.push({ nodeId: f.source_node_id, productId: pid });
        skuCleanupPairs.push({ nodeId: f.target_node_id, productId: pid });
      });
      DDS_STORE.remove('map_flows', { flow_id: f.id });
      DDS_STORE.remove('flows',     { id: f.id });
    });
    skuCleanupPairs.forEach(function (pair) {
      api.cleanupSku(pair.nodeId, pair.productId);
    });
    DDS_STORE.remove('skus', { node_id: nodeId });
    // BOMs
    DDS_STORE.query('boms', { node_id: nodeId }).forEach(function (b) {
      DDS_STORE.remove('bom_components', { bom_id: b.id });
    });
    DDS_STORE.remove('boms', { node_id: nodeId });
    // Demands + map_demands + CTT geometry reset
    DDS_STORE.query('demands', { node_id: nodeId }).forEach(function (d) {
      DDS_STORE.remove('map_demands', { demand_id: d.id });
    });
    DDS_STORE.remove('demands', { node_id: nodeId });
    DDS_STORE.update('map_nodes', { node_id: nodeId }, { demand_x: null, demand_y: null, demand_length: null });
    // Map nodes + Cytoscape
    DDS_STORE.remove('map_nodes', { node_id: nodeId });
    DDS_STORE.remove('nodes',     { id: nodeId });
    if (typeof DDS_CY !== 'undefined' && DDS_CY) {
      var cyNode = DDS_CY.$('#n' + nodeId);
      if (cyNode && cyNode.length) { cyNode.connectedEdges().remove(); cyNode.remove(); }
      var ghost = DDS_CY.$('#note-' + nodeId);
      if (ghost && ghost.length) ghost.remove();
    }
    // Orphan product cleanup
    productIdsToCheck.forEach(function (pid) {
      if (DDS_STORE.query('skus', { product_id: pid }).length === 0) {
        api.deleteProduct(pid);
      }
    });
  };

  // ------------------------------------------------------------------
  // deleteFlow
  // Deletes a flow and its map_flows across all maps.
  // No SKU modification.
  // ------------------------------------------------------------------
  api.deleteFlow = function (flowId) {
    DDS_STORE.remove('map_flows', { flow_id: flowId });
    DDS_STORE.remove('flows',     { id: flowId });
  };

  // ------------------------------------------------------------------
  // deleteProduct
  // Deletes a product with full cascade:
  //   removes productId from all flows[].product_ids
  //   deletes all skus for this product
  //   deletes boms where output_product_id matches + bom_components
  //   deletes bom_components where product_id matches
  //     (+ parent bom if left with no components)
  //   deletes demands for this product + map_demands
  //   deletes the products record
  // ------------------------------------------------------------------
  api.deleteProduct = function (productId) {
    // Delete product-nodes (nodes typed is_product_node_default with a SKU for this product)
    var productNodeType = DDS_STORE.query('node_types').find(function (t) { return t.is_product_node_default; });
    if (productNodeType) {
      var skusForProduct = DDS_STORE.query('skus', { product_id: productId });
      skusForProduct.forEach(function (sku) {
        var node = DDS_STORE.query('nodes', { id: sku.node_id })[0];
        if (node && node.type_code === productNodeType.code) {
          api.deleteNode(node.id);
        }
      });
    }
    // Remove product from all flows
    DDS_STORE.query('flows').forEach(function (f) {
      if (!Array.isArray(f.product_ids)) return;
      var ids = f.product_ids.map(Number);
      if (!ids.includes(productId)) return;
      DDS_STORE.update('flows', { id: f.id }, { product_ids: ids.filter(function (id) { return id !== productId; }) });
    });
    // Delete demands for this product + map_demands + reset CTT geometry
    DDS_STORE.query('demands', { product_id: productId }).forEach(function (d) {
      DDS_STORE.remove('map_demands', { demand_id: d.id });
      if (DDS_STORE.query('demands', { node_id: d.node_id }).length === 1) {
        DDS_STORE.update('map_nodes', { node_id: d.node_id }, { demand_x: null, demand_y: null, demand_length: null });
      }
    });
    DDS_STORE.remove('demands', { product_id: productId });
    // Delete SKUs
    DDS_STORE.remove('skus', { product_id: productId });
    // BOM cascade
    DDS_STORE.query('boms', { output_product_id: productId }).forEach(function (b) {
      DDS_STORE.remove('bom_components', { bom_id: b.id });
      DDS_STORE.remove('boms', { id: b.id });
    });
    DDS_STORE.remove('bom_components', { product_id: productId });
    // Delete product
    DDS_STORE.remove('products', { id: productId });
  };

  // ------------------------------------------------------------------
  // deleteSwimLane
  // Deletes a swim-lane with full cascade:
  //   calls deleteNode for each node assigned to this lane
  //   deletes map_swim_lanes across all maps
  //   clears default_swim_lane_id on node_types that referenced this lane
  //   deletes the swim_lanes record
  // ------------------------------------------------------------------
  api.deleteSwimLane = function (swimLaneId) {
    var nodes = DDS_STORE.query('nodes', { swim_lane_id: swimLaneId });
    nodes.forEach(function (node) {
      api.deleteNode(node.id);
    });
    // Delete annotations assigned to this lane
    DDS_STORE.query('annotations', { swim_lane_id: swimLaneId }).forEach(function (ann) {
      api.deleteAnnotation(ann.id);
    });
    DDS_STORE.remove('map_swim_lanes', { swim_lane_id: swimLaneId });
    var affectedTypes = DDS_STORE.query('node_types', { default_swim_lane_id: swimLaneId });
    affectedTypes.forEach(function (nt) {
      DDS_STORE.update('node_types', { id: nt.id }, { default_swim_lane_id: null });
    });
    DDS_STORE.remove('swim_lanes', { id: swimLaneId });
  };

  // ------------------------------------------------------------------
  // ensureSku
  // Inserts a skus row for this node x product pair if one doesn't
  // already exist. No-op if the SKU is already present.
  // ------------------------------------------------------------------
  api.ensureSku = function (nodeId, productId) {
    var existing = DDS_STORE.query('skus', { node_id: nodeId, product_id: productId });
    if (existing.length > 0) return;
    DDS_STORE.insert('skus', [{ node_id: nodeId, product_id: productId, tags: [], notes: '' }]);
  };

  // ------------------------------------------------------------------
  // cleanupSku
  // Removes a node x product SKU only if it is no longer needed:
  //   - never removes the SKU of a product-node (it owns its SKU
  //     independently of any flow)
  //   - never removes it while any flow still references this node x
  //     product pair
  //   - otherwise delegates to removeSku (below) for the full cascade
  // Single source of truth for this guard — called from deleteNode's
  // cascade above and from DDS_CMD's TX.FLOW_ADD_PRODUCT/FLOW_REMOVE_PRODUCT
  // and DDS_FLOWS_UI's flow-delete call site (consolidated 2026-07-02,
  // replacing the retired DDS_PRODUCTS.cleanSku facade).
  // ------------------------------------------------------------------
  api.cleanupSku = function (nodeId, productId) {
    var productNodeType = DDS_STORE.query('node_types').find(function (t) { return t.is_product_node_default; });
    if (productNodeType) {
      var node = DDS_STORE.query('nodes', { id: nodeId })[0];
      if (node && node.type_code === productNodeType.code) return;
    }
    var stillNeeded = DDS_STORE.query('flows').some(function (f) {
      return (f.source_node_id === nodeId || f.target_node_id === nodeId) &&
        Array.isArray(f.product_ids) && f.product_ids.map(Number).indexOf(Number(productId)) !== -1;
    });
    if (stillNeeded) return;
    api.removeSku(nodeId, productId);
  };

  // ------------------------------------------------------------------
  // removeSku
  // Deletes the demand for this node x product pair (+ map_demands),
  // then deletes the sku record.
  // ------------------------------------------------------------------
  api.removeSku = function (nodeId, productId) {
    // cascade: delete demand + map_demands for this SKU
    var demand = DDS_STORE.query('demands', { node_id: nodeId, product_id: productId })[0];
    if (demand) {
      DDS_STORE.remove('map_demands', { demand_id: demand.id });
      DDS_STORE.remove('demands', { node_id: nodeId, product_id: productId });
      // Reset CTT geometry on map_nodes if no demands remain for this node
      if (DDS_STORE.query('demands', { node_id: nodeId }).length === 0) {
        DDS_STORE.update('map_nodes', { node_id: nodeId }, { demand_x: null, demand_y: null, demand_length: null });
      }
    }
    DDS_STORE.remove('skus', { node_id: nodeId, product_id: productId });
  };

  // ------------------------------------------------------------------
  // deleteDemand
  // Deletes map_demands for this demand, then the demand record.
  // ------------------------------------------------------------------
  api.deleteDemand = function (nodeId, productId) {
    var demand = DDS_STORE.query('demands', { node_id: nodeId, product_id: productId })[0];
    if (!demand) return;
    DDS_STORE.remove('map_demands', { demand_id: demand.id });
    DDS_STORE.remove('demands', { node_id: nodeId, product_id: productId });
    // Reset CTT geometry if no demands remain for this node
    if (DDS_STORE.query('demands', { node_id: nodeId }).length === 0) {
      DDS_STORE.update('map_nodes', { node_id: nodeId }, { demand_x: null, demand_y: null, demand_length: null });
    }
  };

  // ------------------------------------------------------------------
  // deleteBom
  // Deletes all bom_components for this BOM, then the bom record.
  // ------------------------------------------------------------------
  api.deleteBom = function (bomId) {
    DDS_STORE.remove('bom_components', { bom_id: bomId });
    DDS_STORE.remove('boms',           { id: bomId });
  };

  // ------------------------------------------------------------------
  // rerouteFlow
  // Updates source_node_id and/or target_node_id on the flows record.
  // No SKU modification.
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // deleteAnnotation
  // Deletes all map_annotations for this annotation, then the record.
  // ------------------------------------------------------------------
  api.deleteAnnotation = function (annotationId) {
    DDS_STORE.remove('map_annotations', { annotation_id: annotationId });
    DDS_STORE.remove('annotations',     { id: annotationId });
  };

  api.rerouteFlow = function (flowId, newSourceId, newTargetId) {
    var updates = {};
    if (newSourceId !== undefined && newSourceId !== null) updates.source_node_id = newSourceId;
    if (newTargetId !== undefined && newTargetId !== null) updates.target_node_id = newTargetId;
    if (Object.keys(updates).length > 0) {
      DDS_STORE.update('flows', { id: flowId }, updates);
    }
  };

  // ------------------------------------------------------------------
  // addProductToFlow
  // Appends productId to flows[flowId].product_ids. No SKU creation.
  // ------------------------------------------------------------------
  api.addProductToFlow = function (flowId, productId) {
    var flow = DDS_STORE.query('flows', { id: flowId })[0];
    if (!flow) return;
    var ids = (flow.product_ids || []).map(Number);
    if (ids.includes(Number(productId))) return;
    DDS_STORE.update('flows', { id: flowId }, { product_ids: ids.concat([Number(productId)]) });
  };

  // ------------------------------------------------------------------
  // removeProductFromFlow
  // Removes productId from flows[flowId].product_ids. No SKU deletion.
  // ------------------------------------------------------------------
  api.removeProductFromFlow = function (flowId, productId) {
    var flow = DDS_STORE.query('flows', { id: flowId })[0];
    if (!flow) return;
    var ids = (flow.product_ids || []).map(Number).filter(function (id) {
      return id !== Number(productId);
    });
    DDS_STORE.update('flows', { id: flowId }, { product_ids: ids });
  };

  return api;

}());
