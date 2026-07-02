// ============================================================
// DDS_MAP_UI — map selector + toolbar wiring
// ============================================================

var DDS_MAP_UI = {};

// Render map selector for the current project
DDS_MAP_UI.renderSelector = function() {
  var sel = document.getElementById('dds-map-selector');
  if (!sel) return;

  var maps = DDS_MAP.state.maps;
  var currentMapId = DDS_MAP.state.currentMapId;

  sel.innerHTML = '';
  maps.forEach(function(map) {
    var opt = document.createElement('option');
    opt.value = map.id;
    opt.textContent = map.name;
    if (map.id === currentMapId) opt.selected = true;
    sel.appendChild(opt);
  });

  // Update delete button state
  var delBtn = document.getElementById('dds-btn-map-delete');
  if (delBtn) delBtn.disabled = maps.length <= 1;
};

// Keep renderTabs as alias for compatibility (calls renderSelector)
DDS_MAP_UI.renderTabs = DDS_MAP_UI.renderSelector;

// Switch to a different map
DDS_MAP_UI.switchMap = async function(mapId) {
  DDS_MAP.state.currentMapId = mapId;
  DDS_MAP_UI.renderSelector();
  await DDS_MAP.loadMap(mapId);
  var map = DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
  DDS_MAP_UI.updateDirectionBtn(map ? (map.direction || 'right-left') : 'right-left');
};

// Rename map inline
DDS_MAP_UI.startRename = function(tab, map) {
  var nameSpan = tab.querySelector('.dds-map-tab-name');
  nameSpan.contentEditable = 'true';
  nameSpan.focus();
  var range = document.createRange();
  range.selectNodeContents(nameSpan);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  function save() {
    nameSpan.contentEditable = 'false';
    var newName = (nameSpan.textContent || '').trim() || map.name;
    nameSpan.textContent = newName;
    if (newName !== map.name) {
      DDS_CMD.execute(TX.MAP_RENAME, { id: map.id, name: newName }, null, function() {
        map.name = newName;
      });
    }
  }
  nameSpan.addEventListener('blur', save, { once: true });
  nameSpan.addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  { e.preventDefault(); nameSpan.blur(); }
    if (e.key === 'Escape') { nameSpan.textContent = map.name; nameSpan.blur(); }
  }, { once: true });
};

// Update auto-layout button visual state
DDS_MAP_UI.updateAutoLayoutBtn = function() {
  var btn = document.getElementById('dds-btn-auto-layout');
  if (!btn) return;
  if (DDS.getAutoLayout()) {
    btn.classList.add('active');
    btn.title = 'Auto-Layout: ON (click to disable)';
  } else {
    btn.classList.remove('active');
    btn.title = 'Auto-Layout: OFF (click to enable)';
  }
};

// Update direction toggle button label to reflect current map direction
DDS_MAP_UI.updateDirectionBtn = function(direction) {
  var btn = document.getElementById('dds-btn-direction');
  if (!btn) return;
  if (direction === 'left-right') {
    btn.textContent = '→ →';
    btn.title = 'Direction: left → right (click to toggle)';
    btn.classList.add('dds-btn-direction-active');
  } else {
    btn.textContent = '← ←';
    btn.title = 'Direction: right ← left (click to toggle)';
    btn.classList.remove('dds-btn-direction-active');
  }
};

// Toggle direction on the active map
DDS_MAP_UI.toggleDirection = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  var map = DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
  if (!map) return;
  var newDir = (map.direction === 'left-right') ? 'right-left' : 'left-right';
  map.direction = newDir;
  DDS_STORE.update('maps', { id: mapId }, { direction: newDir });
  DDS_MAP_UI.updateDirectionBtn(newDir);
};

// Create a new map
DDS_MAP_UI.createMap = function() {
  DDS_CMD.execute(TX.MAP_CREATE, {}, null, function(result) {
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
    DDS_MAP_UI.switchMap(result.id);
  });
};

