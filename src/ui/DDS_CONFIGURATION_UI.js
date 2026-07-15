// AUDITOR:LARGE_BLOCK_JUSTIFIED - unified configuration controller.
// ============================================================
// DDS_CONFIGURATION_UI — Configuration tab: swim-lanes, node types, product types (all via DDS_STORE)
// Formerly DDS_SETTINGS_UI — renamed to disambiguate from the separate DDS_SETTINGS /
// Settings modal (developer toggles), see docs/DDScope_UI.md §7 vs §8, T-034.
// ============================================================

var DDS_CONFIGURATION_UI = {};
var _setMode = null, _setEditId = null, _setColor = null, _setLineColor = null, _setDirty = false;
// Color palette — use DDS_COLORS (SCRIPT 105)
var DDS_SETTINGS_SHAPES = ['rectangle','diamond','ellipse','hexagon','triangle','star','barrel','rhomboid'];

DDS_CONFIGURATION_UI._esc = function(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

DDS_CONFIGURATION_UI._table = function(type) {
  if (type === 'lane')      return 'swim_lanes';
  if (type === 'nodetype')  return 'node_types';
  if (type === 'prodtype')  return 'product_types';
  if (type === 'tagstyle')  return 'tag_styles';
  if (type === 'notecat')   return 'note_categories';
};

// Collect all tags used in the project (nodes, flows, products, skus, tag_styles)
DDS_CONFIGURATION_UI._allTags = function() {
  var seen = {};
  var add = function(arr) { (arr || []).forEach(function(t) { if (t) seen[t] = true; }); };
  var p = DDS_STORE.getProject();
  if (!p) return [];
  (p.nodes        || []).forEach(function(r) { add(r.tags); });
  (p.flows        || []).forEach(function(r) { add(r.tags); });
  (p.products     || []).forEach(function(r) { add(r.tags); });
  (p.skus         || []).forEach(function(r) { add(r.tags); });
  (p.tag_styles   || []).forEach(function(r) { if (r.tag) seen[r.tag] = true; });
  return Object.keys(seen).sort();
};

DDS_CONFIGURATION_UI.render = function() {
  var el = document.getElementById('dds-configuration-content'); if (!el) return;
  if (!DDS_STORE.getProject()) {
    el.innerHTML = '<div class="dds-empty"><div class="dds-empty-title">No project open.</div></div>'; return;
  }
  el.innerHTML =
    DDS_CONFIGURATION_UI._sectionHtml('swim-lanes',       'Swim-lanes',        'lane') +
    DDS_CONFIGURATION_UI._sectionHtml('node-types',       'Node types',        'nodetype') +
    DDS_CONFIGURATION_UI._sectionHtml('product-types',    'Product types',     'prodtype') +
    DDS_CONFIGURATION_UI._sectionHtml('tag-styles',       'Tag styles',        'tagstyle') +
    DDS_CONFIGURATION_UI._sectionHtml('note-categories',  'Note categories',   'notecat');

  DDS_CONFIGURATION_UI._cache = {
    lane:     DDS_STORE.query('swim_lanes'),
    nodetype: DDS_STORE.query('node_types'),
    prodtype: DDS_STORE.query('product_types'),
    tagstyle: DDS_STORE.query('tag_styles'),
    notecat:  DDS_STORE.query('note_categories', {}, { order: 'position.asc' })
  };

  ['lane','nodetype','prodtype','tagstyle','notecat'].forEach(function(t) { DDS_CONFIGURATION_UI._renderTable(t); });

  el.querySelectorAll('[data-add]').forEach(function(btn) {
    btn.addEventListener('click', function() { DDS_CONFIGURATION_UI.openModal(this.dataset.add, null); });
  });
};

DDS_CONFIGURATION_UI._sectionHtml = function(id, title, type) {
  return '<div class="dds-configuration-section">' +
    '<div class="dds-configuration-section-header">' +
    '<span class="dds-configuration-section-title">' + title + '</span>' +
    '<button class="dds-btn dds-btn-primary dds-btn-sm" data-add="' + type + '">+ Add</button></div>' +
    '<div id="dds-set-table-' + type + '"></div></div>';
};

DDS_CONFIGURATION_UI._renderTable = function(type) {
  var wrap = document.getElementById('dds-set-table-' + type); if (!wrap) return;
  var records = (DDS_CONFIGURATION_UI._cache && DDS_CONFIGURATION_UI._cache[type]) || [];
  if (records.length === 0) {
    wrap.innerHTML = '<div style="color:var(--dds-text-muted);font-size:var(--dds-text-sm);padding:8px 0">None yet.</div>'; return;
  }
  var html = '<table class="dds-table"><thead><tr>';
  if (type === 'notecat')  { html += '<th>Label</th><th></th>'; }
  else if (type === 'lane')     { html += '<th>Color</th><th>Name</th><th></th>'; }
  else if (type === 'tagstyle') { html += '<th>Tag</th><th>Node color</th><th>Line color</th><th>Line style</th><th>Width</th><th></th>'; }
  else {
    html += '<th>Code</th><th>Label</th><th>Shape</th>';
    if (type === 'prodtype' || type === 'nodetype') html += '<th>Color</th>';
    if (type === 'nodetype') html += '<th>Default lane</th><th>Icon</th><th>Label pos</th><th>Transp.</th>';
    html += '<th>Default</th>';
    if (type === 'nodetype') html += '<th>Product</th>';
    html += '<th></th>';
  }
  html += '</tr></thead><tbody>';
  records.forEach(function(r, idx) {
    html += '<tr>';
    if (type === 'notecat') {
      html += '<td>' + DDS_CONFIGURATION_UI._esc(r.label) + '</td>';
      html += '<td><div class="dds-table-actions">' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-move="up" data-id="' + r.id + '"' + (idx === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-move="down" data-id="' + r.id + '"' + (idx === records.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-edit="notecat" data-id="' + r.id + '">Edit</button>' +
        '<button class="dds-btn dds-btn-danger dds-btn-sm" data-del="notecat" data-id="' + r.id + '">Delete</button>' +
        '</div></td></tr>';
    } else if (type === 'lane') {
      html += '<td><span class="dds-color-dot" style="background:' + DDS_CONFIGURATION_UI._esc(r.color||'#ccc') + '"></span></td>';
      html += '<td>' + DDS_CONFIGURATION_UI._esc(r.name) + '</td>';
    } else if (type === 'tagstyle') {
      html += '<td><strong>' + DDS_CONFIGURATION_UI._esc(r.tag) + '</strong></td>';
      html += '<td>' + (r.color ? '<span class="dds-color-dot" style="background:' + DDS_CONFIGURATION_UI._esc(r.color) + '"></span>' : '<span style="color:var(--dds-text-muted)">—</span>') + '</td>';
      html += '<td>' + (r.line_color ? '<span class="dds-color-dot" style="background:' + DDS_CONFIGURATION_UI._esc(r.line_color) + '"></span>' : '<span style="color:var(--dds-text-muted)">—</span>') + '</td>';
      html += '<td>' + DDS_CONFIGURATION_UI._esc(r.line_style || '—') + '</td>';
      html += '<td>' + DDS_CONFIGURATION_UI._esc(r.line_width || '—') + '</td>';
    } else {
      html += '<td><code>' + DDS_CONFIGURATION_UI._esc(r.code) + '</code></td>';
      html += '<td>' + DDS_CONFIGURATION_UI._esc(r.label) + '</td>';
      html += '<td><span class="dds-shape-badge">' + DDS_CONFIGURATION_UI._esc(r.shape||'—') + '</span></td>';
      if (type === 'prodtype' || type === 'nodetype') html += '<td><span class="dds-color-dot" style="background:' + DDS_CONFIGURATION_UI._esc(r.color||'#ccc') + '"></span></td>';
      if (type === 'nodetype') {
        var defLane = r.default_swim_lane_id
          ? (DDS_STORE.query('swim_lanes', { id: r.default_swim_lane_id })[0] || null)
          : null;
        html += '<td>' + (defLane ? DDS_CONFIGURATION_UI._esc(defLane.name) : '<span style="color:var(--dds-text-muted)">—</span>') + '</td>';
        // Icon key
        var iconLabel = r.icon_key && window.DDS_ICONS ? (DDS_ICONS.LIBRARY[r.icon_key] ? r.icon_key : '<em style="color:var(--dds-text-muted)">unknown</em>') : '<span style="color:var(--dds-text-muted)">—</span>';
        html += '<td>' + iconLabel + '</td>';
        // Label position
        html += '<td>' + DDS_CONFIGURATION_UI._esc(r.label_position || 'center') + '</td>';
        // Transparent background
        html += '<td>' + (r.transparent_bg ? '<span class="dds-default-badge" style="background:var(--dds-accent-light,#e0f2fe);color:var(--dds-accent)">&#10003;</span>' : '') + '</td>';
      }
      html += '<td>' + (r.is_default ? '<span class="dds-default-badge">default</span>' : '') + '</td>';
      if (type === 'nodetype') {
        html += '<td>' + (r.is_product_node_default ? '<span class="dds-default-badge" style="background:var(--dds-accent-light,#e0f2fe);color:var(--dds-accent)">product</span>' : '') + '</td>';
      }
    }
    if (type !== 'notecat') {
      html += '<td><div class="dds-table-actions">' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-edit="' + type + '" data-id="' + r.id + '">Edit</button>' +
        '<button class="dds-btn dds-btn-danger dds-btn-sm" data-del="' + type + '" data-id="' + r.id + '">Delete</button>' +
        '</div></td></tr>';
    }
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-edit]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var rec = records.find(function(r) { return r.id === parseInt(btn.dataset.id); });
      if (rec) DDS_CONFIGURATION_UI.openModal(btn.dataset.edit, rec);
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(function(btn) {
    btn.addEventListener('click', function() { DDS_CONFIGURATION_UI.handleDelete(btn.dataset.del, parseInt(btn.dataset.id)); });
  });
  // Reorder buttons for notecat
  if (type === 'notecat') {
    wrap.querySelectorAll('[data-move]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        DDS_CONFIGURATION_UI._moveNoteCategory(parseInt(btn.dataset.id), btn.dataset.move);
      });
    });
  }
};

