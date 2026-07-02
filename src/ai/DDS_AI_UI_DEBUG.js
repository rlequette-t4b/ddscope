// ============================================================
// DDS_AI_UI_DEBUG — Debug panel for AI calls
// Only active when DDS_SETTINGS.isDebugAI() === true
// Depends on: DDS_AI_UI SCRIPT 2500
// ============================================================

DDS_AI_UI._appendDebug = function(debugInfo) {
  if (!window.DDS_SETTINGS || !DDS_SETTINGS.isDebugAI()) return;
  if (!debugInfo) return;

  var history = document.getElementById('dds-ai-history');
  if (!history) return;

  // ─ Helpers ────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function prettyJson(obj) {
    try { return esc(JSON.stringify(obj, null, 2)); }
    catch(e) { return esc(String(obj)); }
  }
  function makeSection(title, innerHtml) {
    var d = document.createElement('div');
    d.className = 'dds-dbg-section';
    d.innerHTML = '<div class="dds-dbg-section-title">' + esc(title) + '</div>' + innerHtml;
    return d;
  }
  function makePre(text, errClass) {
    var p = document.createElement('pre');
    p.className = 'dds-dbg-pre' + (errClass ? ' ' + errClass : '');
    p.textContent = text; // textContent: no escaping needed, no XSS
    return p;
  }

  // ─ Root element ───────────────────────────────────────
  var dbgEl = document.createElement('div');
  dbgEl.className = 'dds-ai-msg dds-ai-msg-debug';

  var block = document.createElement('div');
  block.className = 'dds-dbg-block';
  dbgEl.appendChild(block);

  // ─ Toggle button (header) ───────────────────────────
  var timingStr = debugInfo.timingMs !== null ? debugInfo.timingMs + ' ms' : '—';
  var tokensStr = debugInfo.usage
    ? 'in ' + (debugInfo.usage.input_tokens || 0) + ' / out ' + (debugInfo.usage.output_tokens || 0)
    : '—';
  var hasError = !!debugInfo.parseError || (debugInfo.validationErrors && debugInfo.validationErrors.length > 0);

  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'dds-dbg-toggle';
  toggleBtn.innerHTML =
    '<span class="dds-dbg-arrow">▶</span>' +
    '<span>🐞 Debug</span>' +
    '<div class="dds-dbg-summary">' +
      '<span class="dds-dbg-chip">⏱ ' + esc(timingStr) + '</span>' +
      '<span class="dds-dbg-chip">🎫 tokens ' + esc(tokensStr) + '</span>' +
      (hasError ? '<span class="dds-dbg-badge dds-dbg-badge-err">Error</span>' : '') +
    '</div>';
  block.appendChild(toggleBtn);

  // ─ Body (collapsed by default) ───────────────────────
  var body = document.createElement('div');
  body.className = 'dds-dbg-body';
  body.style.display = 'none';
  block.appendChild(body);

  toggleBtn.addEventListener('click', function() {
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    toggleBtn.querySelector('.dds-dbg-arrow').textContent = open ? '▶' : '▼';
  });

  // ─ Section 1: Errors ───────────────────────────────
  if (debugInfo.parseError) {
    var s = makeSection('Parse / request error', '');
    s.appendChild(makePre(debugInfo.parseError, 'dds-dbg-pre-err'));
    body.appendChild(s);
  }
  if (debugInfo.validationErrors && debugInfo.validationErrors.length > 0) {
    var s2 = makeSection('Validation errors', '');
    s2.appendChild(makePre(debugInfo.validationErrors.join('\n'), 'dds-dbg-pre-err'));
    body.appendChild(s2);
  }

  // ─ Section 2: Commands — editable textarea + Re-run ──────
  var commands      = debugInfo.commands || [];
  var commandsJson  = JSON.stringify(commands, null, 2);
  var commandCount  = commands.length;

  var actSection = document.createElement('div');
  actSection.className = 'dds-dbg-section';

  var actTitle = document.createElement('div');
  actTitle.className = 'dds-dbg-section-title';
  actTitle.textContent = 'Commands (' + commandCount + ')';
  actSection.appendChild(actTitle);

  // Textarea — value set via .value (NOT innerHTML) to avoid HTML-encoding issues
  var ta = document.createElement('textarea');
  ta.className   = 'dds-dbg-textarea';
  ta.spellcheck  = false;
  ta.value       = commandsJson;  // raw JSON, no escaping needed
  actSection.appendChild(ta);

  // Error feedback
  var errDiv = document.createElement('div');
  errDiv.className    = 'dds-dbg-rerun-err';
  errDiv.style.display = 'none';
  actSection.appendChild(errDiv);

  // Re-run row
  var rerunRow = document.createElement('div');
  rerunRow.className = 'dds-dbg-rerun-row';

  var rerunBtn = document.createElement('button');
  rerunBtn.className   = 'dds-btn dds-btn-secondary dds-btn-sm';
  rerunBtn.textContent = '▶ Re-run';
  rerunBtn.addEventListener('click', function() {
    DDS_AI_UI._rerunDebugActions(ta, errDiv);
  });

  var rerunHint = document.createElement('span');
  rerunHint.className   = 'dds-dbg-rerun-hint';
  rerunHint.textContent = 'Edit JSON then Re-run → generates a new Apply/Cancel plan';

  rerunRow.appendChild(rerunBtn);
  rerunRow.appendChild(rerunHint);
  actSection.appendChild(rerunRow);
  body.appendChild(actSection);

  // ─ Section 3: Raw response ──────────────────────────
  var rawSection = makeSection('Raw response', '');
  rawSection.appendChild(makePre(
    JSON.stringify(debugInfo.rawResponse, null, 2)
  ));
  body.appendChild(rawSection);

  // ─ Section 4: Messages sent ────────────────────────
  var msgCount   = debugInfo.messages ? debugInfo.messages.length : 0;
  var msgSection = makeSection('Messages sent (' + msgCount + ')', '');
  msgSection.appendChild(makePre(
    JSON.stringify(debugInfo.messages, null, 2)
  ));
  body.appendChild(msgSection);

  // ─ Section 5: System prompt ────────────────────────
  var sysSection = makeSection('System prompt', '');
  sysSection.appendChild(makePre(debugInfo.systemPrompt || ''));
  body.appendChild(sysSection);

  // ─ Append to history ──────────────────────────────
  history.appendChild(dbgEl);
  history.scrollTop = history.scrollHeight;
};

