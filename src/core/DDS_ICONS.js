// ============================================================
// DDS_ICONS — SVG icon library for node types
// ============================================================
// AUDITOR:LARGE_BLOCK_JUSTIFIED - self-contained icon library with embedded SVG strings

window.DDS_ICONS = (function() {

  // SVG authoring rules:
  //   - viewBox 0 0 100 100, width=32 height=32 (mandatory for Cytoscape background-image sizing)
  //   - All shapes within x=5..95, y=5..95 (avoids Cytoscape clipping)
  //   - {{color}} placeholder replaced by toDataUrl(key, color)
  //   - White-icon mode : toDataUrl(key)          -> fills with 'white'
  //   - Colored-icon mode: toDataUrl(key, hexColor) -> fills with tag color

  var NS = 'http://www.w3.org/2000/svg';

  function makeSvg(inner) {
    return '<svg xmlns="' + NS + '" width="32" height="32" viewBox="0 0 100 100">' + inner + '</svg>';
  }

  var LIBRARY = {

    factory: {
      label: 'Usine / Production',
      svg: makeSvg(
        '<path fill="{{color}}" d="M5,95 L5,18 L17,18 L17,54 L48,38 L48,60 L95,38 L95,95 Z"/>'
      )
    },

    warehouse: {
      label: 'Entrepot',
      svg: makeSvg(
        '<path fill-rule="evenodd" fill="{{color}}" d="M5,44 L50,8 L95,44 L95,95 L5,95 Z M34,95 L34,62 L66,62 L66,95 Z"/>'
      )
    },

    customer: {
      label: 'Client',
      svg: makeSvg(
        '<circle cx="50" cy="30" r="20" fill="{{color}}"/>' +
        '<path fill="{{color}}" d="M15,95 Q15,56 50,56 Q85,56 85,95 Z"/>'
      )
    },

    cylinder: {
      label: 'Systeme informatique',
      svg: makeSvg(
        '<path d="M10,30 A40,12 0 0,0 90,30 L90,75 A40,12 0 0,1 10,75 Z" fill="{{color}}"/>' +
        '<ellipse cx="50" cy="75" rx="40" ry="12" fill="{{color}}" opacity="0.75"/>' +
        '<ellipse cx="50" cy="30" rx="40" ry="12" fill="{{color}}"/>' +
        '<ellipse cx="50" cy="30" rx="40" ry="12" fill="white" opacity="0.2"/>'
      )
    },

    document: {
      label: 'Document',
      svg: makeSvg(
        '<polygon points="15,5 70,5 85,20 85,95 15,95" fill="{{color}}"/>' +
        '<polygon points="70,5 70,20 85,20" fill="{{color}}" opacity="0.35"/>' +
        '<rect x="24" y="35" width="40" height="5" fill="{{color}}" rx="1" opacity="0.35"/>' +
        '<rect x="24" y="47" width="40" height="5" fill="{{color}}" rx="1" opacity="0.35"/>' +
        '<rect x="24" y="59" width="30" height="5" fill="{{color}}" rx="1" opacity="0.35"/>'
      )
    }

  };

  function list() {
    return Object.keys(LIBRARY).map(function(key) {
      return { key: key, label: LIBRARY[key].label };
    });
  }

  function get(key) {
    if (!key || !LIBRARY[key]) return null;
    return LIBRARY[key].svg;
  }

  function toDataUrl(key, color) {
    var svg = get(key);
    if (!svg) return null;
    var fill = color || 'white';
    var encoded = svg.replace(/\{\{color\}\}/g, fill);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(encoded);
  }

  return { LIBRARY: LIBRARY, list: list, get: get, toDataUrl: toDataUrl };

})();
