// AUDITOR:LARGE_BLOCK_JUSTIFIED - cohesive SKU demand sub-section renderer, must handle create/update/delete/show-on-map in one place.
// ============================================================
// DDS_PANEL — SKU demand sub-section renderer
// ============================================================
// _renderSkuDemand(rowEl, nodeId, productId)
// Appended to each SKU row in openNode().
// Shows badge if demand exists, expandable sub-section with
// CTT fields, demand fields, Show on map / Hide from map,
// Delete demand. No demand → shows + Demand button.
// ============================================================

var UNITS = ['hours','days','weeks','months','years'];

DDS_PANEL._renderSkuDemand = function(rowEl, nodeId, productId) {
  var mapId  = DDS_MAP.state.currentMapId;
  var demand = DDS_STORE.query('demands', { node_id: nodeId, product_id: productId })[0] || null;

  // ---- Badge ----
  var badge = document.createElement('span');
  badge.className = 'dds-demand-badge' + (demand ? ' has-demand' : ' no-demand');
  badge.title = demand ? 'Demand recorded' : 'No demand';
  badge.textContent = demand ? '●' : '○'; // filled / empty circle
  rowEl.querySelector('.dds-sku-name').appendChild(badge);

  // ---- + Demand button (no demand) ----
  if (!demand) {
    var addBtn = document.createElement('button');
    addBtn.className = 'dds-btn dds-btn-ghost dds-btn-sm dds-demand-add-btn';
    addBtn.textContent = '+ Demand';
    addBtn.addEventListener('click', function() {
      DDS_CMD.execute(TX.DEMAND_CREATE, { node_id: nodeId, product_id: productId }, null, function() {
        // Re-render the entire SKU row area by refreshing the panel
        DDS_PANEL._refreshNodeSkus(nodeId);
      });
    });
    rowEl.appendChild(addBtn);
    return;
  }

  // ---- Expand toggle ----
  var subSection = document.createElement('div');
  subSection.className = 'dds-demand-sub dds-hidden';

  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'dds-btn dds-btn-ghost dds-btn-sm dds-demand-toggle';
  toggleBtn.textContent = 'CTT / Demand ▾';
  toggleBtn.addEventListener('click', function() {
    var hidden = subSection.classList.toggle('dds-hidden');
    toggleBtn.textContent = 'CTT / Demand ' + (hidden ? '▾' : '▴');
  });
  rowEl.appendChild(toggleBtn);
  rowEl.appendChild(subSection);

  // ---- Helper: unit select ----
  function _unitSelect(selectedUnit) {
    var sel = document.createElement('select');
    sel.className = 'dds-demand-unit';
    UNITS.forEach(function(u) {
      var opt = document.createElement('option');
      opt.value = u; opt.textContent = u;
      if (u === selectedUnit) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  // ---- CTT row ----
  var cttRow = document.createElement('div'); cttRow.className = 'dds-demand-row';
  var cttLabel = document.createElement('label'); cttLabel.textContent = 'CTT';
  var cttVal = document.createElement('input');
  cttVal.type = 'number'; cttVal.min = '0'; cttVal.step = 'any';
  cttVal.className = 'dds-demand-val';
  cttVal.value = demand.ctt_value != null ? demand.ctt_value : '';
  var cttUnit = _unitSelect(demand.ctt_unit || 'days');

  var _saveCtt = function() {
    DDS_CMD.execute(TX.DEMAND_UPDATE, {
      node_id: nodeId, product_id: productId,
      ctt_value: cttVal.value !== '' ? parseFloat(cttVal.value) : null,
      ctt_unit:  cttUnit.value
    }, null, function() {
      if (typeof DDS_MAP.renderCTTOverlays === 'function') {
        DDS_MAP.renderCTTOverlays(DDS_MAP.state.currentMapId);
      }
    });
  };
  cttVal.addEventListener('blur',    _saveCtt);
  cttUnit.addEventListener('change', _saveCtt);
  cttRow.appendChild(cttLabel); cttRow.appendChild(cttVal); cttRow.appendChild(cttUnit);
  subSection.appendChild(cttRow);

  // ---- Demand row ----
  var dRow = document.createElement('div'); dRow.className = 'dds-demand-row';
  var dLabel = document.createElement('label'); dLabel.textContent = 'Demand';
  var dVal = document.createElement('input');
  dVal.type = 'number'; dVal.min = '0'; dVal.step = 'any';
  dVal.className = 'dds-demand-val';
  dVal.value = demand.demand_value != null ? demand.demand_value : '';
  var dPeriod = _unitSelect(demand.demand_period || 'weeks');
  var dPeriodLabel = document.createElement('span');
  dPeriodLabel.className = 'dds-demand-period-label';
  dPeriodLabel.textContent = '/ ';

  var _saveDemand = function() {
    DDS_CMD.execute(TX.DEMAND_UPDATE, {
      node_id: nodeId, product_id: productId,
      demand_value:  dVal.value !== '' ? parseFloat(dVal.value) : null,
      demand_period: dPeriod.value
    }, null);
  };
  dVal.addEventListener('blur',      _saveDemand);
  dPeriod.addEventListener('change', _saveDemand);
  dRow.appendChild(dLabel); dRow.appendChild(dVal);
  dRow.appendChild(dPeriodLabel); dRow.appendChild(dPeriod);
  subSection.appendChild(dRow);

  // ---- Notes row ----
  var nRow = document.createElement('div'); nRow.className = 'dds-demand-row';
  var nLabel = document.createElement('label'); nLabel.textContent = 'Notes';
  var nArea = document.createElement('textarea');
  nArea.className = 'dds-demand-notes'; nArea.rows = 2;
  nArea.value = demand.notes || '';
  nArea.addEventListener('blur', function() {
    DDS_CMD.execute(TX.DEMAND_UPDATE, { node_id: nodeId, product_id: productId, notes: this.value }, null);
  });
  nRow.appendChild(nLabel); nRow.appendChild(nArea);
  subSection.appendChild(nRow);

  // ---- Actions row ----
  var aRow = document.createElement('div'); aRow.className = 'dds-demand-actions';

  // Show / Hide on map button
  var mapBtn = document.createElement('button');
  mapBtn.className = 'dds-btn dds-btn-sm';
  var _isOnMap = mapId ? (DDS_STORE.query('map_demands', { demand_id: demand.id, map_id: mapId }).length > 0) : false;
  mapBtn.textContent = _isOnMap ? 'Hide from map' : 'Show on map';
  mapBtn.classList.add(_isOnMap ? 'dds-btn-secondary' : 'dds-btn-primary');
  mapBtn.addEventListener('click', function() {
    if (!mapId) return;
    var onMap = (DDS_STORE.query('map_demands', { demand_id: demand.id, map_id: mapId }).length > 0);
    var txKey = onMap ? TX.MAP_HIDE_DEMAND : TX.MAP_SHOW_DEMAND;
    DDS_CMD.execute(txKey, { demand_id: demand.id }, mapId, function() {
      if (onMap) {
        mapBtn.textContent = 'Show on map';
        mapBtn.classList.replace('dds-btn-secondary', 'dds-btn-primary');
      } else {
        mapBtn.textContent = 'Hide from map';
        mapBtn.classList.replace('dds-btn-primary', 'dds-btn-secondary');
      }
      if (typeof DDS_MAP.renderCTTOverlays === 'function') {
        DDS_MAP.renderCTTOverlays(mapId);
      }
    });
  });
  aRow.appendChild(mapBtn);

  // Delete demand button
  var delBtn = document.createElement('button');
  delBtn.className = 'dds-btn dds-btn-sm dds-btn-danger';
  delBtn.textContent = 'Delete demand';
  delBtn.addEventListener('click', function() {
    if (!confirm('Delete demand for this SKU?')) return;
    DDS_CMD.execute(TX.DEMAND_DELETE, { node_id: nodeId, product_id: productId }, null, function() {
      if (typeof DDS_MAP.renderCTTOverlays === 'function') {
        DDS_MAP.renderCTTOverlays(DDS_MAP.state.currentMapId);
      }
      DDS_PANEL._refreshNodeSkus(nodeId);
    });
  });
  aRow.appendChild(delBtn);
  subSection.appendChild(aRow);
};

// Refresh only the SKU section of the node panel (avoids full panel close/reopen)
DDS_PANEL._refreshNodeSkus = function(nodeId) {
  var cyNode = DDS_CY && DDS_CY.$('#n' + nodeId);
  if (cyNode && cyNode.length) {
    DDS_PANEL.openNode(cyNode[0]);
  }
};
