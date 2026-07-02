// JS: TX — transaction label catalogue
// CommWise block: SCRIPT 1865
// Testability: pure
// Depends on: none
// API documented: yes
// SRC MIRROR NOTE (2026-07-02): synced against live SCRIPT 1865 (BOM_COMPONENT_*
// and MAP_REMOVE_LANE keys were missing) alongside the DDS_CMD.js resync —
// see DDScope_Commands.md v1.13.

var TX = {
  // Nodes
  NODE_CREATE:              'node.create',
  NODE_UPDATE:              'node.update',
  NODE_DELETE:              'node.delete',
  NODE_ASSIGN_LANE:         'node.assign_lane', // unused — legacy side-panel call site uses NODE_UPDATE (see DDScope_Commands.md §3.3)

  // Flows
  FLOW_CREATE:              'flow.create',
  FLOW_UPDATE:              'flow.update',
  FLOW_DELETE:              'flow.delete',
  FLOW_REROUTE:             'flow.reroute',
  FLOW_ADD_PRODUCT:         'flow.add_product',
  FLOW_REMOVE_PRODUCT:      'flow.remove_product',

  // Products
  PRODUCT_CREATE:           'product.create',
  PRODUCT_UPDATE:           'product.update',
  PRODUCT_DELETE:           'product.delete',

  // SKUs
  SKU_ADD:                  'sku.add', // standalone AI-vocabulary command (Phase 6 Step 2) — legacy UI call sites still fold this into FLOW_ADD_PRODUCT
  SKU_UPDATE:               'sku.update',
  SKU_REMOVE:               'sku.remove', // standalone AI-vocabulary command (Phase 6 Step 2) — legacy UI call sites still fold this into FLOW_REMOVE_PRODUCT

  // BOMs
  BOM_CREATE:               'bom.create',
  BOM_UPDATE_COMPONENTS:    'bom.update_components',
  BOM_DELETE:               'bom.delete',
  BOM_COMPONENT_ADD:        'bom_component.add', // Phase 6 Step 2 — unitary BOM component commands for the AI vocabulary
  BOM_COMPONENT_UPDATE:     'bom_component.update',
  BOM_COMPONENT_REMOVE:     'bom_component.remove',

  // Demands
  DEMAND_CREATE:            'demand.create',
  DEMAND_UPDATE:            'demand.update',
  DEMAND_DELETE:            'demand.delete',

  // Annotations
  ANNOTATION_CREATE:        'annotation.create',
  ANNOTATION_UPDATE:        'annotation.update',
  ANNOTATION_DELETE:        'annotation.delete',

  // Multi-selection
  MULTI_DELETE:             'multi.delete',

  // Swim lanes
  LANE_CREATE:              'lane.create',
  LANE_UPDATE:              'lane.update',
  LANE_DELETE:              'lane.delete',
  LANE_REORDER:             'lane.reorder',

  // Maps
  MAP_CREATE:               'map.create',
  MAP_RENAME:               'map.rename',
  MAP_DELETE:               'map.delete',
  MAP_DUPLICATE:            'map.duplicate',

  // Map presentation — combined operations
  MAP_ADD_PRODUCT_NODE:     'map.add_product_node',

  // Map presentation — element visibility
  MAP_ADD_NODE:             'map.add_node',
  MAP_ADD_FLOW:             'map.add_flow',
  MAP_ADD_ANNOTATION:       'map.add_annotation',
  MAP_REMOVE_NODE:          'map.remove_node',
  MAP_REMOVE_FLOW:          'map.remove_flow',
  MAP_REMOVE_ANNOTATION:    'map.remove_annotation',
  MAP_REMOVE_LANE:          'map.remove_lane', // gap found during Phase 5 §3.4 migration — DDS_REMOVE lane modal supports "map only" removal, was never in the TX catalogue before

  // Map presentation — canvas geometry
  MAP_MOVE_NODE:            'map.move_node',
  MAP_MOVE_NOTE_GHOST:      'map.move_note_ghost',
  MAP_MOVE_CTT:             'map.move_ctt',
  MAP_RESIZE_CTT:           'map.resize_ctt',
  MAP_MOVE_WAYPOINT:        'map.move_waypoint',
  MAP_MOVE_FLOW_NOTE_GHOST: 'map.move_flow_note_ghost',
  MAP_MOVE_ANNOTATION:      'map.move_annotation',
  MAP_RESIZE_LANE:          'map.resize_lane',

  // Map presentation — demand visibility
  MAP_SHOW_DEMAND:          'map.show_demand',
  MAP_HIDE_DEMAND:          'map.hide_demand',

  // Notes (DDS_CMD — FEAT-002)
  NOTE_CATEGORY_CREATE:     'note_category.create',
  NOTE_CATEGORY_UPDATE:     'note_category.update',
  NOTE_CATEGORY_DELETE:     'note_category.delete',
  NOTE_CATEGORY_REORDER:    'note_category.reorder',
  NOTE_CREATE:              'note.create',
  NOTE_UPDATE:              'note.update',
  NOTE_DELETE:              'note.delete',
  NOTE_REORDER:             'note.reorder',

  // Project
  PROJECT_RENAME:           'project.rename',

  // Settings
  SETTINGS_NODE_TYPE:       'settings.node_type',
  SETTINGS_PRODUCT_TYPE:    'settings.product_type',

  // AI
  AI_APPLY_ACTIONS:         'ai.apply_actions',
};

window.TX = TX;

// ESM export for Vitest compatibility
export default TX;