// Duplicate active map
DDS_MAP_UI.duplicateMap = function(srcMap) {
  DDS_CMD.execute(TX.MAP_DUPLICATE, { source_id: srcMap.id }, null, function(result) {
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
    DDS_MAP_UI.switchMap(result.id);
  });
};

// Delete active map
DDS_MAP_UI.deleteMap = function(map) {
  if (DDS_MAP.state.maps.length <= 1) return;
  DDS_CMD.execute(TX.MAP_DELETE, { id: map.id }, null, function() {
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
    var remaining = DDS_MAP.state.maps[0];
    if (remaining) DDS_MAP_UI.switchMap(remaining.id);
  });
};

// Wire toolbar buttons + tab bar
DDS_MAP_UI.bindEvents = function() {
  var fitBtn          = document.getElementById('dds-btn-fit');
  var layoutBtn       = document.getElementById('dds-btn-layout');
  var legendBtn       = document.getElementById('dds-btn-legend');
  var notesBtn        = document.getElementById('dds-btn-notes');
  var directionBtn    = document.getElementById('dds-btn-direction');
  var mapSelector     = document.getElementById('dds-map-selector');
  var renameMapBtn    = document.getElementById('dds-btn-map-rename');
  var newMapBtn       = document.getElementById('dds-btn-map-new');
  var dupMapBtn       = document.getElementById('dds-btn-map-duplicate');
  var delMapBtn       = document.getElementById('dds-btn-map-delete');
  var addSwimLaneBtn  = document.getElementById('dds-btn-add-swimlane');
  if (fitBtn)          fitBtn.addEventListener('click',       function() { DDS_MAP.fitMap(); });
  if (layoutBtn)       layoutBtn.addEventListener('click',    function() { DDS_MAP.runLayout(); });
  if (legendBtn)       legendBtn.addEventListener('click',    function() { DDS_MAP.toggleLegend(); });
  if (notesBtn)        notesBtn.addEventListener('click',     function() { if (window.DDS_NOTES_UI) DDS_NOTES_UI.toggle(); });
  if (mapSelector)     mapSelector.addEventListener('change', function() {
    var mapId = parseInt(this.value, 10);
    if (mapId && mapId !== DDS_MAP.state.currentMapId) DDS_MAP_UI.switchMap(mapId);
  });
  if (renameMapBtn)    renameMapBtn.addEventListener('click',  function() { DDS_MAP_UI.openRenameModal(); });
  if (newMapBtn)       newMapBtn.addEventListener('click',    function() { DDS_MAP_UI.createMap(); });
  if (dupMapBtn)       dupMapBtn.addEventListener('click',    function() {
    var map = DDS_MAP.state.maps.find(function(m) { return m.id === DDS_MAP.state.currentMapId; });
    if (map) DDS_MAP_UI.duplicateMap(map);
  });
  if (delMapBtn)       delMapBtn.addEventListener('click',    function() {
    var map = DDS_MAP.state.maps.find(function(m) { return m.id === DDS_MAP.state.currentMapId; });
    if (map) DDS_MAP_UI.deleteMap(map);
  });

  var autoLayoutBtn = document.getElementById('dds-btn-auto-layout');
  if (autoLayoutBtn) {
    autoLayoutBtn.addEventListener('click', function() {
      DDS.setAutoLayout(!DDS.getAutoLayout());
      DDS_MAP_UI.updateAutoLayoutBtn();
    });
  }

  var removeFromMapBtn = document.getElementById('dds-btn-remove-from-map');
  if (removeFromMapBtn) {
    removeFromMapBtn.addEventListener('click', function() {
      // Lane: not a Cytoscape element — detect via panel state
      if (DDS_PANEL.mode === 'lane' && DDS_PANEL.entityId) {
        DDS_REMOVE.open('lane', DDS_PANEL.entityId);
        return;
      }
      if (!DDS_CY) return;
      var selected = DDS_CY.elements(':selected').not('.dds-note-ghost');
      if (selected.length === 0) return;

      if (selected.length === 1) {
        var el = selected[0];
        var type = el.isNode() ? 'node' : 'edge';
        if (DDS_PANEL.mode && DDS_PANEL.entityId) {
          type = DDS_PANEL.mode === 'flow' ? 'edge' : DDS_PANEL.mode;
          DDS_REMOVE.open(type, DDS_PANEL.entityId);
        } else {
          var id = el.isNode()
            ? (el.data('annotationId') != null ? el.data('annotationId') : el.data('nodeId'))
            : el.data('flowId');
          type = el.isNode() && el.data('annotationId') != null ? 'annotation' : type;
          DDS_REMOVE.open(type, id);
        }
      } else {
        DDS_REMOVE.openMulti(selected);
      }
    });
  }

  if (directionBtn)    directionBtn.addEventListener('click', function() { DDS_MAP_UI.toggleDirection(); });
  // Undo / Redo button state — click handlers are owned by DDS_UI_NAV.bindUndoRedo()

  if (addSwimLaneBtn)  addSwimLaneBtn.addEventListener('click', function() {
    if (!DDS_STORE.getProject()) return;
    DDS_SETTINGS_UI.openModal('lane', null);
  });

  var addAnnotationBtn = document.getElementById('dds-btn-add-annotation');
  if (addAnnotationBtn) {
    addAnnotationBtn.addEventListener('click', function() {
      if (!DDS_STORE.getProject()) return;
      DDS_MAP_UI.openAnnotationModal();
    });
  }
};

