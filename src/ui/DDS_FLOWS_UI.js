// ============================================================
// DDS_FLOWS_UI — flows table view (all via DDS_STORE)
// ============================================================

var DDS_FLOWS_UI = {};

DDS_FLOWS_UI._esc = function(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

// Build node options HTML for a select, with current value selected
DDS_FLOWS_UI._nodeOptions = function(selectedId) {
  var nodes = DDS_STORE.query('nodes', {}, { order_by: 'name ASC' });
  return nodes.map(function(n) {
    var sel = (n.id === selectedId) ? ' selected' : '';
    return '<option value="' + n.id + '"' + sel + '>' + DDS_FLOWS_UI._esc(n.name) + '</option>';
  }).join('');
};

// Build product options HTML for the product selector in a row
DDS_FLOWS_UI._productOptions = function(flowProductIds) {
  var products = DDS_STORE.query('products', {}, { order_by: 'name ASC' });
  var ids = (flowProductIds || []).map(Number);
  return products.map(function(p) {
    var sel = ids.indexOf(p.id) !== -1 ? ' selected' : '';
    return '<option value="' + p.id + '"' + sel + '>' + DDS_FLOWS_UI._esc(p.name) + '</option>';
  }).join('');
};

// Render the full flows table
DDS_FLOWS_UI.renderTable = function() {
  var wrap = document.getElementById('dds-flows-table-wrap');
  if (!wrap) return;
  var flows = DDS_STORE.query('flows');
  var nodes = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodes[n.id] = n; });
  var products = {};
  DDS_STORE.query('products').forEach(function(p) { products[p.id] = p; });

  if (flows.length === 0) {
    wrap.innerHTML = '<div class="dds-table-empty">No flows yet — create flows on the map.</div>';
    return;
  }

  var html = '<table class="dds-table">' +
    '<thead><tr>' +
    '<th>Source</th><th>Target</th><th>Products</th>' +
    '<th>Lead time</th><th style="text-align:center">&#8596;</th><th>Tags</th><th>Notes</th><th></th>' +
    '</tr></thead><tbody>';

  flows.forEach(function(f) {
    var srcName = nodes[f.source_node_id] ? DDS_FLOWS_UI._esc(nodes[f.source_node_id].name) : '?';
    var tgtName = nodes[f.target_node_id] ? DDS_FLOWS_UI._esc(nodes[f.target_node_id].name) : '?';
    var prodIds = (f.product_ids || []).map(Number);
    var prodNames = prodIds.map(function(pid) {
      return products[pid] ? DDS_FLOWS_UI._esc(products[pid].name) : '?';
    }).join(', ');
    var ltVal  = f.lead_time_value  != null ? DDS_FLOWS_UI._esc(String(f.lead_time_value)) : '';
    var ltUnit = f.lead_time_unit ? DDS_FLOWS_UI._esc(f.lead_time_unit) : '';
    var ltDisplay = ltVal ? (ltVal + (ltUnit ? ' ' + ltUnit : '')) : '—';
    var tagsHtml = (f.tags || []).map(function(t) {
      return '<span class="dds-table-tag">' + DDS_FLOWS_UI._esc(t) + '</span>';
    }).join('');

    var biArrow = f.bidirectional ? '&#8596;' : '';
    html += '<tr data-flow-id="' + f.id + '">' +
      '<td>' + srcName + '</td>' +
      '<td>' + tgtName + '</td>' +
      '<td>' + (prodNames || '<span style="color:var(--dds-text-muted)">—</span>') + '</td>' +
      '<td>' + ltDisplay + '</td>' +
      '<td style="text-align:center;font-size:1.1em">' + biArrow + '</td>' +
      '<td>' + (tagsHtml || '<span style="color:var(--dds-text-muted)">—</span>') + '</td>' +
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        DDS_FLOWS_UI._esc(f.notes || '') +
      '</td>' +
      '<td><div class="dds-table-actions">' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-action="edit" data-id="' + f.id + '">Edit</button>' +
        '<button class="dds-btn dds-btn-danger dds-btn-sm"    data-action="del"  data-id="' + f.id + '">Delete</button>' +
      '</div></td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;

  // Bind action buttons
  wrap.querySelectorAll('[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = parseInt(this.dataset.id);
      var flow = DDS_STORE.query('flows', { id: id })[0];
      if (!flow) return;
      if (this.dataset.action === 'edit') DDS_FLOWS_UI.openEditRow(flow);
      if (this.dataset.action === 'del')  DDS_FLOWS_UI.handleDelete(flow);
    });
  });
};

