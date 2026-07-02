// ============================================================
// DDS_PROJECTS — Project operations (thin layer over DDS_STORE)
// ============================================================

var DDS_PROJECTS = {};

// Name uniqueness check (synchronous — project is in memory)
DDS_PROJECTS.nameExists = function(name, excludeId) {
  // Only relevant within the current project — each file IS one project.
  // Kept for modal validation compatibility.
  return false;
};

// Update project metadata (name, description)
DDS_PROJECTS.update = function(name, description) {
  var p = DDS_STORE.getProject();
  if (!p) return;
  p.project.name = name;
  p.project.description = description || '';
  var label = document.getElementById('dds-nav-project-label');
  if (label) label.textContent = name + (DDS_STORE.isDirty() ? ' •' : '');
};
