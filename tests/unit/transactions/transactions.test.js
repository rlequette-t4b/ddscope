// Unit tests for DDS_TRANSACTIONS.js
// See: docs/shared/DDScope_Modules.md for module contract

import {beforeEach, describe, it, expect, vi } from 'vitest';

describe('DDS_TRANSACTIONS', () => {

  // Note: DDS_TRANSACTIONS.begin/commit are owned by the caller in these
  // tests (mirroring the UI-layer contract in DDS_TRANSACTIONS.js). We
  // can't use DDS_CMD.execute(DDS_TX.NODE_CREATE, ...) here because it
  // owns its own begin/commit internally and would nest transactions.
  // Insert the node directly via DDS_STORE, mirroring the shape DDS_CMD's
  // NODE_CREATE handler uses, so the mutation is recorded against the
  // transaction already opened by the test.
  function createNode(name) {
    return DDS_STORE.insert('nodes', [{
      name: name,
      type_code: null,
      swim_lane_id: null,
      tags: [],
      notes: ''
    }]);
  }

  beforeEach(() => {
    DDS_STORE.newProject('Unit test', 'DDS_TRANSACTIONS baseline', 'vitest');
    DDS_TRANSACTIONS.clear();
  });


  it('begin() should return a transaction id', () => {
    const id = DDS_TRANSACTIONS.begin('test');
    expect(typeof id).toBe('number');
    DDS_TRANSACTIONS.rollback(id); // cleanup
  });

  it('commit() should push to undo stack and clear redo stack', () => {
    const id = DDS_TRANSACTIONS.begin('commit');
    createNode('Node in transaction');
    DDS_TRANSACTIONS.commit(id);
    expect(DDS_TRANSACTIONS.canUndo()).toBe(true);
    expect(DDS_TRANSACTIONS.canRedo()).toBe(false);
  });

  it('undo() should move transaction from undo to redo stack', () => {
    const id = DDS_TRANSACTIONS.begin('undo');
    createNode('Node in transaction');
    DDS_TRANSACTIONS.commit(id);
    const result = DDS_TRANSACTIONS.undo();
    expect(result).toBe(true);
    expect(DDS_TRANSACTIONS.canUndo()).toBe(false);
    expect(DDS_TRANSACTIONS.canRedo()).toBe(true);
  });

  it('redo() should move transaction from redo to undo stack', () => {
    const id = DDS_TRANSACTIONS.begin('redo');
    createNode('Node in transaction');
    DDS_TRANSACTIONS.commit(id);
    DDS_TRANSACTIONS.undo();
    const result = DDS_TRANSACTIONS.redo();
    expect(result).toBe(true);
    expect(DDS_TRANSACTIONS.canUndo()).toBe(true);
    expect(DDS_TRANSACTIONS.canRedo()).toBe(false);
  });

  it('clear() should reset all stacks and state', () => {
    const id = DDS_TRANSACTIONS.begin('clear');
    createNode('Node in transaction');
    DDS_TRANSACTIONS.commit(id);
    DDS_TRANSACTIONS.clear();
    expect(DDS_TRANSACTIONS.canUndo()).toBe(false);
    expect(DDS_TRANSACTIONS.canRedo()).toBe(false);
  });

  it('onChange() should register a callback fired on commit/undo/redo/clear', () => {
    const spy = vi.fn();
    DDS_TRANSACTIONS.onChange(spy);
    const id = DDS_TRANSACTIONS.begin('cb');
    createNode('Node in transaction');
    DDS_TRANSACTIONS.commit(id);
    DDS_TRANSACTIONS.undo();
    DDS_TRANSACTIONS.redo();
    DDS_TRANSACTIONS.clear();
    expect(spy).toHaveBeenCalled();
    DDS_TRANSACTIONS.onChange(null); // cleanup
  });
});
