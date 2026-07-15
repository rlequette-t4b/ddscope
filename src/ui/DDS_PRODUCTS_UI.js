// ============================================================
// DDS_PRODUCTS_UI — table + modal (writes via DDS_CMD, reads via DDS_STORE directly — DDS_PRODUCTS facade retired 2026-07-02)
// ============================================================

var DDS_PRODUCTS_UI = {};
var _prodModalMode = 'create', _editProductId = null, _prodTags = [];

DDS_PRODUCTS_UI._esc = function(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

DDS_PRODUCTS_UI.renderTable = function() {
  var wrap = document.getElementById('dds-products-table-wrap'); if (!wrap) return;
  var products = DDS_STORE.query('products');
  var flowCountByProduct = {};
  DDS_STORE.query('flows').forEach(function(f) {
    (f.product_ids || []).map(Number).forEach(function(pid2) {
      flowCountByProduct[pid2] = (flowCountByProduct[pid2] || 0) + 1;
    });
  });
  if (products.length === 0) {
    wrap.innerHTML = '<div class="dds-table-empty">No products yet — click &ldquo;+ Product&rdquo; to add one.</div>';
    return;
  }
  var html = '<table class="dds-table"><thead><tr><th>Name</th><th>Type</th><th>Tags</th><th>Flows</th><th></th></tr></thead><tbody>';
  products.forEach(function(p) {
    var tagsHtml = (p.tags || []).map(function(t) { return '<span class="dds-table-tag">' + DDS_PRODUCTS_UI._esc(t) + '</span>'; }).join('');
    html += '<tr>' +
      '<td><strong>' + DDS_PRODUCTS_UI._esc(p.name) + '</strong></td>' +
      '<td>' + DDS_PRODUCTS_UI._esc(p.type_code || '—') + '</td>' +
      '<td>' + (tagsHtml || '<span style="color:var(--dds-text-muted)">—</span>') + '</td>' +
      '<td style="text-align:center">' + (flowCountByProduct[p.id] || 0) + '</td>' +
      '<td><div class="dds-table-actions">' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-action="edit" data-id="' + p.id + '">Edit</button>' +
        '<button class="dds-btn dds-btn-danger dds-btn-sm" data-action="del" data-id="' + p.id + '">Delete</button>' +
      '</div></td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = parseInt(this.dataset.id);
      var p = products.find(function(x) { return x.id === id; }); if (!p) return;
      if (this.dataset.action === 'edit') DDS_PRODUCTS_UI.openModal(p);
      if (this.dataset.action === 'del')  DDS_PRODUCTS_UI.handleDelete(p);
    });
  });
};

DDS_PRODUCTS_UI.openModal = function(product) {
  _prodModalMode = product ? 'edit' : 'create';
  _editProductId = product ? product.id : null;
  _prodTags = product && Array.isArray(product.tags) ? product.tags.slice() : [];
  document.getElementById('dds-modal-product-title').textContent = product ? 'Edit product' : 'Add product';
  document.getElementById('dds-modal-product-save').textContent  = product ? 'Save' : 'Add';
  document.getElementById('dds-prod-name').value  = product ? (product.name  || '') : '';
  document.getElementById('dds-prod-notes').value = product ? (product.notes || '') : '';
  var typeEl = document.getElementById('dds-prod-type');
  typeEl.innerHTML = '<option value="">— no type —</option>';
  DDS_STORE.query('product_types').forEach(function(t) {
    var opt = document.createElement('option'); opt.value = t.code; opt.textContent = t.label || t.code;
    if (product && t.code === product.type_code) opt.selected = true;
    typeEl.appendChild(opt);
  });
  DDS_PANEL.renderTags('dds-prod-tags-wrap', 'dds-prod-tag-input', _prodTags);
  DDS_PANEL.bindTagInput('dds-prod-tag-input', _prodTags, 'dds-prod-tags-wrap');
  document.getElementById('dds-modal-product-save').disabled = !(product && product.name);
  var overlay = document.getElementById('dds-modal-product-overlay');
  overlay.classList.remove('dds-hidden'); void overlay.offsetWidth; overlay.classList.add('visible');
  document.getElementById('dds-prod-name').focus();
};

DDS_PRODUCTS_UI.closeModal = function() {
  var overlay = document.getElementById('dds-modal-product-overlay');
  if (overlay) overlay.classList.remove('visible');
};

