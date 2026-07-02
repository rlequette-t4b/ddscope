// AUDITOR:LARGE_BLOCK_JUSTIFIED - single cohesive AI panel UI controller
// ============================================================
// DDS_AI_UI — panel rendering + interaction
// Depends on: DDS_STORE SCRIPT 150, DDS_AI SCRIPT 2400, DDS_ACTIONS SCRIPT 1850
// Depends on: DDS_TRANSACTIONS SCRIPT 1860, TX SCRIPT 1865
// _replayParse lives in SCRIPT 2505
// ============================================================

var DDS_AI_UI = {
  _open: false, _pendingPlan: null, _pendingMsgEl: null, _lastWidth: 420,
  _lastSendFailed: false,
  _replay: { messages: [], index: 0, filename: '', running: false }
};

// ===== Replay helpers (state + UI — parse in SCRIPT 2505) =====

DDS_AI_UI._replayUpdateUI = function() {
  var r       = DDS_AI_UI._replay;
  var bar     = document.getElementById('dds-ai-player-bar');
  var fileEl  = document.getElementById('dds-ai-player-file');
  var posEl   = document.getElementById('dds-ai-player-pos');
  var nextBtn = document.getElementById('dds-ai-player-next');
  var runBtn  = document.getElementById('dds-ai-player-run');
  if (!bar) return;
  if (fileEl) fileEl.textContent = r.filename;
  if (posEl)  posEl.textContent  = r.index + ' / ' + r.messages.length;
  var done = r.index >= r.messages.length;
  if (nextBtn) nextBtn.disabled = done || r.running;
  if (runBtn)  runBtn.disabled  = done || r.running;
};

DDS_AI_UI._replayLoad = function(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var messages = DDS_AI_UI._replayParse(text);
    if (!messages.length) { alert('No user messages found in this file.'); return; }
    var r = DDS_AI_UI._replay;
    r.messages     = messages;
    r.index        = 0;
    r.filename     = file.name;
    r.running      = false;
    r.instructions = DDS_AI_UI._replayParseInstructions(text) || '';
    var bar = document.getElementById('dds-ai-player-bar');
    if (bar) bar.classList.remove('dds-hidden');
    // Show instructions button only if instructions found
    var instrBtn = document.getElementById('dds-ai-player-instr');
    if (instrBtn) instrBtn.style.display = r.instructions ? '' : 'none';
    DDS_AI_UI._replayUpdateUI();
    // Prompt user if instructions found
    if (r.instructions) {
      var prompt = document.getElementById('dds-ai-replay-instr-prompt');
      if (prompt) {
        prompt.classList.remove('dds-hidden');
        void prompt.offsetWidth;
        prompt.classList.add('visible');
      }
    }
  };
  reader.readAsText(file);
};

DDS_AI_UI._replayNext = async function() {
  var r = DDS_AI_UI._replay;
  if (r.index >= r.messages.length || r.running) return;
  var input = document.getElementById('dds-ai-input');
  if (!input) return;
  input.value = r.messages[r.index];
  r.index++;
  DDS_AI_UI._replayUpdateUI();
  await DDS_AI_UI.send();
};

DDS_AI_UI._replayRunToEnd = async function() {
  var r = DDS_AI_UI._replay;
  if (r.running) return;
  r.running = true;
  DDS_AI_UI._replayUpdateUI();
  var hadError = false;
  while (r.index < r.messages.length && !hadError) {
    var input = document.getElementById('dds-ai-input');
    if (!input) break;
    input.value = r.messages[r.index];
    r.index++;
    DDS_AI_UI._replayUpdateUI();
    DDS_AI_UI._lastSendFailed = false;
    try { await DDS_AI_UI.send(); } catch(err) { hadError = true; }
    if (DDS_AI_UI._lastSendFailed) { hadError = true; break; }
    // Auto-apply pending plan if any
    if (DDS_AI_UI._pendingPlan) {
      var applyBtn = document.getElementById('dds-ai-apply-plan');
      if (applyBtn && !applyBtn.disabled) {
        applyBtn.click();
        // Wait for apply to complete (pendingPlan cleared) — max 30s
        var waited = 0;
        while (DDS_AI_UI._pendingPlan && waited < 30000) {
          await new Promise(function(res) { setTimeout(res, 100); });
          waited += 100;
        }
      }
    }
  }
  r.running = false;
  DDS_AI_UI._replayUpdateUI();
};