// Replace a table row with an inline edit form
DDS_FLOWS_UI.openEditRow = function(flow) {
  var row = document.querySelector('#dds-flows-table-wrap tr[data-flow-id="' + flow.id + '"]');
  if (!row) return;

  var tags = (flow.tags || []).slice();

  row.innerHTML =
    '<td><select class="dds-select dds-select-sm" id="dds-fe-src-' + flow.id + '">' +
      DDS_FLOWS_UI._nodeOptions(flow.source_node_id) +
    '</select></td>' +
    '<td><select class="dds-select dds-select-sm" id="dds-fe-tgt-' + flow.id + '">' +
      DDS_FLOWS_UI._nodeOptions(flow.target_node_id) +
    '</select></td>' +
    '<td><select class="dds-select dds-select-sm" id="dds-fe-prod-' + flow.id + '" multiple style="height:auto;min-width:120px">' +
      DDS_FLOWS_UI._productOptions(flow.product_ids) +
    '</select></td>' +
    '<td style="white-space:nowrap">' +
      '<input class="dds-input dds-input-sm" id="dds-fe-ltv-' + flow.id + '" type="number" min="0" step="any" style="width:60px" value="' + DDS_FLOWS_UI._esc(String(flow.lead_time_value != null ? flow.lead_time_value : '')) + '" placeholder="0" />' +
      ' <input class="dds-input dds-input-sm" id="dds-fe-ltu-' + flow.id + '" type="text" style="width:60px" value="' + DDS_FLOWS_UI._esc(flow.lead_time_unit || '') + '" placeholder="days" />' +
    '</td>' +
    '<td><input class="dds-input dds-input-sm" id="dds-fe-tags-' + flow.id + '" type="text" style="min-width:100px" value="' + DDS_FLOWS_UI._esc(tags.join(', ')) + '" placeholder="tag1, tag2" /></td>' +
    '<td><input class="dds-input dds-input-sm" id="dds-fe-notes-' + flow.id + '" type="text" style="min-width:120px" value="' + DDS_FLOWS_UI._esc(flow.notes || '') + '" /></td>' +
    '<td><div class="dds-table-actions">' +
      '<button class="dds-btn dds-btn-primary dds-btn-sm" id="dds-fe-save-' + flow.id + '">Save</button>' +
      '<button class="dds-btn dds-btn-secondary dds-btn-sm" id="dds-fe-cancel-' + flow.id + '">Cancel</button>' +
    '</div></td>';

  document.getElementById('dds-fe-save-' + flow.id).addEventListener('click', function() {
    DDS_FLOWS_UI.saveEditRow(flow.id);
  });
  document.getElementById('dds-fe-cancel-' + flow.id).addEventListener('click', function() {
    DDS_FLOWS_UI.renderTable();
  });
};

