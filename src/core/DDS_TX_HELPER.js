// JS: DDS_TX_HELPER — transaction utility for UI modules
// Wraps the begin → commit/rollback cycle for UI call sites.
// Temporary placement — will be absorbed into the presentation layer refactor.
//
// Depends on: DDS_TRANSACTIONS SCRIPT 1860

const DDS_TX_HELPER = {
  /**
   * Execute a synchronous mutation function inside a transaction.
   * Commits on success, rolls back and re-throws on failure.
   * An optional onSuccess callback is called after commit, receiving
   * the context object populated by fn — intended for presentation-layer
   * side effects (Cytoscape, DOM) that must not be inside the transaction.
   *
   * @param {string}   label      - TX catalogue key (e.g. TX.NODE_CREATE)
   * @param {Function} fn         - Synchronous function (ctx) => void — store mutations only
   * @param {Function} [onSuccess]- Optional (ctx) => void — called after commit, never on rollback
   */
  run(label, fn, onSuccess) {
    const ctx = {};
    const txId = DDS_TRANSACTIONS.begin(label);
    try {
      fn(ctx);
      DDS_TRANSACTIONS.commit(txId);
      if (typeof onSuccess === 'function') onSuccess(ctx);
    } catch (err) {
      DDS_TRANSACTIONS.rollback(txId);
      throw err;
    }
  }
};
