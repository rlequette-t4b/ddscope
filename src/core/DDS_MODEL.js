// AUDITOR:LARGE_BLOCK_JUSTIFIED - complete integrity API, all operations must be co-located.
// ============================================================
// DDS_MODEL  functional integrity layer
// ============================================================
// Authoritative runtime implementation of DDScope_DataModel.md 17.
// The ONLY module allowed to perform cascade deletions on the
// functional model. DDS_STORE is the data layer; DDS_MODEL is
// the business rules layer above it.
//
// v1 strategy: thin facade delegating to existing modules.
// Migration to direct DDS_STORE calls happens progressively
// as DDS_PRODUCTS / DDS_BOMS / DDS_DEMANDS are deprecated.
//
// Depends on: DDS_STORE    (SCRIPT 150)
//             DDS_NODES    (in SCRIPT 1600, loaded before this block)
//             DDS_PRODUCTS (SCRIPT 1600)
// Note: DDS_BOMS and DDS_DEMANDS are no longer dependencies 
//       cascade logic inlined directly via DDS_STORE calls.
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
    // Cascade: flows + map_flows + SKU cleanup
    var flows = DDS_STORE.query('flows').filter(function (f) {
      return f.source_node_id === nodeId || f.target_node_id === nodeId;
    });
    flows.forEach(function (f) {
      (f.product_ids || []).forEach(function (pid) {
        if (typeof DDS_PRODUCTS !== 'undefined') {
          DDS_PRODUCTS.cleanSku(f.source_node_id, pid);
          DDS_PRODUCTS.cleanSku(f.target_node_id, pid);
        }
      });
      DDS_STORE.remove('map_flows', { flow_id: f.id });
      DDS_STORE.remove('flows',     { id: f.id });
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
    DDS_STORE.remove('map_swim_lanes', { swim_lane_id: swimLaneId });
    var affectedTypes = DDS_STORE.query('node_types', { default_swim_lane_id: swimLaneId });
    affectedTypes.forEach(function (nt) {
      DDS_STORE.update('node_types', { id: nt.id }, { default_swim_lane_id: null });
    });
    DDS_STORE.remove('swim_lanes', { id: swimLaneId });
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

export default DDS_MODEL;