// Persist inline edits to DDS_STORE
DDS_FLOWS_UI.saveEditRow = function(flowId) {
  var flow = DDS_STORE.query('flows', { id: flowId })[0];
  if (!flow) return;

  var newSrcId  = parseInt(document.getElementById('dds-fe-src-'   + flowId).value);
  var newTgtId  = parseInt(document.getElementById('dds-fe-tgt-'   + flowId).value);
  var ltv       = document.getElementById('dds-fe-ltv-'  + flowId).value.trim();
  var ltu       = document.getElementById('dds-fe-ltu-'  + flowId).value.trim();
  var tagsRaw   = document.getElementById('dds-fe-tags-' + flowId).value;
  var notes     = document.getElementById('dds-fe-notes-'+ flowId).value.trim();

  // Collect selected products from multi-select
  var prodSel = document.getElementById('dds-fe-prod-' + flowId);
  var newProductIds = [];
  if (prodSel) {
    Array.from(prodSel.options).forEach(function(opt) {
      if (opt.selected) newProductIds.push(parseInt(opt.value));
    });
  }

  var newTags = tagsRaw.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
  var newLtv  = ltv !== '' ? parseFloat(ltv) : null;
  var newLtu  = ltu || null;

  // Determine products added / removed to sync SKUs
  var oldIds = (flow.product_ids || []).map(Number);
  var added   = newProductIds.filter(function(id) { return oldIds.indexOf(id) === -1; });
  var removed = oldIds.filter(function(id) { return newProductIds.indexOf(id) === -1; });

  // Update flow record — TX.FLOW_UPDATE (DDS_CMD, SCRIPT 1875)
  DDS_CMD.execute(TX.FLOW_UPDATE, {
    id:              flowId,
    lead_time_value: newLtv,
    lead_time_unit:  newLtu,
    tags:            newTags,
    notes:           notes
  }, DDS_MAP.state.currentMapId);
  if (newSrcId !== flow.source_node_id || newTgtId !== flow.target_node_id) {
    DDS_CMD.execute(TX.FLOW_REROUTE, {
      flow_id:       flowId,
      new_source_id: newSrcId !== flow.source_node_id ? newSrcId : null,
      new_target_id: newTgtId !== flow.target_node_id ? newTgtId : null
    });
  }
  // Sync product_ids via add/remove per changed product — TX.FLOW_ADD_PRODUCT /
  // TX.FLOW_REMOVE_PRODUCT already cascade SKU ensure/cleanup via
  // DDS_MODEL.ensureSku/cleanupSku (SCRIPT 1875 → SCRIPT 1550), so no
  // separate call is needed here (T-024).
  added.forEach(function(pid) { DDS_CMD.execute(TX.FLOW_ADD_PRODUCT, { flow_id: flowId, product_id: pid }); });
  removed.forEach(function(pid) { DDS_CMD.execute(TX.FLOW_REMOVE_PRODUCT, { flow_id: flowId, product_id: pid }); });

  // If source/target changed, refresh map if map view is active
  if (newSrcId !== flow.source_node_id || newTgtId !== flow.target_node_id) {
    if (typeof DDS_MAP !== 'undefined' && DDS.state.currentView === 'map') {
      DDS_MAP.loadMap(DDS.state.currentMap);
    }
  }

  DDS_FLOWS_UI.renderTable();
};

// Delete a flow with SKU cascade confirmation
DDS_FLOWS_UI.handleDelete = function(flow) {
  var nodes = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodes[n.id] = n; });
  var srcName = nodes[flow.source_node_id] ? nodes[flow.source_node_id].name : '?';
  var tgtName = nodes[flow.target_node_id] ? nodes[flow.target_node_id].name : '?';
  if (!confirm('Delete flow from "' + srcName + '" to "' + tgtName + '"? Associated SKUs will be cleaned up.')) return;

  var productIds = (flow.product_ids || []).map(Number);

  // Delete flow first (cascade to map_flows handled by DDS_MODEL.deleteFlow) —
  // TX.FLOW_DELETE does not touch SKUs. The cleanup below MUST run after this,
  // not before: DDS_MODEL.cleanupSku's "still referenced by another flow"
  // check queries DDS_STORE live, so running it while this flow still exists
  // would always find this flow itself and never clean up (fixed 2026-07-02,
  // same class of ordering bug as DDS_MODEL.deleteNode — see DDS_MODEL SCRIPT
  // 1550). Consolidated onto DDS_MODEL.cleanupSku, replacing the retired
  // DDS_PRODUCTS.cleanSku facade (T-024 / SKU logic consolidation).
  DDS_CMD.execute(TX.FLOW_DELETE, { id: flow.id });

  productIds.forEach(function(pid) {
    DDS_MODEL.cleanupSku(flow.source_node_id, pid);
    DDS_MODEL.cleanupSku(flow.target_node_id, pid);
  });

  // Refresh map if active, preserving current viewport
  if (typeof DDS_MAP !== 'undefined' && DDS_MAP.state.currentMapId) {
    DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
  }

  DDS_FLOWS_UI.renderTable();
};

// Wire tab click
DDS_FLOWS_UI.bindEvents = function() {
  var tab = document.getElementById('dds-tab-flows');
  if (tab) {
    tab.addEventListener('click', function() {
      setTimeout(function() { DDS_FLOWS_UI.renderTable(); }, 50);
    });
  }
};

document.addEventListener('DOMContentLoaded', function() {
  DDS_FLOWS_UI.bindEvents();
});
