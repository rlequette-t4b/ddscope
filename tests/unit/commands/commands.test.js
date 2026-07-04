// Unit tests for DDS_CMD.js — notes domain (FEAT-002)
// Covers: note_categories CRUD + cascade, notes CRUD + map_notes, reorder, undo/redo

import { beforeEach, describe, it, expect } from 'vitest';

function setup() {
  DDS_STORE.newProject('CMD test', '', 'vitest');
  DDS_TRANSACTIONS.clear();
}

// Helper: get the id of the first map created by newProject
function getMapId() {
  return DDS_STORE.query('maps')[0].id;
}

// ------------------------------------------------------------------ //
// DDS_TX catalogue — notes keys
// ------------------------------------------------------------------ //

describe('DDS_TX — notes keys', () => {
  it('exposes all note TX keys', () => {
    expect(DDS_TX.NOTE_CATEGORY_CREATE).toBe('note_category.create');
    expect(DDS_TX.NOTE_CATEGORY_UPDATE).toBe('note_category.update');
    expect(DDS_TX.NOTE_CATEGORY_DELETE).toBe('note_category.delete');
    expect(DDS_TX.NOTE_CATEGORY_REORDER).toBe('note_category.reorder');
    expect(DDS_TX.NOTE_CREATE).toBe('note.create');
    expect(DDS_TX.NOTE_UPDATE).toBe('note.update');
    expect(DDS_TX.NOTE_DELETE).toBe('note.delete');
    expect(DDS_TX.NOTE_REORDER).toBe('note.reorder');
  });
});

// ------------------------------------------------------------------ //
// DDS_CMD.execute — basics
// ------------------------------------------------------------------ //

describe('DDS_CMD.execute — basics', () => {
  beforeEach(setup);

  it('returns { ok: false } for unknown txKey', () => {
    const result = DDS_CMD.execute('unknown.key', {}, null);
    expect(result.ok).toBe(false);
  });

  it('returns { ok: true, id } on success', () => {
    const result = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'General' }, null);
    expect(result.ok).toBe(true);
    expect(typeof result.id).toBe('number');
  });

  it('calls onSuccess after commit', () => {
    let called = false;
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'X' }, null, () => { called = true; });
    expect(called).toBe(true);
  });

  it('does not call onSuccess on failure', () => {
    let called = false;
    DDS_CMD.execute('bad.key', {}, null, () => { called = true; });
    expect(called).toBe(false);
  });
});

// ------------------------------------------------------------------ //
// NOTE_CATEGORY_CREATE
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_CATEGORY_CREATE', () => {
  beforeEach(setup);

  it('inserts a note_category record', () => {
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Contraintes' }, null);
    const cats = DDS_STORE.query('note_categories');
    expect(cats.length).toBe(1);
    expect(cats[0].label).toBe('Contraintes');
  });

  it('auto-assigns position 0 when no categories exist', () => {
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'First' }, null);
    expect(DDS_STORE.query('note_categories')[0].position).toBe(0);
  });

  it('auto-appends position after last category', () => {
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'A' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'B' }, null);
    const cats = DDS_STORE.query('note_categories', null, { order: 'position.asc' });
    expect(cats[1].position).toBe(1);
  });

  it('respects explicit position param', () => {
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'X', position: 5 }, null);
    expect(DDS_STORE.query('note_categories')[0].position).toBe(5);
  });

  it('is undoable', () => {
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Undo me' }, null);
    expect(DDS_STORE.query('note_categories').length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('note_categories').length).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// NOTE_CATEGORY_UPDATE
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_CATEGORY_UPDATE', () => {
  beforeEach(setup);

  it('updates the label', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Old' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_UPDATE, { id, label: 'New' }, null);
    expect(DDS_STORE.query('note_categories', { id })[0].label).toBe('New');
  });

  it('updates position independently', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'A', position: 0 }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_UPDATE, { id, position: 3 }, null);
    expect(DDS_STORE.query('note_categories', { id })[0].position).toBe(3);
  });

  it('is undoable', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Original' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_UPDATE, { id, label: 'Changed' }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('note_categories', { id })[0].label).toBe('Original');
  });
});

// ------------------------------------------------------------------ //
// NOTE_CATEGORY_DELETE
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_CATEGORY_DELETE', () => {
  beforeEach(setup);

  it('removes the category record', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'ToDelete' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_DELETE, { id }, null);
    expect(DDS_STORE.query('note_categories', { id }).length).toBe(0);
  });

  it('cascades to notes in that category', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note 1' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note 2' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_DELETE, { id: catId }, null);
    expect(DDS_STORE.query('notes', { category_id: catId }).length).toBe(0);
  });

  it('cascades to map_notes of notes in that category', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_DELETE, { id: catId }, null);
    expect(DDS_STORE.query('map_notes', { map_id: mapId }).length).toBe(0);
  });

  it('does not delete notes in other categories', () => {
    const mapId = getMapId();
    const { id: catA } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'A' }, null);
    const { id: catB } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'B' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catA, content: 'Note A' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catB, content: 'Note B' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_DELETE, { id: catA }, null);
    expect(DDS_STORE.query('notes', { category_id: catB }).length).toBe(1);
  });

  it('is undoable — restores category, its notes, and their map_notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_DELETE, { id: catId }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('note_categories', { id: catId }).length).toBe(1);
    expect(DDS_STORE.query('notes', { category_id: catId }).length).toBe(1);
    expect(DDS_STORE.query('map_notes', { map_id: mapId }).length).toBe(1);
  });
});

