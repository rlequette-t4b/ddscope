// JS: DDS_TX — Centralised transaction label catalogue
// CommWise block: SCRIPT 1865
// Testability: pure
// Depends on: none
// API documented: yes

var DDS_TX = {
  // Nodes
  NODE_CREATE:              'node.create',
  NODE_UPDATE:              'node.update',
  NODE_DELETE:              'node.delete',
  NODE_ASSIGN_LANE:         'node.assign_lane',
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
  SKU_ADD:                  'sku.add',
  SKU_UPDATE:               'sku.update',
  SKU_REMOVE:               'sku.remove',
  // BOMs
  BOM_CREATE:               'bom.create',
  BOM_UPDATE_COMPONENTS:    'bom.update_components',
  BOM_DELETE:               'bom.delete',
  // Demands
  DEMAND_CREATE:            'demand.create',
  DEMAND_UPDATE:            'demand.update',
  DEMAND_DELETE:            'demand.delete',
  // Annotations
  ANNOTATION_CREATE:        'annotation.create',
  ANNOTATION_UPDATE:        'annotation.update',
  ANNOTATION_DELETE:        'annotation.delete',
  // Notes (DDS_CMD domain — FEAT-002)
  NOTE_CATEGORY_CREATE:     'note_category.create',
  NOTE_CATEGORY_UPDATE:     'note_category.update',
  NOTE_CATEGORY_DELETE:     'note_category.delete',
  NOTE_CATEGORY_REORDER:    'note_category.reorder',
  NOTE_CREATE:              'note.create',
  NOTE_UPDATE:              'note.update',
  NOTE_DELETE:              'note.delete',
  NOTE_REORDER:             'note.reorder',
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
  // Map presentation — canvas geometry
  MAP_MOVE_NODE:            'map.move_node',
  MAP_MOVE_NOTE_GHOST:      'map.move_note_ghost',
  MAP_MOVE_CTT:             'map.move_ctt',
  MAP_RESIZE_CTT:           'map.resize_ctt',
  MAP_MOVE_WAYPOINT:        'map.move_waypoint',
  MAP_MOVE_FLOW_NOTE_GHOST: 'map.move_flow_note_ghost',
  MAP_MOVE_ANNOTATION:      'map.move_annotation',
  MAP_RESIZE_LANE:          'map.resize_lane',
  // Project
  PROJECT_RENAME:           'project.rename',
  // Settings
  SETTINGS_NODE_TYPE:       'settings.node_type',
  SETTINGS_PRODUCT_TYPE:    'settings.product_type',
  // AI
  AI_APPLY_ACTIONS:         'ai.apply_actions',
};

window.DDS_TX = DDS_TX;

export default DDS_TX;
