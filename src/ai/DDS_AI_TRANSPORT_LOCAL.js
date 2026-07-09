// ============================================================
// DDS_AI_TRANSPORT_LOCAL — IAITransport implementation ai-impl-2
// (DirectAnthropicTransport, framework-2 / local runner only).
// See docs/DDScope_Service_AITransport.md §1 (interface contract) and §3
// (this implementation). TODO T-038.
//
// Not wired to window.DDS_AI_TRANSPORT by this file — that assignment is
// done by frameworks/local/template.html, same convention as
// window.DDS_SETTINGS_BACKEND (see docs/DDScope_Framework_Local.md
// §Stub status). This module only defines the object.
//
// Framework-2-only: scoped in assembly.json via "frameworks": ["framework-2"]
// (see docs/DDScope_Assemblies.md §1 - Module block model) — never a
// CommWise push candidate, never loaded there.
//
// Security trade-off — demo/dev scope only: the API key is read from
// DDS_SETTINGS (settings-impl-2, browser localStorage, clear text) and sent
// directly from the browser via `anthropic-dangerous-direct-browser-access`.
// Acceptable only because framework-2 is a single-user, dev/debug/demo host,
// never a production deployment target. See TODO T-041 for the durable,
// multi-user-safe replacement.
// ============================================================

var DDS_AI_TRANSPORT_LOCAL = {
  // IAITransport contract: send(systemPrompt, messages, options) -> Promise<{ content, usage }>
  // See docs/DDScope_Service_AITransport.md §1 - Interface IAITransport.
  send: async function(systemPrompt, messages, options) {
    options = options || {};

    var apiKey = window.DDS_SETTINGS && DDS_SETTINGS.getAnthropicApiKey();
    if (!apiKey) {
      throw new Error(
        '[DDS_AI_TRANSPORT_LOCAL] No Anthropic API key configured — ' +
        'set it in Settings > Local framework.'
      );
    }

    var response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          model:      options.model || 'claude-sonnet-4-6',
          max_tokens: options.max_tokens || 4096,
          system:     systemPrompt,
          messages:   messages
        })
      });
    } catch (networkErr) {
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] fetch failed: ' + (networkErr.message || String(networkErr)));
    }

    var data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] Response is not valid JSON: ' + (parseErr.message || String(parseErr)));
    }

    if (!response.ok) {
      var apiMsg = (data && data.error && data.error.message) || JSON.stringify(data).substring(0, 300);
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] Anthropic API error (' + response.status + '): ' + apiMsg);
    }

    if (!data || !data.content) {
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] Unexpected response structure: ' + JSON.stringify(data).substring(0, 300));
    }

    return { content: data.content, usage: data.usage || null };
  }
};
