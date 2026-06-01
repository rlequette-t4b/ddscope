// ============================================================
// DDS_DURATION  duration utility module
// ============================================================
// toHours(value, unit)        number  converts to hours (internal base)
// compare(v1,u1,v2,u2)        { value, unit }  returns the longer duration
// toDisplay(value, unit)      string  human-readable label
// ============================================================

var DDS_DURATION = (function() {

  var HOURS = {
    hours:  1,
    days:   24,
    weeks:  168,
    months: 720,
    years:  8760
  };

  var api = {};

  // Convert any duration to hours for comparison
  api.toHours = function(value, unit) {
    var v = parseFloat(value);
    if (isNaN(v) || !unit || !HOURS[unit]) return 0;
    return v * HOURS[unit];
  };

  // Return the longer of two durations, preserving original unit
  api.compare = function(v1, u1, v2, u2) {
    var h1 = api.toHours(v1, u1);
    var h2 = api.toHours(v2, u2);
    return h1 >= h2
      ? { value: v1, unit: u1 }
      : { value: v2, unit: u2 };
  };

  // Format as human-readable string: "5 days", "2 weeks", etc.
  api.toDisplay = function(value, unit) {
    var v = parseFloat(value);
    if (isNaN(v) || !unit) return '';
    // Singular/plural label
    var label = unit;
    if (v === 1) {
      // Remove trailing 's' for singular (daysday, weeksweek, etc.)
      label = unit.replace(/s$/, '');
    }
    return v + ' ' + label;
  };

  return api;

}());

export default DDS_DURATION;