// ─ Re-run handler ──────────────────────────────────────────
// Accepts direct DOM references (textarea element + error div element).
// Parses JSON, then calls appendAssistant to generate an Apply/Cancel plan.
DDS_AI_UI._rerunDebugActions = function(taEl, errEl) {
  if (!taEl || !errEl) return;

  errEl.style.display = 'none';
  errEl.textContent   = '';

  var parsed;
  try {
    parsed = JSON.parse(taEl.value);
  } catch(e) {
    errEl.textContent   = 'Invalid JSON: ' + e.message;
    errEl.style.display = 'block';
    return;
  }

  if (!Array.isArray(parsed)) {
    errEl.textContent   = 'Expected a JSON array of commands.';
    errEl.style.display = 'block';
    return;
  }

  if (parsed.length === 0) {
    errEl.textContent   = 'No commands to run.';
    errEl.style.display = 'block';
    return;
  }

  var syntheticResult = {
    reasoning: '[Debug re-run] ' + parsed.length + ' command' + (parsed.length > 1 ? 's' : '') + ' from edited JSON.',
    answer:    null,
    commands:  parsed
  };

  DDS_AI_UI._cancelPendingPlan();
  DDS_AI_UI.appendAssistant(syntheticResult);
  if (syntheticResult.commands.length > 0) DDS_AI_UI._pendingPlan = syntheticResult;

  var history = document.getElementById('dds-ai-history');
  if (history) history.scrollTop = history.scrollHeight;
};
