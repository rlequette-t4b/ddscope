// ============================================================
// DDS_AI — API call + system prompt (command-based, DDS_CMD-driven)
// Depends on: DDS_STORE SCRIPT 150, DDS_AI_CONTEXT SCRIPT 2200, DDS_CMD SCRIPT 1875, TX SCRIPT 1865
// Rewired onto DDS_CMD.getVocabularyText() / DDS_CMD.executeList() contract
// (DDScope_AI_Assistant.md v1.9-2.1; DDS_CMD_Migration.md Phase 6 Step 4).
// Full session history (not last-turn only) per §5.2 — closes TODO T-013.
//
// AI call routing goes through the injected window.DDS_AI_TRANSPORT
// (IAITransport, see docs/DDScope_Service_AITransport.md §1) — a framework
// injects the implementation (ai-impl-1 CommWiseTransport for CommWise,
// ai-impl-2 DirectLLMTransport for the local framework) before this
// file's call() is first invoked. No CommWise-specific code lives here
// anymore (closes TODO T-005, done as part of TODO T-038).
// ============================================================

var DDS_AI = {
  history: [], // [{ instruction, reasoning, answer, commands }]

  SYSTEM_PROMPT: [
    'You are an assistant embedded in DDScope, a supply chain mapping tool for DDMRP scoping.',
    '',
    'Concepts:',
    '- Node: supply chain actor (supplier, plant, warehouse, customer).',
    '- Flow: directed link between two nodes representing material movement.',
    '- Product: material or item flowing between nodes.',
    '- SKU: node x product association (tags: buffer, stock, transit...).',
    '- Swim-lane: named stage grouping nodes (Sourcing, Production, Distribution).',
    '- BOM: bill of material on a node — one output product, one or more input components with quantities.',
    '- Demand: CTT (Customer Tolerance Time) and average demand per period for a SKU. At most one per SKU.',
    '- Annotation: free-text note placed on a swim-lane, not attached to a node or flow.',
    '- Map: named view of the project. active_map shows what is visible.',
    '- Tags: free-text labels on nodes, products, flows, SKUs.',
    '',
    'You receive: (1) a JSON project snapshot, (2) a user instruction.',
    'Always respond in the same language as the user instruction.',
    '',
    'Respond with ONLY a single JSON object:',
    '{',
    '  "reasoning": "2-5 sentences: what you understood, which entities, why these commands.",',
    '  "answer": "string or null (for analytical questions). null for modification requests.",',
    '  "commands": []',
    '}',
    '',
    'Rules:',
    '- Only use IDs present in the context. Never invent IDs.',
    '- For new entities referenced by later commands, use "id": "new_entity_N" on the creating command.',
    '- If ambiguous, return commands:[] and explain in reasoning.',
    '- Never emit commands on maps/map_nodes/map_flows/map_swim_lanes/map_demands.',
    '- No free text outside the JSON.',
    '',
    'Each command object MUST have a "type" field (the exact command key, e.g. "node.create") and a "params" object holding the domain fields. An optional "id" field ("new_entity_N") lets later commands in the same plan reference an entity created earlier.',
    'Example: {"type": "node.create", "params": {"name": "Supplier A"}}',
    'NEVER use "action" as the discriminant key, and never put domain fields outside "params" — only "type", "params", and optionally "id" are accepted at the top level of a command.',
    '',
    'Allowed commands (each lists its required and optional fields):',
    '{{COMMAND_VOCABULARY}}'
  ].join('\n')
};

