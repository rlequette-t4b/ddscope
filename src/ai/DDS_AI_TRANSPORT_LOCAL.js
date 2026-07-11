// ============================================================
// DDS_AI_TRANSPORT_LOCAL — IAITransport implementation ai-impl-2
// (DirectLLMTransport, framework-2 / local runner only).
// See docs/DDScope_Service_AITransport.md §1 (interface contract), §3 (this
// implementation), and §4 (provider adapters it dispatches to). TODO T-038,
// extended for multiple LLM vendors by TODO T-043.
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
// This dispatcher performs the actual fetch() — request construction and
// response parsing are delegated to a provider adapter (src/ai/providers/),
// picked from options.model via MODEL_PROVIDERS below.
//
// Security trade-off — demo/dev scope only: every provider's API key is read
// from DDS_SETTINGS (settings-impl-2, browser localStorage, clear text) and
// sent directly from the browser. Acceptable only because framework-2 is a
// single-user, dev/debug/demo host, never a production deployment target.
// See TODO T-041 for the durable, multi-user-safe replacement.
// ============================================================

var DDS_AI_TRANSPORT_LOCAL = {
  // model -> { provider, apiKeyGetter } — see docs/DDScope_Service_AITransport.md §4.
  MODEL_PROVIDERS: {
    'claude-sonnet-4-6':         { provider: 'DDS_AI_PROVIDER_ANTHROPIC', apiKeyGetter: 'getAnthropicApiKey', settingsHint: 'Settings > Local framework > Anthropic API key' },
    'claude-haiku-4-5-20251001': { provider: 'DDS_AI_PROVIDER_ANTHROPIC', apiKeyGetter: 'getAnthropicApiKey', settingsHint: 'Settings > Local framework > Anthropic API key' },
    'gemini-3.5-flash':          { provider: 'DDS_AI_PROVIDER_GEMINI',    apiKeyGetter: 'getGeminiApiKey',    settingsHint: 'Settings > Local framework > Gemini API key' }
  },

  // IAITransport contract: send(systemPrompt, messages, options) -> Promise<{ text, usage }>
  // See docs/DDScope_Service_AITransport.md §1 - Interface IAITransport.
  send: async function(systemPrompt, messages, options) {
    options = options || {};
    var model = options.model || 'claude-sonnet-4-6';

    var route = DDS_AI_TRANSPORT_LOCAL.MODEL_PROVIDERS[model];
    if (!route) {
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] No provider configured for model "' + model + '" (see docs/DDScope_Service_AITransport.md §4).');
    }

    var provider = window[route.provider];
    if (!provider) {
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] Provider adapter ' + route.provider + ' is not loaded.');
    }

    var apiKey = window.DDS_SETTINGS && DDS_SETTINGS[route.apiKeyGetter] && DDS_SETTINGS[route.apiKeyGetter]();
    if (!apiKey) {
      throw new Error(
        '[DDS_AI_TRANSPORT_LOCAL] No API key configured for model "' + model + '" — ' +
        'set it in ' + route.settingsHint + '.'
      );
    }

    var request = provider.buildRequest(systemPrompt, messages, options, apiKey);

    var response;
    try {
      response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body)
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
      throw new Error('[DDS_AI_TRANSPORT_LOCAL] ' + route.provider + ' API error (' + response.status + '): ' + apiMsg);
    }

    return provider.parseResponse(data);
  }
};
