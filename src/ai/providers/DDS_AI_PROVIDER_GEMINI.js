// ============================================================
// DDS_AI_PROVIDER_GEMINI — provider adapter for the Gemini generateContent
// API (gemini-3.5-flash). See docs/DDScope_Service_AITransport.md §4
// (Provider adapters contract) and §3 (consumed by ai-impl-2,
// DirectLLMTransport). TODO T-043.
//
// Framework-agnostic: builds a request descriptor and parses a response, but
// never performs the fetch() itself — that stays the transport's job, so
// this module could be reused by a future CommWise ai-impl-1 wrapper without
// change (see docs/DDScope_Service_AITransport.md §2).
// ============================================================

var DDS_AI_PROVIDER_GEMINI = {
  // provider.buildRequest(systemPrompt, messages, options, apiKey) -> { url, headers, body }
  buildRequest: function(systemPrompt, messages, options, apiKey) {
    options = options || {};
    var model = options.model || 'gemini-3.5-flash';

    // Anthropic-shaped messages ({role: 'user'|'assistant', content: string})
    // -> Gemini's contents array ({role: 'user'|'model', parts: [{text}]}).
    var contents = (messages || []).map(function(m) {
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      };
    });

    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey),
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: { maxOutputTokens: options.max_tokens || 4096 }
      }
    };
  },

  // provider.parseResponse(rawJson) -> { text, usage: { input_tokens, output_tokens } }
  parseResponse: function(data) {
    var candidate = data && data.candidates && data.candidates[0];
    var parts = candidate && candidate.content && candidate.content.parts;
    if (!parts) {
      throw new Error('[DDS_AI_PROVIDER_GEMINI] Unexpected response structure: ' + JSON.stringify(data).substring(0, 300));
    }

    var text = parts.map(function(p) { return p.text || ''; }).join('');
    var um = data.usageMetadata;

    return {
      text: text,
      usage: um
        ? { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 }
        : null
    };
  }
};