// Call the AI Assistant (LLM) via the injected IAITransport (window.DDS_AI_TRANSPORT)
DDS_AI.call = async function(instruction) {
  var context = DDS_AI_CONTEXT.build();
  var systemPrompt = DDS_AI.SYSTEM_PROMPT.replace('{{COMMAND_VOCABULARY}}', DDS_CMD.getVocabularyText());

  // Build messages array — full session history (DDScope_AI_Assistant.md
  // §5.2, closes TODO T-013). Project context is serialised fresh and
  // attached only to the current turn; prior turns are replayed without it.
  var messages = [];

  // Project-specific instructions block (fake turn injection, §5.3)
  var _p = DDS_STORE.getProject();
  var aiInstructions = _p && _p.project && _p.project.ai_instructions;
  if (aiInstructions && aiInstructions.trim()) {
    messages.push({ role: 'user', content: 'Project-specific instructions:\n' + aiInstructions.trim() });
    messages.push({ role: 'assistant', content: 'Understood.' });
  }

  // One user/assistant pair per prior turn, oldest first — DDS_AI.history is
  // not trimmed (see DDScope_AI_Assistant.md §7 item 2 for the token-growth
  // trade-off this implies on long sessions).
  DDS_AI.history.forEach(function(entry) {
    messages.push({ role: 'user', content: 'Instruction: ' + entry.instruction });
    messages.push({ role: 'assistant', content: JSON.stringify({ reasoning: entry.reasoning, commands: entry.commands }) });
  });

  // Current turn — full project context attached here only
  messages.push({
    role: 'user',
    content: 'Project context:\n' + JSON.stringify(context) + '\n\nInstruction: ' + instruction
  });

  // --- Debug capture ---
  var _debugInfo = {
    t0:           Date.now(),
    systemPrompt: systemPrompt,
    messages:     messages,
    rawResponse:  null,
    usage:        null,
    timingMs:     null,
    parseError:   null,
    validationErrors: []
  };

  if (!window.DDS_AI_TRANSPORT) {
    var errCfg = new Error(
      'DDS_AI_TRANSPORT is not configured — a framework must inject window.DDS_AI_TRANSPORT ' +
      'before DDS_AI.call() runs (see docs/DDScope_Service_AITransport.md §1).'
    );
    errCfg._debug = _debugInfo;
    throw errCfg;
  }

  var model = (window.DDS_SETTINGS && DDS_SETTINGS.getAiModel()) || 'claude-sonnet-4-6';

  var result;
  try {
    result = await window.DDS_AI_TRANSPORT.send(systemPrompt, messages, { model: model });
  } catch(reqErr) {
    _debugInfo.timingMs = Date.now() - _debugInfo.t0;
    _debugInfo.parseError = 'DDS_AI_TRANSPORT.send failed: ' + (reqErr.message || String(reqErr));
    console.log('[DDS_AI] DDS_AI_TRANSPORT.send error:', reqErr);
    var err = new Error('DDS_AI_TRANSPORT.send failed: ' + (reqErr.message || String(reqErr)));
    err._debug = _debugInfo;
    throw err;
  }

  _debugInfo.timingMs = Date.now() - _debugInfo.t0;
  _debugInfo.rawResponse = result;
  if (result && result.usage) _debugInfo.usage = result.usage;

  if (!result || typeof result.text !== 'string') {
    _debugInfo.parseError = 'Unexpected response structure';
    var err2 = new Error('Unexpected response structure: ' + JSON.stringify(result).substring(0, 300));
    err2._debug = _debugInfo;
    throw err2;
  }

  var text = result.text;

  // Parse JSON
  var clean = text.replace(/```json|```/g, '').trim();
  var parsed;
  try {
    parsed = JSON.parse(clean);
  } catch(e) {
    _debugInfo.parseError = 'Invalid JSON: ' + e.message;
    var err3 = new Error('The AI Assistant returned invalid JSON: ' + text.substring(0, 300));
    err3._debug = _debugInfo;
    throw err3;
  }

  // Validate contract
  if (typeof parsed.reasoning !== 'string') {
    _debugInfo.validationErrors.push('Missing or invalid reasoning field');
    throw new Error('Missing reasoning field');
  }
  if (!Array.isArray(parsed.commands)) {
    _debugInfo.validationErrors.push('Missing or invalid commands array');
    throw new Error('Missing commands array');
  }

  return {
    reasoning: parsed.reasoning,
    answer:    parsed.answer || null,
    commands:  parsed.commands || [],
    _debug:    _debugInfo
  };
};

// Clear session history (called when a new project is opened)
DDS_AI.clearHistory = function() {
  DDS_AI.history = [];
};
