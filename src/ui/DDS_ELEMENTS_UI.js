// ============================================================
// DDS_ELEMENTS_UI — panel + events (all via DDS_STORE)
// ============================================================

var DDS_ELEMENTS_UI = {};
var _elemPanelOpen = false;

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

DDS_ELEMENTS_UI.mountPanel = function() {
  var wrap = document.getElementById('dds-canvas-wrap');
  var panel = document.getElementById('dds-elements-panel');
  var ctx   = document.getElementById('dds-ctx-remove');
  // Panel goes inside canvas-wrap for overlay positioning
  if (wrap && panel && panel.parentNode !== wrap) wrap.appendChild(panel);
  // Context menu stays in body to avoid transform/overflow clipping from canvas-wrap
  if (ctx && ctx.parentNode !== document.body) document.body.appendChild(ctx);
  // Delete modal overlay also stays in body
  var delOverlay = document.getElementById('dds-delete-modal-overlay');
  if (delOverlay && delOverlay.parentNode !== document.body) document.body.appendChild(delOverlay);
};

DDS_ELEMENTS_UI.toggle = function() {
  _elemPanelOpen = !_elemPanelOpen;
  var panel = document.getElementById('dds-elements-panel');
  if (panel) panel.classList.toggle('open', _elemPanelOpen);
  if (_elemPanelOpen) DDS_ELEMENTS_UI.render();
};

DDS_ELEMENTS_UI.close = function() {
  _elemPanelOpen = false;
  var panel = document.getElementById('dds-elements-panel');
  if (panel) panel.classList.remove('open');
};

DDS_ELEMENTS_UI.render = function() {
  var body = document.getElementById('dds-elements-panel-body'); if (!body) return;
  if (!DDS_STORE.getProject()) { body.innerHTML = '<div class="dds-elements-empty">No project open.</div>'; return; }

  var nodeIdsOnMap = DDS_ELEMENTS.nodeIdsOnMap();
  var flowIdsOnMap = DDS_ELEMENTS.flowIdsOnMap();
  var laneIdsOnMap = DDS_ELEMENTS.laneIdsOnMap();

  var offNodes = DDS_STORE.query('nodes').filter(function(n) { return !nodeIdsOnMap.includes(n.id); });
  var offFlows = DDS_STORE.query('flows').filter(function(f) { return !flowIdsOnMap.includes(f.id); });
  var offLanes = DDS_STORE.query('swim_lanes').filter(function(sl) { return !laneIdsOnMap.includes(sl.id); });

  if (offNodes.length === 0 && offFlows.length === 0 && offLanes.length === 0) {
    body.innerHTML = '<div class="dds-elements-empty">All elements are on this map.</div>'; return;
  }

  var nodeById = {};
  DDS_STORE.query('nodes').forEach(function(n) { nodeById[n.id] = n; });

  var html = '';

  if (offNodes.length > 0) {
    html += '<div class="dds-elements-group"><div class="dds-elements-group-title">Nodes (' + offNodes.length + ')</div></div>';
    offNodes.forEach(function(n) {
      html += '<div class="dds-elements-item" data-type="node" data-id="' + n.id + '">' +
        '<span class="dds-elements-item-name">' + _esc(n.name || '(unnamed)') + '</span>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-add-type="node" data-id="' + n.id + '">Add</button></div>';
    });
  }

  if (offFlows.length > 0) {
    html += '<div class="dds-elements-group"><div class="dds-elements-group-title">Flows (' + offFlows.length + ')</div></div>';
    offFlows.forEach(function(f) {
      var eligible = DDS_ELEMENTS.flowEligible(f, nodeIdsOnMap);
      var srcName = (nodeById[f.source_node_id] || {}).name || '?';
      var tgtName = (nodeById[f.target_node_id] || {}).name || '?';
      html += '<div class="dds-elements-item' + (eligible ? '' : ' disabled') + '">' +
        '<div><div class="dds-elements-item-name">' + _esc(srcName) + ' → ' + _esc(tgtName) + '</div>' +
        (!eligible ? '<div class="dds-elements-item-hint">Endpoint nodes not on map</div>' : '') + '</div>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-add-type="flow" data-id="' + f.id + '"' +
          (eligible ? '' : ' disabled') + '>Add</button></div>';
    });
  }

  if (offLanes.length > 0) {
    html += '<div class="dds-elements-group"><div class="dds-elements-group-title">Swim-lanes (' + offLanes.length + ')</div></div>';
    offLanes.forEach(function(sl) {
      html += '<div class="dds-elements-item">' +
        '<span class="dds-elements-item-name">' + _esc(sl.name || 'Lane') + '</span>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" data-add-type="lane" data-id="' + sl.id + '">Add</button></div>';
    });
  }

  body.innerHTML = html;

  body.querySelectorAll('[data-add-type]').forEach(function(btn) {
    if (btn.disabled) return;
    btn.addEventListener('click', function() {
      var id = parseInt(this.dataset.id), type = this.dataset.addType;
      btn.disabled = true;
      try {
        if (type === 'node') DDS_ELEMENTS.addNode(id);
        if (type === 'flow') DDS_ELEMENTS.addFlow(id);
        if (type === 'lane') DDS_ELEMENTS.addLane(id);
        DDS_ELEMENTS_UI.render();
      } catch(err) { console.error('[DDS] Add element error:', err); btn.disabled = false; }
    });
  });
};