DDS_AI_UI._replayClose = function() {
  var r = DDS_AI_UI._replay;
  r.messages = []; r.index = 0; r.filename = ''; r.running = false;
  var bar = document.getElementById('dds-ai-player-bar');
  if (bar) bar.classList.add('dds-hidden');
};

// Cancel the currently open plan (if any) — called before each new send()
DDS_AI_UI._cancelPendingPlan = function() {
  if (!DDS_AI_UI._pendingPlan) return;
  var msgEl = DDS_AI_UI._pendingMsgEl;
  if (msgEl) {
    var footer = msgEl.querySelector('.dds-ai-plan-footer');
    if (footer) footer.innerHTML = '<span style="color:var(--dds-text-muted);font-size:0.87em">Cancelled — new request sent.</span>';
    var applyBtn  = msgEl.querySelector('#dds-ai-apply-plan');
    var cancelBtn = msgEl.querySelector('#dds-ai-cancel-plan');
    if (applyBtn)  { applyBtn.disabled  = true; }
    if (cancelBtn) { cancelBtn.disabled = true; }
  }
  DDS_AI_UI._pendingPlan  = null;
  DDS_AI_UI._pendingMsgEl = null;
};

// Notify Cytoscape of the new canvas size after the panel transition ends
DDS_AI_UI._notifyCytoscape = function() {
  var panel = document.getElementById('dds-ai-panel');
  if (!panel) return;
  setTimeout(function() {
    if (window.DDS_CY && typeof DDS_CY.resize === 'function') DDS_CY.resize();
  }, 240);
};

DDS_AI_UI.open = function() {
  if (DDS_AI_UI._open) return;
  DDS_AI_UI._open = true;
  var panel = document.getElementById('dds-ai-panel');
  var btn   = document.getElementById('dds-btn-ai');
  if (panel) {
    panel.classList.add('open');
    panel.style.width = DDS_AI_UI._lastWidth + 'px';
    var top = panel.getBoundingClientRect().top;
    panel.style.height = (window.innerHeight - top) + 'px';
  }
  if (btn) btn.classList.add('active');
  DDS_AI_UI._notifyCytoscape();
};

DDS_AI_UI.close = function() {
  if (!DDS_AI_UI._open) return;
  DDS_AI_UI._open = false;
  var panel = document.getElementById('dds-ai-panel');
  var btn   = document.getElementById('dds-btn-ai');
  if (panel) { panel.classList.remove('open'); panel.style.width = '0'; }
  if (btn)   btn.classList.remove('active');
  DDS_AI_UI._notifyCytoscape();
};

DDS_AI_UI.toggle = function() {
  if (DDS_AI_UI._open) DDS_AI_UI.close();
  else DDS_AI_UI.open();
};

// ===== Drag-resize =====
DDS_AI_UI._initResize = function() {
  var handle = document.getElementById('dds-ai-resize-handle');
  var panel  = document.getElementById('dds-ai-panel');
  if (!handle || !panel) return;
  var _dragging = false, _startX = 0, _startW = 0;
  handle.addEventListener('mousedown', function(e) {
    if (!DDS_AI_UI._open) return;
    _dragging = true; _startX = e.clientX; _startW = panel.offsetWidth;
    handle.classList.add('dragging');
    panel.style.transition = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!_dragging) return;
    var newW = Math.max(280, Math.min(700, _startW + (e.clientX - _startX)));
    panel.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!_dragging) return;
    _dragging = false;
    handle.classList.remove('dragging');
    DDS_AI_UI._lastWidth = panel.offsetWidth;
    panel.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (window.DDS_CY && typeof DDS_CY.resize === 'function') DDS_CY.resize();
  });
};

// ===== Message helpers =====
DDS_AI_UI._appendMsg = function(role, html) {
  var history = document.getElementById('dds-ai-history'); if (!history) return;
  var msg = document.createElement('div');
  msg.className = 'dds-ai-msg dds-ai-msg-' + role;
  msg.innerHTML = html;
  history.appendChild(msg);
  history.scrollTop = history.scrollHeight;
  return msg;
};

