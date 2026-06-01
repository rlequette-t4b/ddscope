// AUDITOR:LARGE_BLOCK_JUSTIFIED  single cohesive module: ACTIONS registry, execute(), describe(), getVocabularyText(). Cannot be split without breaking the internal references between the four exported members.

window.DDS_ACTIONS = (function () {

  // ---------------------------------------------------------------------------
  // ACTIONS  structured vocabulary (source of truth for getVocabularyText)
  // ---------------------------------------------------------------------------

  var ACTIONS = {
    add_node: {
      required: ['name'],
      optional: ['type_code', 'swim_lane_id', 'tags', 'notes'],
      notes: [
        'x, y are NOT accepted  canvas position is map-specific and set manually.',
        'include "id": "new_node_N" in this action when referenced by subsequent actions in the same plan.',
        'PRODUCT-NODE PATTERN (default behaviour): whenever a new product is mentioned, apply the product-node pattern  create a node (name = product name, type = is_product_node_default, swim_lane_id = default_swim_lane_id unless specified by the user) and emit add_sku for the node x product pair. Also emit add_flow if the product is described as a source or destination.',
        'EXCEPTION  add_product_to_flow only: when the user explicitly asks to add a product to an existing flow between two existing non-product nodes (i.e. both endpoints already exist and neither represents a product), use add_product_to_flow instead. Do NOT create a node for the product in this case.',
        'In all other cases  new product, product as a flow endpoint, product placed in a lane  apply the product-node pattern.'
      ]
    },
    update_node: {
      required: ['node_id'],
      optional: ['name', 'type_code', 'swim_lane_id', 'tags', 'notes'],
      notes: []
    },
    delete_node: {
      required: ['node_id'],
      optional: [],
      notes: [
        'implicitly removes all flows where this node is source or target, all SKUs for this node, and all demands for this node.',
        'List all implied cascade actions explicitly in the actions array.'
      ]
    },
    assign_node_to_lane: {
      required: ['node_id', 'swim_lane_id'],
      optional: [],
      notes: []
    },
    add_flow: {
      required: ['source_id', 'target_id'],
      optional: ['lead_time_value', 'lead_time_unit', 'tags', 'notes'],
      notes: [
        'a flow with no products is valid.',
        'include "id": "new_flow_N" in this action when referenced by subsequent actions in the same plan.'
      ]
    },
    update_flow: {
      required: ['flow_id'],
      optional: ['lead_time_value', 'lead_time_unit', 'tags', 'notes'],
      notes: []
    },
    delete_flow: {
      required: ['flow_id'],
      optional: [],
      notes: []
    },
    reroute_flow: {
      required: ['flow_id'],
      optional: ['new_source_id', 'new_target_id'],
      notes: ['at least one of new_source_id or new_target_id is required.']
    },
    add_product_to_flow: {
      required: ['flow_id', 'product_id'],
      optional: [],
      notes: []
    },
    remove_product_from_flow: {
      required: ['flow_id', 'product_id'],
      optional: [],
      notes: []
    },
    add_product: {
      required: ['name'],
      optional: ['type_code', 'tags', 'notes'],
      notes: ['include "id": "new_product_N" in this action when referenced by subsequent actions in the same plan.']
    },
    update_product: {
      required: ['product_id'],
      optional: ['name', 'type_code', 'tags', 'notes'],
      notes: []
    },
    delete_product: {
      required: ['product_id'],
      optional: [],
      notes: [
        'implicitly removes the product from all flows, all SKUs, and all demands associated with those SKUs.',
        'List all implied cascade actions explicitly in the actions array.'
      ]
    },
    add_sku: {
      required: ['node_id', 'product_id'],
      optional: ['tags', 'notes'],
      notes: ['tags express the nature of the association (e.g. "buffer", "stock", "transit").']
    },
    update_sku: {
      required: ['node_id', 'product_id'],
      optional: ['tags', 'notes'],
      notes: []
    },
    remove_sku: {
      required: ['node_id', 'product_id'],
      optional: [],
      notes: []
    },
    add_swim_lane: {
      required: ['name'],
      optional: ['color'],
      notes: ['include "id": "new_lane_N" in this action when referenced by subsequent actions in the same plan.']
    },
    update_swim_lane: {
      required: ['swim_lane_id'],
      optional: ['name', 'color'],
      notes: []
    },
    add_bom: {
      required: ['node_id', 'output_product_id'],
      optional: ['notes'],
      notes: [
        'include "id": "new_bom_N" when referenced by subsequent add_bom_component actions.',
        'verify that output_product_id exists as a SKU on the node. If not, propose add_sku first.'
      ]
    },
    update_bom: {
      required: ['bom_id'],
      optional: ['output_product_id', 'notes'],
      notes: []
    },
    delete_bom: {
      required: ['bom_id'],
      optional: [],
      notes: ['implicitly removes all bom_components for this BOM. State the cascade explicitly in reasoning.']
    },
    add_bom_component: {
      required: ['bom_id', 'product_id', 'quantity'],
      optional: ['notes'],
      notes: ['verify that product_id exists as a SKU on the node. If not, propose add_sku first.']
    },
    update_bom_component: {
      required: ['bom_id', 'product_id'],
      optional: ['quantity', 'notes'],
      notes: []
    },
    remove_bom_component: {
      required: ['bom_id', 'product_id'],
      optional: [],
      notes: []
    },
    add_demand: {
      required: ['node_id', 'product_id'],
      optional: ['ctt_value', 'ctt_unit', 'demand_value', 'demand_period', 'notes'],
      notes: [
        'verify that the SKU (node_id x product_id) exists before emitting. If absent, propose add_sku first.',
        'ctt_unit and demand_period accept: hours, days, weeks, months, years.'
      ]
    },
    update_demand: {
      required: ['node_id', 'product_id'],
      optional: ['ctt_value', 'ctt_unit', 'demand_value', 'demand_period', 'notes'],
      notes: []
    },
    delete_demand: {
      required: ['node_id', 'product_id'],
      optional: [],
      notes: ['cascades to map_demands. State explicitly in reasoning.']
    }
  };

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function _resolveId(value, newIdMap) {
    if (typeof value === 'string' && value.indexOf('new_') === 0) {
      return newIdMap[value] !== undefined ? newIdMap[value] : value;
    }
    return value;
  }

  function _resolveAction(action, newIdMap) {
    var resolved = {};
    for (var key in action) {
      if (!action.hasOwnProperty(key)) continue;
      var val = action[key];
      if (key === 'id') {
        resolved[key] = val; // temporary id  not resolved, used as registry key
      } else if (typeof val === 'string') {
        resolved[key] = _resolveId(val, newIdMap);
      } else if (Array.isArray(val)) {
        resolved[key] = val.map(function (v) {
          return typeof v === 'string' ? _resolveId(v, newIdMap) : v;
        });
      } else {
        resolved[key] = val;
      }
    }
    return resolved;
  }

  function _nodeName(id, newLabelMap) {
    if (typeof id === 'string' && id.indexOf('new_') === 0) {
      return newLabelMap[id] || id;
    }
    var records = DDS_STORE.query('nodes', { id: parseInt(id, 10) });
    return records.length ? records[0].name : ('node#' + id);
  }

  function _productName(id, newLabelMap) {
    if (typeof id === 'string' && id.indexOf('new_') === 0) {
      return newLabelMap[id] || id;
    }
    var records = DDS_STORE.query('products', { id: parseInt(id, 10) });
    return records.length ? records[0].name : ('product#' + id);
  }

  function _laneName(id, newLabelMap) {
    if (typeof id === 'string' && id.indexOf('new_') === 0) {
      return newLabelMap[id] || id;
    }
    var records = DDS_STORE.query('swim_lanes', { id: parseInt(id, 10) });
    return records.length ? records[0].name : ('lane#' + id);
  }

  function _flowEndpoints(flowId) {
    var records = DDS_STORE.query('flows', { id: parseInt(flowId, 10) });
    if (!records.length) return { src: 'flow#' + flowId, tgt: '?' };
    var f = records[0];
    var srcRecs = DDS_STORE.query('nodes', { id: f.source_node_id });
    var tgtRecs = DDS_STORE.query('nodes', { id: f.target_node_id });
    return {
      src: srcRecs.length ? srcRecs[0].name : ('node#' + f.source_node_id),
      tgt: tgtRecs.length ? tgtRecs[0].name : ('node#' + f.target_node_id)
    };
  }

  function _bomNodeName(bomId) {
    var records = DDS_STORE.query('boms', { id: parseInt(bomId, 10) });
    if (!records.length) return 'bom#' + bomId;
    var nodeRecs = DDS_STORE.query('nodes', { id: records[0].node_id });
    return nodeRecs.length ? nodeRecs[0].name : ('node#' + records[0].node_id);
  }

  // ---------------------------------------------------------------------------
  // execute(actions)  { applied: action[], failed: action|null }   synchronous
  // ---------------------------------------------------------------------------

  function execute(actions) {
    var applied = [];
      var newIdMap = {}; // new_*  real id

      for (var i = 0; i < actions.length; i++) {
        var raw = actions[i];

        // Normalise "action"  "type" (robustness against model variation)
        if (raw.action !== undefined && raw.type === undefined) raw = Object.assign({}, raw, { type: raw.action });

        // Validate action type
        if (!ACTIONS[raw.type]) {
          return { applied: applied, failed: raw };
        }

        // Resolve new_* references in all fields
        var action = _resolveAction(raw, newIdMap);

        try {
          var inserted = null;

          switch (action.type) {

            // --- NODES ---
            case 'add_node':
              inserted = DDS_STORE.insert('nodes', [{
                name: action.name || '',
                type_code: action.type_code || null,
                swim_lane_id: action.swim_lane_id ? parseInt(action.swim_lane_id, 10) : null,
                tags: action.tags || [],
                notes: action.notes || ''
              }]);
              if (raw.id) newIdMap[raw.id] = inserted[0].id;
              break;

            case 'update_node':
              var nodeUpdate = {};
              if (action.name !== undefined) nodeUpdate.name = action.name;
              if (action.type_code !== undefined) nodeUpdate.type_code = action.type_code;
              if (action.swim_lane_id !== undefined) nodeUpdate.swim_lane_id = action.swim_lane_id ? parseInt(action.swim_lane_id, 10) : null;
              if (action.tags !== undefined) nodeUpdate.tags = action.tags;
              if (action.notes !== undefined) nodeUpdate.notes = action.notes;
              DDS_STORE.update('nodes', { id: parseInt(action.node_id, 10) }, nodeUpdate);
              break;

            case 'delete_node':
              DDS_MODEL.deleteNode(parseInt(action.node_id, 10));
              break;

            case 'assign_node_to_lane':
              DDS_STORE.update('nodes', { id: parseInt(action.node_id, 10) }, { swim_lane_id: parseInt(action.swim_lane_id, 10) });
              break;

            // --- FLOWS ---
            case 'add_flow':
              inserted = DDS_STORE.insert('flows', [{
                source_node_id: parseInt(action.source_id, 10),
                target_node_id: parseInt(action.target_id, 10),
                product_ids: action.product_ids || [],
                tags: action.tags || [],
                lead_time_value: action.lead_time_value !== undefined ? action.lead_time_value : null,
                lead_time_unit: action.lead_time_unit || null,
                notes: action.notes || ''
              }]);
              if (raw.id) newIdMap[raw.id] = inserted[0].id;
              break;

            case 'update_flow':
              var flowUpdate = {};
              if (action.lead_time_value !== undefined) flowUpdate.lead_time_value = action.lead_time_value;
              if (action.lead_time_unit !== undefined) flowUpdate.lead_time_unit = action.lead_time_unit;
              if (action.tags !== undefined) flowUpdate.tags = action.tags;
              if (action.notes !== undefined) flowUpdate.notes = action.notes;
              DDS_STORE.update('flows', { id: parseInt(action.flow_id, 10) }, flowUpdate);
              break;

            case 'delete_flow':
              DDS_MODEL.deleteFlow(parseInt(action.flow_id, 10));
              break;

            case 'reroute_flow':
              var rerouteUpdate = {};
              if (action.new_source_id) rerouteUpdate.source_node_id = parseInt(action.new_source_id, 10);
              if (action.new_target_id) rerouteUpdate.target_node_id = parseInt(action.new_target_id, 10);
              DDS_STORE.update('flows', { id: parseInt(action.flow_id, 10) }, rerouteUpdate);
              break;

            case 'add_product_to_flow':
              var flowRecs = DDS_STORE.query('flows', { id: parseInt(action.flow_id, 10) });
              if (flowRecs.length) {
                var existingIds = flowRecs[0].product_ids || [];
                var pid = parseInt(action.product_id, 10);
                if (existingIds.indexOf(pid) === -1) {
                  DDS_STORE.update('flows', { id: parseInt(action.flow_id, 10) }, { product_ids: existingIds.concat([pid]) });
                }
              }
              break;

            case 'remove_product_from_flow':
              var flowRecs2 = DDS_STORE.query('flows', { id: parseInt(action.flow_id, 10) });
              if (flowRecs2.length) {
                var pid2 = parseInt(action.product_id, 10);
                var filtered = (flowRecs2[0].product_ids || []).filter(function (id) { return id !== pid2; });
                DDS_STORE.update('flows', { id: parseInt(action.flow_id, 10) }, { product_ids: filtered });
              }
              break;

            // --- PRODUCTS ---
            case 'add_product':
              inserted = DDS_STORE.insert('products', [{
                name: action.name || '',
                type_code: action.type_code || null,
                tags: action.tags || [],
                notes: action.notes || ''
              }]);
              if (raw.id) newIdMap[raw.id] = inserted[0].id;
              break;

            case 'update_product':
              var productUpdate = {};
              if (action.name !== undefined) productUpdate.name = action.name;
              if (action.type_code !== undefined) productUpdate.type_code = action.type_code;
              if (action.tags !== undefined) productUpdate.tags = action.tags;
              if (action.notes !== undefined) productUpdate.notes = action.notes;
              DDS_STORE.update('products', { id: parseInt(action.product_id, 10) }, productUpdate);
              break;

            case 'delete_product':
              DDS_MODEL.deleteProduct(parseInt(action.product_id, 10));
              break;

            // --- SKUs ---
            case 'add_sku':
              DDS_STORE.insert('skus', [{
                node_id: parseInt(action.node_id, 10),
                product_id: parseInt(action.product_id, 10),
                tags: action.tags || [],
                notes: action.notes || ''
              }]);
              break;

            case 'update_sku':
              var skuUpdate = {};
              if (action.tags !== undefined) skuUpdate.tags = action.tags;
              if (action.notes !== undefined) skuUpdate.notes = action.notes;
              DDS_STORE.update('skus', { node_id: parseInt(action.node_id, 10), product_id: parseInt(action.product_id, 10) }, skuUpdate);
              break;

            case 'remove_sku':
              DDS_MODEL.removeSku(parseInt(action.node_id, 10), parseInt(action.product_id, 10));
              break;

            // --- SWIM-LANES ---
            case 'add_swim_lane':
              inserted = DDS_STORE.insert('swim_lanes', [{
                name: action.name || '',
                color: action.color || null
              }]);
              if (raw.id) newIdMap[raw.id] = inserted[0].id;
              break;

            case 'update_swim_lane':
              var laneUpdate = {};
              if (action.name !== undefined) laneUpdate.name = action.name;
              if (action.color !== undefined) laneUpdate.color = action.color;
              DDS_STORE.update('swim_lanes', { id: parseInt(action.swim_lane_id, 10) }, laneUpdate);
              break;

            // --- BOMs ---
            case 'add_bom':
              inserted = DDS_STORE.insert('boms', [{
                node_id: parseInt(action.node_id, 10),
                output_product_id: parseInt(action.output_product_id, 10),
                notes: action.notes || ''
              }]);
              if (raw.id) newIdMap[raw.id] = inserted[0].id;
              break;

            case 'update_bom':
              var bomUpdate = {};
              if (action.output_product_id !== undefined) bomUpdate.output_product_id = parseInt(action.output_product_id, 10);
              if (action.notes !== undefined) bomUpdate.notes = action.notes;
              DDS_STORE.update('boms', { id: parseInt(action.bom_id, 10) }, bomUpdate);
              break;

            case 'delete_bom':
              DDS_MODEL.deleteBom(parseInt(action.bom_id, 10));
              break;

            case 'add_bom_component':
              DDS_STORE.insert('bom_components', [{
                bom_id: parseInt(action.bom_id, 10),
                product_id: parseInt(action.product_id, 10),
                quantity: action.quantity,
                notes: action.notes || ''
              }]);
              break;

            case 'update_bom_component':
              var bomCompUpdate = {};
              if (action.quantity !== undefined) bomCompUpdate.quantity = action.quantity;
              if (action.notes !== undefined) bomCompUpdate.notes = action.notes;
              DDS_STORE.update('bom_components', { bom_id: parseInt(action.bom_id, 10), product_id: parseInt(action.product_id, 10) }, bomCompUpdate);
              break;

            case 'remove_bom_component':
              DDS_STORE.remove('bom_components', { bom_id: parseInt(action.bom_id, 10), product_id: parseInt(action.product_id, 10) });
              break;

            // --- DEMANDS ---
            case 'add_demand':
              DDS_STORE.insert('demands', [{
                node_id: parseInt(action.node_id, 10),
                product_id: parseInt(action.product_id, 10),
                ctt_value: action.ctt_value !== undefined ? action.ctt_value : null,
                ctt_unit: action.ctt_unit || null,
                demand_value: action.demand_value !== undefined ? action.demand_value : null,
                demand_period: action.demand_period || null,
                notes: action.notes || ''
              }]);
              break;

            case 'update_demand':
              var demandUpdate = {};
              if (action.ctt_value !== undefined) demandUpdate.ctt_value = action.ctt_value;
              if (action.ctt_unit !== undefined) demandUpdate.ctt_unit = action.ctt_unit;
              if (action.demand_value !== undefined) demandUpdate.demand_value = action.demand_value;
              if (action.demand_period !== undefined) demandUpdate.demand_period = action.demand_period;
              if (action.notes !== undefined) demandUpdate.notes = action.notes;
              DDS_STORE.update('demands', { node_id: parseInt(action.node_id, 10), product_id: parseInt(action.product_id, 10) }, demandUpdate);
              break;

            case 'delete_demand':
              DDS_MODEL.deleteDemand(parseInt(action.node_id, 10), parseInt(action.product_id, 10));
              // cascade handled by DDS_MODEL.deleteDemand above
              break;

            default:
              resolve({ applied: applied, failed: raw });
              return;
          }

          // Attach _created_id to the applied action for callers (e.g. DDS_AI_UI map placement)
          if (inserted && inserted[0]) raw._created_id = inserted[0].id;
          applied.push(raw);

        } catch (err) {
          console.error('[DDS_ACTIONS] execute failed on action', raw.type, err);
          return { applied: applied, failed: raw };
        }
      }

    return { applied: applied, failed: null };
  }

  // ---------------------------------------------------------------------------
  // describe(actions)  { index, label }[]
  // ---------------------------------------------------------------------------

  function describe(actions) {
    // Pass 1  collect new_* labels
    var newLabelMap = {};
    actions.forEach(function (action) {
      if (!action.id || action.id.indexOf('new_') !== 0) return;
      var label;
      if (action.name) {
        label = action.name;
      } else if (action.type === 'add_flow') {
        label = 'new flow';
      } else if (action.type === 'add_bom') {
        label = 'new BOM';
      } else {
        label = action.id;
      }
      newLabelMap[action.id] = label;
    });

    // Pass 2  build labels
    return actions.map(function (action, index) {
      // Normalise "action"  "type" (robustness against model variation)
      if (action.action !== undefined && action.type === undefined) action = Object.assign({}, action, { type: action.action });
      var label;
      try {
        switch (action.type) {
          case 'add_node':
            label = 'Add node "' + (action.name || '?') + '"';
            break;
          case 'update_node':
            label = 'Update node "' + _nodeName(action.node_id, newLabelMap) + '"';
            break;
          case 'delete_node':
            label = 'Delete node "' + _nodeName(action.node_id, newLabelMap) + '"';
            break;
          case 'assign_node_to_lane':
            label = 'Assign node "' + _nodeName(action.node_id, newLabelMap) + '" to lane "' + _laneName(action.swim_lane_id, newLabelMap) + '"';
            break;
          case 'add_flow':
            label = 'Add flow ' + _nodeName(action.source_id, newLabelMap) + ' \u2192 ' + _nodeName(action.target_id, newLabelMap);
            break;
          case 'update_flow':
            var ep = _flowEndpoints(action.flow_id);
            label = 'Update flow ' + ep.src + ' \u2192 ' + ep.tgt;
            break;
          case 'delete_flow':
            var ep2 = _flowEndpoints(action.flow_id);
            label = 'Delete flow ' + ep2.src + ' \u2192 ' + ep2.tgt;
            break;
          case 'reroute_flow':
            var ep3 = _flowEndpoints(action.flow_id);
            var newSrc = action.new_source_id ? _nodeName(action.new_source_id, newLabelMap) : ep3.src;
            var newTgt = action.new_target_id ? _nodeName(action.new_target_id, newLabelMap) : ep3.tgt;
            label = 'Reroute flow: ' + newSrc + ' \u2192 ' + newTgt;
            break;
          case 'add_product_to_flow':
            var ep4 = _flowEndpoints(action.flow_id);
            label = 'Add product "' + _productName(action.product_id, newLabelMap) + '" to flow ' + ep4.src + ' \u2192 ' + ep4.tgt;
            break;
          case 'remove_product_from_flow':
            var ep5 = _flowEndpoints(action.flow_id);
            label = 'Remove product "' + _productName(action.product_id, newLabelMap) + '" from flow ' + ep5.src + ' \u2192 ' + ep5.tgt;
            break;
          case 'add_product':
            label = 'Add product "' + (action.name || '?') + '"';
            break;
          case 'update_product':
            label = 'Update product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'delete_product':
            label = 'Delete product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'add_sku':
            label = 'Add SKU: node "' + _nodeName(action.node_id, newLabelMap) + '" \u00d7 product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'update_sku':
            label = 'Update SKU: node "' + _nodeName(action.node_id, newLabelMap) + '" \u00d7 product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'remove_sku':
            label = 'Remove SKU: node "' + _nodeName(action.node_id, newLabelMap) + '" \u00d7 product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'add_swim_lane':
            label = 'Add swim-lane "' + (action.name || '?') + '"';
            break;
          case 'update_swim_lane':
            label = 'Update swim-lane "' + _laneName(action.swim_lane_id, newLabelMap) + '"';
            break;
          case 'add_bom':
            label = 'Add BOM: node "' + _nodeName(action.node_id, newLabelMap) + '" \u2192 output "' + _productName(action.output_product_id, newLabelMap) + '"';
            break;
          case 'update_bom':
            label = 'Update BOM on node "' + _bomNodeName(action.bom_id) + '"';
            break;
          case 'delete_bom':
            label = 'Delete BOM on node "' + _bomNodeName(action.bom_id) + '"';
            break;
          case 'add_bom_component':
            label = 'Add BOM component: "' + _productName(action.product_id, newLabelMap) + '" \u00d7 ' + action.quantity + ' to BOM on "' + _bomNodeName(action.bom_id) + '"';
            break;
          case 'update_bom_component':
            label = 'Update BOM component "' + _productName(action.product_id, newLabelMap) + '" on node "' + _bomNodeName(action.bom_id) + '"';
            break;
          case 'remove_bom_component':
            label = 'Remove BOM component "' + _productName(action.product_id, newLabelMap) + '" from BOM on "' + _bomNodeName(action.bom_id) + '"';
            break;
          case 'add_demand':
            label = 'Add demand: node "' + _nodeName(action.node_id, newLabelMap) + '" \u00d7 product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'update_demand':
            label = 'Update demand: node "' + _nodeName(action.node_id, newLabelMap) + '" \u00d7 product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          case 'delete_demand':
            label = 'Delete demand: node "' + _nodeName(action.node_id, newLabelMap) + '" \u00d7 product "' + _productName(action.product_id, newLabelMap) + '"';
            break;
          default:
            label = 'Unknown action: ' + action.type;
        }
      } catch (e) {
        label = 'Action ' + (index + 1) + ' (' + action.type + ')';
      }
      return { index: index, label: label };
    });
  }

  // ---------------------------------------------------------------------------
  // getVocabularyText()  string
  // ---------------------------------------------------------------------------

  function getVocabularyText() {
    var lines = [];

    var sections = [
      { title: 'NODES',      keys: ['add_node', 'update_node', 'delete_node', 'assign_node_to_lane'] },
      { title: 'FLOWS',      keys: ['add_flow', 'update_flow', 'delete_flow', 'reroute_flow', 'add_product_to_flow', 'remove_product_from_flow'] },
      { title: 'PRODUCTS',   keys: ['add_product', 'update_product', 'delete_product'] },
      { title: 'SKUs',       keys: ['add_sku', 'update_sku', 'remove_sku'] },
      { title: 'SWIM-LANES', keys: ['add_swim_lane', 'update_swim_lane'] },
      { title: 'BOMs',       keys: ['add_bom', 'update_bom', 'delete_bom', 'add_bom_component', 'update_bom_component', 'remove_bom_component'] },
      { title: 'DEMANDS',    keys: ['add_demand', 'update_demand', 'delete_demand'] }
    ];

    lines.push('ACTION FORMAT: each action is a JSON object with a "type" field (required) plus domain fields.');
    lines.push('The discriminant field MUST be named "type". Example: {"type": "add_node", "name": "..."}');
    lines.push('NEVER use "action" or any other key name  only "type" is accepted.');
    lines.push('');

    sections.forEach(function (section) {
      lines.push('--- ' + section.title + ' ---');
      lines.push('');
      section.keys.forEach(function (key) {
        var def = ACTIONS[key];
        if (!def) return;
        lines.push(key);
        if (def.required.length) lines.push('  Required : ' + def.required.join(', '));
        if (def.optional.length) lines.push('  Optional : ' + def.optional.join(', '));
        def.notes.forEach(function (note) {
          lines.push('  Note     : ' + note);
        });
        lines.push('');
      });
    });

    lines.push('Note: swim_lane deletion is excluded from v1 of the AI assistant.');
    lines.push('Note: node_type and product_type creation are excluded from v1.');
    lines.push('Note: map management and map visibility (map_nodes, map_flows, map_swim_lanes, map_demands) are excluded from v1. Do not emit actions on these entities.');

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    ACTIONS: ACTIONS,
    execute: execute,
    describe: describe,
    getVocabularyText: getVocabularyText
  };

})();


export default window.DDS_ACTIONS;



