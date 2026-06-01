// JS: DDS_TOOLS — cross-cutting utilities
// Loaded at SCRIPT 40 — available to all subsequent modules.
// No dependencies.

var DDS_TOOLS = (function () {

  // ------------------------------------------------------------------
  // DDS_TOOLS.log — levelled logger
  // ------------------------------------------------------------------
  // Levels (ascending severity): debug < info < warn < error < off
  // Default: 'warn' — overridable via localStorage key 'dds_log_level'.
  // Usage:
  //   DDS_TOOLS.log.setLevel('debug');
  //   DDS_TOOLS.log.debug('[DDS_STORE] insert', row);
  //   DDS_TOOLS.log.warn('[DDS_TX_HELPER] rollback', err);
  // ------------------------------------------------------------------

  var _LEVELS = { debug: 0, info: 1, warn: 2, error: 3, off: 99 };
  var _DEFAULT_LEVEL = 'warn';
  var _LS_KEY = 'dds_log_level';

  var _level = (function () {
    try {
      var saved = typeof localStorage !== 'undefined' && localStorage.getItem(_LS_KEY);
      return (saved && _LEVELS[saved] !== undefined) ? saved : _DEFAULT_LEVEL;
    } catch (e) {
      return _DEFAULT_LEVEL;
    }
  }());

  function _log(method, level, args) {
    if (_LEVELS[level] >= _LEVELS[_level]) {
      console[method].apply(console, args);
    }
  }

  var log = {
    /**
     * Set the active log level. Persists to localStorage when available.
     * @param {'debug'|'info'|'warn'|'error'|'off'} level
     */
    setLevel: function (level) {
      if (_LEVELS[level] === undefined) {
        console.warn('[DDS_TOOLS] Unknown log level:', level);
        return;
      }
      _level = level;
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(_LS_KEY, level);
      } catch (e) { /* storage unavailable */ }
    },

    /** Current active level. */
    getLevel: function () { return _level; },

    debug: function () { _log('log',   'debug', Array.prototype.slice.call(arguments)); },
    info:  function () { _log('info',  'info',  Array.prototype.slice.call(arguments)); },
    warn:  function () { _log('warn',  'warn',  Array.prototype.slice.call(arguments)); },
    error: function () { _log('error', 'error', Array.prototype.slice.call(arguments)); }
  };

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return {
    log: log
  };

}());

// ESM export appended during extraction — do not remove
export default DDS_TOOLS;