DDS_AI_UI._esc = function(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

DDS_AI_UI.appendUser = function(text) {
  var history = document.getElementById('dds-ai-history'); if (!history) return;
  var msg = document.createElement('div');
  msg.className = 'dds-ai-msg dds-ai-msg-user';
  // Wrapper to position bubble + reuse button together
  var wrap = document.createElement('div');
  wrap.className = 'dds-ai-user-wrap';
  // Reuse button
  var btn = document.createElement('button');
  btn.className = 'dds-ai-reuse-btn';
  btn.title = 'Copy to input';
  btn.innerHTML = '&#10549;';
  btn.addEventListener('click', function() {
    var input = document.getElementById('dds-ai-input');
    if (!input) return;
    input.value = text;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    input.focus();
  });
  // Bubble
  var bubble = document.createElement('div');
  bubble.className = 'dds-ai-bubble dds-ai-bubble-user';
  bubble.textContent = text;
  wrap.appendChild(btn);
  wrap.appendChild(bubble);
  msg.appendChild(wrap);
  history.appendChild(msg);
  history.scrollTop = history.scrollHeight;
};

DDS_AI_UI.appendAssistant = function(result) {
  var html = '';
  if (result.reasoning) html += '<div class="dds-ai-reasoning">' + DDS_AI_UI._esc(result.reasoning) + '</div>';
  if (result.answer && result.commands.length === 0) {
    html += '<div class="dds-ai-bubble dds-ai-bubble-assistant">' + DDS_AI_UI._esc(result.answer) + '</div>';
    DDS_AI_UI._appendMsg('assistant', html); return;
  }
  if (result.commands.length === 0) {
    html += '<div class="dds-ai-bubble dds-ai-bubble-assistant">No commands proposed.</div>';
    DDS_AI_UI._appendMsg('assistant', html); return;
  }
  var labels = DDS_CMD.describe(result.commands);
  var commandsHtml = '';
  labels.forEach(function(item) {
    commandsHtml += '<div class="dds-ai-action-row"><span class="dds-ai-action-num">' + (item.index + 1) + '.</span>' +
      '<span>' + DDS_AI_UI._esc(item.label) + '</span></div>';
  });
  html += '<div class="dds-ai-plan">' +
    '<div class="dds-ai-plan-header">' + result.commands.length + ' command' + (result.commands.length > 1 ? 's' : '') + ' to apply</div>' +
    '<div class="dds-ai-plan-actions">' + commandsHtml + '</div>' +
    '<div class="dds-ai-plan-footer">' +
      '<button class="dds-btn dds-btn-secondary dds-btn-sm" id="dds-ai-cancel-plan">Cancel</button>' +
      '<button class="dds-btn dds-btn-primary dds-btn-sm" id="dds-ai-apply-plan">Apply</button>' +
    '</div></div>';
  var msgEl = DDS_AI_UI._appendMsg('assistant', html);
  var capturedCommands = result.commands.slice();
  DDS_AI_UI._pendingMsgEl = msgEl;
  var applyBtn  = msgEl.querySelector('#dds-ai-apply-plan');
  var cancelBtn = msgEl.querySelector('#dds-ai-cancel-plan');

  if (applyBtn) applyBtn.addEventListener('click', async function() {
    if (applyBtn.disabled) return;
    applyBtn.disabled = true; cancelBtn.disabled = true;
    applyBtn.innerHTML = '<span class="dds-spinner"></span>';
    var activeMapId = DDS_MAP.state.currentMapId;
    try {
      // DDS_CMD.executeList wraps the whole batch in ONE transaction
      // internally (TX.AI_APPLY_ACTIONS) — no outer begin/commit/rollback
      // needed here, unlike the legacy DDS_ACTIONS.execute() call site.
      var execResult = DDS_CMD.executeList(capturedCommands, activeMapId, function(applied) {
        // node.create / flow.create already place their entities on the map
        // internally when mapId is passed to executeList (DDS_CMD Phase 5/6)
        // — only annotation.create still needs explicit map placement here,
        // since an annotation is never auto-placed by the command itself
        // (DDScope_AI_Assistant.md §4).
        applied.forEach(function(entry) {
          if (entry.type === TX.ANNOTATION_CREATE && entry.result && entry.result.id) {
            DDS_ELEMENTS.addAnnotation(entry.result.id);
          }
        });
        if (DDS_STORE.getProject() && activeMapId) {
          DDS_MAP.loadMap(activeMapId).then(function() { DDS_MAP.triggerAutoLayout(); });
        }
      });
      DDS_AI_UI._pendingPlan  = null;
      DDS_AI_UI._pendingMsgEl = null;
      if (!execResult.ok) {
        DDS_AI_UI._renderExecResultsRolledBack(msgEl, execResult);
      } else {
        DDS_AI_UI._renderExecResults(msgEl, execResult);
      }
    } catch(err) {
      DDS_AI_UI._renderExecResults(msgEl, { applied: [], failed: { type: '?', _error: err.message || String(err) } });
    }
  });

  if (cancelBtn) cancelBtn.addEventListener('click', function() {
    DDS_AI_UI._pendingPlan  = null;
    DDS_AI_UI._pendingMsgEl = null;
    var footer = msgEl.querySelector('.dds-ai-plan-footer');
    if (footer) footer.innerHTML = '<span style="color:var(--dds-text-muted);font-size:0.87em">Cancelled.</span>';
  });
};

// Render rolled-back execution
DDS_AI_UI._renderExecResultsRolledBack = function(msgEl, execResult) {
  var actionsDiv = msgEl.querySelector('.dds-ai-plan-actions'); if (!actionsDiv) return;
  actionsDiv.innerHTML = '';
  (execResult.applied || []).forEach(function(action) {
    var label = DDS_ACTIONS.describe([action])[0].label;
    actionsDiv.innerHTML += '<div class="dds-ai-action-row">' +
      '<span class="dds-ai-action-num" style="color:var(--dds-text-muted)">↩</span>' +
      '<span style="color:var(--dds-text-muted);text-decoration:line-through">' + DDS_AI_UI._esc(label) + '</span></div>';
  });
  if (execResult.failed) {
    var failLabel = DDS_CMD.describe([execResult.failed])[0].label;
    actionsDiv.innerHTML += '<div class="dds-ai-action-row">' +
      '<span class="dds-ai-action-num dds-ai-action-err">✗</span>' +
      '<span>' + DDS_AI_UI._esc(failLabel) + (execResult.failed._error ? ' — ' + execResult.failed._error : '') + '</span></div>';
  }
  var footer = msgEl.querySelector('.dds-ai-plan-footer');
  if (footer) footer.innerHTML = '<span style="color:var(--dds-danger);font-size:var(--dds-text-sm)">Failed — rolled back</span>';
};

// Render execution results
DDS_AI_UI._renderExecResults = function(msgEl, execResult) {
  var actionsDiv = msgEl.querySelector('.dds-ai-plan-actions'); if (!actionsDiv) return;
  actionsDiv.innerHTML = '';
  var applied = execResult.applied || [];
  var failed  = execResult.failed  || null;
  applied.forEach(function(action) {
    var label = DDS_CMD.describe([action])[0].label;
    actionsDiv.innerHTML += '<div class="dds-ai-action-row">' +
      '<span class="dds-ai-action-num dds-ai-action-ok">✓</span>' +
      '<span>' + DDS_AI_UI._esc(label) + '</span></div>';
  });
  if (failed) {
    var failLabel = DDS_CMD.describe([failed])[0].label;
    actionsDiv.innerHTML += '<div class="dds-ai-action-row">' +
      '<span class="dds-ai-action-num dds-ai-action-err">✗</span>' +
      '<span>' + DDS_AI_UI._esc(failLabel) + (failed._error ? ' — ' + failed._error : '') + '</span></div>';
  }
  var footer = msgEl.querySelector('.dds-ai-plan-footer');
  if (footer) footer.innerHTML = !failed
    ? '<span style="color:var(--dds-accent);font-size:var(--dds-text-sm);font-weight:600">✓ Applied</span>'
    : '<span style="color:var(--dds-danger);font-size:var(--dds-text-sm)">Partial failure — ' + applied.length + '/' + (applied.length + 1) + ' applied</span>';
};

DDS_AI_UI.appendError = function(msg) {
  DDS_AI_UI._appendMsg('assistant',
    '<div class="dds-ai-bubble dds-ai-bubble-assistant dds-ai-bubble-error">' + DDS_AI_UI._esc(msg) + '</div>');
};

DDS_AI_UI.appendThinking = function() {
  return DDS_AI_UI._appendMsg('assistant',
    '<div class="dds-ai-thinking"><span class="dds-spinner"></span> Thinking…</div>');
};

DDS_AI_UI.send = async function() {
  var input = document.getElementById('dds-ai-input'); if (!input) return;
  var text = (input.value || '').trim(); if (!text) return;
  if (!DDS_STORE.getProject()) { DDS_AI_UI.appendError('No project open.'); return; }
  DDS_AI_UI._cancelPendingPlan();
  input.value = ''; input.style.height = 'auto';
  var sendBtn = document.getElementById('dds-ai-send');
  if (sendBtn) sendBtn.disabled = true;
  DDS_AI_UI.appendUser(text);
  var thinking = DDS_AI_UI.appendThinking();
  try {
    var result = await DDS_AI.call(text);
    if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
    DDS_AI.history.push({ instruction: text, reasoning: result.reasoning, answer: result.answer, commands: result.commands });
    if (result.commands.length > 0) DDS_AI_UI._pendingPlan = result;
    DDS_AI_UI.appendAssistant(result);
    if (window.DDS_SETTINGS && DDS_SETTINGS.isDebugAI() && result._debug) {
      result._debug.commands = result.commands;
      DDS_AI_UI._appendDebug(result._debug);
    }
  } catch(err) {
    if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
    DDS_AI_UI.appendError('Error: ' + (err.message || String(err)));
    DDS_AI_UI._lastSendFailed = true;
    if (window.DDS_SETTINGS && DDS_SETTINGS.isDebugAI() && err._debug) {
      DDS_AI_UI._appendDebug(err._debug);
    }
    console.error('[DDS] AI error:', err);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
};

// Export conversation to a markdown file
DDS_AI_UI.exportConversation = function() {
  if (!window.DDS_AI || !DDS_AI.history || DDS_AI.history.length === 0) {
    alert('No conversation to export.'); return;
  }
  var _proj = DDS_STORE.getProject();
  var projectName = (_proj && _proj.project && _proj.project.name) ? _proj.project.name : 'DDScope';
  var NL = String.fromCharCode(10);
  var FENCE = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
  var lines = ['# AI Assistant — ' + projectName, ''];
  // Prepend project-specific instructions if present
  var aiInstr = _proj && _proj.project && _proj.project.ai_instructions;
  if (aiInstr && aiInstr.trim()) {
    lines.push('**Project specific instructions:**');
    lines.push(FENCE);
    lines.push(aiInstr.trim());
    lines.push(FENCE);
    lines.push('');
  }
  DDS_AI.history.forEach(function(entry) {
    lines.push('**User:**');
    lines.push(FENCE);
    lines.push(entry.instruction || '');
    lines.push(FENCE);
    lines.push('');
    var response = entry.answer || entry.reasoning || '';
    if (response) { lines.push('**Assistant:** ' + response); lines.push(''); }
    lines.push('---');
    lines.push('');
  });
  var content = lines.join(NL);
  var blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var ts   = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = projectName.replace(/[^a-z0-9_-]/gi, '_') + '_AI_' + ts + '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Reset panel
DDS_AI_UI.reset = function() {
  if (window.DDS_AI) DDS_AI.history = [];
  DDS_AI_UI._pendingPlan  = null;
  DDS_AI_UI._pendingMsgEl = null;
  var history = document.getElementById('dds-ai-history');
  if (history) history.innerHTML = '';
  var input = document.getElementById('dds-ai-input');
  if (input) { input.value = ''; input.style.height = 'auto'; }
};

DDS_AI_UI.bindEvents = function() {
  var aiBtn = document.getElementById('dds-btn-ai');
  if (aiBtn) aiBtn.addEventListener('click', function() { DDS_AI_UI.toggle(); });

  var headerToggle = document.getElementById('dds-ai-header-toggle');
  if (headerToggle) headerToggle.addEventListener('click', function() { DDS_AI_UI.toggle(); });

  var closeBtn = document.getElementById('dds-ai-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { DDS_AI_UI.close(); });

  var exportBtn = document.getElementById('dds-ai-export');
  if (exportBtn) exportBtn.addEventListener('click', function() { DDS_AI_UI.exportConversation(); });

  var instrBtn = document.getElementById('dds-ai-instructions');
  if (instrBtn) instrBtn.addEventListener('click', function() {
    var overlay  = document.getElementById('dds-ai-instructions-overlay');
    var textarea = document.getElementById('dds-ai-instructions-text');
    if (!overlay || !textarea) return;
    var _p2 = DDS_STORE.getProject();
    var current = _p2 && _p2.project && _p2.project.ai_instructions;
    textarea.value = current || '';
    overlay.classList.remove('dds-hidden');
    void overlay.offsetWidth;
    overlay.classList.add('visible');
    textarea.focus();
  });
  var instrClose  = document.getElementById('dds-ai-instructions-close');
  var instrCancel = document.getElementById('dds-ai-instructions-cancel');
  function _closeInstrModal() {
    var overlay = document.getElementById('dds-ai-instructions-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      void overlay.offsetWidth;
      overlay.classList.add('dds-hidden');
    }
  }
  if (instrClose)  instrClose.addEventListener('click',  _closeInstrModal);
  if (instrCancel) instrCancel.addEventListener('click', _closeInstrModal);
  var instrSave = document.getElementById('dds-ai-instructions-save');
  if (instrSave) instrSave.addEventListener('click', function() {
    var textarea = document.getElementById('dds-ai-instructions-text');
    var _p3 = DDS_STORE.getProject();
    if (!textarea || !_p3 || !_p3.project) return;
    _p3.project.ai_instructions = textarea.value.trim() || null;
    DDS_STORE.markDirty();
    _closeInstrModal();
  });

  var replayBtn   = document.getElementById('dds-ai-replay');
  var replayInput = document.getElementById('dds-ai-replay-input');
  if (replayBtn && replayInput) {
    replayBtn.addEventListener('click', function() { replayInput.value = ''; replayInput.click(); });
    replayInput.addEventListener('change', function() {
      if (replayInput.files && replayInput.files[0]) DDS_AI_UI._replayLoad(replayInput.files[0]);
    });
  }
  var playerNext  = document.getElementById('dds-ai-player-next');
  var playerRun   = document.getElementById('dds-ai-player-run');
  var playerClose = document.getElementById('dds-ai-player-close');
  var playerInstr = document.getElementById('dds-ai-player-instr');
  if (playerNext)  playerNext.addEventListener('click',  function() { DDS_AI_UI._replayNext(); });
  if (playerRun)   playerRun.addEventListener('click',   function() { DDS_AI_UI._replayRunToEnd(); });
  if (playerClose) playerClose.addEventListener('click', function() { DDS_AI_UI._replayClose(); });
  if (playerInstr) playerInstr.addEventListener('click', function() { DDS_AI_UI._replayOpenInstrModal(); });

  // Replay instructions modal
  function _openReplayInstrModal() {
    var overlay  = document.getElementById('dds-ai-replay-instr-overlay');
    var textarea = document.getElementById('dds-ai-replay-instr-text');
    if (!overlay || !textarea) return;
    textarea.value = DDS_AI_UI._replay.instructions || '';
    overlay.classList.remove('dds-hidden');
    void overlay.offsetWidth;
    overlay.classList.add('visible');
    textarea.focus();
  }
  function _closeReplayInstrModal() {
    var overlay = document.getElementById('dds-ai-replay-instr-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      void overlay.offsetWidth;
      overlay.classList.add('dds-hidden');
    }
  }
  DDS_AI_UI._replayOpenInstrModal = _openReplayInstrModal;

  var instrModalClose  = document.getElementById('dds-ai-replay-instr-close');
  var instrModalCancel = document.getElementById('dds-ai-replay-instr-cancel');
  var instrModalCopy   = document.getElementById('dds-ai-replay-instr-copy');
  if (instrModalClose)  instrModalClose.addEventListener('click',  _closeReplayInstrModal);
  if (instrModalCancel) instrModalCancel.addEventListener('click', _closeReplayInstrModal);
  if (instrModalCopy) instrModalCopy.addEventListener('click', function() {
    var textarea = document.getElementById('dds-ai-replay-instr-text');
    var _p = DDS_STORE.getProject();
    if (!textarea || !_p || !_p.project) return;
    _p.project.ai_instructions = textarea.value.trim() || null;
    DDS_STORE.markDirty();
    _closeReplayInstrModal();
  });

  // Replay instructions prompt (post-load)
  function _closeReplayPrompt() {
    var prompt = document.getElementById('dds-ai-replay-instr-prompt');
    if (prompt) prompt.classList.remove('visible');
  }
  var promptNo  = document.getElementById('dds-ai-replay-prompt-no');
  var promptYes = document.getElementById('dds-ai-replay-prompt-yes');
  if (promptNo)  promptNo.addEventListener('click',  _closeReplayPrompt);
  if (promptYes) promptYes.addEventListener('click', function() {
    _closeReplayPrompt();
    _openReplayInstrModal();
  });

  var clearBtn = document.getElementById('dds-ai-clear');
  if (clearBtn) clearBtn.addEventListener('click', function() {
    var input = document.getElementById('dds-ai-input');
    if (!input) return;
    input.value = '';
    input.style.height = 'auto';
    input.focus();
  });

  var sendBtn = document.getElementById('dds-ai-send');
  if (sendBtn) sendBtn.addEventListener('click', function() { DDS_AI_UI.send(); });

  var input = document.getElementById('dds-ai-input');
  if (input) {
    input.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); DDS_AI_UI.send(); } });
  }

  DDS_AI_UI._initResize();
};
