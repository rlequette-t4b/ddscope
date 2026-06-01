// JS: DDS_TRANSACTIONS — snapshot-based undo/redo transaction manager
// CommWise block: SCRIPT 1860
// Testability: store-dependent
// Depends on: DDS_STORE (SCRIPT 150)
// API documented: yes

// DDS_TRANSACTION — Undo/Redo transaction manager
// Depends on: DDS_STORE (SCRIPT 150)
// Status: STUB — API surface only, no implementation
//
// Transaction ownership: called by UI layer modules only.
// DDS_ACTIONS is not transaction-aware.
// A single user interaction may chain multiple DDS_ACTIONS.execute() calls;
// the UI module starts, commits, or rolls back the wrapping transaction.



var DDS_TRANSACTIONS = (function () {
  // --- Internal state ---
  var undoStack = [];
  var redoStack = [];
  var currentTransaction = null;
  var _onChangeFn = null;

  // --- API ---
  function begin(label) {
    DDS_TOOLS.log.info('begin transaction: ' + label);

    if (currentTransaction) {
      throw new Error('Transaction already in progress: ' + currentTransaction.label);
    }

    // clear the redo, a new future
    redoStack.length = 0;
    
    DDS_STORE.beginDelta();
    currentTransaction = { label: label, id: Date.now() };
    return currentTransaction.id;
  }

  function commit(transactionId) {
    DDS_TOOLS.log.info('commit transaction: ' + transactionId);
    
    if (!currentTransaction || currentTransaction.id !== transactionId) {
      throw new Error('No transaction in progress with id: ' + transactionId);
    }

    currentTransaction.delta = DDS_STORE.endDelta();
    undoStack.push(currentTransaction);
    currentTransaction = null;
    redoStack.length = 0;
    _fireChange();
}

  function rollback(transactionId) {
    DDS_TOOLS.log.info('rollback transaction: ' + transactionId);

    DDS_STORE.cancelDelta();
    currentTransaction = null;
  }

  function undo() {
    DDS_TOOLS.log.info('undo transaction');

    // Pop from undo, push to redo, restore delta
    if (undoStack.length > 0) {
      var tx = undoStack.pop();
      tx.delta = DDS_STORE.revertDelta(tx.delta);
      redoStack.push(tx);
      _fireChange();
      return true;
    }
    return false;
  }

  function redo() {
    DDS_TOOLS.log.info('redo transaction');

    // Pop from redo, push to undo, restore delta
    if (redoStack.length > 0) {
      var tx = redoStack.pop();
      tx.delta = DDS_STORE.revertDelta(tx.delta);
      undoStack.push(tx);
      _fireChange();
      return true;
    }
    return false;
  }

  function canUndo() {
    DDS_TOOLS.log.info('canUndo: ' + (undoStack.length > 0));
    return undoStack.length > 0;
  }

  function canRedo() {
    DDS_TOOLS.log.info('canRedo: ' + (redoStack.length > 0));
    return redoStack.length > 0;
  }

  function clear() {
    DDS_TOOLS.log.info('clear transactions');
    undoStack.length = 0;
    redoStack.length = 0;
    currentTransaction = null;
    _fireChange();
  }

  function onChange(fn) {
    _onChangeFn = (typeof fn === 'function') ? fn : null;
  }

  function _fireChange() {
    if (typeof _onChangeFn === 'function') {
      DDS_TOOLS.log.info('transaction change, firing onChange');
      _onChangeFn();
    }
  }

  // --- Public API ---
  return {
    begin: begin,
    commit: commit,
    rollback: rollback,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    clear: clear,
    onChange: onChange
  };
}());

// ESM export for Vitest compatibility
export default DDS_TRANSACTIONS;
