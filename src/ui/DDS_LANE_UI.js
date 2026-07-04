// ============================================================
// DDS_LANE_UI — swim-lane search/create modal (map toolbar)
//
// T-036 part 4: the map `+ Swim-lane` button used to open the Configuration
// tab's CRUD modal directly (DDS_CONFIGURATION_UI.openModal('lane', null)),
// which only ever creates a brand-new lane and — when a map is active —
// placed it via a direct, untransacted DDS_STORE.insert('map_swim_lanes', ...)
// (never undoable, same class of gap fixed for nodes/flows in T-036 parts
// 1/3). This module replaces that call site with a dedicated search/create
// modal, mirroring DDS_NODE_UI's `+ Node` modal pattern:
//   — existing lane already on active map → shown grayed "(on map)", not
//     selectable;
//   — existing lane not on active map → place it via TX.MAP_ADD_LANE
//     (undoable);
//   — no exact match → `+ Create "[name]"` → TX.LANE_CREATE with mapId
//     (color swatch shown only in this case).
// Exact-name matches suppress the create entry — duplicate lane names are
// avoided by construction, same as the node modal.
//
// The Configuration tab's own "+ Add" button for swim-lanes is untouched —
// it still opens DDS_CONFIGURATION_UI's CRUD modal directly (pure lane
// management, no map dimension, mapId never passed).
// ============================================================

var DDS_LANE_UI = {};

// { id: int, name } existing lane (not on map) | { id: null, name } create | null
DDS_LANE_UI._selectedLane = null;
DDS_LANE_UI._createColor = null;

DDS_LANE_UI.injectModal = function() {
  var existing = document.getElementById('dds-map-lane-overlay');
  if (existing) existing.parentNode.removeChild(existing);
  var html = [
    '<div class="dds-overlay dds-hidden" id="dds-map-lane-overlay">',
    '  <div class="dds-modal" style="max-width:420px">',
    '    <div class="dds-modal-header">',
    '      <span class="dds-modal-title">Add swim-lane</span>',
    '      <button class="dds-btn dds-modal-close" id="dds-map-lane-close">&times;</button>',
    '    </div>',
    '    <div class="dds-modal-body">',
    '      <div class="dds-field" style="position:relative">',
    '        <label class="dds-label" for="dds-map-lane-input">Swim-lane *</label>',
    '        <input class="dds-input" id="dds-map-lane-input" type="text" placeholder="Search or create..." autocomplete="off" />',
    '        <div id="dds-map-lane-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--dds-border-light,#e2e8f0);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:9999;max-height:200px;overflow-y:auto"></div>',
    '      </div>',
    '      <div class="dds-field dds-hidden" id="dds-map-lane-color-field">',
    '        <label class="dds-label">Color</label>',
    '        <div id="dds-map-lane-swatches"></div>',
    '      </div>',
    '    </div>',
    '    <div class="dds-modal-footer">',
    '      <button class="dds-btn dds-btn-secondary" id="dds-map-lane-cancel">Cancel</button>',
    '      <button class="dds-btn dds-btn-secondary" id="dds-map-lane-save" disabled>Save</button>',
    '      <button class="dds-btn dds-btn-primary" id="dds-map-lane-save-close" disabled>Save &amp; Close</button>',
    '    </div></div></div>'
  ].join('\n');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  document.body.appendChild(tmp.firstElementChild);

  document.getElementById('dds-map-lane-close').addEventListener('click', function() { DDS_LANE_UI.closeModal(); });
  document.getElementById('dds-map-lane-cancel').addEventListener('click', function() { DDS_LANE_UI.closeModal(); });
  document.getElementById('dds-map-lane-save').addEventListener('click', function() { DDS_LANE_UI._doSave(false); });
  document.getElementById('dds-map-lane-save-close').addEventListener('click', function() { DDS_LANE_UI._doSave(true); });
  document.getElementById('dds-map-lane-overlay').addEventListener('click', function(e) {
    if (e.target === this) DDS_LANE_UI.closeModal();
  });
  // Enter = Save & Close
  document.getElementById('dds-map-lane-overlay').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = document.getElementById('dds-map-lane-save-close');
      if (btn && !btn.disabled) { e.preventDefault(); DDS_LANE_UI._doSave(true); }
    }
  });
};

