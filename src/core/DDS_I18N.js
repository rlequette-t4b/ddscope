/**
 * DDS_I18N — II18nService: string catalog and locale resolution.
 * See docs/SCFlow_I18N.md for the interface contract.
 *
 * Public API (framework-agnostic):
 *   await DDS_I18N.ready()        -> resolves once the active locale's catalog is loaded
 *   DDS_I18N.t(key, params)       -> resolves key in the active locale, substitutes params
 *   await DDS_I18N.setLocale(loc) -> switches active locale, reloads catalog, persists to DDS_SETTINGS
 *   DDS_I18N.getLocale()          -> active locale code (e.g. 'en')
 *
 * Catalog: static data, one flat key/value file per locale
 * (src/core/DDS_I18N_CATALOG_<LOCALE>.js, each assigning
 * window.DDS_I18N_CATALOG_<LOCALE>) — bundled directly in Core, identical
 * across every framework. Unlike DDS_SETTINGS, no per-framework backend
 * injection here: the catalog *content* does not vary by framework, only
 * its future *source* might (e.g. a server-fetched catalog) — that seam,
 * if ever needed, belongs to a later chantier (TODO T-058), not the socle.
 *
 * Locale resolution order: DDS_SETTINGS key 'locale' (persisted, same
 * mechanism as log_level/workbench_panel_width) -> navigator.language
 * (first two letters, if a supported locale) -> SOURCE_LOCALE ('en').
 *
 * Placeholders: hand-rolled subset of ICU MessageFormat syntax — plain
 * "{name}" substitution plus "{name, plural, one {...} other {...}}"
 * pluralization ("#" inside a branch is replaced by the numeric value).
 * No external dependency: the project has no runtime dependencies or
 * bundler (script-tag modules only, see docs/SCFlow_I18N.md §2) — revisit
 * if a future language needs rules beyond one/other plurals or word-order
 * reshuffling that this subset can't express.
 */
var DDS_I18N = (function() {
    'use strict';

    var SOURCE_LOCALE = 'en';
    // Extend as catalogs are added (extraction chantier, TODO T-058).
    var SUPPORTED_LOCALES = ['en'];

    var _locale = SOURCE_LOCALE;
    var _catalog = {};
    var _readyPromise = null;

    function _catalogFor(locale) {
        return window['DDS_I18N_CATALOG_' + locale.toUpperCase()] || null;
    }

    function _resolveInitialLocale() {
        var fromSettings = window.DDS_SETTINGS && DDS_SETTINGS.get('locale');
        if (fromSettings && SUPPORTED_LOCALES.indexOf(fromSettings) !== -1) {
            return fromSettings;
        }

        var nav = ((typeof navigator !== 'undefined' && navigator.language) || '').slice(0, 2).toLowerCase();
        if (nav && SUPPORTED_LOCALES.indexOf(nav) !== -1) return nav;

        return SOURCE_LOCALE;
    }

    function _load(locale) {
        var catalog = _catalogFor(locale);
        if (!catalog) {
            console.warn('[DDS_I18N] No catalog for locale "' + locale + '" — falling back to ' + SOURCE_LOCALE);
            locale = SOURCE_LOCALE;
            catalog = _catalogFor(SOURCE_LOCALE) || {};
        }
        _locale = locale;
        _catalog = catalog;
        console.log('[DDS_I18N] Locale set to', _locale, '(' + Object.keys(_catalog).length + ' key(s))');
    }

    function ready() {
        if (_readyPromise) return _readyPromise;

        _readyPromise = Promise.resolve()
            .then(function() {
                return (window.DDS_SETTINGS && DDS_SETTINGS.ready) ? DDS_SETTINGS.ready() : Promise.resolve();
            })
            .then(function() {
                _load(_resolveInitialLocale());
            })
            .catch(function(e) {
                console.warn('[DDS_I18N] ready() failed — falling back to ' + SOURCE_LOCALE + ':', e);
                _load(SOURCE_LOCALE);
            });

        return _readyPromise;
    }

    async function setLocale(locale) {
        if (SUPPORTED_LOCALES.indexOf(locale) === -1) {
            console.warn('[DDS_I18N] setLocale: unsupported locale "' + locale + '" — ignored');
            return;
        }
        _load(locale);
        if (window.DDS_SETTINGS) {
            await DDS_SETTINGS.set('locale', locale);
        }
    }

    function getLocale() {
        return _locale;
    }

    function t(key, params) {
        var raw = Object.prototype.hasOwnProperty.call(_catalog, key) ? _catalog[key] : null;
        if (raw === null) {
            console.warn('[DDS_I18N] Missing key "' + key + '" for locale', _locale);
            return key;
        }
        return _format(raw, params || {});
    }

    // {name, plural, one {...} other {...}} is resolved before plain
    // substitution so a {name} reference inside a branch still resolves.
    function _format(template, params) {
        var withPlurals = template.replace(
            /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
            function(match, name, one, other) {
                var n = Number(params[name]);
                var branch = (n === 1 ? one : other);
                return branch.replace(/#/g, String(n));
            }
        );
        return withPlurals.replace(/\{(\w+)\}/g, function(match, name) {
            return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
        });
    }

    return {
        ready: ready,
        t: t,
        setLocale: setLocale,
        getLocale: getLocale
    };
})();
