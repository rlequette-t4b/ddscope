// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive module: panel DOM, listener, view toggle, clear, export, collapse.
// ============================================================
// DDS_ACTIONS_LOG - live actions log panel (push layout, right side)
// Listens to BOTH DDS_ACTIONS (legacy) and DDS_CMD (migrated domains) in
// parallel during the DDS_CMD migration. Each entry is tagged with its
// source so the correct describe() function is used at render time.
// Once migration is complete, the DDS_ACTIONS branch will be decommissioned
// (see DDScope_Commands.md §0 and TODO T-015).
// ============================================================

var DDS_ACTIONS_LOG = (function () {

  var _entries   = [];   // { ts, actions, source: 'actions'|'cmd' }[]
  var _jsonMode  = false;
  var _collapsed = false;
  var _panel     = null;
  var _listenerActions = null;
  var _listenerCmd     = null;

  // --- Helpers ---
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _ts() {
    var d = new Date(), p = function(n) { return n < 10 ? '0' + n : String(n); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function _describe(entry) {
    return entry.source === 'cmd' ? DDS_CMD.describe(entry.actions) : DDS_ACTIONS.describe(entry.actions);
  }

  // --- Panel creation (injected into .dds-workspace as last flex child) ---
  function _createPanel() {
    var el = document.createElement('div');
    el.id = 'dds-actions-log-panel';
    el.innerHTML =
      '<div class="dds-log-header">' +
        '<span class="dds-log-title">Actions log</span>' +
        '<span class="dds-log-count" id="dds-log-count">0</span>' +
        '<button class="dds-log-collapse-btn" id="dds-log-collapse" title="Collapse / expand">&#8250;</button>' +
      '</div>' +
      '<div class="dds-log-toolbar">' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" id="dds-log-toggle-view">Labels</button>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" id="dds-log-clear">Clear</button>' +
        '<button class="dds-btn dds-btn-secondary dds-btn-sm" id="dds-log-export">Export</button>' +
      '</div>' +
      '<div class="dds-log-entries" id="dds-log-entries">' +
        '<div class="dds-log-empty">No actions logged yet.</div>' +
      '</div>';

    // Insert at the END of .dds-workspace so it sits on the right
    var workspace = document.getElementById('dds-workspace');
    if (workspace) workspace.appendChild(el);
    else document.body.appendChild(el);

    _panel = el;
    _bindPanelEvents();
  }

  function _bindPanelEvents() {
    // Collapse / expand
    document.getElementById('dds-log-collapse').addEventListener('click', function() {
      _collapsed = !_collapsed;
      _panel.classList.toggle('dds-log-collapsed', _collapsed);
      this.innerHTML = _collapsed ? '&#8249;' : '&#8250;';
      _notifyCytoscape();
    });

    // View toggle
    document.getElementById('dds-log-toggle-view').addEventListener('click', function() {
      _jsonMode = !_jsonMode;
      this.textContent = _jsonMode ? 'JSON' : 'Labels';
      var entries = document.getElementById('dds-log-entries');
      if (entries) entries.classList.toggle('dds-log-panel-json', _jsonMode);
    });

    // Clear
    document.getElementById('dds-log-clear').addEventListener('click', function() {
      _entries = [];
      _renderEntries();
    });

    // Export
    document.getElementById('dds-log-export').addEventListener('click', function() {
      var blob = new Blob([JSON.stringify(_entries, null, 2)], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = 'dds-actions-log-' + new Date().toISOString().slice(0,19).replace(/[:.T]/g,'-') + '.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    });
  }

  // --- Cytoscape resize after panel width change ---
  function _notifyCytoscape() {
    setTimeout(function() {
      if (window.DDS_CY && typeof DDS_CY.resize === 'function') DDS_CY.resize();
    }, 240);
  }

  // --- Rendering (oldest first, scroll to bottom) ---
  function _renderEntries() {
    var container = document.getElementById('dds-log-entries'); if (!container) return;
    var countEl   = document.getElementById('dds-log-count');
    if (countEl) countEl.textContent = String(_entries.length);
    if (_entries.length === 0) {
      container.innerHTML = '<div class="dds-log-empty">No actions logged yet.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < _entries.length; i++) {
      var e = _entries[i];
      var labels = _describe(e);
      var labelsHtml = labels.map(function(item) {
        return '<div class="dds-log-action-row">' +
          '<span class="dds-log-action-num">' + (item.index + 1) + '.</span>' +
          '<span>' + _esc(item.label) + '</span></div>';
      }).join('');
      var sourceTag = e.source === 'cmd'
        ? '<span class="dds-log-entry-source dds-log-entry-source-cmd">CMD</span>'
        : '<span class="dds-log-entry-source dds-log-entry-source-actions">ACTIONS</span>';
      html +=
        '<div class="dds-log-entry">' +
          '<div class="dds-log-entry-meta">' +
            '<span class="dds-log-entry-time">' + _esc(e.ts) + '</span>' +
            sourceTag +
            '<span class="dds-log-entry-count">' + e.actions.length +
              (e.actions.length > 1 ? ' actions' : ' action') + '</span>' +
          '</div>' +
          '<div class="dds-log-labels">' + labelsHtml + '</div>' +
          '<pre class="dds-log-json">' + _esc(JSON.stringify(e.actions, null, 2)) + '</pre>' +
        '</div>';
    }
    container.innerHTML = html;
    if (_jsonMode) container.classList.add('dds-log-panel-json');
    else           container.classList.remove('dds-log-panel-json');
    // Scroll to bottom so latest entry is visible
    container.scrollTop = container.scrollHeight;
  }

  // --- Listeners ---
  function _onExecuteActions(actions) {
    if (!actions || actions.length === 0) return;
    _entries.push({ ts: _ts(), actions: actions.map(function(a) { return Object.assign({}, a); }), source: 'actions' });
    _renderEntries();
  }

  function _onExecuteCmd(commands) {
    if (!commands || commands.length === 0) return;
    _entries.push({ ts: _ts(), actions: commands.map(function(c) { return Object.assign({}, c); }), source: 'cmd' });
    _renderEntries();
  }

  // --- Show / hide panel + register / unregister listeners ---
  function applyVisibility() {
    var active = window.DDS_SETTINGS && DDS_SETTINGS.isLogActions();
    if (!_panel) _createPanel();
    if (active) {
      _panel.classList.add('dds-log-open');
      _panel.classList.toggle('dds-log-collapsed', _collapsed);
      if (!_listenerActions) {
        _listenerActions = _onExecuteActions;
        DDS_ACTIONS.addExecuteListener(_listenerActions);
      }
      if (!_listenerCmd && window.DDS_CMD && typeof DDS_CMD.addExecuteListener === 'function') {
        _listenerCmd = _onExecuteCmd;
        DDS_CMD.addExecuteListener(_listenerCmd);
      }
    } else {
      _panel.classList.remove('dds-log-open', 'dds-log-collapsed');
      if (_listenerActions) {
        DDS_ACTIONS.removeExecuteListener(_listenerActions);
        _listenerActions = null;
      }
      if (_listenerCmd && window.DDS_CMD) {
        DDS_CMD.removeExecuteListener(_listenerCmd);
        _listenerCmd = null;
      }
    }
    _notifyCytoscape();
  }

  // --- Boot: wait for DDS_SETTINGS.ready() before checking the setting ---
  function init() {
    function _boot() {
      var p = window.DDS_SETTINGS ? DDS_SETTINGS.ready() : Promise.resolve();
      p.then(applyVisibility);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _boot);
    } else {
      _boot();
    }
  }

  return { init: init, applyVisibility: applyVisibility };

})();

DDS_ACTIONS_LOG.init();