DDS_LANE_UI.openModal = function() {
  DDS_LANE_UI.injectModal();
  DDS_LANE_UI._selectedLane = null;
  DDS_LANE_UI._createColor = null;

  document.getElementById('dds-map-lane-color-field').classList.add('dds-hidden');

  var input = document.getElementById('dds-map-lane-input');
  input.value = '';
  DDS_LANE_UI._setButtons(null);
  DDS_LANE_UI._hideDropdown();

  input.oninput = function() { DDS_LANE_UI._onInput(this.value); };
  input.onblur  = function() { setTimeout(DDS_LANE_UI._hideDropdown, 150); };

  var overlay = document.getElementById('dds-map-lane-overlay');
  overlay.classList.remove('dds-hidden');
  void overlay.offsetWidth;
  overlay.classList.add('visible');
  input.focus();
};

// Set save-button labels and enabled state from the current selection.
// sel: null (nothing selected) | { id: int } (existing → "Add to map") |
//      { id: null } (create → "Save").
DDS_LANE_UI._setButtons = function(sel) {
  var saveBtn      = document.getElementById('dds-map-lane-save');
  var saveCloseBtn = document.getElementById('dds-map-lane-save-close');
  var disabled = !sel;
  saveBtn.disabled = disabled;
  saveCloseBtn.disabled = disabled;
  if (sel && sel.id !== null) {
    saveBtn.textContent = 'Add to map';
    saveCloseBtn.innerHTML = 'Add &amp; Close';
  } else {
    saveBtn.textContent = 'Save';
    saveCloseBtn.innerHTML = 'Save &amp; Close';
  }
};

DDS_LANE_UI._renderSwatches = function() {
  var wrap = document.getElementById('dds-map-lane-swatches');
  wrap.innerHTML = '';
  DDS_COLORS.forEach(function(c) {
    var sw = document.createElement('div');
    sw.className = 'dds-swatch' + (c === DDS_LANE_UI._createColor ? ' selected' : '');
    sw.style.background = c; sw.dataset.color = c;
    sw.addEventListener('click', function() {
      wrap.querySelectorAll('.dds-swatch').forEach(function(s) { s.classList.remove('selected'); });
      sw.classList.add('selected');
      DDS_LANE_UI._createColor = c;
    });
    wrap.appendChild(sw);
  });
};

