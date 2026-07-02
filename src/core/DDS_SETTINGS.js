/**
 * SETTINGS Module - Settings Modal Controller
 */
var SETTINGS = (function() {
    'use strict';

    var $backdrop = null;
    var $modal = null;
    var isOpen = false;

    function init() {
        $backdrop = jQuery('#b2w-settings-modal-backdrop');
        $modal = $backdrop.find('.b2w-settings-modal');

        jQuery('#commwise-header-settings-btn').on('click', function(e) {
            e.preventDefault();
            open();
        });

        $backdrop.on('click', function(e) {
            if (e.target === $backdrop[0]) { close(); }
        });

        jQuery(document).on('keydown', function(e) {
            if (e.key === 'Escape' && isOpen) { close(); }
        });

        console.log('[SETTINGS] Initialized');
    }

    function open() {
        // Sync toggle state from current DDS_SETTINGS cache
        var toggle = document.getElementById('dds-debug-toggle');
        if (toggle && window.DDS_SETTINGS) {
            toggle.checked = DDS_SETTINGS.isDebugAI();
        }
        var toggleLog = document.getElementById('dds-log-actions-toggle');
        if (toggleLog && window.DDS_SETTINGS) {
            toggleLog.checked = DDS_SETTINGS.isLogActions();
        }
        var toggleBfs = document.getElementById('dds-show-bfs-ranks-toggle');
        if (toggleBfs && window.DDS_SETTINGS) {
            toggleBfs.checked = DDS_SETTINGS.isShowBfsRanks();
        }
        var selectLogLevel = document.getElementById('dds-log-level-select');
        if (selectLogLevel && window.DDS_SETTINGS) {
            selectLogLevel.value = DDS_SETTINGS.get('log_level') || 'warn';
        }
        $backdrop.addClass('visible');
        isOpen = true;
        $modal.find('.b2w-settings-modal-close').focus();
    }

    function close() {
        $backdrop.removeClass('visible');
        isOpen = false;
    }

    jQuery(document).ready(function() { init(); });

    return {
        open: open,
        close: close,
        isOpen: function() { return isOpen; }
    };
})();

/**
 * NAV_MENU Module - Header Navigation Dropdown Controller
 */
var NAV_MENU = (function() {
    'use strict';

    var $btn = null;
    var $dropdown = null;
    var isOpen = false;

    function open() {
        $dropdown.addClass('b2w-nav-open');
        isOpen = true;
    }

    function close() {
        $dropdown.removeClass('b2w-nav-open');
        isOpen = false;
    }

    function init() {
        $btn = jQuery('#commwise-header-nav-btn');
        $dropdown = jQuery('#commwise-header-nav-dropdown');

        if (!$btn.length || !$dropdown.length) { return; }

        $btn.on('click', function(e) {
            e.stopPropagation();
            if (isOpen) { close(); } else { open(); }
        });

        jQuery(document).on('click', function(e) {
            if (isOpen && !$dropdown[0].contains(e.target) && !$btn[0].contains(e.target)) {
                close();
            }
        });

        jQuery(document).on('keydown', function(e) {
            if (e.key === 'Escape' && isOpen) { close(); }
        });

        console.log('[NAV_MENU] Initialized');
    }

    jQuery(document).ready(function() { init(); });

    return { open: open, close: close };
})();

/**
 * DDS_SETTINGS — App-level settings backed by DataStore
 *
 * Reads key/value pairs from cw_c3_22645_app_settings at boot.
 * Exposes DDS.state.settings and a simple get/set/isDebug API.
 *
 * Boot sequence:
 *   await DDS_SETTINGS.ready()        -> resolves when DataStore has loaded
 *   DDS_SETTINGS.isDebug()            -> true if debug_mode === 'true'
 *   DDS_SETTINGS.get('key')           -> string value or null
 *   await DDS_SETTINGS.set('k', 'v') -> upsert to DataStore
 *
 * DataStore module: window.B2W_DATA_DDS_APP_SETTINGS_VKVR7N
 */
var DDS_SETTINGS = (function() {
    'use strict';

    var DS_MODULE = 'B2W_DATA_DDS_APP_SETTINGS_VKVR7N';
    var _cache = {};
    var _readyPromise = null;

    if (window.DDS && window.DDS.state) {
        window.DDS.state.settings = window.DDS.state.settings || {};
    }

    function ready() {
        if (_readyPromise) return _readyPromise;

        _readyPromise = new Promise(function(resolve) {
            function tryLoad() {
                var ds = window[DS_MODULE];
                if (!ds) { setTimeout(tryLoad, 100); return; }
                if (ds.isLoaded()) { _populate(ds.getRawRecords()); resolve(); return; }
                if (ds.getLoadError()) {
                    console.warn('[DDS_SETTINGS] DataStore error — using defaults:', ds.getLoadError());
                    resolve(); return;
                }
                document.addEventListener('B2W_DATA_DDS_APP_SETTINGS_VKVR7N_ready', function onReady() {
                    _populate(window[DS_MODULE].getRawRecords());
                    resolve();
                }, { once: true });
                document.addEventListener('B2W_DATA_DDS_APP_SETTINGS_VKVR7N_error', function onErr() {
                    console.warn('[DDS_SETTINGS] DataStore error event — using defaults');
                    resolve();
                }, { once: true });
            }
            tryLoad();
        });

        return _readyPromise;
    }

    function _populate(records) {
        _cache = {};
        (records || []).forEach(function(row) {
            if (row.key) _cache[row.key] = row.value;
        });
        _syncState();
        console.log('[DDS_SETTINGS] Loaded', Object.keys(_cache).length, 'setting(s). debug_ai =', _cache.debug_ai);
    }

    function _syncState() {
        if (!window.DDS || !window.DDS.state) return;
        window.DDS.state.settings = {
            debug_ai:       _cache.debug_ai       === 'true',
            log_actions:    _cache.log_actions    === 'true',
            show_bfs_ranks: _cache.show_bfs_ranks === 'true',
            log_level:      _cache.log_level      || 'warn'
        };
    }

    function get(key) {
        return Object.prototype.hasOwnProperty.call(_cache, key) ? _cache[key] : null;
    }

    async function set(key, value) {
        var ds = window[DS_MODULE];
        if (!ds) {
            console.warn('[DDS_SETTINGS] DataStore not available — memory only');
            _cache[key] = value;
            _syncState();
            return;
        }
        _cache[key] = value;
        _syncState();
        try {
            var existing = ds.getRawRecords().find(function(r) { return r.key === key; });
            if (existing) {
                await ds.update({ id: existing.id }, { value: value });
            } else {
                await ds.insert({ key: key, value: value });
            }
            console.log('[DDS_SETTINGS] Saved:', key, '=', value);
        } catch(e) {
            console.error('[DDS_SETTINGS] Save failed for key', key, e);
        }
    }

    function isDebugAI() {
        return _cache.debug_ai === 'true';
    }

    function isLogActions() {
        return _cache.log_actions === 'true';
    }

    function isShowBfsRanks() {
        return _cache.show_bfs_ranks === 'true';
    }

    function getLogLevel() {
        return _cache.log_level || 'warn';
    }

    return { ready: ready, get: get, set: set, isDebugAI: isDebugAI, isLogActions: isLogActions, isShowBfsRanks: isShowBfsRanks, getLogLevel: getLogLevel };
})();