// ------------------------------------------------------------------ //
// NOTE_CATEGORY_REORDER
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_CATEGORY_REORDER', () => {
  beforeEach(setup);

  it('updates positions of multiple categories', () => {
    const { id: a } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'A', position: 0 }, null);
    const { id: b } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'B', position: 1 }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_REORDER, { order: [{ id: a, position: 1 }, { id: b, position: 0 }] }, null);
    expect(DDS_STORE.query('note_categories', { id: a })[0].position).toBe(1);
    expect(DDS_STORE.query('note_categories', { id: b })[0].position).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// NOTE_CREATE
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_CREATE', () => {
  beforeEach(setup);

  it('returns { ok: true } and creates the note even when mapId is null (graceful fallback — corrected 2026-07-02: TX.NOTE_CREATE has always fallen back to _activeMapId() rather than requiring mapId, per DDScope_Commands.md §0.6 ("mapId used: No"); this test previously asserted the opposite and only surfaced as a failure once the src mirror was resynced against the live command, exercising this call site for the first time in CI)', () => {
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const result = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'No map' }, null);
    expect(result.ok).toBe(true);
    expect(typeof result.id).toBe('number');
  });

  it('creates the note but no map_notes row when mapId is null and no map is active', () => {
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: noteId } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'No map' }, null);
    expect(DDS_STORE.query('notes', { category_id: catId }).length).toBe(1);
    expect(DDS_STORE.query('notes', { id: noteId })[0].content).toBe('No map');
    expect(DDS_STORE.query('map_notes').length).toBe(0);
  });

  it('inserts a note in the given category', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Hello' }, mapId);
    const notes = DDS_STORE.query('notes', { category_id: catId });
    expect(notes.length).toBe(1);
    expect(notes[0].content).toBe('Hello');
  });

  it('creates a map_notes record for the active map', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: noteId } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Hello' }, mapId);
    expect(DDS_STORE.query('map_notes', { map_id: mapId, note_id: noteId }).length).toBe(1);
  });

  it('auto-assigns position 0 when category is empty', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'First' }, mapId);
    expect(DDS_STORE.query('notes', { id })[0].position).toBe(0);
  });

  it('auto-appends position after last note in category', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'A' }, mapId);
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'B' }, mapId);
    expect(DDS_STORE.query('notes', { id })[0].position).toBe(1);
  });

  it('is undoable — removes both note and map_notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: noteId } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'To undo' }, mapId);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('notes', { category_id: catId }).length).toBe(0);
    expect(DDS_STORE.query('map_notes', { note_id: noteId }).length).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// NOTE_UPDATE
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_UPDATE', () => {
  beforeEach(setup);

  it('updates the content of a note', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Old' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_UPDATE, { id, content: 'New' }, null);
    expect(DDS_STORE.query('notes', { id })[0].content).toBe('New');
  });

  it('is undoable', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Original' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_UPDATE, { id, content: 'Changed' }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('notes', { id })[0].content).toBe('Original');
  });
});

// ------------------------------------------------------------------ //
// NOTE_DELETE
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_DELETE', () => {
  beforeEach(setup);

  it('removes the note record', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Bye' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_DELETE, { id }, null);
    expect(DDS_STORE.query('notes', { id }).length).toBe(0);
  });

  it('cascades to map_notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: noteId } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Bye' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_DELETE, { id: noteId }, null);
    expect(DDS_STORE.query('map_notes', { note_id: noteId }).length).toBe(0);
  });

  it('does not affect other notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: a } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Keep' }, mapId);
    const { id: b } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Delete' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_DELETE, { id: b }, null);
    expect(DDS_STORE.query('notes', { id: a }).length).toBe(1);
  });

  it('is undoable — restores note and map_notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: noteId } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Restore me' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_DELETE, { id: noteId }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('notes', { id: noteId }).length).toBe(1);
    expect(DDS_STORE.query('map_notes', { note_id: noteId }).length).toBe(1);
  });
});

// ------------------------------------------------------------------ //
// NOTE_REORDER
// ------------------------------------------------------------------ //

describe('DDS_TX.NOTE_REORDER', () => {
  beforeEach(setup);

  it('updates positions of multiple notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: a } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'A', position: 0 }, mapId);
    const { id: b } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'B', position: 1 }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_REORDER, { order: [{ id: a, position: 1 }, { id: b, position: 0 }] }, null);
    expect(DDS_STORE.query('notes', { id: a })[0].position).toBe(1);
    expect(DDS_STORE.query('notes', { id: b })[0].position).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// MAP_DELETE cascade — map_notes
// ------------------------------------------------------------------ //

describe('DDS_TX.MAP_DELETE cascade — map_notes', () => {
  beforeEach(setup);

  it('deleting a map removes its map_notes', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note A' }, mapId);
    DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note B' }, mapId);
    // Create a second map so the first is not the last
    DDS_STORE.insert('maps', { name: 'Map 2', position: 2 });
    DDS_CMD.execute(DDS_TX.MAP_DELETE, { id: mapId }, null);
    expect(DDS_STORE.query('map_notes', { map_id: mapId }).length).toBe(0);
  });

  it('deleting a map does not remove map_notes on other maps', () => {
    const mapId = getMapId();
    const { id: catId } = DDS_CMD.execute(DDS_TX.NOTE_CATEGORY_CREATE, { label: 'Cat' }, null);
    const { id: noteId } = DDS_CMD.execute(DDS_TX.NOTE_CREATE, { category_id: catId, content: 'Note' }, mapId);
    // Place the same note on a second map
    const map2 = DDS_STORE.insert('maps', { name: 'Map 2', position: 2 })[0];
    DDS_STORE.insert('map_notes', { map_id: map2.id, note_id: noteId });
    DDS_CMD.execute(DDS_TX.MAP_DELETE, { id: mapId }, null);
    expect(DDS_STORE.query('map_notes', { map_id: map2.id }).length).toBe(1);
  });

  it('refuses to delete the last map', () => {
    const mapId = getMapId();
    const result = DDS_CMD.execute(DDS_TX.MAP_DELETE, { id: mapId }, null);
    expect(result.ok).toBe(false);
    expect(DDS_STORE.query('maps').length).toBe(1);
  });
});

// ------------------------------------------------------------------ //
// TX.LANE_CREATE
// ------------------------------------------------------------------ //

