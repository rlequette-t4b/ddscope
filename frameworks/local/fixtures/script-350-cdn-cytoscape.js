// SCRIPT 350 — CDN: Cytoscape + Dagre
// Verbatim copy fetched from CommWise app 22645 via the CommWise MCP tool
// (commwise_get_block, code_type=script, position=350) on 2026-07-03.
// Not re-authored — see docs/DDScope_Modular_Architecture.md §8 Decoupling Log, Step 2.
// Injected by frameworks/local/build.js at its SCRIPT position (350).

(function() {
  function loadScript(src, onload) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = function() { console.error('[DDS] Failed to load: ' + src); };
    document.head.appendChild(s);
  }

  // Load chain: cytoscape → dagre → cytoscape-dagre
  loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.33.1/cytoscape.min.js',
    function() {
      loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js',
        function() {
          loadScript(
            'https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.js',
            function() {
              if (window.cytoscape && window.dagre) {
                cytoscape.use(cytoscapeDagre);
                console.log('[DDS] Cytoscape ' + cytoscape.version + ' + Dagre ready');
                document.dispatchEvent(new CustomEvent('dds-cytoscape-ready'));
              }
            }
          );
        }
      );
    }
  );
})();
