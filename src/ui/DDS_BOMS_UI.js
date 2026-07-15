// ============================================================
// DDS_BOMS_UI — table + modal (writes via DDS_CMD, reads via DDS_STORE directly — DDS_BOMS facade retired 2026-07-02)
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive BOM UI controller

var DDS_BOMS_UI = {};
var _bomModalMode = 'create', _editBomId = null, _bomComponents = [];

DDS_BOMS_UI._esc = function(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

DDS_BOMS_UI.renderTable = function() {
  var wrap = document.getElementById('dds-boms-table-wrap'); if (!wrap) return;
  var boms = DDS_STORE.query('boms');
  var nodeById = {}, productById = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodeById[n.id] = n; });
  DDS_STORE.query('products').forEach(function(p) { productById[p.id] = p; });
  if (boms.length === 0) {
    wrap.innerHTML = '<div class="dds-table-empty">No BOMs yet — click &ldquo;+ BOM&rdquo; to add one.</div>'; return;
  }
  var html = '<table class="dds-table"><thead><tr><th>Node</th><th>Output product</th><th>Components</th><th></th></tr></thead><tbody>';
  boms.forEach(function(bom) {
    var node = nodeById[bom.node_id], output = productById[bom.output_product_id];
    var comps = DDS_STORE.query('bom_components', { bom_id: bom.id });
    var compsHtml = comps.length === 0 ? '<span style="color:var(--dds-text-muted)">—</span>'
      : comps.map(function(c) {
          var p = productById[c.product_id];
          return '<span class="dds-table-tag">' + DDS_BOMS_UI._esc(p ? p.name : '?') + ' ×' + (c.quantity || 1) + '</span>';
        }).join(' ');
    html += '<tr><td>' + DDS_BOMS_UI._esc(node ? node.name : '?') + '</td>' +
      '<td><strong>' + DDS_BOMS_UI._esc(output ? output.name : '?') + '</strong></td>' +
      '<td>' + compsHtml + '</td>' +
      '<td><div class="dds-table-actions">' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-action="edit" data-id="' + bom.id + '">Edit</button>' +
        '<button class="dds-btn dds-btn-danger dds-btn-sm" data-action="del" data-id="' + bom.id + '">Delete</button>' +
      '</div></td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = parseInt(this.dataset.id);
      var bom = boms.find(function(b) { return b.id === id; }); if (!bom) return;
      if (this.dataset.action === 'edit') DDS_BOMS_UI.openModal(bom);
      if (this.dataset.action === 'del')  DDS_BOMS_UI.handleDelete(bom);
    });
  });
};

DDS_BOMS_UI.openModal = function(bom) {
  _bomModalMode  = bom ? 'edit' : 'create';
  _editBomId     = bom ? bom.id : null;
  _bomComponents = bom ? DDS_STORE.query('bom_components', { bom_id: bom.id }).map(function(c) {
    return { product_id: c.product_id, quantity: c.quantity };
  }) : [];
  document.getElementById('dds-modal-bom-title').textContent = bom ? 'Edit BOM' : 'Add BOM';
  document.getElementById('dds-modal-bom-save').textContent  = bom ? 'Save' : 'Add';

  var nodeEl = document.getElementById('dds-bom-node');
  nodeEl.innerHTML = '<option value="">Select a node…</option>';
  DDS_STORE.query('nodes').forEach(function(n) {
    var opt = document.createElement('option'); opt.value = n.id; opt.textContent = n.name || ('Node ' + n.id);
    if (bom && n.id === bom.node_id) opt.selected = true;
    nodeEl.appendChild(opt);
  });
  nodeEl.disabled = !!bom;

  var outputEl = document.getElementById('dds-bom-output');
  outputEl.innerHTML = '<option value="">Select a product…</option>';
  DDS_STORE.query('products').forEach(function(p) {
    var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
    if (bom && p.id === bom.output_product_id) opt.selected = true;
    outputEl.appendChild(opt);
  });
  outputEl.disabled = !!bom;

  DDS_BOMS_UI._renderComponents();
  DDS_BOMS_UI._updateSaveBtn();
  nodeEl.addEventListener('change',   DDS_BOMS_UI._updateSaveBtn);
  outputEl.addEventListener('change', DDS_BOMS_UI._updateSaveBtn);

  var overlay = document.getElementById('dds-modal-bom-overlay');
  overlay.classList.remove('dds-hidden'); void overlay.offsetWidth; overlay.classList.add('visible');
};