var _ctxTarget = null;

DDS_ELEMENTS_UI.showRemoveBtn = function(type, entityId, screenX, screenY) {
  _ctxTarget = { type: type, id: entityId };
  var btn = document.getElementById('dds-ctx-remove'); if (!btn) return;
  btn.style.left = (screenX + 8) + 'px'; btn.style.top = (screenY + 8) + 'px';
  btn.classList.add('visible');
};

DDS_ELEMENTS_UI.hideRemoveBtn = function() {
  var btn = document.getElementById('dds-ctx-remove'); if (btn) btn.classList.remove('visible');
  _ctxTarget = null;
};

DDS_ELEMENTS_UI.bindEvents = function() {
  var elemBtn = document.getElementById('dds-btn-elements');
  if (elemBtn) elemBtn.addEventListener('click', function() { DDS_ELEMENTS_UI.toggle(); });
  var closeBtn = document.getElementById('dds-elements-panel-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { DDS_ELEMENTS_UI.close(); });

  var removeBtn = document.getElementById('dds-ctx-remove-btn');
  if (removeBtn) removeBtn.addEventListener('click', function() {
    if (!_ctxTarget) return;
    try {
      if (_ctxTarget.type === 'node') DDS_ELEMENTS.removeNode(_ctxTarget.id);
      if (_ctxTarget.type === 'edge') DDS_ELEMENTS.removeFlow(_ctxTarget.id);
    } catch(err) { console.error('[DDS] Remove error:', err); }
    DDS_ELEMENTS_UI.hideRemoveBtn();
    if (_elemPanelOpen) DDS_ELEMENTS_UI.render();
  });



  function wireCyElements() {
    if (!DDS_CY) return;
    DDS_CY.on('select', 'node', function(e) {
      var pos = e.renderedPosition || e.position;
      var wrap = document.getElementById('dds-canvas-wrap') || {};
      DDS_ELEMENTS_UI.showRemoveBtn('node', e.target.data('nodeId'), pos.x + (wrap.offsetLeft || 0), pos.y + (wrap.offsetTop || 0));
    });
    DDS_CY.on('select', 'edge', function(e) {
      var pos = e.renderedPosition || e.position;
      var wrap = document.getElementById('dds-canvas-wrap') || {};
      DDS_ELEMENTS_UI.showRemoveBtn('edge', e.target.data('flowId'), pos.x + (wrap.offsetLeft || 0), pos.y + (wrap.offsetTop || 0));
    });
    DDS_CY.on('unselect tap', function() {
      setTimeout(function() { if (DDS_CY && DDS_CY.elements(':selected').length === 0) DDS_ELEMENTS_UI.hideRemoveBtn(); }, 100);
    });
  }

  if (DDS_MAP.state.cytoscapeReady) { wireCyElements(); }
  else { document.addEventListener('dds-cytoscape-ready', wireCyElements, { once: true }); }
  document.addEventListener('dds-cytoscape-ready', function() { DDS_ELEMENTS_UI.mountPanel(); }, { once: true });
};
