// SCRIPT 1784 — CDN: SortableJS
// Verbatim copy fetched from CommWise app 22645 via the CommWise MCP tool
// (commwise_get_block, code_type=script, position=1784) on 2026-07-03.
// Not re-authored — see docs/DDScope_Modular_Architecture.md §8 Decoupling Log, Step 2.
// Injected by frameworks/local/build.js at its SCRIPT position (1784) —
// must stay before SCRIPT 1785 (DDS_NOTES_UI), per the original block's own comment.

(function () {
  if (window.Sortable) return;
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js';
  s.async = false;
  document.head.appendChild(s);
}());