// Open modal to rename the active map
DDS_MAP_UI.openRenameModal = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;
  var map = DDS_MAP.state.maps.find(function(m) { return m.id === mapId; });
  if (!map) return;

  // Create modal dynamically if it doesn't exist yet
  var overlay = document.getElementById('dds-modal-rename-map-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dds-modal-rename-map-overlay';
    overlay.className = 'dds-overlay dds-hidden';
    overlay.innerHTML = [
      '<div class="dds-modal">',
      '  <div class="dds-modal-header">',
      '    <span class="dds-modal-title">Rename Map</span>',
      '    <button class="dds-modal-close" id="dds-modal-rename-map-close">×</button>',
      '  </div>',
      '  <div class="dds-modal-body">',
      '    <label class="dds-form-label">Map name</label>',
      '    <input id="dds-rename-map-input" type="text" class="dds-input" style="width:100%" />',
      '  </div>',
      '  <div class="dds-modal-footer">',
      '    <button class="dds-btn dds-btn-secondary" id="dds-modal-rename-map-cancel">Cancel</button>',
      '    <button class="dds-btn dds-btn-primary" id="dds-modal-rename-map-save">Save</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
  }

  var input   = document.getElementById('dds-rename-map-input');
  var saveBtn = document.getElementById('dds-modal-rename-map-save');

  input.value = map.name;
  saveBtn.disabled = true;

  function validate() {
    var val = input.value.trim();
    saveBtn.disabled = !val || val === map.name;
  }
  input.oninput = validate;

  function close() { overlay.classList.remove('visible'); void overlay.offsetWidth; overlay.classList.add('dds-hidden'); }

  document.getElementById('dds-modal-rename-map-close').onclick  = close;
  document.getElementById('dds-modal-rename-map-cancel').onclick = close;

  saveBtn.onclick = function() {
    var newName = input.value.trim();
    if (!newName || newName === map.name) return;
    DDS_CMD.execute(TX.MAP_RENAME, { id: map.id, name: newName }, null, function() {
      map.name = newName;
      DDS_MAP_UI.renderSelector();
      close();
    });
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click();
    if (e.key === 'Escape') close();
  };

  overlay.classList.remove('dds-hidden');
  void overlay.offsetWidth;
  overlay.classList.add('visible');
  setTimeout(function() { input.select(); }, 50);
};