DDS_CONFIGURATION_UI.openModal = function(type, record) {
  _setMode = type; _setEditId = record ? record.id : null; _setDirty = false;
  _setColor = record ? (record.color || null) : null;
  _setLineColor = record ? (record.line_color || null) : null;
  var isLane     = type === 'lane';
  var isProd     = type === 'prodtype';
  var isTagStyle = type === 'tagstyle';
  var isNoteCat  = type === 'notecat';
  var titles = { lane: 'Swim-lane', nodetype: 'Node type', prodtype: 'Product type', tagstyle: 'Tag style', notecat: 'Note category' };
  document.getElementById('dds-modal-configuration-title').textContent = (record ? 'Edit ' : 'Add ') + titles[type];
  document.getElementById('dds-set-code-field').classList.toggle('dds-hidden', isLane || isTagStyle || isNoteCat);
  document.getElementById('dds-set-shape-field').classList.toggle('dds-hidden', isLane || isTagStyle || isNoteCat);
  document.getElementById('dds-set-color-field').classList.toggle('dds-hidden', !isLane && !isProd && !isTagStyle && type !== 'nodetype');
  document.getElementById('dds-set-default-lane-field').classList.toggle('dds-hidden', type !== 'nodetype');
  document.getElementById('dds-set-default-field').classList.toggle('dds-hidden', isLane || isTagStyle || isNoteCat);
  document.getElementById('dds-set-product-node-default-field').classList.toggle('dds-hidden', type !== 'nodetype');
  document.getElementById('dds-set-icon-field').classList.toggle('dds-hidden', type !== 'nodetype');
  document.getElementById('dds-set-label-pos-field').classList.toggle('dds-hidden', type !== 'nodetype');
  document.getElementById('dds-set-transparent-bg-field').classList.toggle('dds-hidden', type !== 'nodetype');
  if (type === 'nodetype') {
    var iconSel = document.getElementById('dds-set-icon-key');
    if (iconSel) {
      iconSel.innerHTML = '<option value="">— none —</option>';
      if (window.DDS_ICONS) {
        DDS_ICONS.list().forEach(function(ic) {
          var opt = document.createElement('option');
          opt.value = ic.key; opt.textContent = ic.key + ' — ' + ic.label;
          if (record && record.icon_key === ic.key) opt.selected = true;
          iconSel.appendChild(opt);
        });
      }
    }
    var lpSel = document.getElementById('dds-set-label-pos');
    if (lpSel) lpSel.value = record ? (record.label_position || 'center') : 'center';
    var tbEl = document.getElementById('dds-set-transparent-bg');
    if (tbEl) tbEl.checked = record ? !!record.transparent_bg : false;
  }
  // Flow style fields — only for tagstyle
  var flowFields = document.getElementById('dds-set-flow-fields');
  if (flowFields) flowFields.classList.toggle('dds-hidden', !isTagStyle);
  if (isTagStyle && record) {
    var lsEl = document.getElementById('dds-set-line-style');
    var lwEl = document.getElementById('dds-set-line-width');
    if (lsEl) lsEl.value = record.line_style || '';
    if (lwEl) lwEl.value = record.line_width || '';
  } else if (isTagStyle) {
    var lsEl2 = document.getElementById('dds-set-line-style');
    var lwEl2 = document.getElementById('dds-set-line-width');
    if (lsEl2) lsEl2.value = '';
    if (lwEl2) lwEl2.value = '';
  }
  var nameLabel = document.querySelector('label[for="dds-set-name"]');
  nameLabel.textContent = isLane ? 'Name *' : isTagStyle ? 'Tag *' : 'Label *';
  // Color swatch label
  var colorLabel = document.querySelector('label[for="dds-set-swatches"]');
  if (colorLabel) colorLabel.textContent = isTagStyle ? 'Node color' : 'Color';
  // Datalist for tag autocomplete
  var oldDl = document.getElementById('dds-set-name-datalist');
  if (oldDl) oldDl.parentNode.removeChild(oldDl);
  if (isTagStyle) {
    var dl = document.createElement('datalist');
    dl.id = 'dds-set-name-datalist';
    DDS_CONFIGURATION_UI._allTags().forEach(function(t) {
      var opt = document.createElement('option'); opt.value = t; dl.appendChild(opt);
    });
    document.body.appendChild(dl);
    document.getElementById('dds-set-name').setAttribute('list', 'dds-set-name-datalist');
  } else {
    document.getElementById('dds-set-name').removeAttribute('list');
  }
  document.getElementById('dds-set-name').value    = record ? (record.tag || record.name || record.label || '') : '';
  document.getElementById('dds-set-code').value    = record ? (record.code  || '') : '';
  document.getElementById('dds-set-shape').value   = record ? (record.shape || 'rectangle') : 'rectangle';
  document.getElementById('dds-set-default').checked = record ? !!record.is_default : false;
  var pndEl = document.getElementById('dds-set-product-node-default');
  if (pndEl) pndEl.checked = record ? !!record.is_product_node_default : false;
  // Populate default swim-lane select (node types only)
  if (type === 'nodetype') {
    var laneSelect = document.getElementById('dds-set-default-lane');
    laneSelect.innerHTML = '<option value="">— none —</option>';
    DDS_STORE.query('swim_lanes').forEach(function(sl) {
      var opt = document.createElement('option');
      opt.value = sl.id;
      opt.textContent = sl.name || ('Lane ' + sl.id);
      if (record && record.default_swim_lane_id === sl.id) opt.selected = true;
      laneSelect.appendChild(opt);
    });
  }
  if (isLane || isProd || isTagStyle || type === 'nodetype') {
    var wrap = document.getElementById('dds-set-swatches'); wrap.innerHTML = '';
    DDS_COLORS.forEach(function(c) {
      var sw = document.createElement('div');
      sw.className = 'dds-swatch' + (c === _setColor ? ' selected' : '');
      sw.style.background = c; sw.dataset.color = c;
      sw.addEventListener('click', function() {
        wrap.querySelectorAll('.dds-swatch').forEach(function(s) { s.classList.remove('selected'); });
        sw.classList.add('selected'); _setColor = c;
      });
      wrap.appendChild(sw);
    });
  }
  // Line color swatches (tag styles only)
  if (isTagStyle) {
    var lineWrap = document.getElementById('dds-set-line-swatches');
    if (lineWrap) {
      lineWrap.innerHTML = '';
      var noneSw = document.createElement('div');
      noneSw.className = 'dds-swatch' + (!_setLineColor ? ' selected' : '');
      noneSw.style.cssText = 'background:#fff;border:1px dashed #9ca3af;';
      noneSw.title = 'None';
      noneSw.addEventListener('click', function() {
        lineWrap.querySelectorAll('.dds-swatch').forEach(function(s) { s.classList.remove('selected'); });
        noneSw.classList.add('selected'); _setLineColor = null;
      });
      lineWrap.appendChild(noneSw);
      DDS_COLORS.forEach(function(c) {
        var sw2 = document.createElement('div');
        sw2.className = 'dds-swatch' + (c === _setLineColor ? ' selected' : '');
        sw2.style.background = c; sw2.dataset.color = c;
        sw2.addEventListener('click', function() {
          lineWrap.querySelectorAll('.dds-swatch').forEach(function(s) { s.classList.remove('selected'); });
          sw2.classList.add('selected'); _setLineColor = c;
        });
        lineWrap.appendChild(sw2);
      });
    }
  }
  DDS_CONFIGURATION_UI._validateModal();
  // Update button labels based on add vs edit mode
  var saveBtn      = document.getElementById('dds-modal-configuration-save');
  var saveCloseBtn = document.getElementById('dds-modal-configuration-save-close');
  if (_setEditId) {
    if (saveBtn)      { saveBtn.textContent = 'Save as New'; }
    if (saveCloseBtn) { saveCloseBtn.textContent = 'Save'; }
  } else {
    if (saveBtn)      { saveBtn.textContent = 'Save'; }
    if (saveCloseBtn) { saveCloseBtn.textContent = 'Save and Close'; }
  }
  var overlay = document.getElementById('dds-modal-configuration-overlay');
  overlay.classList.remove('dds-hidden'); void overlay.offsetWidth; overlay.classList.add('visible');
  document.getElementById('dds-set-name').focus();
};

