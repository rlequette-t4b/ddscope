// JS: DDS_NOTES_UI — notes panel below the map canvas
// Depends on: DDS_STORE (SCRIPT 150), DDS_CMD (SCRIPT 1875), TX (SCRIPT 1865)
// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive UI module with shared private state

var DDS_NOTES_UI = (function () {

  // Kanban card palette — 8 pastel colors [border, bg-tint]
  var _PALETTE = [
    ['#4a90d9', 'rgba(74,144,217,0.06)'],
    ['#27ae60', 'rgba(39,174,96,0.06)'],
    ['#e67e22', 'rgba(230,126,34,0.06)'],
    ['#8e44ad', 'rgba(142,68,173,0.06)'],
    ['#e74c3c', 'rgba(231,76,60,0.06)'],
    ['#16a085', 'rgba(22,160,133,0.06)'],
    ['#d4ac0d', 'rgba(212,172,13,0.06)'],
    ['#2c3e50', 'rgba(44,62,80,0.06)']
  ];

  // In-memory collapsed state per category (not persisted)
  var _collapsed = {};
  // Show all categories toggle — not persisted, reset on load()
  var _showAllCategories = false;
  // Active map id
  var _mapId = null;
  // Resize drag state
  var _resizing = false;
  var _resizeStartY = 0;
  var _resizeStartH = 0;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _panel() { return document.getElementById('dds-notes-panel'); }
  function _body()  { return document.getElementById('dds-notes-body'); }

  // Notes visible on the active map for a given category
  function _notesForCategory(categoryId) {
    if (!_mapId) {
      return DDS_STORE.query('notes', { category_id: categoryId }, { order: 'position.asc' });
    }
    var mapNoteIds = DDS_STORE.query('map_notes', { map_id: _mapId }).map(function (mn) { return mn.note_id; });
    return DDS_STORE.query('notes', { category_id: categoryId }, { order: 'position.asc' })
      .filter(function (n) { return mapNoteIds.indexOf(n.id) !== -1; });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function render() {
    var body = _body();
    if (!body) return;
    var project = DDS_STORE.getProject();
    if (!project) {
      body.innerHTML = '<div style="color:var(--dds-text-muted);font-size:var(--dds-text-sm)">No project open.</div>';
      return;
    }
    var categories = DDS_STORE.query('note_categories', {}, { order: 'position.asc' });
    if (categories.length === 0) {
      body.innerHTML = '<div style="color:var(--dds-text-muted);font-size:var(--dds-text-sm)">No note categories yet. Add them in Settings.</div>';
      return;
    }

    // B3 — filter out categories with no visible notes on the active map (unless show-all mode)
    var visibleCategories = _showAllCategories ? categories : categories.filter(function (cat) {
      return _notesForCategory(cat.id).length > 0;
    });

    // Update show-all button appearance
    var showAllBtn = document.getElementById('dds-notes-show-all');
    if (showAllBtn) {
      showAllBtn.classList.toggle('active', _showAllCategories);
      showAllBtn.title = _showAllCategories
        ? 'Showing all categories — click to show only categories with notes'
        : 'Show all categories (including empty ones)';
    }

    body.innerHTML = '';

    if (visibleCategories.length === 0) {
      body.innerHTML = '<div style="color:var(--dds-text-muted);font-size:var(--dds-text-sm)">No notes on this map yet. Click &quot;+ note&quot; in a category to add one.</div>';
      return;
    }

    visibleCategories.forEach(function (cat, catIdx) {
      var palette = _PALETTE[catIdx % _PALETTE.length];
      var cardBorder = palette[0];
      var cardBg    = palette[1];
      var notes = _notesForCategory(cat.id);
      var isCatCollapsed = !!_collapsed[cat.id];

      var section = document.createElement('div');
      section.className = 'dds-notes-category';
      section.dataset.catId = cat.id;

      // Category header — I2: bold label, full header clickable
      var header = document.createElement('div');
      header.className = 'dds-notes-category-header';
      header.title = 'Click to collapse / expand';
      header.innerHTML =
        '<span class="dds-notes-category-toggle">' + (isCatCollapsed ? '▶' : '▼') + '</span>' +
        '<span class="dds-notes-category-label">' + _esc(cat.label) + '</span>' +
        '<span class="dds-notes-category-count">' + notes.length + '</span>';
      header.addEventListener('click', function () {
        _collapsed[cat.id] = !_collapsed[cat.id];
        render();
      });
      section.appendChild(header);

      // Notes list
      var list = document.createElement('div');
      list.className = 'dds-notes-list' + (isCatCollapsed ? ' collapsed' : '');

      notes.forEach(function (note) {
        var row = _buildNoteRow(note, cat.id, cardBorder, cardBg);
        list.appendChild(row);
      });

      // I3: distinct add note button
      var addBtn = document.createElement('button');
      addBtn.className = 'dds-notes-add-btn';
      addBtn.textContent = '+ Add note';
      addBtn.addEventListener('click', function () { _addNote(cat.id); });
      list.appendChild(addBtn);

      // Init SortableJS after list is in DOM
      if (!isCatCollapsed) {
        _initSortable(list, cat.id);
      }

      section.appendChild(list);
      body.appendChild(section);
    });
  }

  function _buildNoteRow(note, categoryId, cardBorder, cardBg) {
    var row = document.createElement('div');
    row.className = 'dds-note-row';
    row.dataset.noteId = note.id;
    row.dataset.categoryId = categoryId;
    if (cardBorder) { row.style.borderLeftColor = cardBorder; }
    if (cardBg)     { row.style.background = cardBg; }

    // Drag handle
    var handle = document.createElement('span');
    handle.className = 'dds-note-drag-handle';
    handle.textContent = '☰';
    handle.title = 'Drag to reorder';

    // Content wrapper
    var content = document.createElement('div');
    content.className = 'dds-note-content';

    // Display mode
    var display = document.createElement('div');
    display.className = 'dds-note-display';
    display.textContent = note.content || '';

    // Edit mode — textarea
    var text = document.createElement('textarea');
    text.className = 'dds-note-text';
    text.value = note.content || '';
    text.rows = 1;

    function _autoResize() {
      text.style.height = 'auto';
      text.style.height = text.scrollHeight + 'px';
    }
    text.addEventListener('input', _autoResize);

    text.addEventListener('blur', function () {
      var newContent = text.value.trim();
      // B2 — discard empty note on blur if content was never set
      if (!newContent && !(note.content || '').trim()) {
        DDS_CMD.execute(TX.NOTE_DELETE, { id: note.id }, null);
        render();
        return;
      }
      if (newContent !== (note.content || '').trim()) {
        DDS_CMD.execute(TX.NOTE_UPDATE, { id: note.id, content: newContent }, null);
        note.content = newContent;
      }
      display.textContent = note.content || '';
      row.classList.remove('editing');
    });

    text.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        text.blur();
      }
      if (e.key === 'Escape') {
        text.value = note.content || '';
        text.blur();
      }
    });

    // Click on display to enter edit mode
    display.addEventListener('click', function () {
      row.classList.add('editing');
      text.style.height = 'auto';
      text.style.height = text.scrollHeight + 'px';
      text.focus();
      text.setSelectionRange(text.value.length, text.value.length);
    });

    content.appendChild(display);
    content.appendChild(text);

    // Delete button
    var delBtn = document.createElement('button');
    delBtn.className = 'dds-note-delete-btn';
    delBtn.title = 'Delete note';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', function () { _deleteNote(note.id); });

    row.appendChild(handle);
    row.appendChild(content);
    row.appendChild(delBtn);
    return row;
  }

  function _initSortable(listEl, categoryId) {
    if (!window.Sortable) return;
    Sortable.create(listEl, {
      handle: '.dds-note-drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      // Exclude the add-note button from draggable items
      draggable: '.dds-note-row',
      onEnd: function (evt) {
        var notes = DDS_STORE.query('notes', { category_id: categoryId }, { order: 'position.asc' });
        var ids = Array.from(listEl.querySelectorAll('.dds-note-row')).map(function (el) { return el.dataset.noteId; });
        var order = ids.map(function (id, i) {
          var n = notes.find(function (n) { return n.id === id; });
          return { id: id, position: n ? n.position : i };
        });
        // Re-assign positions by sorted index
        var sorted = notes.slice().sort(function (a, b) { return a.position - b.position; });
        var newOrder = ids.map(function (id, i) {
          return { id: id, position: sorted[i] ? sorted[i].position : i };
        });
        DDS_CMD.execute(TX.NOTE_REORDER, { order: newOrder }, null);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Note operations
  // ---------------------------------------------------------------------------

  function _addNote(categoryId) {
    var notes = _notesForCategory(categoryId);
    var result = DDS_CMD.execute(TX.NOTE_CREATE, {
      category_id: categoryId,
      content: '',
      position: notes.length
    }, _mapId);
    render();
    if (result && result.id) {
      var ta = _body() && _body().querySelector('[data-note-id="' + result.id + '"] .dds-note-text');
      if (ta) { ta.focus(); }
    }
  }

  function _deleteNote(noteId) {
    DDS_CMD.execute(TX.NOTE_DELETE, { id: noteId }, null);
    render();
  }

  function _moveNote(noteId, categoryId, direction) {
    var notes = DDS_STORE.query('notes', { category_id: categoryId }, { order: 'position.asc' });
    var idx = notes.findIndex(function (n) { return n.id === noteId; });
    if (idx < 0) return;
    var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= notes.length) return;
    var order = notes.map(function (n, i) {
      if (i === idx)     return { id: n.id, position: notes[swapIdx].position };
      if (i === swapIdx) return { id: n.id, position: notes[idx].position };
      return { id: n.id, position: n.position };
    });
    DDS_CMD.execute(TX.NOTE_REORDER, { order: order }, null);
    render();
  }

  // ---------------------------------------------------------------------------
  // Panel show/hide — controlled by Notes toolbar button
  // ---------------------------------------------------------------------------

  function toggle() {
    if (!_mapId) return;
    var panel = _panel();
    if (!panel) return;
    // Use DOM class as source of truth — always in sync with what the user sees
    var isVisible = !panel.classList.contains('dds-hidden');
    var next = !isVisible;
    // Persist to store (same pattern as legend_visible)
    DDS_STORE.update('maps', { id: _mapId }, { notes_panel_visible: next });
    if (next) {
      show();
    } else {
      hide();
    }
    // Resize canvas after panel visibility change
    setTimeout(function () {
      if (window.DDS_CY) DDS_CY.resize();
      if (window.DDS_MAP) DDS_MAP.fitMap();
    }, 50);
  }

  // ---------------------------------------------------------------------------
  // Panel resize
  // ---------------------------------------------------------------------------

  function _initResize() {
    var handle = document.querySelector('#dds-notes-panel .dds-notes-header');
    if (!handle) return;
    var _viewMapTop = 0;

    handle.addEventListener('mousedown', function (e) {
      // Ignore clicks on buttons inside the header (e.g. Show all)
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      _resizing = true;
      _resizeStartY = e.clientY;
      _resizeStartH = _panel().offsetHeight;
      // Capture the total height of the view container once at drag start
      var viewMap = document.getElementById('dds-view-map');
      _viewMapTop = viewMap ? viewMap.offsetHeight : 400;
      e.preventDefault();
    });

    var _lastClientY = 0;
    var _rafPending = false;

    document.addEventListener('mousemove', function (e) {
      if (!_resizing) return;
      _lastClientY = e.clientY;
      if (_rafPending) return;
      _rafPending = true;
      requestAnimationFrame(function () {
        _rafPending = false;
        var panel = _panel();
        if (!panel) return;
        var available = _viewMapTop;
        var maxH = Math.max(80, available - 37 - 8);
        var delta = _resizeStartY - _lastClientY;
        var newH = Math.max(36, Math.min(maxH, _resizeStartH + delta));
        panel.style.height = newH + 'px';
        var canvasH = available - newH;
        var wrap = document.getElementById('dds-canvas-wrap');
        if (wrap) {
          wrap.style.height = canvasH + 'px';
          wrap.style.maxHeight = '';
        }
        var viewMap = document.getElementById('dds-view-map');
        if (viewMap) viewMap.style.maxHeight = '';
        // DDS_CY.resize() intentionally omitted here — called only on mouseup to prevent canvas flicker
      });
    });

    document.addEventListener('mouseup', function () {
      if (_resizing) {
        _resizing = false;
        var viewMap = document.getElementById('dds-view-map');
        if (viewMap) viewMap.style.maxHeight = '';
        var wrap = document.getElementById('dds-canvas-wrap');
        if (wrap) wrap.style.height = '';
        if (window.DDS_CY) DDS_CY.resize();
        if (window.DDS_MAP) DDS_MAP.fitMap();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // B1 — Settings refresh: re-render when categories change
  // Called by DDS_CONFIGURATION_UI after any notecat save/delete/reorder
  // ---------------------------------------------------------------------------

  function refresh() {
    render();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function load(mapId) {
    _mapId = mapId || null;
    _showAllCategories = false; // I6 — reset on map switch

    // Restore panel visibility and height from map state
    if (_mapId) {
      var maps = DDS_STORE.query('maps', { id: _mapId });
      if (maps.length) {
        var mapState = maps[0];
        // notes_panel_visible: default false (hidden)
        if (mapState.notes_panel_visible) {
          show();
          // Restore persisted height if any
          if (mapState.notes_panel_height) {
            var p = _panel();
            if (p) p.style.height = mapState.notes_panel_height + 'px';
          }
          // Re-fit after panel is visible and sized — same pattern as toggle/resize
          setTimeout(function () {
            if (window.DDS_CY) DDS_CY.resize();
            if (window.DDS_MAP) DDS_MAP.fitMap();
          }, 50);
        } else {
          hide();
        }
      } else {
        hide();
      }
    } else {
      hide();
    }

    render();
  }

  function init() {
    _initResize();

    // I6 — Show all categories toggle
    var showAllBtn = document.getElementById('dds-notes-show-all');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _showAllCategories = !_showAllCategories;
        render();
      });
    }

    // Hide panel until project open
    var panel = _panel();
    if (panel) panel.classList.add('dds-hidden');
  }

  function show() {
    var panel = _panel();
    if (panel) panel.classList.remove('dds-hidden');
  }

  function hide() {
    var panel = _panel();
    if (panel) panel.classList.add('dds-hidden');
  }

  return {
    init:    init,
    load:    load,
    render:  render,
    refresh: refresh,
    show:    show,
    hide:    hide,
    toggle:  toggle
  };

})();

window.DDS_NOTES_UI = DDS_NOTES_UI;