DDS_LANE_UI._onInput = function(val) {
  val = val.trim();
  DDS_LANE_UI._selectedLane = null;
  DDS_LANE_UI._setButtons(null);
  document.getElementById('dds-map-lane-color-field').classList.add('dds-hidden');

  var dropdown = document.getElementById('dds-map-lane-dropdown');
  var lanes = DDS_STORE.query('swim_lanes');
  var lower = val.toLowerCase();
  var matches = val ? lanes.filter(function(l) {
    return (l.name || '').toLowerCase().indexOf(lower) !== -1;
  }) : lanes;

  var onMapIds = DDS_STORE.query('map_swim_lanes', { map_id: DDS_MAP.state.currentMapId })
    .map(function(r) { return r.swim_lane_id; });

  dropdown.innerHTML = '';
  var items = [];

  matches.forEach(function(l) {
    items.push({ id: l.id, name: l.name, isNew: false, onMap: onMapIds.indexOf(l.id) !== -1, color: l.color });
  });

  var exactMatch = lanes.find(function(l) {
    return (l.name || '').toLowerCase() === lower;
  });
  if (val && !exactMatch) {
    items.push({ id: null, name: val, isNew: true, onMap: false, color: null });
  }

  if (items.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  items.forEach(function(item) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:var(--dds-text-sm);border-bottom:1px solid var(--dds-border-light,#f1f5f9)';
    if (item.isNew) {
      div.textContent = '+ Create "' + item.name + '"';
      div.style.color = 'var(--dds-accent)';
    } else {
      div.textContent = item.name + (item.onMap ? ' (on map)' : '');
    }
    if (item.onMap) {
      // Already on the active map — grayed, not selectable
      div.style.color = 'var(--dds-text-muted,#94a3b8)';
      div.style.cursor = 'default';
    } else {
      div.onmousedown = function() {
        DDS_LANE_UI._selectedLane = { id: item.id, name: item.name };
        document.getElementById('dds-map-lane-input').value = item.name;
        DDS_LANE_UI._hideDropdown();
        DDS_LANE_UI._setButtons(DDS_LANE_UI._selectedLane);
        // Color swatch only for the create case
        var colorField = document.getElementById('dds-map-lane-color-field');
        colorField.classList.toggle('dds-hidden', !item.isNew);
        if (item.isNew) {
          DDS_LANE_UI._createColor = null;
          DDS_LANE_UI._renderSwatches();
        }
      };
      div.onmouseover = function() { this.style.background = 'var(--dds-bg-hover,#f8fafc)'; };
      div.onmouseout  = function() { this.style.background = ''; };
    }
    dropdown.appendChild(div);
  });

  dropdown.style.display = 'block';
};

DDS_LANE_UI._hideDropdown = function() {
  var d = document.getElementById('dds-map-lane-dropdown');
  if (d) d.style.display = 'none';
};

DDS_LANE_UI.closeModal = function() {
  var overlay = document.getElementById('dds-map-lane-overlay');
  if (overlay) overlay.classList.remove('visible');
  DDS_LANE_UI._hideDropdown();
  DDS_LANE_UI._selectedLane = null;
};

// _doSave: shared logic for Save (closeAfter=false) and Save & Close (closeAfter=true).
// Selection required: { id: int } → TX.MAP_ADD_LANE (place existing lane);
// { id: null } → TX.LANE_CREATE with mapId (create and place).
DDS_LANE_UI._doSave = function(closeAfter) {
  var sel = DDS_LANE_UI._selectedLane;
  if (!sel) return;

  var saveBtn      = document.getElementById('dds-map-lane-save');
  var saveCloseBtn = document.getElementById('dds-map-lane-save-close');
  saveBtn.disabled = true;
  saveCloseBtn.disabled = true;
  saveBtn.innerHTML = '<span class="dds-spinner"></span>';

  var mapId = DDS_MAP.state.currentMapId;

  function onSuccess(cmdResult) {
    // Render the swim-lane DOM overlay + reload the map so the lane appears
    // (mirrors DDS_CONFIGURATION_UI._doSaveCmd's post-create refresh).
    DDS_MAP.loadMap(mapId, true);
    if (typeof DDS_SWIMLANES !== 'undefined') DDS_SWIMLANES.render();

    if (closeAfter) {
      DDS_LANE_UI.closeModal();
    } else {
      // Reset for next entry
      DDS_LANE_UI._selectedLane = null;
      document.getElementById('dds-map-lane-input').value = '';
      document.getElementById('dds-map-lane-color-field').classList.add('dds-hidden');
      DDS_LANE_UI._hideDropdown();
      saveBtn.innerHTML = 'Save';
      DDS_LANE_UI._setButtons(null);
      document.getElementById('dds-map-lane-input').focus();
    }
  }

  var result;
  if (sel.id !== null) {
    // Existing lane not on map → place it
    result = DDS_CMD.execute(TX.MAP_ADD_LANE, { swim_lane_id: sel.id }, mapId, onSuccess);
  } else {
    // Create and place
    result = DDS_CMD.execute(TX.LANE_CREATE, {
      name: sel.name, color: DDS_LANE_UI._createColor || '#6b7280'
    }, mapId, onSuccess);
  }

  if (!result.ok) {
    console.error('[DDS] Add swim-lane error');
    saveBtn.textContent = 'Error — retry';
    saveBtn.disabled = false;
    saveCloseBtn.disabled = false;
  }
};

DDS_LANE_UI.bindEvents = function() {
  var btn = document.getElementById('dds-btn-add-swimlane');
  if (btn) btn.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_LANE_UI.openModal();
  });
};