DDS_CONFIGURATION_UI._validateModal = function() {
  var name = document.getElementById('dds-set-name').value.trim();
  var code = document.getElementById('dds-set-code').value.trim().toUpperCase();
  var needsCode = (_setMode !== 'lane' && _setMode !== 'tagstyle' && _setMode !== 'notecat');
  var baseOk = needsCode ? !!(name && code) : !!name;
  // Save and Close (or Save in edit mode) — enabled when fields are valid
  var sc = document.getElementById('dds-modal-configuration-save-close');
  if (sc) sc.disabled = !baseOk;
  // Save (add mode) / Save as New (edit mode) — also check code uniqueness in edit mode
  var saveBtn = document.getElementById('dds-modal-configuration-save');
  if (saveBtn) {
    var saveAsNewOk = baseOk;
    if (_setEditId && needsCode && code) {
      // Disable Save as New if code already exists in the table
      var table = DDS_CONFIGURATION_UI._table(_setMode);
      var existing = table ? DDS_STORE.query(table, { code: code }) : [];
      if (existing.length > 0) saveAsNewOk = false;
    }
    saveBtn.disabled = !saveAsNewOk;
  }
};

DDS_CONFIGURATION_UI._applyMapRefresh = function() {
  if (_setMode === 'nodetype' && typeof DDS_MAP !== 'undefined' && DDS_MAP.state.currentMapId) {
    DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
  }
  if (_setMode === 'tagstyle' && typeof DDS_MAP !== 'undefined') {
    DDS_MAP.applyNodeColors();
    DDS_MAP.applyFlowStyles();
    DDS_MAP.renderLegend();
  }
};

