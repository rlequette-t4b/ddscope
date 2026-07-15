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
// v2 (RFC §4 Declarative Menu and Toolbar Contributions / Toggle
// Commands, TODO/T-056) adds a second declaration on top of register():
// contribute(commandId, { surface, location, group, order }), kept
// separate from the command definition because a command should not
// need to know its own placement. renderMenuItems(location, containerEl)
// is the generic renderer that turns contributions into DOM — a plugin
// becomes able to add a menu entry via register()+contribute() alone, no
// edit to this file or DDS_UI_MENU.js required. v1's imperative wiring
// (each menu item hand-authored in fragments/app-shell.html, bound by
// DDS_UI_MENU._bindMenuBar's querySelectorAll sweep) still works
// unchanged for menus not yet migrated — File is the v2 pilot (see
// DDS_UI_MENU._registerCommands); Edit/View/Arrange/Extras/Help and the
// toolbar row convert later, same incremental discipline as T-052.
// Toolbar rendering itself (a generic renderer building toolbar buttons
// from contributions, not just menu items) is not built yet — today's
// toolbar row stays hand-authored in fragments/app-shell.html; only the
// toggle-visual-sync half of Toggle Commands (see _refreshOne) is wired
// for it in advance.
//
// API: register(id, config), contribute(commandId, config),
// renderMenuItems(location, containerEl), execute(id), isEnabled(id),
// isActive(id), bindTrigger(el, id), refreshEnablement(),
// setKeybinding(combo, id), bindKeyboard().
// ============================================================

var DDS_UI_COMMANDS = {
  _commands: {},       // id -> { handler, isEnabled, title, icon, isActive, activeIcon, activeTitle }
  _bound: [],          // [{ el, id }] — DOM triggers registered via bindTrigger
  _keybindings: {},    // 'mod+s' -> id
  _contributions: []   // [{ commandId, surface, location, group, order }]
};

// config: { handler: fn, isEnabled?: fn -> boolean, title?: string,
//   icon?: string (raw SVG markup), isActive?: fn -> boolean,
//   activeIcon?: string, activeTitle?: string }
// isActive/activeIcon/activeTitle are for toggle commands only (RFC §4
// Toggle Commands) — a command with no isActive is a stateless action.
// Deliberately scoped to a binary/two-way state, not a general state
// machine (RFC).
DDS_UI_COMMANDS.register = function(id, config) {
  DDS_UI_COMMANDS._commands[id] = config || {};
};

// contribution: { surface: 'menu'|'toolbar', location, group?, order? }
// location is the menu name ('File', 'Edit'...) for a menu contribution,
// or the toolbar row/section for a toolbar contribution. group+order
// give separator/ordering control without a full priority system: items
// are sorted by group (groups ordered by first contribute() call that
// used them), then by order within a group (defaults to registration
// order); a separator is rendered between groups by renderMenuItems.
DDS_UI_COMMANDS.contribute = function(commandId, contrib) {
  contrib = contrib || {};
  DDS_UI_COMMANDS._contributions.push({
    commandId: commandId,
    surface: contrib.surface,
    location: contrib.location,
    group: contrib.group || 'default',
    order: typeof contrib.order === 'number' ? contrib.order : DDS_UI_COMMANDS._contributions.length
  });
};

DDS_UI_COMMANDS._contributionsFor = function(surface, location) {
  var matches = DDS_UI_COMMANDS._contributions.filter(function(c) {
    return c.surface === surface && c.location === location;
  });
  var groupOrder = [];
  matches.forEach(function(c) { if (groupOrder.indexOf(c.group) === -1) groupOrder.push(c.group); });
  return matches.slice().sort(function(a, b) {
    var g = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
    return g !== 0 ? g : a.order - b.order;
  });
};

// Reverse-lookup of setKeybinding() — lets a generic renderer display a
// command's shortcut without the caller having to know it separately.
DDS_UI_COMMANDS._comboFor = function(id) {
  for (var combo in DDS_UI_COMMANDS._keybindings) {
    if (DDS_UI_COMMANDS._keybindings[combo] === id) return combo;
  }
  return null;
};