describe('DDS_TX.LANE_CREATE', () => {
  beforeEach(setup);

  it('inserts a swim_lane record', () => {
    DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Supply', color: '#4a90d9' }, null);
    const lanes = DDS_STORE.query('swim_lanes');
    expect(lanes.length).toBe(1);
    expect(lanes[0].name).toBe('Supply');
    expect(lanes[0].color).toBe('#4a90d9');
  });

  it('falls back to a default color when none given', () => {
    DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Supply' }, null);
    expect(DDS_STORE.query('swim_lanes')[0].color).toBe('#6b7280');
  });

  it('is undoable', () => {
    DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Undo me' }, null);
    expect(DDS_STORE.query('swim_lanes').length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('swim_lanes').length).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// TX.LANE_UPDATE
// ------------------------------------------------------------------ //

describe('DDS_TX.LANE_UPDATE', () => {
  beforeEach(setup);

  it('updates name and color', () => {
    const { id } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Old', color: '#111111' }, null);
    DDS_CMD.execute(DDS_TX.LANE_UPDATE, { id, name: 'New', color: '#222222' }, null);
    const lane = DDS_STORE.query('swim_lanes', { id })[0];
    expect(lane.name).toBe('New');
    expect(lane.color).toBe('#222222');
  });

  it('is undoable', () => {
    const { id } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Original' }, null);
    DDS_CMD.execute(DDS_TX.LANE_UPDATE, { id, name: 'Changed' }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('swim_lanes', { id })[0].name).toBe('Original');
  });
});

// ------------------------------------------------------------------ //
// TX.LANE_DELETE — cascade via DDS_MODEL.deleteSwimLane
// ------------------------------------------------------------------ //

describe('DDS_TX.LANE_DELETE', () => {
  beforeEach(setup);

  it('removes the swim_lane record', () => {
    const { id } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'ToDelete' }, null);
    DDS_CMD.execute(DDS_TX.LANE_DELETE, { id }, null);
    expect(DDS_STORE.query('swim_lanes', { id }).length).toBe(0);
  });

  it('cascades to nodes assigned to the lane', () => {
    const { id: laneId } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Lane' }, null);
    const node = DDS_STORE.insert('nodes', { name: 'N1', swim_lane_id: laneId })[0];
    DDS_CMD.execute(DDS_TX.LANE_DELETE, { id: laneId }, null);
    expect(DDS_STORE.query('nodes', { id: node.id }).length).toBe(0);
  });

  it('removes map_swim_lanes across all maps', () => {
    const mapId = getMapId();
    const { id: laneId } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Lane' }, null);
    DDS_STORE.insert('map_swim_lanes', { map_id: mapId, swim_lane_id: laneId, x: 0, y: 0, width: 200, height: 300 });
    DDS_CMD.execute(DDS_TX.LANE_DELETE, { id: laneId }, null);
    expect(DDS_STORE.query('map_swim_lanes', { swim_lane_id: laneId }).length).toBe(0);
  });

  it('clears default_swim_lane_id on node_types that referenced it', () => {
    const { id: laneId } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Lane' }, null);
    const nt = DDS_STORE.insert('node_types', { code: 'SUPPLIER', label: 'Supplier', default_swim_lane_id: laneId })[0];
    DDS_CMD.execute(DDS_TX.LANE_DELETE, { id: laneId }, null);
    expect(DDS_STORE.query('node_types', { id: nt.id })[0].default_swim_lane_id).toBe(null);
  });

  it('is undoable — restores the lane and its cascade', () => {
    const { id: laneId } = DDS_CMD.execute(DDS_TX.LANE_CREATE, { name: 'Lane' }, null);
    const node = DDS_STORE.insert('nodes', { name: 'N1', swim_lane_id: laneId })[0];
    DDS_CMD.execute(DDS_TX.LANE_DELETE, { id: laneId }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('swim_lanes', { id: laneId }).length).toBe(1);
    expect(DDS_STORE.query('nodes', { id: node.id }).length).toBe(1);
  });
});

// ------------------------------------------------------------------ //
// TX.ANNOTATION_DELETE — cascade via DDS_MODEL.deleteAnnotation
// ------------------------------------------------------------------ //

describe('DDS_TX.ANNOTATION_DELETE', () => {
  beforeEach(setup);

  it('removes the annotation record', () => {
    const ann = DDS_STORE.insert('annotations', { notes: 'Hello' })[0];
    DDS_CMD.execute(DDS_TX.ANNOTATION_DELETE, { id: ann.id }, null);
    expect(DDS_STORE.query('annotations', { id: ann.id }).length).toBe(0);
  });

  it('cascades to map_annotations across all maps', () => {
    const mapId = getMapId();
    const ann = DDS_STORE.insert('annotations', { notes: 'Hello' })[0];
    DDS_STORE.insert('map_annotations', { map_id: mapId, annotation_id: ann.id, x: 0, y: 0 });
    DDS_CMD.execute(DDS_TX.ANNOTATION_DELETE, { id: ann.id }, null);
    expect(DDS_STORE.query('map_annotations', { annotation_id: ann.id }).length).toBe(0);
  });

  it('is undoable — restores annotation and map_annotations', () => {
    const mapId = getMapId();
    const ann = DDS_STORE.insert('annotations', { notes: 'Hello' })[0];
    DDS_STORE.insert('map_annotations', { map_id: mapId, annotation_id: ann.id, x: 0, y: 0 });
    DDS_CMD.execute(DDS_TX.ANNOTATION_DELETE, { id: ann.id }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('annotations', { id: ann.id }).length).toBe(1);
    expect(DDS_STORE.query('map_annotations', { annotation_id: ann.id }).length).toBe(1);
  });
});

// ------------------------------------------------------------------ //
// TX.CONFIGURATION_NODE_TYPE (formerly TX.SETTINGS_NODE_TYPE — T-034)
// ------------------------------------------------------------------ //

describe('DDS_TX.CONFIGURATION_NODE_TYPE', () => {
  beforeEach(setup);

  it('inserts a node_type when no id is given', () => {
    const result = DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'SUPPLIER', label: 'Supplier', shape: 'rectangle' } }, null);
    expect(result.ok).toBe(true);
    expect(DDS_STORE.query('node_types').length).toBe(1);
  });

  it('updates an existing node_type when id is given', () => {
    const { id } = DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'A', label: 'Old' } }, null);
    DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { id, fields: { code: 'A', label: 'New' } }, null);
    expect(DDS_STORE.query('node_types', { id })[0].label).toBe('New');
    expect(DDS_STORE.query('node_types').length).toBe(1);
  });

  it('forceInsert inserts a new record even when id is given (Save as New)', () => {
    const { id } = DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'A', label: 'Original' } }, null);
    const result = DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { id, forceInsert: true, fields: { code: 'B', label: 'Copy' } }, null);
    expect(DDS_STORE.query('node_types').length).toBe(2);
    expect(result.id).not.toBe(id);
  });

  it('enforces single is_default across node_types', () => {
    const { id: a } = DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'A', label: 'A', is_default: true } }, null);
    DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'B', label: 'B', is_default: true } }, null);
    expect(DDS_STORE.query('node_types', { id: a })[0].is_default).toBe(false);
    expect(DDS_STORE.query('node_types', { is_default: true }).length).toBe(1);
  });

  it('enforces single is_product_node_default across node_types', () => {
    const { id: a } = DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'A', label: 'A', is_product_node_default: true } }, null);
    DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'B', label: 'B', is_product_node_default: true } }, null);
    expect(DDS_STORE.query('node_types', { id: a })[0].is_product_node_default).toBe(false);
    expect(DDS_STORE.query('node_types', { is_product_node_default: true }).length).toBe(1);
  });

  it('is undoable', () => {
    DDS_CMD.execute(DDS_TX.CONFIGURATION_NODE_TYPE, { fields: { code: 'A', label: 'A' } }, null);
    expect(DDS_STORE.query('node_types').length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('node_types').length).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// TX.CONFIGURATION_PRODUCT_TYPE (formerly TX.SETTINGS_PRODUCT_TYPE — T-034)
// ------------------------------------------------------------------ //

describe('DDS_TX.CONFIGURATION_PRODUCT_TYPE', () => {
  beforeEach(setup);

  it('inserts a product_type when no id is given', () => {
    const result = DDS_CMD.execute(DDS_TX.CONFIGURATION_PRODUCT_TYPE, { fields: { code: 'RAW', label: 'Raw material' } }, null);
    expect(result.ok).toBe(true);
    expect(DDS_STORE.query('product_types').length).toBe(1);
  });

  it('updates an existing product_type when id is given', () => {
    const { id } = DDS_CMD.execute(DDS_TX.CONFIGURATION_PRODUCT_TYPE, { fields: { code: 'A', label: 'Old' } }, null);
    DDS_CMD.execute(DDS_TX.CONFIGURATION_PRODUCT_TYPE, { id, fields: { code: 'A', label: 'New' } }, null);
    expect(DDS_STORE.query('product_types', { id })[0].label).toBe('New');
  });

  it('enforces single is_default across product_types', () => {
    const { id: a } = DDS_CMD.execute(DDS_TX.CONFIGURATION_PRODUCT_TYPE, { fields: { code: 'A', label: 'A', is_default: true } }, null);
    DDS_CMD.execute(DDS_TX.CONFIGURATION_PRODUCT_TYPE, { fields: { code: 'B', label: 'B', is_default: true } }, null);
    expect(DDS_STORE.query('product_types', { id: a })[0].is_default).toBe(false);
  });

  it('is undoable', () => {
    DDS_CMD.execute(DDS_TX.CONFIGURATION_PRODUCT_TYPE, { fields: { code: 'A', label: 'A' } }, null);
    expect(DDS_STORE.query('product_types').length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('product_types').length).toBe(0);
  });
});

// ------------------------------------------------------------------ //
// Phase 3 — Products / BOMs / Demands (tabular CRUD)
// ------------------------------------------------------------------ //

describe('DDS_TX.PRODUCT_CREATE', () => {
  beforeEach(setup);

  it('inserts a product record', () => {
    const result = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Widget', type_code: 'FG' }, null);
    expect(result.ok).toBe(true);
    const products = DDS_STORE.query('products');
    expect(products.length).toBe(1);
    expect(products[0].name).toBe('Widget');
    expect(products[0].type_code).toBe('FG');
  });

  it('defaults tags to an empty array and notes to an empty string', () => {
    DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Widget' }, null);
    const product = DDS_STORE.query('products')[0];
    expect(product.tags).toEqual([]);
    expect(product.notes).toBe('');
  });

  it('is undoable', () => {
    DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Undo me' }, null);
    expect(DDS_STORE.query('products').length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('products').length).toBe(0);
  });
});

describe('DDS_TX.PRODUCT_UPDATE', () => {
  beforeEach(setup);

  it('updates the given fields only', () => {
    const { id } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Old', type_code: 'FG' }, null);
    DDS_CMD.execute(DDS_TX.PRODUCT_UPDATE, { id, name: 'New' }, null);
    const product = DDS_STORE.query('products', { id })[0];
    expect(product.name).toBe('New');
    expect(product.type_code).toBe('FG');
  });

  it('is undoable', () => {
    const { id } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Original' }, null);
    DDS_CMD.execute(DDS_TX.PRODUCT_UPDATE, { id, name: 'Changed' }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('products', { id })[0].name).toBe('Original');
  });
});

describe('DDS_TX.PRODUCT_DELETE — cascade via DDS_MODEL.deleteProduct', () => {
  beforeEach(setup);

  it('removes the product record', () => {
    const { id } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'ToDelete' }, null);
    DDS_CMD.execute(DDS_TX.PRODUCT_DELETE, { id }, null);
    expect(DDS_STORE.query('products', { id }).length).toBe(0);
  });

  it('removes skus referencing the product', () => {
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    DDS_STORE.insert('skus', { node_id: node.id, product_id: productId });
    DDS_CMD.execute(DDS_TX.PRODUCT_DELETE, { id: productId }, null);
    expect(DDS_STORE.query('skus', { product_id: productId }).length).toBe(0);
  });

  it('removes demands associated with the product', () => {
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    DDS_STORE.insert('demands', { node_id: node.id, product_id: productId });
    DDS_CMD.execute(DDS_TX.PRODUCT_DELETE, { id: productId }, null);
    expect(DDS_STORE.query('demands', { product_id: productId }).length).toBe(0);
  });

  it('removes boms whose output_product_id matches, with their bom_components', () => {
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const { id: compId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Component' }, null);
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const bom = DDS_STORE.insert('boms', { node_id: node.id, output_product_id: productId })[0];
    DDS_STORE.insert('bom_components', { bom_id: bom.id, product_id: compId, quantity: 1 });
    DDS_CMD.execute(DDS_TX.PRODUCT_DELETE, { id: productId }, null);
    expect(DDS_STORE.query('boms', { id: bom.id }).length).toBe(0);
    expect(DDS_STORE.query('bom_components', { bom_id: bom.id }).length).toBe(0);
  });

  it('is undoable — restores the product and its cascade', () => {
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    DDS_STORE.insert('skus', { node_id: node.id, product_id: productId });
    DDS_CMD.execute(DDS_TX.PRODUCT_DELETE, { id: productId }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('products', { id: productId }).length).toBe(1);
    expect(DDS_STORE.query('skus', { product_id: productId }).length).toBe(1);
  });
});

describe('DDS_TX.BOM_CREATE', () => {
  beforeEach(setup);

  it('inserts a bom record with no components', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const result = DDS_CMD.execute(DDS_TX.BOM_CREATE, { node_id: node.id, output_product_id: productId }, null);
    expect(result.ok).toBe(true);
    expect(DDS_STORE.query('boms', { id: result.id }).length).toBe(1);
  });

  it('inserts components alongside the bom, ignoring entries without product_id', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: outputId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const { id: compId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Component' }, null);
    const result = DDS_CMD.execute(DDS_TX.BOM_CREATE, {
      node_id: node.id,
      output_product_id: outputId,
      components: [{ product_id: compId, quantity: 3, notes: 'steel' }, { product_id: null, quantity: 1 }]
    }, null);
    const components = DDS_STORE.query('bom_components', { bom_id: result.id });
    expect(components.length).toBe(1);
    expect(components[0].product_id).toBe(compId);
    expect(components[0].quantity).toBe(3);
    expect(components[0].notes).toBe('steel');
  });

  it('fails when a bom for the same node/output product already exists', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    DDS_CMD.execute(DDS_TX.BOM_CREATE, { node_id: node.id, output_product_id: productId }, null);
    const result = DDS_CMD.execute(DDS_TX.BOM_CREATE, { node_id: node.id, output_product_id: productId }, null);
    expect(result.ok).toBe(false);
    expect(DDS_STORE.query('boms', { node_id: node.id, output_product_id: productId }).length).toBe(1);
  });

  it('is undoable — removes bom and its components', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: outputId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const { id: compId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Component' }, null);
    const { id: bomId } = DDS_CMD.execute(DDS_TX.BOM_CREATE, {
      node_id: node.id, output_product_id: outputId, components: [{ product_id: compId, quantity: 1 }]
    }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('boms', { id: bomId }).length).toBe(0);
    expect(DDS_STORE.query('bom_components', { bom_id: bomId }).length).toBe(0);
  });
});

