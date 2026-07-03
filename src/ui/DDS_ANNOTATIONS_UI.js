// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive table-view module for annotations.
// ============================================================
// DDS_ANNOTATIONS_UI — Annotations table view
// ============================================================
// Spec: DDScope_UI.md §2.7
// Flat list of all project annotations, not filtered by map.
// Inline edit: notes, swim-lane (selector), tags.
// Delete: full project delete with cascade.

var DDS_ANNOTATIONS_UI = (function () {

  var api = {};

  // ---- helpers -------------------------------------------------------

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _laneOptions(selectedId) {
    var lanes = DDS_STORE.query('swim_lanes');
    var html = '<option value="">(none)</option>';
    lanes.forEach(function (l) {
      html += '<option value="' + l.id + '"' + (l.id === selectedId ? ' selected' : '') + '>' + _esc(l.name) + '</option>';
    });
    return html;
  }

  // ---- render --------------------------------------------------------

  api.load = function () {
    var container = document.getElementById('dds-annotations-view');
    if (!container) return;
    if (!DDS_STORE.getProject()) {
      container.innerHTML = '<p class="dds-table-empty">No project open.</p>';
      return;
    }
    api.refresh();
  };

  api.refresh = function () {
    var container = document.getElementById('dds-annotations-view');
    if (!container || !DDS_STORE.getProject()) return;

    var annotations = DDS_STORE.query('annotations');

    if (annotations.length === 0) {
      container.innerHTML = '<p class="dds-table-empty">No annotations in this project.</p>';
      return;
    }

    var html = '<table class="dds-table">';
    html += '<thead><tr>';
    html += '<th style="width:55%">Notes</th>';
    html += '<th style="width:20%">Swim-lane</th>';
    html += '<th style="width:20%">Tags</th>';
    html += '<th style="width:5%"></th>';
    html += '</tr></thead><tbody>';

    annotations.forEach(function (ann) {
      var laneRec = ann.swim_lane_id ? DDS_STORE.query('swim_lanes', { id: ann.swim_lane_id })[0] : null;
      var laneDisplay = laneRec ? _esc(laneRec.name) : '';
      var tagsDisplay = (ann.tags || []).join(', ');
      var notesPreview = (ann.notes || '').replace(/\n/g, ' ').substring(0, 80);

      html += '<tr data-ann-id="' + ann.id + '">';

      // Notes cell — inline textarea
      html += '<td>';
      html += '<textarea class="dds-inline-edit dds-ann-notes" rows="2" data-ann-id="' + ann.id + '">' + _esc(ann.notes || '') + '</textarea>';
      html += '</td>';

      // Swim-lane cell — select
      html += '<td>';
      html += '<select class="dds-inline-select dds-ann-lane" data-ann-id="' + ann.id + '">' + _laneOptions(ann.swim_lane_id) + '</select>';
      html += '</td>';

      // Tags cell — inline input
      html += '<td>';
      html += '<input type="text" class="dds-inline-edit dds-ann-tags" value="' + _esc(tagsDisplay) + '" data-ann-id="' + ann.id + '" placeholder="tag1, tag2">';
      html += '</td>';

      // Delete button
      html += '<td>';
      html += '<button class="dds-icon-btn dds-ann-delete" data-ann-id="' + ann.id + '" title="Delete annotation">×</button>';
      html += '</td>';

      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
    _bindEvents(container);
  };

  // ---- events --------------------------------------------------------

  function _bindEvents(container) {
    // Notes: save on blur
    container.querySelectorAll('.dds-ann-notes').forEach(function (el) {
      el.addEventListener('blur', function () {
        var id = parseInt(el.dataset.annId, 10);
        // T-023: routed via DDS_CMD (was untransacted DDS_ANNOTATIONS.update)
        DDS_CMD.execute(TX.ANNOTATION_UPDATE, { id: id, notes: el.value });
      });
    });

    // Swim-lane: save on change
    container.querySelectorAll('.dds-ann-lane').forEach(function (el) {
      el.addEventListener('change', function () {
        var id = parseInt(el.dataset.annId, 10);
        var laneId = el.value ? parseInt(el.value, 10) : null;
        // T-023: routed via DDS_CMD (was untransacted DDS_ANNOTATIONS.update)
        DDS_CMD.execute(TX.ANNOTATION_UPDATE, { id: id, swim_lane_id: laneId });
      });
    });

    // Tags: save on blur
    container.querySelectorAll('.dds-ann-tags').forEach(function (el) {
      el.addEventListener('blur', function () {
        var id = parseInt(el.dataset.annId, 10);
        var tags = el.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        // T-023: routed via DDS_CMD (was untransacted DDS_ANNOTATIONS.update)
        DDS_CMD.execute(TX.ANNOTATION_UPDATE, { id: id, tags: tags });
      });
    });

    // Delete — routed through DDS_CMD (Phase 2 migration)
    container.querySelectorAll('.dds-ann-delete').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = parseInt(el.dataset.annId, 10);
        if (!confirm('Delete this annotation? This will remove it from all maps.')) return;
        DDS_CMD.execute(TX.ANNOTATION_DELETE, { id: id }, null, function () {
          // Remove ghost from Cytoscape canvas if on active map
          if (typeof DDS_CY !== 'undefined' && DDS_CY) {
            var ghost = DDS_CY.$('#ann-' + id);
            if (ghost && ghost.length) ghost.remove();
          }
        });
        api.refresh();
      });
    });
  }

  api.bindEvents = function() {
    var tab = document.getElementById('dds-tab-annotations');
    if (tab) {
      tab.addEventListener('click', function() {
        setTimeout(function() { api.load(); }, 50);
      });
    }
  };

  return api;

}());