DDS_BOMS_UI._updateSaveBtn = function() {
  var n = document.getElementById('dds-bom-node').value;
  var o = document.getElementById('dds-bom-output').value;
  document.getElementById('dds-modal-bom-save').disabled = !(n && o);
};

DDS_BOMS_UI._renderComponents = function() {
  var list = document.getElementById('dds-bom-components-list'); if (!list) return;
  list.innerHTML = '';
  var products = DDS_STORE.query('products');
  _bomComponents.forEach(function(comp, idx) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;overflow:hidden';
    var sel = document.createElement('select'); sel.className = 'dds-select';
    sel.style.cssText = 'flex:1 1 0;min-width:0;width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis';
    sel.innerHTML = '<option value="">Select product…</option>';
    products.forEach(function(p) {
      var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
      if (p.id == comp.product_id) opt.selected = true; // jshint ignore:line — loose equality for int/string safety
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function() { _bomComponents[idx].product_id = parseInt(this.value) || null; });
    var qty = document.createElement('input'); qty.className = 'dds-input'; qty.type = 'number'; qty.min = '0'; qty.step = '0.1'; qty.style.cssText = 'width:52px!important;max-width:52px!important;flex:0 0 52px'; qty.value = comp.quantity || 1;
    qty.addEventListener('change', function() { _bomComponents[idx].quantity = parseFloat(this.value) || 1; });
    var removeBtn = document.createElement('button'); removeBtn.className = 'dds-btn dds-btn-ghost dds-btn-sm'; removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function() { _bomComponents.splice(idx, 1); DDS_BOMS_UI._renderComponents(); });
    row.appendChild(sel); row.appendChild(qty); row.appendChild(removeBtn); list.appendChild(row);
  });
};

DDS_BOMS_UI.closeModal = function() {
  var overlay = document.getElementById('dds-modal-bom-overlay');
  if (overlay) overlay.classList.remove('visible');
};

DDS_BOMS_UI.handleSave = function() {
  var saveBtn = document.getElementById('dds-modal-bom-save');
  saveBtn.disabled = true; saveBtn.innerHTML = '<span class="dds-spinner"></span>';
  var nodeId = parseInt(document.getElementById('dds-bom-node').value);
  var outputId = parseInt(document.getElementById('dds-bom-output').value);
  var comps = _bomComponents.filter(function(c) { return c.product_id; });
  try {
    if (_bomModalMode === 'edit') { DDS_CMD.execute(TX.BOM_UPDATE_COMPONENTS, { bom_id: _editBomId, components: comps }, null); }
    else { DDS_CMD.execute(TX.BOM_CREATE, { node_id: nodeId, output_product_id: outputId, components: comps }, null); }
    DDS_BOMS_UI.closeModal();
    DDS_BOMS_UI.renderTable();
  } catch(err) {
    console.error('[DDS] BOM save error:', err);
    saveBtn.textContent = 'Error — retry'; saveBtn.disabled = false;
  }
};

DDS_BOMS_UI.handleDelete = function(bom) {
  if (!confirm('Delete this BOM?')) return;
  DDS_CMD.execute(TX.BOM_DELETE, { id: bom.id }, null);
  DDS_BOMS_UI.renderTable();
};

DDS_BOMS_UI.bindEvents = function() {
  document.getElementById('dds-btn-add-bom').addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return; DDS_BOMS_UI.openModal(null);
  });
  document.getElementById('dds-modal-bom-close').addEventListener('click',  DDS_BOMS_UI.closeModal);
  document.getElementById('dds-modal-bom-cancel').addEventListener('click', DDS_BOMS_UI.closeModal);
  document.getElementById('dds-modal-bom-save').addEventListener('click',   DDS_BOMS_UI.handleSave);
  document.getElementById('dds-bom-add-component').addEventListener('click', function() {
    _bomComponents.push({ product_id: null, quantity: 1 }); DDS_BOMS_UI._renderComponents();
  });
  document.getElementById('dds-modal-bom-overlay').addEventListener('click', function(e) { if (e.target === this) DDS_BOMS_UI.closeModal(); });
  // CommWise (framework-1) legacy nav tab — see DDS_PRODUCTS_UI.bindEvents
  // for the framework-2/3 equivalent (DDS._registerPages onShow).
  var bomsTab = document.getElementById('dds-tab-boms');
  if (bomsTab) bomsTab.addEventListener('click', function() {
    setTimeout(function() { DDS_BOMS_UI.renderTable(); }, 50);
  });
};