DDS_CONFIGURATION_UI.closeModal = function() {
  var overlay = document.getElementById('dds-modal-configuration-overlay');
  if (overlay) overlay.classList.remove('visible');
  // Refresh map once on close if any saves were made
  if (_setDirty) {
    _setDirty = false;
    DDS_CONFIGURATION_UI._applyMapRefresh();
  }
};

DDS_CONFIGURATION_UI._doSave = function(closeAfter) {
  var saveBtn      = document.getElementById('dds-modal-configuration-save');
  var saveCloseBtn = document.getElementById('dds-modal-configuration-save-close');
  saveBtn.disabled = true;
  if (saveCloseBtn) saveCloseBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';
  var name = document.getElementById('dds-set-name').value.trim();
  var code = document.getElementById('dds-set-code').value.trim().toUpperCase();
  var shape = document.getElementById('dds-set-shape').value;
  var isDefault = document.getElementById('dds-set-default').checked;
  var table = DDS_CONFIGURATION_UI._table(_setMode);
  var defaultLaneVal = document.getElementById('dds-set-default-lane').value;
  var defaultLaneId = defaultLaneVal ? parseInt(defaultLaneVal) : null;
  // notecat — routed through DDS_CMD, not the legacy store path
  if (_setMode === 'notecat') {
    var cats = DDS_STORE.query('note_categories', {}, { order: 'position.asc' });
    var txKey = _setEditId ? TX.NOTE_CATEGORY_UPDATE : TX.NOTE_CATEGORY_CREATE;
    var cmdParams = _setEditId
      ? { id: _setEditId, label: name }
      : { label: name, position: cats.length };
    DDS_CMD.execute(txKey, cmdParams, null);
    _setDirty = true;
    if (window.DDS_NOTES_UI) DDS_NOTES_UI.refresh();
    if (closeAfter) {
      saveBtn.innerHTML = 'Save'; saveBtn.disabled = false;
      if (saveCloseBtn) saveCloseBtn.disabled = false;
      DDS_CONFIGURATION_UI.closeModal();
      DDS_CONFIGURATION_UI.render();
    } else if (_setEditId) {
      saveBtn.innerHTML = 'Save as New'; saveBtn.disabled = false;
      if (saveCloseBtn) { saveCloseBtn.textContent = 'Save'; saveCloseBtn.disabled = false; }
      DDS_CONFIGURATION_UI.render();
      document.getElementById('dds-set-name').focus();
    } else {
      saveBtn.innerHTML = 'Save';
      DDS_CONFIGURATION_UI._validateModal();
      DDS_CONFIGURATION_UI.render();
      document.getElementById('dds-set-name').value = '';
      DDS_CONFIGURATION_UI._validateModal();
      document.getElementById('dds-set-name').focus();
    }
    return;
  }
  // lane, nodetype, prodtype — routed through DDS_CMD (Phase 2 migration)
  if (_setMode === 'lane' || _setMode === 'nodetype' || _setMode === 'prodtype') {
    DDS_CONFIGURATION_UI._doSaveCmd(closeAfter, name, code, shape, isDefault, defaultLaneId);
    return;
  }
  var record = Object.assign(
    { tag: name, color: _setColor || null },
    { line_color: _setLineColor || null },
    { line_style: (document.getElementById('dds-set-line-style') || {}).value || null },
    { line_width: (document.getElementById('dds-set-line-width') || {}).value || null }
  );
  // In edit mode, Save as New (closeAfter===false) must insert, not update
  var _forceInsert = (!closeAfter && !!_setEditId);
  try {
    if (_setEditId && !_forceInsert) {
      DDS_STORE.update(table, { id: _setEditId }, record);
    } else {
      DDS_STORE.insert(table, record);
    }
    _setDirty = true;
    if (closeAfter) {
      saveBtn.innerHTML = 'Save';
      saveBtn.disabled = false;
      if (saveCloseBtn) saveCloseBtn.disabled = false;
      DDS_CONFIGURATION_UI.closeModal(); // closeModal handles map refresh via _setDirty
      DDS_CONFIGURATION_UI.render();
    } else if (_setEditId) {
      // Save as New (edit mode) — the insert already ran above as a new record.
      // Find the newly created record by tag and pivot _setEditId to it.
      var newRecords = DDS_STORE.query(table);
      var newRec = null;
      for (var ni = newRecords.length - 1; ni >= 0; ni--) {
        if (newRecords[ni].tag === record.tag) { newRec = newRecords[ni]; break; }
      }
      if (newRec) _setEditId = newRec.id;
      saveBtn.innerHTML = 'Save as New';
      if (saveCloseBtn) saveCloseBtn.textContent = 'Save';
      saveBtn.disabled = false;
      if (saveCloseBtn) saveCloseBtn.disabled = false;
      DDS_CONFIGURATION_UI._validateModal();
      DDS_CONFIGURATION_UI.render();
      document.getElementById('dds-set-name').focus();
    } else {
      saveBtn.innerHTML = 'Save';
      DDS_CONFIGURATION_UI._validateModal();
      DDS_CONFIGURATION_UI.render();
      document.getElementById('dds-set-name').value = '';
      DDS_CONFIGURATION_UI._validateModal();
      document.getElementById('dds-set-name').focus();
    }
  } catch(err) {
    console.error('[DDS] Configuration save error:', err);
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
  }
};