DDS_PRODUCTS_UI._doSave = function(closeAfter) {
  var saveBtn      = document.getElementById('dds-modal-product-save');
  var saveCloseBtn = document.getElementById('dds-modal-product-save-close');
  saveBtn.disabled = true;
  if (saveCloseBtn) saveCloseBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';
  var name     = document.getElementById('dds-prod-name').value.trim();
  var typeCode = document.getElementById('dds-prod-type').value || null;
  var notes    = document.getElementById('dds-prod-notes').value;
  try {
    if (_prodModalMode === 'edit') { DDS_CMD.execute(TX.PRODUCT_UPDATE, { id: _editProductId, name: name, type_code: typeCode, tags: _prodTags, notes: notes }, null); }
    else { DDS_CMD.execute(TX.PRODUCT_CREATE, { name: name, type_code: typeCode, tags: _prodTags, notes: notes }, null); }
    if (closeAfter) {
      DDS_PRODUCTS_UI.closeModal();
      DDS_PRODUCTS_UI.renderTable();
    } else {
      // Reset for next entry (create mode only)
      _prodTags = [];
      document.getElementById('dds-prod-name').value = '';
      document.getElementById('dds-prod-notes').value = '';
      DDS_PANEL.renderTags('dds-prod-tags-wrap', 'dds-prod-tag-input', _prodTags);
      DDS_PANEL.bindTagInput('dds-prod-tag-input', _prodTags, 'dds-prod-tags-wrap');
      saveBtn.innerHTML = 'Save';
      saveBtn.disabled = true;
      if (saveCloseBtn) saveCloseBtn.disabled = true;
      DDS_PRODUCTS_UI.renderTable();
      document.getElementById('dds-prod-name').focus();
    }
  } catch(err) {
    console.error('[DDS] Product save error:', err);
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
  }
};

DDS_PRODUCTS_UI.handleSave = function() { DDS_PRODUCTS_UI._doSave(true); };

DDS_PRODUCTS_UI.handleDelete = function(product) {
  if (!confirm('Delete product "' + product.name + '"? It will be removed from all flows and any associated product nodes.')) return;
  DDS_CMD.execute(TX.PRODUCT_DELETE, { id: product.id }, null);
  DDS_PRODUCTS_UI.renderTable();
  if (typeof DDS_MAP !== 'undefined' && DDS_MAP.state.currentMapId) {
    DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
  }
};

DDS_PRODUCTS_UI.bindEvents = function() {
  document.getElementById('dds-btn-add-product').addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return; DDS_PRODUCTS_UI.openModal(null);
  });
  document.getElementById('dds-prod-name').addEventListener('input', function() {
    var ok = !!this.value.trim();
    document.getElementById('dds-modal-product-save').disabled = !ok;
    var sc = document.getElementById('dds-modal-product-save-close');
    if (sc) sc.disabled = !ok;
  });
  document.getElementById('dds-modal-product-close').addEventListener('click',       DDS_PRODUCTS_UI.closeModal);
  document.getElementById('dds-modal-product-cancel').addEventListener('click',      DDS_PRODUCTS_UI.closeModal);
  document.getElementById('dds-modal-product-save').addEventListener('click',        function() { DDS_PRODUCTS_UI._doSave(false); });
  document.getElementById('dds-modal-product-save-close').addEventListener('click',  function() { DDS_PRODUCTS_UI._doSave(true); });
  document.getElementById('dds-modal-product-overlay').addEventListener('click', function(e) { if (e.target === this) DDS_PRODUCTS_UI.closeModal(); });
  document.getElementById('dds-modal-product-overlay').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = document.getElementById('dds-modal-product-save-close');
      if (btn && !btn.disabled) { e.preventDefault(); DDS_PRODUCTS_UI._doSave(true); }
    }
  });
  // CommWise (framework-1) legacy nav tab — fragments/app-shell.html
  // (framework-2/3) no longer has #dds-tab-products (T-052 step 5, moved
  // to the Page Strip; see DDS._registerPages in src/presentation/DDS.js
  // for the equivalent onShow-triggered renderTable() there).
  var prodTab = document.getElementById('dds-tab-products');
  if (prodTab) prodTab.addEventListener('click', function() { setTimeout(function() { DDS_PRODUCTS_UI.renderTable(); }, 50); });
};