describe('DDS_TX.BOM_UPDATE_COMPONENTS', () => {
  beforeEach(setup);

  function makeBom() {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: outputId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const { id: p1 } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'C1' }, null);
    const { id: p2 } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'C2' }, null);
    const { id: bomId } = DDS_CMD.execute(DDS_TX.BOM_CREATE, {
      node_id: node.id,
      output_product_id: outputId,
      components: [{ product_id: p1, quantity: 2, notes: '' }, { product_id: p2, quantity: 1, notes: 'old' }]
    }, null);
    return { bomId, p1, p2 };
  }

  it('removes components no longer present', () => {
    const { bomId, p2 } = makeBom();
    DDS_CMD.execute(DDS_TX.BOM_UPDATE_COMPONENTS, { bom_id: bomId, components: [{ product_id: p2, quantity: 1, notes: 'old' }] }, null);
    expect(DDS_STORE.query('bom_components', { bom_id: bomId }).length).toBe(1);
  });

  it('adds new components and updates changed ones', () => {
    const { bomId, p1, p2 } = makeBom();
    const { id: p3 } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'C3' }, null);
    DDS_CMD.execute(DDS_TX.BOM_UPDATE_COMPONENTS, {
      bom_id: bomId,
      components: [{ product_id: p2, quantity: 3, notes: 'new' }, { product_id: p3, quantity: 5, notes: '' }]
    }, null);
    const components = DDS_STORE.query('bom_components', { bom_id: bomId });
    expect(components.length).toBe(2);
    expect(components.find(c => c.product_id === p1)).toBeUndefined();
    const c2 = components.find(c => c.product_id === p2);
    expect(c2.quantity).toBe(3);
    expect(c2.notes).toBe('new');
    const c3 = components.find(c => c.product_id === p3);
    expect(c3.quantity).toBe(5);
  });

  it('is undoable', () => {
    const { bomId, p1, p2 } = makeBom();
    DDS_CMD.execute(DDS_TX.BOM_UPDATE_COMPONENTS, { bom_id: bomId, components: [{ product_id: p2, quantity: 9, notes: '' }] }, null);
    DDS_TRANSACTIONS.undo();
    const components = DDS_STORE.query('bom_components', { bom_id: bomId });
    expect(components.length).toBe(2);
    expect(components.find(c => c.product_id === p1)).toBeDefined();
    expect(components.find(c => c.product_id === p2).quantity).toBe(1);
  });
});

