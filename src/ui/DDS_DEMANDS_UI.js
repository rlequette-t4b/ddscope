// AUDITOR:LARGE_BLOCK_JUSTIFIED - single-responsibility demand table view, cohesive inline-edit + delete.
// ============================================================
// DDS_DEMANDS_UI — Demand table view
// ============================================================
// Renders all SKUs that have a demand record in the project.
// Inline edit: CTT value/unit, demand value/period, notes.
// Delete: removes demand with cascade.
// Auto-loaded on tab click.
// ============================================================

var DDS_DEMANDS_UI = {};

var _D_UNITS = ['hours','days','weeks','months','years'];

DDS_DEMANDS_UI.renderTable = function() {
  var wrap = document.getElementById('dds-demand-table-wrap');
  if (!wrap) return;

  var demands = DDS_STORE.query('demands');
  var nodeById    = {};
  var productById = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodeById[n.id] = n; });
  DDS_STORE.query('products').forEach(function(p) { productById[p.id] = p; });

  if (demands.length === 0) {
    wrap.innerHTML = '<div class="dds-demand-empty">No demand records yet.<br>Add demands from the node side panel (SKU section).</div>';
    return;
  }

  var table = document.createElement('table');
  table.className = 'dds-demand-table';

  var thead = document.createElement('thead');
  thead.innerHTML =
    '<tr>' +
    '<th>Node</th>' +
    '<th>Product</th>' +
    '<th>CTT</th>' +
    '<th>Demand</th>' +
    '<th>Notes</th>' +
    '<th></th>' +
    '</tr>';
  table.appendChild(thead);

  var tbody = document.createElement('tbody');

  demands.forEach(function(demand) {
    var node    = nodeById[demand.node_id];
    var product = productById[demand.product_id];
    var tr = document.createElement('tr');

    // Node name (read-only)
    var tdNode = document.createElement('td');
    tdNode.textContent = node ? (node.name || '—') : '?';
    tr.appendChild(tdNode);

    // Product name (read-only)
    var tdProd = document.createElement('td');
    tdProd.textContent = product ? (product.name || '—') : '?';
    tr.appendChild(tdProd);

    // CTT: value + unit
    var tdCtt = document.createElement('td');
    var cttPair = document.createElement('div'); cttPair.className = 'dds-demand-pair';
    var cttVal = document.createElement('input');
    cttVal.type = 'number'; cttVal.min = '0'; cttVal.step = 'any';
    cttVal.value = demand.ctt_value != null ? demand.ctt_value : '';
    var cttUnit = DDS_DEMANDS_UI._unitSelect(demand.ctt_unit || 'days');
    var _saveCtt = function() {
      DDS_CMD.execute(TX.DEMAND_UPDATE, {
        node_id: demand.node_id,
        product_id: demand.product_id,
        ctt_value: cttVal.value !== '' ? parseFloat(cttVal.value) : null,
        ctt_unit:  cttUnit.value
      }, null);
    };
    cttVal.addEventListener('blur',    _saveCtt);
    cttUnit.addEventListener('change', _saveCtt);
    cttPair.appendChild(cttVal); cttPair.appendChild(cttUnit);
    tdCtt.appendChild(cttPair); tr.appendChild(tdCtt);

    // Demand: value + period
    var tdDem = document.createElement('td');
    var dPair = document.createElement('div'); dPair.className = 'dds-demand-pair';
    var dVal = document.createElement('input');
    dVal.type = 'number'; dVal.min = '0'; dVal.step = 'any';
    dVal.value = demand.demand_value != null ? demand.demand_value : '';
    var dPeriod = DDS_DEMANDS_UI._unitSelect(demand.demand_period || 'weeks');
    var _saveDem = function() {
      DDS_CMD.execute(TX.DEMAND_UPDATE, {
        node_id: demand.node_id,
        product_id: demand.product_id,
        demand_value:  dVal.value !== '' ? parseFloat(dVal.value) : null,
        demand_period: dPeriod.value
      }, null);
    };
    dVal.addEventListener('blur',      _saveDem);
    dPeriod.addEventListener('change', _saveDem);
    dPair.appendChild(dVal); dPair.appendChild(dPeriod);
    tdDem.appendChild(dPair); tr.appendChild(tdDem);

    // Notes
    var tdNotes = document.createElement('td');
    var notesArea = document.createElement('textarea');
    notesArea.rows = 1; notesArea.value = demand.notes || '';
    notesArea.addEventListener('blur', function() {
      DDS_CMD.execute(TX.DEMAND_UPDATE, { node_id: demand.node_id, product_id: demand.product_id, notes: this.value }, null);
    });
    tdNotes.appendChild(notesArea); tr.appendChild(tdNotes);

    // Delete button
    var tdDel = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.className = 'dds-btn dds-btn-sm dds-btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', function() {
      if (!confirm('Delete demand for ' + (node ? node.name : '?') + ' × ' + (product ? product.name : '?') + '?')) return;
      DDS_CMD.execute(TX.DEMAND_DELETE, { node_id: demand.node_id, product_id: demand.product_id }, null);
      DDS_DEMANDS_UI.renderTable();
    });
    tdDel.appendChild(delBtn); tr.appendChild(tdDel);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.innerHTML = '';
  wrap.appendChild(table);
};

// Build a unit <select> element
DDS_DEMANDS_UI._unitSelect = function(selectedUnit) {
  var sel = document.createElement('select');
  _D_UNITS.forEach(function(u) {
    var opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    if (u === selectedUnit) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
};

DDS_DEMANDS_UI.bindEvents = function() {
  var tab = document.getElementById('dds-tab-demand');
  if (tab) {
    tab.addEventListener('click', function() {
      setTimeout(function() { DDS_DEMANDS_UI.renderTable(); }, 50);
    });
  }
};