// lane, nodetype, prodtype save path — routed through DDS_CMD (Phase 2)
DDS_CONFIGURATION_UI._doSaveCmd = function(closeAfter, name, code, shape, isDefault, defaultLaneId) {
  var saveBtn      = document.getElementById('dds-modal-configuration-save');
  var saveCloseBtn = document.getElementById('dds-modal-configuration-save-close');
  var forceInsert  = (!closeAfter && !!_setEditId);
  var txKey, fields, params;
  if (_setMode === 'lane') {
    txKey  = (_setEditId && !forceInsert) ? TX.LANE_UPDATE : TX.LANE_CREATE;
    fields = { name: name, color: _setColor || '#6b7280' };
    params = Object.assign({ id: _setEditId }, fields);
  } else {
    txKey  = (_setMode === 'nodetype') ? TX.CONFIGURATION_NODE_TYPE : TX.CONFIGURATION_PRODUCT_TYPE;
    fields = Object.assign({ code: code, label: name, shape: shape, is_default: isDefault },
      _setMode === 'prodtype' ? { color: _setColor || '#6b7280' } : {},
      _setMode === 'nodetype' ? {
        color: _setColor || null,
        default_swim_lane_id: defaultLaneId,
        is_product_node_default: !!(document.getElementById('dds-set-product-node-default') || {}).checked,
        icon_key:        ((document.getElementById('dds-set-icon-key') || {}).value) || null,
        label_position:  ((document.getElementById('dds-set-label-pos') || {}).value) || 'center',
        transparent_bg:  !!(document.getElementById('dds-set-transparent-bg') || {}).checked
      } : {});
    params = { id: _setEditId, forceInsert: forceInsert, fields: fields };
  }
  var result;
  try {
    // T-036 part 4: no more auto-placement on the active map from this CRUD
    // modal — that untransacted DDS_STORE.insert('map_swim_lanes', ...) call
    // (never undoable) was replaced by the dedicated `+ Swim-lane` toolbar
    // modal (DDS_LANE_UI), which places via TX.LANE_CREATE(mapId) /
    // TX.MAP_ADD_LANE. This Configuration tab modal is pure lane management
    // now — mapId is never passed (params has no mapId argument below).
    result = DDS_CMD.execute(txKey, params, null);
  } catch (err) {
    console.error('[DDS] Configuration save error:', err);
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
    return;
  }
  if (!result || !result.ok) {
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
    return;
  }
  _setDirty = true;
  if (closeAfter) {
    saveBtn.innerHTML = 'Save';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
    DDS_CONFIGURATION_UI.closeModal(); // closeModal handles map refresh via _setDirty
    DDS_CONFIGURATION_UI.render();
  } else if (_setEditId) {
    // Save as New (edit mode) — DDS_CMD returns the new record's id directly
    if (result.id) { _setEditId = result.id; }
    saveBtn.innerHTML = 'Save as New';
    if (saveCloseBtn) saveCloseBtn.textContent = 'Save';
    saveBtn.disabled = false;
    if (saveCloseBtn) saveCloseBtn.disabled = false;
    DDS_CONFIGURATION_UI._validateModal();
    DDS_CONFIGURATION_UI.render();
    document.getElementById('dds-set-name').focus();
  } else {
    saveBtn.innerHTML = 'Save';
    DDS_CONFIGURATION_UI._validateModal();
    DDS_CONFIGURATION_UI.render();
    document.getElementById('dds-set-name').value = '';
    if (!document.getElementById('dds-set-code-field').classList.contains('dds-hidden')) {
      document.getElementById('dds-set-code').value = '';
    }
    DDS_CONFIGURATION_UI._validateModal();
    document.getElementById('dds-set-name').focus();
  }
};

