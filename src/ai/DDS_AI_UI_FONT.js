// ===== AI panel font size controls (select) =====
(function () {
  function initAiFontControls() {
    var panel  = document.getElementById('dds-ai-panel');
    var select = document.getElementById('dds-ai-font-select');
    if (!panel || !select) return;
    select.addEventListener('change', function () {
      panel.style.setProperty('font-size', select.value, 'important');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiFontControls);
  } else {
    initAiFontControls();
  }
})();
