// ===== DDS_AI_UI._replayParse + _replayParseInstructions =====
// Uses String.fromCharCode to avoid newline/backtick corruption via CommWise transport.
// Depends on: DDS_AI_UI SCRIPT 2500.

// Parse **Project specific instructions:** fence block from markdown (if present)
DDS_AI_UI._replayParseInstructions = function(text) {
  var NL    = String.fromCharCode(10);
  var FENCE = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
  var marker = '**Project specific instructions:**';
  var idx = text.indexOf(marker);
  if (idx === -1) return null;
  var after = text.slice(idx + marker.length);
  var fenceOpen = after.indexOf(FENCE);
  if (fenceOpen === -1) return null;
  var bodyStart = after.indexOf(NL, fenceOpen);
  if (bodyStart === -1) return null;
  bodyStart += 1;
  var fenceClose = after.indexOf(NL + FENCE, bodyStart);
  if (fenceClose === -1) return null;
  var instr = after.slice(bodyStart, fenceClose).trim();
  return instr || null;
};

// Parse **User:** / fence blocks — returns array of message strings
DDS_AI_UI._replayParse = function(text) {
  var results = [];
  var NL    = String.fromCharCode(10);
  var FENCE = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
  var marker = '**User:**';
  var parts = text.split(marker);
  for (var i = 1; i < parts.length; i++) {
    var chunk = parts[i];
    var fenceOpen = chunk.indexOf(FENCE);
    if (fenceOpen === -1) continue;
    var bodyStart = chunk.indexOf(NL, fenceOpen);
    if (bodyStart === -1) continue;
    bodyStart += 1;
    var fenceClose = chunk.indexOf(NL + FENCE, bodyStart);
    if (fenceClose === -1) continue;
    var msg = chunk.slice(bodyStart, fenceClose);
    if (msg.trim()) results.push(msg);
  }
  return results;
};
