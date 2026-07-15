// ============================================================
// DDS_NODES_UI — table + modal
// ============================================================

var DDS_NODES_UI = {};
var _nodeModalMode = 'create', _editNodeId = null, _nodeTags = [];

DDS_NODES_UI._esc = function(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

DDS_NODES_UI.renderTable = function() {
  var wrap = document.getElementById('dds-nodes-table-wrap');
  if (!wrap) return;
  if (!DDS_STORE.getProject()) {
    wrap.innerHTML = '<div class="dds-table-empty">No project open.</div>';
    return;
  }
  var nodes     = DDS_STORE.query('nodes');
  var lanes     = DDS_STORE.query('swim_lanes');
  var nodeTypes = DDS_STORE.query('node_types');

  var laneMap = {};
  lanes.forEach(function(l) { laneMap[l.id] = l.name; });
  var typeMap = {};
  nodeTypes.forEach(function(t) { typeMap[t.code] = t.label || t.code; });

  if (nodes.length === 0) {
    wrap.innerHTML = '<div class="dds-table-empty">No nodes yet — add one from the map or click &ldquo;+ Node&rdquo;.</div>';
    return;
  }

  var html = '<table class="dds-table"><thead><tr>' +
    '<th>Name</th><th>Type</th><th>Swim-lane</th><th>Tags</th>' +
    '</tr></thead><tbody>';

  nodes.forEach(function(n) {
    var tagsHtml = (n.tags || []).map(function(t) {
      return '<span class="dds-table-tag">' + DDS_NODES_UI._esc(t) + '</span>';
    }).join('');
    var laneLabel = n.swim_lane_id ? (laneMap[n.swim_lane_id] || '—') : '—';
    var typeLabel = n.type_code    ? (typeMap[n.type_code]    || n.type_code) : '—';

    html += '<tr data-node-id="' + n.id + '" style="cursor:pointer" title="Click to edit in the side panel">' +
      '<td><strong>' + DDS_NODES_UI._esc(n.name) + '</strong></td>' +
      '<td>' + DDS_NODES_UI._esc(typeLabel) + '</td>' +
      '<td>' + DDS_NODES_UI._esc(laneLabel) + '</td>' +
      '<td>' + (tagsHtml || '<span style="color:var(--dds-text-muted)">—</span>') + '</td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;

  // Row click (RFC step 4, T-052) — opens the node in the side panel, same
  // editor as the equivalent canvas selection. Deletion goes through the
  // Toolbar row's Remove button (DDS_MAP_UI.js), same as a canvas
  // selection — no more per-row Delete button here.
  wrap.querySelectorAll('tr[data-node-id]').forEach(function(row) {
    row.addEventListener('click', function() {
      var id = parseInt(this.dataset.nodeId);
      if (window.DDS_PANEL) DDS_PANEL.openNodeById(id);
    });
  });
};

DDS_NODES_UI.openModal = function(node) {
  _nodeModalMode = node ? 'edit' : 'create';
  _editNodeId    = node ? node.id : null;
  _nodeTags      = node && Array.isArray(node.tags) ? node.tags.slice() : [];

  document.getElementById('dds-modal-node-title').textContent = node ? 'Edit node' : 'Add node';
  document.getElementById('dds-modal-node-save').textContent  = node ? 'Save' : 'Add';
  document.getElementById('dds-node-name').value  = node ? (node.name  || '') : '';
  document.getElementById('dds-node-notes').value = node ? (node.notes || '') : '';

  // Populate type select
  var typeEl = document.getElementById('dds-node-type');
  typeEl.innerHTML = '<option value="">— no type —</option>';
  DDS_STORE.query('node_types').forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.code;
    opt.textContent = t.label || t.code;
    if (node && t.code === node.type_code) opt.selected = true;
    typeEl.appendChild(opt);
  });

  // Populate swim-lane select
  var laneEl = document.getElementById('dds-node-lane');
  laneEl.innerHTML = '<option value="">— no swim-lane —</option>';
  DDS_STORE.query('swim_lanes').forEach(function(l) {
    var opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    if (node && node.swim_lane_id === l.id) opt.selected = true;
    laneEl.appendChild(opt);
  });

  // Tags widget (reuse DDS_PANEL helpers)
  DDS_PANEL.renderTags('dds-node-tags-wrap', 'dds-node-tag-input', _nodeTags);
  DDS_PANEL.bindTagInput('dds-node-tag-input', _nodeTags, 'dds-node-tags-wrap');

  var _hasName = !!(node && node.name);
  document.getElementById('dds-modal-node-save').disabled = !_hasName;
  var _scBtn = document.getElementById('dds-modal-node-save-close');
  if (_scBtn) _scBtn.disabled = !_hasName;

  var overlay = document.getElementById('dds-modal-node-overlay');
  overlay.classList.remove('dds-hidden');
  void overlay.offsetWidth;
  overlay.classList.add('visible');
  document.getElementById('dds-node-name').focus();
};

DDS_NODES_UI.closeModal = function() {
  var overlay = document.getElementById('dds-modal-node-overlay');
  if (overlay) overlay.classList.remove('visible');
};

DDS_NODES_UI._doSave = function(closeAfter) {
  var saveBtn      = document.getElementById('dds-modal-node-save');
  var saveCloseBtn = document.getElementById('dds-modal-node-save-close');
  saveBtn.disabled = true;
  if (saveCloseBtn) saveCloseBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';

  var name      = document.getElementById('dds-node-name').value.trim();
  var typeCode  = document.getElementById('dds-node-type').value || null;
  var laneVal   = document.getElementById('dds-node-lane').value;
  var laneId    = laneVal ? parseInt(laneVal) : null;
  var notes     = document.getElementById('dds-node-notes').value;

  try {
    if (_nodeModalMode === 'edit') {
      var updateResult = DDS_CMD.execute(TX.NODE_UPDATE, {
        id: _editNodeId, name: name, type_code: typeCode, swim_lane_id: laneId,
        tags: _nodeTags.slice(), notes: notes
      }, null);
      if (!updateResult.ok) throw new Error('DDS_CMD NODE_UPDATE failed');
    } else {
      var createResult = DDS_CMD.execute(TX.NODE_CREATE, {
        name: name, type_code: typeCode, swim_lane_id: laneId,
        tags: _nodeTags.slice(), notes: notes
      }, null);
      if (!createResult.ok) throw new Error('DDS_CMD NODE_CREATE failed');
    }
    if (closeAfter) {
      DDS_NODES_UI.closeModal();
      DDS_NODES_UI.renderTable();
    } else {
      // Reset for next entry (create mode only)
      _nodeTags = [];
      document.getElementById('dds-node-name').value = '';
      document.getElementById('dds-node-notes').value = '';
      DDS_PANEL.renderTags('dds-node-tags-wrap', 'dds-node-tag-input', _nodeTags);
      DDS_PANEL.bindTagInput('dds-node-tag-input', _nodeTags, 'dds-node-tags-wrap');
      saveBtn.innerHTML = 'Save';
      saveBtn.disabled = true;
      if (saveCloseBtn) saveCloseBtn.disabled = true;
      DDS_NODES_UI.renderTable();
      document.getElementById('dds-node-name').focus();
    }
  } catch (err) {
    console.error('[DDS] Node save error:', err);
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
  }
};

DDS_NODES_UI.handleSave = function() { DDS_NODES_UI._doSave(true); };

// Deletion moved to the Toolbar row's Remove button (T-052 step 4) — it
// already handles the cascade-consequences confirmation (DDS_REMOVE.js),
// now also reachable with no cy element via DDS_PANEL.mode/entityId when
// a row is open in the side panel.

DDS_NODES_UI.bindEvents = function() {
  // Toolbar button (Nodes table view)
  document.getElementById('dds-btn-add-node-table').addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_NODES_UI.openModal(null);
  });

  // Name input — enable/disable Save + Save & Close
  document.getElementById('dds-node-name').addEventListener('input', function() {
    var ok = !!this.value.trim();
    document.getElementById('dds-modal-node-save').disabled = !ok;
    var sc = document.getElementById('dds-modal-node-save-close');
    if (sc) sc.disabled = !ok;
  });

  // Modal controls
  document.getElementById('dds-modal-node-close').addEventListener('click',       DDS_NODES_UI.closeModal);
  document.getElementById('dds-modal-node-cancel').addEventListener('click',      DDS_NODES_UI.closeModal);
  document.getElementById('dds-modal-node-save').addEventListener('click',        function() { DDS_NODES_UI._doSave(false); });
  document.getElementById('dds-modal-node-save-close').addEventListener('click',  function() { DDS_NODES_UI._doSave(true); });
  document.getElementById('dds-modal-node-overlay').addEventListener('click', function(e) {
    if (e.target === this) DDS_NODES_UI.closeModal();
  });
  document.getElementById('dds-modal-node-overlay').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = document.getElementById('dds-modal-node-save-close');
      if (btn && !btn.disabled) { e.preventDefault(); DDS_NODES_UI._doSave(true); }
    }
  });

  // Auto-render on tab switch — CommWise (framework-1) legacy nav tab.
  // See DDS_PRODUCTS_UI.bindEvents for the framework-2/3 equivalent
  // (DDS._registerPages onShow).
  var nodesTab = document.getElementById('dds-tab-nodes');
  if (nodesTab) nodesTab.addEventListener('click', function() {
    setTimeout(function() { DDS_NODES_UI.renderTable(); }, 50);
  });
};