describe('DDS_TX.BOM_DELETE — cascade via DDS_MODEL.deleteBom', () => {
  beforeEach(setup);

  it('removes the bom and its components', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: outputId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const { id: compId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Component' }, null);
    const { id: bomId } = DDS_CMD.execute(DDS_TX.BOM_CREATE, {
      node_id: node.id, output_product_id: outputId, components: [{ product_id: compId, quantity: 1 }]
    }, null);
    DDS_CMD.execute(DDS_TX.BOM_DELETE, { id: bomId }, null);
    expect(DDS_STORE.query('boms', { id: bomId }).length).toBe(0);
    expect(DDS_STORE.query('bom_components', { bom_id: bomId }).length).toBe(0);
  });

  it('is undoable', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: outputId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'Output' }, null);
    const { id: bomId } = DDS_CMD.execute(DDS_TX.BOM_CREATE, { node_id: node.id, output_product_id: outputId }, null);
    DDS_CMD.execute(DDS_TX.BOM_DELETE, { id: bomId }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('boms', { id: bomId }).length).toBe(1);
  });
});

describe('DDS_TX.DEMAND_UPDATE', () => {
  beforeEach(setup);

  function makeDemand() {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    DDS_STORE.insert('demands', { node_id: node.id, product_id: productId, demand_value: 10, demand_period: 'weeks' });
    return { nodeId: node.id, productId };
  }

  it('updates only the given fields', () => {
    const { nodeId, productId } = makeDemand();
    DDS_CMD.execute(DDS_TX.DEMAND_UPDATE, { node_id: nodeId, product_id: productId, demand_value: 25 }, null);
    const demand = DDS_STORE.query('demands', { node_id: nodeId, product_id: productId })[0];
    expect(demand.demand_value).toBe(25);
    expect(demand.demand_period).toBe('weeks');
  });

  it('is undoable', () => {
    const { nodeId, productId } = makeDemand();
    DDS_CMD.execute(DDS_TX.DEMAND_UPDATE, { node_id: nodeId, product_id: productId, demand_value: 99 }, null);
    DDS_TRANSACTIONS.undo();
    const demand = DDS_STORE.query('demands', { node_id: nodeId, product_id: productId })[0];
    expect(demand.demand_value).toBe(10);
  });
});

