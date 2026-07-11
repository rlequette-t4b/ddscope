// ============================================================
// DDS_AI_PROVIDER_ANTHROPIC — provider adapter for the Anthropic v1/messages
// API. See docs/DDScope_Service_AITransport.md §4 (Provider adapters
// contract) and §3 (consumed by ai-impl-2, DirectLLMTransport). TODO T-043.
//
// Framework-agnostic: builds a request descriptor and parses a response, but
// never performs the fetch() itself — that stays the transport's job, so
// this module could be reused by a future CommWise ai-impl-1 wrapper without
// change (see docs/DDScope_Service_AITransport.md §2).
// ============================================================

var DDS_AI_PROVIDER_ANTHROPIC = {
  // provider.buildRequest(systemPrompt, messages, options, apiKey) -> { url, headers, body }
  buildRequest: function(systemPrompt, messages, options, apiKey) {
    options = options || {};
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'x-api-key': apiKey
      },
      body: {
        model:      options.model || 'claude-sonnet-4-6',
        max_tokens: options.max_tokens || 4096,
        system:     systemPrompt,
        messages:   messages
      }
    };
  },

  // provider.parseResponse(rawJson) -> { text, usage: { input_tokens, output_tokens } }
  parseResponse: function(data) {
    if (!data || !data.content) {
      throw new Error('[DDS_AI_PROVIDER_ANTHROPIC] Unexpected response structure: ' + JSON.stringify(data).substring(0, 300));
    }

    var text = '';
    data.content.forEach(function(block) {
      if (block.type === 'text') text += block.text;
    });

    return {
      text: text,
      usage: data.usage
        ? { input_tokens: data.usage.input_tokens || 0, output_tokens: data.usage.output_tokens || 0 }
        : null
    };
  }
};