DDS_CONFIGURATION_UI.handleSave = function() { DDS_CONFIGURATION_UI._doSave(true); }; // Save (edit) / Save and Close (add)

DDS_CONFIGURATION_UI.handleDelete = function(type, id) {
  if (!confirm('Delete this entry?')) return;
  if (type === 'notecat') {
    DDS_CMD.execute(TX.NOTE_CATEGORY_DELETE, { id: id }, null);
    DDS_CONFIGURATION_UI.render();
    if (window.DDS_NOTES_UI) DDS_NOTES_UI.refresh();
    return;
  }
  if (type === 'lane') {
    // Full cascade via DDS_CMD (delegates to DDS_MODEL.deleteSwimLane): removes
    // all assigned nodes (with full cascade), all map_swim_lanes refs across all
    // maps, clears default_swim_lane_id on node_types, then deletes the record.
    DDS_CMD.execute(TX.LANE_DELETE, { id: id }, null, function() {
      if (typeof DDS_MAP !== 'undefined' && DDS_MAP.state.currentMapId) {
        DDS_MAP.loadMap(DDS_MAP.state.currentMapId, true);
      }
    });
  } else {
    DDS_STORE.remove(DDS_CONFIGURATION_UI._table(type), { id: id });
    if (typeof DDS_MAP !== 'undefined' && DDS_MAP.state.currentMapId) {
      if (type === 'tagstyle') {
        DDS_MAP.applyNodeColors();
        DDS_MAP.applyFlowStyles();
        DDS_MAP.renderLegend();
      }
    }
  }
  DDS_CONFIGURATION_UI.render();
};