describe('DDS_TX.NODE_CREATE', () => {
  beforeEach(setup);

  it('inserts a node record with given fields', () => {
    const { id, ok } = DDS_CMD.execute(DDS_TX.NODE_CREATE, {
      name: 'Supplier A', type_code: 'supplier', swim_lane_id: null
    }, null);
    expect(ok).toBe(true);
    const node = DDS_STORE.query('nodes', { id })[0];
    expect(node.name).toBe('Supplier A');
    expect(node.type_code).toBe('supplier');
  });

  it('defaults tags/notes when not provided (table-driven create, no mapId)', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NODE_CREATE, { name: 'N1' }, null);
    const node = DDS_STORE.query('nodes', { id })[0];
    expect(node.tags).toEqual([]);
    expect(node.notes).toBe('');
  });

  it('does not create a map_nodes row when mapId is absent (table call site)', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NODE_CREATE, { name: 'N1' }, null);
    expect(DDS_STORE.query('map_nodes', { node_id: id }).length).toBe(0);
  });

  it('is undoable', () => {
    const { id } = DDS_CMD.execute(DDS_TX.NODE_CREATE, { name: 'Undo me' }, null);
    expect(DDS_STORE.query('nodes', { id }).length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('nodes', { id }).length).toBe(0);
  });

  // NOTE: the mapId-present branch (modal call site, DDS_NODE_UI) calls
  // DDS_LAYOUT.placeNode() to compute canvas position. DDS_LAYOUT is not
  // part of the vitest shims (shims/modules.js) — same pre-existing gap as
  // TX.MAP_ADD_PRODUCT_NODE (Phase 4), which has no unit coverage for the
  // same reason. That branch is covered by manual verification only.
});

describe('DDS_TX.FLOW_CREATE', () => {
  beforeEach(setup);

  it('inserts a flow record and a map_flows row', () => {
    const mapId = getMapId();
    const n1 = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const n2 = DDS_STORE.insert('nodes', { name: 'N2' })[0];
    const { ok, id, flowId, mapFlowId } = DDS_CMD.execute(DDS_TX.FLOW_CREATE, {
      source_id: n1.id, target_id: n2.id
    }, mapId);
    expect(ok).toBe(true);
    expect(flowId).toBe(id);
    const flow = DDS_STORE.query('flows', { id })[0];
    expect(flow.source_node_id).toBe(n1.id);
    expect(flow.target_node_id).toBe(n2.id);
    const mapFlows = DDS_STORE.query('map_flows', { id: mapFlowId });
    expect(mapFlows.length).toBe(1);
    expect(mapFlows[0].flow_id).toBe(id);
  });

  it('throws when mapId is missing', () => {
    const n1 = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const n2 = DDS_STORE.insert('nodes', { name: 'N2' })[0];
    const result = DDS_CMD.execute(DDS_TX.FLOW_CREATE, { source_id: n1.id, target_id: n2.id }, null);
    expect(result.ok).toBe(false);
  });

  it('is undoable — removes both flow and map_flows', () => {
    const mapId = getMapId();
    const n1 = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const n2 = DDS_STORE.insert('nodes', { name: 'N2' })[0];
    const { id } = DDS_CMD.execute(DDS_TX.FLOW_CREATE, { source_id: n1.id, target_id: n2.id }, mapId);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('flows', { id }).length).toBe(0);
    expect(DDS_STORE.query('map_flows', { flow_id: id }).length).toBe(0);
  });
});

describe('DDS_TX.FLOW_REROUTE', () => {
  beforeEach(setup);

  function makeFlow() {
    const mapId = getMapId();
    const n1 = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const n2 = DDS_STORE.insert('nodes', { name: 'N2' })[0];
    const n3 = DDS_STORE.insert('nodes', { name: 'N3' })[0];
    const { id: flowId } = DDS_CMD.execute(DDS_TX.FLOW_CREATE, { source_id: n1.id, target_id: n2.id }, mapId);
    return { flowId, n1, n2, n3 };
  }

  it('reroutes the source endpoint', () => {
    const { flowId, n2, n3 } = makeFlow();
    DDS_CMD.execute(DDS_TX.FLOW_REROUTE, { flow_id: flowId, new_source_id: n3.id }, null);
    const flow = DDS_STORE.query('flows', { id: flowId })[0];
    expect(flow.source_node_id).toBe(n3.id);
    expect(flow.target_node_id).toBe(n2.id);
  });

  it('reroutes the target endpoint', () => {
    const { flowId, n1, n3 } = makeFlow();
    DDS_CMD.execute(DDS_TX.FLOW_REROUTE, { flow_id: flowId, new_target_id: n3.id }, null);
    const flow = DDS_STORE.query('flows', { id: flowId })[0];
    expect(flow.source_node_id).toBe(n1.id);
    expect(flow.target_node_id).toBe(n3.id);
  });

  it('is undoable', () => {
    const { flowId, n1, n3 } = makeFlow();
    DDS_CMD.execute(DDS_TX.FLOW_REROUTE, { flow_id: flowId, new_source_id: n3.id }, null);
    DDS_TRANSACTIONS.undo();
    const flow = DDS_STORE.query('flows', { id: flowId })[0];
    expect(flow.source_node_id).toBe(n1.id);
  });
});

describe('DDS_TX.MAP_MOVE_WAYPOINT', () => {
  beforeEach(setup);

  function makeMapFlow() {
    const mapId = getMapId();
    const n1 = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const n2 = DDS_STORE.insert('nodes', { name: 'N2' })[0];
    const { mapFlowId } = DDS_CMD.execute(DDS_TX.FLOW_CREATE, { source_id: n1.id, target_id: n2.id }, mapId);
    return { mapFlowId };
  }

  it('persists waypoint_pct on the map_flows row', () => {
    const { mapFlowId } = makeMapFlow();
    DDS_CMD.execute(DDS_TX.MAP_MOVE_WAYPOINT, { map_flow_id: mapFlowId, waypoint_pct: 0.3 }, null);
    expect(DDS_STORE.query('map_flows', { id: mapFlowId })[0].waypoint_pct).toBe(0.3);
  });

  it('resets to 0.5', () => {
    const { mapFlowId } = makeMapFlow();
    DDS_CMD.execute(DDS_TX.MAP_MOVE_WAYPOINT, { map_flow_id: mapFlowId, waypoint_pct: 0.2 }, null);
    DDS_CMD.execute(DDS_TX.MAP_MOVE_WAYPOINT, { map_flow_id: mapFlowId, waypoint_pct: 0.5 }, null);
    expect(DDS_STORE.query('map_flows', { id: mapFlowId })[0].waypoint_pct).toBe(0.5);
  });

  it('is undoable', () => {
    const { mapFlowId } = makeMapFlow();
    DDS_CMD.execute(DDS_TX.MAP_MOVE_WAYPOINT, { map_flow_id: mapFlowId, waypoint_pct: 0.8 }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('map_flows', { id: mapFlowId })[0].waypoint_pct).not.toBe(0.8);
  });
});