// Open modal to create a new annotation on the active map
DDS_MAP_UI.openAnnotationModal = function() {
  var mapId = DDS_MAP.state.currentMapId;
  if (!mapId) return;

  // Build modal HTML inline (reuse dds-modal pattern)
  var modal = document.getElementById('dds-annotation-create-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dds-annotation-create-modal';
    modal.className = 'dds-overlay';
    modal.innerHTML = [
      '<div class="dds-modal">',
      '  <div class="dds-modal-header"><span class="dds-modal-title">New Annotation</span>',
      '  <button class="dds-modal-close" id="dds-ann-modal-close">×</button></div>',
      '  <div class="dds-modal-body">',
      '    <label class="dds-form-label">Notes</label>',
      '    <textarea id="dds-ann-modal-notes" class="dds-input" rows="4" style="width:100%;resize:vertical" placeholder="Annotation text…"></textarea>',
      '    <label class="dds-form-label" style="margin-top:10px">Swim-lane (optional)</label>',
      '    <select id="dds-ann-modal-lane" class="dds-input" style="width:100%"><option value="">(none)</option></select>',
      '    <label class="dds-form-label" style="margin-top:10px">Tags</label>',
      '    <input id="dds-ann-modal-tags" type="text" class="dds-input" style="width:100%" placeholder="tag1, tag2">',
      '  </div>',
      '  <div class="dds-modal-footer">',
      '    <button class="dds-btn dds-btn-secondary" id="dds-ann-modal-cancel">Cancel</button>',
      '    <button class="dds-btn dds-btn-primary" id="dds-ann-modal-confirm">Add Annotation</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    document.getElementById('dds-ann-modal-close').addEventListener('click', function() {
      modal.classList.remove('visible');
    });
    document.getElementById('dds-ann-modal-cancel').addEventListener('click', function() {
      modal.classList.remove('visible');
    });
    document.getElementById('dds-ann-modal-confirm').addEventListener('click', function() {
      var notes   = document.getElementById('dds-ann-modal-notes').value;
      var laneVal = document.getElementById('dds-ann-modal-lane').value;
      var tagsRaw = document.getElementById('dds-ann-modal-tags').value;
      var tags = tagsRaw.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      var ann = DDS_ANNOTATIONS.create({
        notes: notes,
        swim_lane_id: laneVal ? parseInt(laneVal, 10) : null,
        tags: tags
      });
      if (ann) {
        DDS_ELEMENTS.addAnnotation(ann.id);
        DDS_STORE.markDirty();
      }
      modal.classList.remove('visible');
    });
  }

  // Populate swim-lane options
  var laneSelect = document.getElementById('dds-ann-modal-lane');
  laneSelect.innerHTML = '<option value="">(none)</option>';
  DDS_STORE.query('swim_lanes').forEach(function(l) {
    var opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    laneSelect.appendChild(opt);
  });

  // Reset fields
  document.getElementById('dds-ann-modal-notes').value = '';
  document.getElementById('dds-ann-modal-tags').value = '';
  laneSelect.value = '';

  modal.classList.add('visible');
};

// Called by DDS.openProject — load maps and open first one
DDS_MAP_UI.openProject = async function() {
  if (typeof DDS_AI !== 'undefined') DDS_AI.clearHistory();

  DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });

  // Safety: create Map 1 if missing
  if (DDS_MAP.state.maps.length === 0) {
    DDS_STORE.insert('maps', { name: 'Map 1', position: 1 });
    DDS_MAP.state.maps = DDS_STORE.query('maps', null, { order: 'position.asc' });
  }

  var firstMap = DDS_MAP.state.maps[0];
  DDS_MAP.state.currentMapId = firstMap.id;
  DDS_MAP_UI.renderSelector();
  await DDS_MAP.loadMap(firstMap.id);
  DDS_MAP_UI.updateDirectionBtn(firstMap.direction || 'right-left');
  DDS_MAP_UI.updateAutoLayoutBtn();
};