DDS_CONFIGURATION_UI._moveNoteCategory = function(id, direction) {
  var cats = DDS_STORE.query('note_categories', {}, { order: 'position.asc' });
  var idx = cats.findIndex(function(c) { return c.id === id; });
  if (idx < 0) return;
  var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= cats.length) return;
  var order = cats.map(function(c, i) {
    if (i === idx)     return { id: c.id, position: cats[swapIdx].position };
    if (i === swapIdx) return { id: c.id, position: cats[idx].position };
    return { id: c.id, position: c.position };
  });
  DDS_CMD.execute(TX.NOTE_CATEGORY_REORDER, { order: order }, null);
  DDS_CONFIGURATION_UI.render();
  if (window.DDS_NOTES_UI) DDS_NOTES_UI.refresh();
};

DDS_CONFIGURATION_UI.bindEvents = function() {
  // CommWise (framework-1) legacy nav tab — see DDS_PRODUCTS_UI.bindEvents
  // for the framework-2/3 equivalent (DDS._registerPages onShow).
  var configTab = document.getElementById('dds-tab-configuration');
  if (configTab) configTab.addEventListener('click', function() { setTimeout(function() { DDS_CONFIGURATION_UI.render(); }, 50); });
  document.getElementById('dds-set-name').addEventListener('input', DDS_CONFIGURATION_UI._validateModal);
  document.getElementById('dds-set-code').addEventListener('input', DDS_CONFIGURATION_UI._validateModal);
  document.getElementById('dds-modal-configuration-close').addEventListener('click',       DDS_CONFIGURATION_UI.closeModal);
  document.getElementById('dds-modal-configuration-cancel').addEventListener('click',      DDS_CONFIGURATION_UI.closeModal);
  document.getElementById('dds-modal-configuration-save').addEventListener('click',        function() { DDS_CONFIGURATION_UI._doSave(false); });
  document.getElementById('dds-modal-configuration-save-close').addEventListener('click',  function() { DDS_CONFIGURATION_UI._doSave(true); });
  document.getElementById('dds-modal-configuration-overlay').addEventListener('click', function(e) { if (e.target === this) DDS_CONFIGURATION_UI.closeModal(); });
  document.getElementById('dds-modal-configuration-overlay').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = document.getElementById('dds-modal-configuration-save-close');
      if (btn && !btn.disabled) { e.preventDefault(); DDS_CONFIGURATION_UI._doSave(true); }
    }
  });
};