describe('DDS_TX.MAP_MOVE_NODE', () => {
  beforeEach(setup);

  it('persists x/y on the map_nodes row', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const mn = DDS_STORE.insert('map_nodes', { map_id: mapId, node_id: node.id, x: 10, y: 10 })[0];
    DDS_CMD.execute(DDS_TX.MAP_MOVE_NODE, { map_node_id: mn.id, x: 150, y: 220 }, null);
    const updated = DDS_STORE.query('map_nodes', { id: mn.id })[0];
    expect(updated.x).toBe(150);
    expect(updated.y).toBe(220);
  });

  it('is undoable', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const mn = DDS_STORE.insert('map_nodes', { map_id: mapId, node_id: node.id, x: 10, y: 10 })[0];
    DDS_CMD.execute(DDS_TX.MAP_MOVE_NODE, { map_node_id: mn.id, x: 150, y: 220 }, null);
    DDS_TRANSACTIONS.undo();
    const reverted = DDS_STORE.query('map_nodes', { id: mn.id })[0];
    expect(reverted.x).toBe(10);
    expect(reverted.y).toBe(10);
  });
});

describe('DDS_TX.MAP_MOVE_NOTE_GHOST', () => {
  beforeEach(setup);

  it('persists note_dx/note_dy on the map_nodes row', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const mn = DDS_STORE.insert('map_nodes', { map_id: mapId, node_id: node.id, x: 0, y: 0 })[0];
    DDS_CMD.execute(DDS_TX.MAP_MOVE_NOTE_GHOST, { map_node_id: mn.id, note_dx: 12, note_dy: -8 }, null);
    const updated = DDS_STORE.query('map_nodes', { id: mn.id })[0];
    expect(updated.note_dx).toBe(12);
    expect(updated.note_dy).toBe(-8);
  });

  it('is undoable', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const mn = DDS_STORE.insert('map_nodes', { map_id: mapId, node_id: node.id, x: 0, y: 0, note_dx: 0, note_dy: 30 })[0];
    DDS_CMD.execute(DDS_TX.MAP_MOVE_NOTE_GHOST, { map_node_id: mn.id, note_dx: 12, note_dy: -8 }, null);
    DDS_TRANSACTIONS.undo();
    const reverted = DDS_STORE.query('map_nodes', { id: mn.id })[0];
    expect(reverted.note_dx).toBe(0);
    expect(reverted.note_dy).toBe(30);
  });
});

describe('DDS_TX.MAP_MOVE_ANNOTATION', () => {
  beforeEach(setup);

  function makeMapAnnotation() {
    const mapId = getMapId();
    const ann = DDS_STORE.insert('annotations', { notes: 'A1' })[0];
    const ma = DDS_STORE.insert('map_annotations', { map_id: mapId, annotation_id: ann.id, x: 0, y: 0 })[0];
    return { ma };
  }

  it('persists x/y on the map_annotations row', () => {
    const { ma } = makeMapAnnotation();
    DDS_CMD.execute(DDS_TX.MAP_MOVE_ANNOTATION, { map_annotation_id: ma.id, x: 77, y: 88 }, null);
    const updated = DDS_STORE.query('map_annotations', { id: ma.id })[0];
    expect(updated.x).toBe(77);
    expect(updated.y).toBe(88);
  });

  it('is undoable', () => {
    const { ma } = makeMapAnnotation();
    DDS_CMD.execute(DDS_TX.MAP_MOVE_ANNOTATION, { map_annotation_id: ma.id, x: 77, y: 88 }, null);
    DDS_TRANSACTIONS.undo();
    const reverted = DDS_STORE.query('map_annotations', { id: ma.id })[0];
    expect(reverted.x).toBe(0);
    expect(reverted.y).toBe(0);
  });
});

// NOTE: TX.MAP_RESIZE_LANE (DDS_SWIMLANES, SCRIPT 1100) was found during
// Phase 5 to already implement the §1.5 begin-at-mousedown pattern correctly
// with direct DDS_TRANSACTIONS.begin/commit/rollback calls (no DDS_CMD.execute
// involved by design — execute() is single-shot and cannot support the
// split-phase mousedown/onMove/mouseup lifecycle). No command was added and no
// code changed; see DDScope_Commands.md v1.9 for the docs-only correction.

describe('DDS_TX.DEMAND_DELETE — cascade via DDS_MODEL.deleteDemand', () => {
  beforeEach(setup);

  it('removes the demand record', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    DDS_STORE.insert('demands', { node_id: node.id, product_id: productId });
    DDS_CMD.execute(DDS_TX.DEMAND_DELETE, { node_id: node.id, product_id: productId }, null);
    expect(DDS_STORE.query('demands', { node_id: node.id, product_id: productId }).length).toBe(0);
  });

  it('removes map_demands for the deleted demand', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    const demand = DDS_STORE.insert('demands', { node_id: node.id, product_id: productId })[0];
    DDS_STORE.insert('map_demands', { demand_id: demand.id, map_id: mapId });
    DDS_CMD.execute(DDS_TX.DEMAND_DELETE, { node_id: node.id, product_id: productId }, null);
    expect(DDS_STORE.query('map_demands', { demand_id: demand.id }).length).toBe(0);
  });

  it('is undoable', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const { id: productId } = DDS_CMD.execute(DDS_TX.PRODUCT_CREATE, { name: 'P1' }, null);
    DDS_STORE.insert('demands', { node_id: node.id, product_id: productId });
    DDS_CMD.execute(DDS_TX.DEMAND_DELETE, { node_id: node.id, product_id: productId }, null);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('demands', { node_id: node.id, product_id: productId }).length).toBe(1);
  });
});

// ------------------------------------------------------------------ //
// MAP_ADD_NODE — place an existing node on the map (T-036 part 1)
//
// DDS_LAYOUT (src/presentation) is not part of the vitest shims
// (shims/modules.js loads src/core only). placeNode is stubbed locally so
// the handler's store mutation, idempotent guard, and undo are covered —
// the placement algorithm itself is out of scope here.
// ------------------------------------------------------------------ //