// 'mod+shift+z' -> 'Ctrl+Shift+Z' (display form, same as the three
// hand-authored dds-menu-shortcut spans this replaces for File).
DDS_UI_COMMANDS._formatCombo = function(combo) {
  return combo.split('+').map(function(part) {
    if (part === 'mod') return 'Ctrl';
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join('+');
};

// Generic Menu Contribution Renderer (RFC §4 Declarative Menu and
// Toolbar Contributions). Clears containerEl and rebuilds it from the
// contributions registered for (surface: 'menu', location) — safe to
// call again later (e.g. a plugin loaded after boot) since it always
// starts from an empty container. Each trigger is built purely from its
// command's title/icon/keybinding and bound via bindTrigger here, not by
// the caller reaching for a hand-picked getElementById.
DDS_UI_COMMANDS.renderMenuItems = function(location, containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  var contribs = DDS_UI_COMMANDS._contributionsFor('menu', location);
  var lastGroup = null;
  contribs.forEach(function(contrib, i) {
    var cmd = DDS_UI_COMMANDS._commands[contrib.commandId];
    if (!cmd) return;
    if (i > 0 && contrib.group !== lastGroup) {
      var sep = document.createElement('div');
      sep.className = 'dds-menu-sep';
      containerEl.appendChild(sep);
    }
    lastGroup = contrib.group;

    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'dds-menu-item';
    el.dataset.cmd = contrib.commandId;

    var start = document.createElement('span');
    start.className = 'dds-menu-item-start';

    if (cmd.isActive) {
      var check = document.createElement('span');
      check.className = 'dds-menu-item-check';
      check.textContent = '✓';
      start.appendChild(check);
    }
    if (cmd.icon) {
      var iconWrap = document.createElement('span');
      iconWrap.className = 'dds-menu-item-icon';
      iconWrap.innerHTML = cmd.icon;
      start.appendChild(iconWrap);
    }
    var label = document.createElement('span');
    label.className = 'dds-menu-item-label';
    label.textContent = cmd.title || contrib.commandId;
    start.appendChild(label);
    el.appendChild(start);

    var combo = DDS_UI_COMMANDS._comboFor(contrib.commandId);
    if (combo) {
      var shortcut = document.createElement('span');
      shortcut.className = 'dds-menu-shortcut';
      shortcut.textContent = DDS_UI_COMMANDS._formatCombo(combo);
      el.appendChild(shortcut);
    }

    containerEl.appendChild(el);
    DDS_UI_COMMANDS.bindTrigger(el, contrib.commandId);
  });
};

DDS_UI_COMMANDS.isEnabled = function(id) {
  var cmd = DDS_UI_COMMANDS._commands[id];
  if (!cmd) return false;
  return cmd.isEnabled ? !!cmd.isEnabled() : true;
};

// Toggle-command state check (RFC §4 Toggle Commands). false for any
// command without an isActive — same "not every command is a toggle"
// default as isEnabled defaulting to true.
DDS_UI_COMMANDS.isActive = function(id) {
  var cmd = DDS_UI_COMMANDS._commands[id];
  return !!(cmd && cmd.isActive && cmd.isActive());
};

DDS_UI_COMMANDS.execute = function(id) {
  var cmd = DDS_UI_COMMANDS._commands[id];
  if (!cmd || !cmd.handler) return;
  if (!DDS_UI_COMMANDS.isEnabled(id)) return;
  cmd.handler();
};

// Binds a DOM element's click to execute(id), and registers it for
// refreshEnablement() to keep its disabled/active state in sync. A
// command may have more than one bound trigger (e.g. a toolbar button
// AND a menu item) — "moving a command between the menu bar and a
// keybinding is a change to a binding table, not to the command or its
// handler" (RFC). Idempotent per element — renderMenuItems binds its own
// elements immediately, and DDS_UI_MENU._bindMenuBar's querySelectorAll
// sweep (for menus not yet migrated to contribute()) may also match
// them; a second bindTrigger call on the same element is a no-op rather
// than double-firing the command.
DDS_UI_COMMANDS.bindTrigger = function(el, id) {
  if (!el || el._ddsCommandBound) return;
  el._ddsCommandBound = true;
  el.addEventListener('click', function() { DDS_UI_COMMANDS.execute(id); });
  DDS_UI_COMMANDS._bound.push({ el: el, id: id });
  DDS_UI_COMMANDS._refreshOne(el, id);
};

DDS_UI_COMMANDS._refreshOne = function(el, id) {
  var cmd = DDS_UI_COMMANDS._commands[id];
  if ('disabled' in el) el.disabled = !DDS_UI_COMMANDS.isEnabled(id);
  else el.classList.toggle('dds-disabled', !DDS_UI_COMMANDS.isEnabled(id));

  if (!cmd || !cmd.isActive) return;
  var active = DDS_UI_COMMANDS.isActive(id);

  // Toggle Commands (RFC §4) — menu item and toolbar button rendering
  // are deliberately different, not just two skins of the same swap:
  if (el.classList.contains('dds-menu-item')) {
    // "a toggle command always renders as a checkbox-style entry —
    // checkmark shown when isActive() is true, regardless of whether
    // activeIcon/activeTitle is set. The label itself does not swap in
    // the menu; the checkmark alone carries the state." — no
    // icon/title swap here even if the command declares them; those
    // fields are toolbar-only per the RFC.
    el.classList.toggle('active', active);
    return;
  }

  // Toolbar button (or any other non-menu trigger bound via
  // bindTrigger — no toolbar contribution renderer exists yet, see file
  // header, but a command declaring isActive today already gets synced
  // state for free through this one shared code path once one is bound
  // by hand). "The two are mutually exclusive per command: an icon swap
  // already communicates state, so no highlight is layered on top of
  // it."
  if (cmd.activeIcon || cmd.activeTitle) {
    el.classList.remove('active');
    if (cmd.icon || cmd.activeIcon) {
      var svg = el.querySelector('svg');
      var markup = active && cmd.activeIcon ? cmd.activeIcon : cmd.icon;
      if (svg && markup) svg.outerHTML = markup;
    }
    if (cmd.title || cmd.activeTitle) el.title = (active && cmd.activeTitle) ? cmd.activeTitle : (cmd.title || el.title || '');
  } else {
    // No activeIcon/activeTitle declared — Legend/side-panel/rail/
    // Notes-toggle case: highlighted/pressed visual on the default icon.
    el.classList.toggle('active', active);
  }
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
