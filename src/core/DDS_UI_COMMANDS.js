// ============================================================
// DDS_UI_COMMANDS — UI Command Registry
// (see docs/DDScope_Plugin_UI_RFC.md §2 UI Command Pattern / §4 UI
// Command Registry, Migration Path step 2)
//
// A UI-level command registry, parallel to DDS_CMD (see
// docs/DDScope_Architecture.md §2) but scoped to UI actions (open panel,
// toggle legend, undo) rather than functional-model mutations. DDS_CMD
// remains the sole write path for data — this registry only decides how
// a UI action is triggered and displayed; a command's handler may call
// into DDS_CMD or any other module.
//
// Every UI action gets a command entry, whether or not it is undoable
// (RFC §5 Decisions) — the registry only standardizes the trigger
// surface (menu, toolbar, keybinding); whether the handler goes through
// DDS_CMD (undoable) or writes/reads view state directly (not undoable)
// is a separate, per-command choice.
//
// v1 API: register(id, config), execute(id), isEnabled(id),
// bindTrigger(el, id), refreshEnablement(), setKeybinding(combo, id),
// bindKeyboard().
// ============================================================

var DDS_UI_COMMANDS = {
  _commands: {},     // id -> { handler, isEnabled, title }
  _bound: [],         // [{ el, id }] — DOM triggers registered via bindTrigger
  _keybindings: {}    // 'mod+s' -> id
};

// config: { handler: fn, isEnabled?: fn -> boolean, title?: string }
DDS_UI_COMMANDS.register = function(id, config) {
  DDS_UI_COMMANDS._commands[id] = config || {};
};

DDS_UI_COMMANDS.isEnabled = function(id) {
  var cmd = DDS_UI_COMMANDS._commands[id];
  if (!cmd) return false;
  return cmd.isEnabled ? !!cmd.isEnabled() : true;
};

DDS_UI_COMMANDS.execute = function(id) {
  var cmd = DDS_UI_COMMANDS._commands[id];
  if (!cmd || !cmd.handler) return;
  if (!DDS_UI_COMMANDS.isEnabled(id)) return;
  cmd.handler();
};

// Binds a DOM element's click to execute(id), and registers it for
// refreshEnablement() to keep its disabled state in sync. A command may
// have more than one bound trigger (e.g. a toolbar button AND a menu
// item) — "moving a command between the menu bar and a keybinding is a
// change to a binding table, not to the command or its handler" (RFC).
DDS_UI_COMMANDS.bindTrigger = function(el, id) {
  if (!el) return;
  el.addEventListener('click', function() { DDS_UI_COMMANDS.execute(id); });
  DDS_UI_COMMANDS._bound.push({ el: el, id: id });
  DDS_UI_COMMANDS._refreshOne(el, id);
};

DDS_UI_COMMANDS._refreshOne = function(el, id) {
  if ('disabled' in el) el.disabled = !DDS_UI_COMMANDS.isEnabled(id);
  else el.classList.toggle('dds-disabled', !DDS_UI_COMMANDS.isEnabled(id));
};

DDS_UI_COMMANDS.refreshEnablement = function() {
  DDS_UI_COMMANDS._bound.forEach(function(b) { DDS_UI_COMMANDS._refreshOne(b.el, b.id); });
};

DDS_UI_COMMANDS.setKeybinding = function(combo, id) {
  DDS_UI_COMMANDS._keybindings[combo] = id;
};

// Global keydown dispatch — ignores typing contexts (input/textarea/
// contentEditable). combo format: 'mod+s', 'mod+shift+z' ('mod' = Ctrl on
// Windows/Linux, Cmd on Mac).
DDS_UI_COMMANDS.bindKeyboard = function() {
  document.addEventListener('keydown', function(e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    var parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('mod');
    if (e.shiftKey) parts.push('shift');
    var key = e.key.toLowerCase();
    if (key === 'control' || key === 'meta' || key === 'shift' || key === 'alt') return;
    parts.push(key);
    var id = DDS_UI_COMMANDS._keybindings[parts.join('+')];
    if (id && DDS_UI_COMMANDS._commands[id]) { e.preventDefault(); DDS_UI_COMMANDS.execute(id); }
  });
};