describe('DDS_TX.MAP_ADD_NODE', () => {
  beforeEach(() => {
    setup();
    globalThis.DDS_LAYOUT = { placeNode: () => ({ x: 123, y: 456 }) };
  });

  it('exposes the TX key', () => {
    expect(DDS_TX.MAP_ADD_NODE).toBe('map.add_node');
  });

  it('inserts a map_nodes row with the placed position', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1', type_code: 'plant' })[0];
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: node.id }, mapId);
    expect(result.ok).toBe(true);
    const rows = DDS_STORE.query('map_nodes', { map_id: mapId, node_id: node.id });
    expect(rows.length).toBe(1);
    expect(rows[0].x).toBe(123);
    expect(rows[0].y).toBe(456);
    expect(result.mapNodeId).toBe(rows[0].id);
    expect(result.name).toBe('N1');
    expect(result.typeCode).toBe('plant');
  });

  it('fails without a mapId', () => {
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: node.id }, null);
    expect(result.ok).toBe(false);
  });

  it('fails for an unknown node', () => {
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: 99999 }, getMapId());
    expect(result.ok).toBe(false);
  });

  it('is idempotent — no duplicate map_nodes row, alreadyOnMap flagged', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: node.id }, mapId);
    const second = DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: node.id }, mapId);
    expect(second.ok).toBe(true);
    expect(second.alreadyOnMap).toBe(true);
    expect(DDS_STORE.query('map_nodes', { map_id: mapId, node_id: node.id }).length).toBe(1);
  });

  it('coerces a string node_id (AI-string-id pattern)', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: String(node.id) }, mapId);
    expect(result.ok).toBe(true);
    expect(DDS_STORE.query('map_nodes', { map_id: mapId, node_id: node.id }).length).toBe(1);
  });

  it('is undoable — undo removes the map_nodes row, node record untouched', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    DDS_TRANSACTIONS.clear();
    DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: node.id }, mapId);
    expect(DDS_STORE.query('map_nodes', { map_id: mapId, node_id: node.id }).length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('map_nodes', { map_id: mapId, node_id: node.id }).length).toBe(0);
    expect(DDS_STORE.query('nodes', { id: node.id }).length).toBe(1);
  });

  it('is redoable', () => {
    const mapId = getMapId();
    const node = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    DDS_TRANSACTIONS.clear();
    DDS_CMD.execute(DDS_TX.MAP_ADD_NODE, { node_id: node.id }, mapId);
    DDS_TRANSACTIONS.undo();
    DDS_TRANSACTIONS.redo();
    expect(DDS_STORE.query('map_nodes', { map_id: mapId, node_id: node.id }).length).toBe(1);
  });

  it('describe() labels it with the node name', () => {
    const node = DDS_STORE.insert('nodes', { name: 'Plant Lyon' })[0];
    const labels = DDS_CMD.describe([{ type: DDS_TX.MAP_ADD_NODE, params: { node_id: node.id } }]);
    expect(labels[0].label).toBe('Add node "Plant Lyon" to map');
  });
});

// ------------------------------------------------------------------ //
// MAP_ADD_FLOW — place an existing flow on the map (T-036 part 3)
// ------------------------------------------------------------------ //

describe('DDS_TX.MAP_ADD_FLOW', () => {
  beforeEach(setup);

  function makeFlowOffMap() {
    // FLOW_CREATE always places on the map it's given (map_flows insert) —
    // to get a flow that exists but is NOT on the active map, create it on
    // a second map, mirroring the D&D scenario this command targets.
    const activeMapId = getMapId();
    const otherMap = DDS_STORE.insert('maps', { name: 'Other map', position: 2 })[0];
    const n1 = DDS_STORE.insert('nodes', { name: 'N1' })[0];
    const n2 = DDS_STORE.insert('nodes', { name: 'N2' })[0];
    const { id: flowId } = DDS_CMD.execute(DDS_TX.FLOW_CREATE, { source_id: n1.id, target_id: n2.id }, otherMap.id);
    return { activeMapId, flowId, n1, n2 };
  }

  it('exposes the TX key', () => {
    expect(DDS_TX.MAP_ADD_FLOW).toBe('map.add_flow');
  });

  it('inserts a map_flows row on the target map', () => {
    const { activeMapId, flowId } = makeFlowOffMap();
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: flowId }, activeMapId);
    expect(result.ok).toBe(true);
    const rows = DDS_STORE.query('map_flows', { map_id: activeMapId, flow_id: flowId });
    expect(rows.length).toBe(1);
    expect(result.mapFlowId).toBe(rows[0].id);
  });

  it('fails without a mapId', () => {
    const { flowId } = makeFlowOffMap();
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: flowId }, null);
    expect(result.ok).toBe(false);
  });

  it('fails for an unknown flow', () => {
    const { activeMapId } = makeFlowOffMap();
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: 99999 }, activeMapId);
    expect(result.ok).toBe(false);
  });

  it('is idempotent — no duplicate map_flows row, alreadyOnMap flagged', () => {
    const { activeMapId, flowId } = makeFlowOffMap();
    DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: flowId }, activeMapId);
    const second = DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: flowId }, activeMapId);
    expect(second.ok).toBe(true);
    expect(second.alreadyOnMap).toBe(true);
    expect(DDS_STORE.query('map_flows', { map_id: activeMapId, flow_id: flowId }).length).toBe(1);
  });

  it('coerces a string flow_id (AI-string-id pattern)', () => {
    const { activeMapId, flowId } = makeFlowOffMap();
    const result = DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: String(flowId) }, activeMapId);
    expect(result.ok).toBe(true);
    expect(DDS_STORE.query('map_flows', { map_id: activeMapId, flow_id: flowId }).length).toBe(1);
  });

  it('is undoable — undo removes the map_flows row, flow record untouched', () => {
    const { activeMapId, flowId } = makeFlowOffMap();
    DDS_TRANSACTIONS.clear();
    DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: flowId }, activeMapId);
    expect(DDS_STORE.query('map_flows', { map_id: activeMapId, flow_id: flowId }).length).toBe(1);
    DDS_TRANSACTIONS.undo();
    expect(DDS_STORE.query('map_flows', { map_id: activeMapId, flow_id: flowId }).length).toBe(0);
    expect(DDS_STORE.query('flows', { id: flowId }).length).toBe(1);
  });

  it('is redoable', () => {
    const { activeMapId, flowId } = makeFlowOffMap();
    DDS_TRANSACTIONS.clear();
    DDS_CMD.execute(DDS_TX.MAP_ADD_FLOW, { flow_id: flowId }, activeMapId);
    DDS_TRANSACTIONS.undo();
    DDS_TRANSACTIONS.redo();
    expect(DDS_STORE.query('map_flows', { map_id: activeMapId, flow_id: flowId }).length).toBe(1);
  });

  it('describe() labels it with both endpoint names', () => {
    const { flowId } = makeFlowOffMap();
    const labels = DDS_CMD.describe([{ type: DDS_TX.MAP_ADD_FLOW, params: { flow_id: flowId } }]);
    expect(labels[0].label).toBe('Add flow N1 → N2 to map');
  });
});
