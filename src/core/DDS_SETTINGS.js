/**
 * SETTINGS Module - Settings Modal Controller (header gear icon)
 *
 * Framework-agnostic: binds to a neutral button id (#dds-header-settings-btn)
 * present in every framework's header, and toggles DDScope's own portable
 * modal chrome (.dds-overlay / .dds-modal, see styles/buttons-modal-forms.css)
 * — not CommWise-borrowed markup. See docs/DDScope_Service_Settings.md.
 */
var SETTINGS = (function() {
    'use strict';

    var $overlay = null;
    var $modal = null;
    var isOpen = false;

    function init() {
        $overlay = jQuery('#dds-header-settings-overlay');
        $modal = $overlay.find('.dds-modal');

        // Local-only section (Anthropic API key, see docs/DDScope_Service_Settings.md
        // §5) — window.DDS_FRAMEWORK is set only by frameworks/local/template.html,
        // never by CommWise, so this section stays hidden there.
        if (window.DDS_FRAMEWORK === 'local') {
            jQuery('#dds-settings-section-local').removeClass('dds-hidden');
        }

        jQuery('#dds-header-settings-btn').on('click', function(e) {
            e.preventDefault();
            open();
        });

        $overlay.on('click', function(e) {
            if (e.target === $overlay[0]) { close(); }
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
        var anthropicKeyInput = document.getElementById('dds-anthropic-key-input');
        if (anthropicKeyInput && window.DDS_SETTINGS) {
            anthropicKeyInput.value = DDS_SETTINGS.getAnthropicApiKey() || '';
        }
        var selectAiModel = document.getElementById('dds-ai-model-select');
        if (selectAiModel && window.DDS_SETTINGS) {
            selectAiModel.value = DDS_SETTINGS.getAiModel();
        }
        if (!$overlay || !$overlay.length) return;
        $overlay.addClass('visible');
        isOpen = true;
        $modal.find('.dds-modal-close').focus();
    }

    function close() {
        if (!$overlay || !$overlay.length) return;
        $overlay.removeClass('visible');
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
 * NAV_MENU Module - CommWise header navigation dropdown controller.
 *
 * CommWise-chrome only (Your Profile / Your Apps / App Store links, DIV 100 —
 * a skipped/non-portable block, see frameworks/commwise/sync-tracker.md).
 * The local framework's header has no nav dropdown, so this module simply
 * no-ops there (#commwise-header-nav-btn / #commwise-header-nav-dropdown
 * don't exist in frameworks/local/fixtures/header-local.html).
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
 * DDS_SETTINGS — ISettingsService: application-level settings/toggles
 * (developer toggles: debug_ai, log_actions, show_bfs_ranks, log_level).
 * See docs/DDScope_Service_Settings.md for the interface contract.
 *
 * Public API (framework-agnostic):
 *   await DDS_SETTINGS.ready()        -> resolves once initial values are loaded
 *   DDS_SETTINGS.get('key')           -> string value or null
 *   await DDS_SETTINGS.set('k', 'v')  -> persist a value
 *   DDS_SETTINGS.isDebugAI() / isLogActions() / isShowBfsRanks() / getLogLevel()
 *
 * Persistence backend (the actual decoupling seam):
 *   A backend is a plain object { load(): Promise<Array<{key,value}>>,
 *   upsert(key, value): Promise<void> }. A framework may inject one
 *   explicitly via window.DDS_SETTINGS_BACKEND, set *before* DDS_SETTINGS.
 *   ready() is first called — same convention as the APP_CONTEXT stub and the
 *   window.DDS_AI_TRANSPORT injection (see frameworks/local/template.html).
 *
 *   - settings-impl-1 CommWiseDataStoreSettings (framework-1/CommWise):
 *     no wiring required — if no backend was injected, DDS_SETTINGS falls
 *     back to the CommWise DataStore module (window.B2W_DATA_DDS_APP_SETTINGS_VKVR7N),
 *     preserving the original behaviour unchanged.
 *   - settings-impl-2 LocalStorageSettings (framework-2/Local): injected by
 *     frameworks/local/template.html via window.DDS_SETTINGS_BACKEND, backed
 *     by window.localStorage — no CommWise DataStore stub needed anymore.
 */
var DDS_SETTINGS = (function() {
    'use strict';

    var DS_MODULE = 'B2W_DATA_DDS_APP_SETTINGS_VKVR7N';
    var _cache = {};
    var _readyPromise = null;
    var _backend = null;

    if (window.DDS && window.DDS.state) {
        window.DDS.state.settings = window.DDS.state.settings || {};
    }

    function _memoryBackend() {
        // Last-resort fallback: no persistence (e.g. Vitest/jsdom with no
        // injected backend and no CommWise DataStore global).
        return {
            load: function() { return Promise.resolve([]); },
            upsert: function() { return Promise.resolve(); }
        };
    }

    // settings-impl-1 — CommWiseDataStoreSettings. Unchanged polling logic:
    // the DataStore DATA block loads after this SCRIPT block in CommWise's
    // assembly order, so window[DS_MODULE] genuinely does not exist yet when
    // this file first runs. Bounded (was previously unbounded) so that an
    // environment where the global never appears (e.g. tests) degrades to
    // memory-only instead of hanging ready() forever.
    function _commwiseDataStoreBackend() {
        return new Promise(function(resolve) {
            var attempts = 0;
            var MAX_ATTEMPTS = 30; // ~3s at 100ms

            function tryLoad() {
                var ds = window[DS_MODULE];
                if (!ds) {
                    attempts++;
                    if (attempts > MAX_ATTEMPTS) {
                        console.warn('[DDS_SETTINGS] ' + DS_MODULE + ' never appeared — memory-only.');
                        resolve(_memoryBackend());
                        return;
                    }
                    setTimeout(tryLoad, 100);
                    return;
                }
                resolve({
                    load: function() {
                        return new Promise(function(res) {
                            if (ds.isLoaded()) { res(ds.getRawRecords()); return; }
                            if (ds.getLoadError()) {
                                console.warn('[DDS_SETTINGS] DataStore error — using defaults:', ds.getLoadError());
                                res([]);
                                return;
                            }
                            document.addEventListener(DS_MODULE + '_ready', function onReady() {
                                res(window[DS_MODULE].getRawRecords());
                            }, { once: true });
                            document.addEventListener(DS_MODULE + '_error', function onErr() {
                                console.warn('[DDS_SETTINGS] DataStore error event — using defaults');
                                res([]);
                            }, { once: true });
                        });
                    },
                    upsert: async function(key, value) {
                        var existing = ds.getRawRecords().find(function(r) { return r.key === key; });
                        if (existing) {
                            await ds.update({ id: existing.id }, { value: value });
                        } else {
                            await ds.insert({ key: key, value: value });
                        }
                    }
                });
            }
            tryLoad();
        });
    }

    function _resolveBackend() {
        if (window.DDS_SETTINGS_BACKEND) {
            return Promise.resolve(window.DDS_SETTINGS_BACKEND);
        }
        return _commwiseDataStoreBackend();
    }

    function ready() {
        if (_readyPromise) return _readyPromise;

        _readyPromise = _resolveBackend()
            .then(function(backend) {
                _backend = backend;
                return backend.load();
            })
            .then(function(records) {
                _populate(records);
            })
            .catch(function(e) {
                console.warn('[DDS_SETTINGS] Failed to load settings — using defaults:', e);
                _backend = _backend || _memoryBackend();
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
            debug_ai:          _cache.debug_ai          === 'true',
            log_actions:       _cache.log_actions       === 'true',
            show_bfs_ranks:    _cache.show_bfs_ranks    === 'true',
            log_level:         _cache.log_level         || 'warn',
            ai_model:          _cache.ai_model          || 'claude-sonnet-4-6',
            anthropic_api_key: _cache.anthropic_api_key || null
        };
    }

    function get(key) {
        return Object.prototype.hasOwnProperty.call(_cache, key) ? _cache[key] : null;
    }

    async function set(key, value) {
        _cache[key] = value;
        _syncState();
        var backend = _backend || _memoryBackend();
        try {
            await backend.upsert(key, value);
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

    // Local-only setting (framework-2, window.DDS_FRAMEWORK === 'local') —
    // Anthropic API key for ai-impl-2 DirectAnthropicTransport, read by
    // src/ai/DDS_AI_TRANSPORT_LOCAL.js. CommWise's ai-impl-1 never reads it.
    // See docs/DDScope_Service_Settings.md §5, docs/DDScope_Service_AITransport.md §3.
    function getAnthropicApiKey() {
        return _cache.anthropic_api_key || null;
    }

    // Framework-agnostic setting (Both) — AI Assistant model, read by
    // src/ai/DDS_AI.js and passed as options.model to window.DDS_AI_TRANSPORT.send().
    // See docs/DDScope_AI_Assistant.md §6b, docs/DDScope_Service_Settings.md §5. TODO T-039.
    function getAiModel() {
        return _cache.ai_model || 'claude-sonnet-4-6';
    }

    return { ready: ready, get: get, set: set, isDebugAI: isDebugAI, isLogActions: isLogActions, isShowBfsRanks: isShowBfsRanks, getLogLevel: getLogLevel, getAnthropicApiKey: getAnthropicApiKey, getAiModel: getAiModel };
})();
