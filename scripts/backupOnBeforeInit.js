import java.util.TimeZone;
var zones = toNative(TimeZone.getAvailableIDs());
var values = {};
var defaultTz = "America/New_York";

function computeDefaultTimeFromNodeId(nodeId) {
  var s = String(nodeId == null ? "" : nodeId).replace(/\D/g, "");
  if (s.length === 0) return "05:00";
  if (s.length < 3) s = ("000" + s).slice(-3);
  var hour = parseInt(s.slice(-1), 10);
  var minute = parseInt(s.slice(-3, -1), 10);
  if (isNaN(hour)) hour = 5;
  if (isNaN(minute)) minute = 0;
  minute = minute % 60;
  hour = hour % 24;
  var hh = (hour < 10 ? "0" : "") + hour;
  var mm = (minute < 10 ? "0" : "") + minute;
  return hh + ":" + mm;
}

for (var i = 0, n = zones.length; i < n; i++) {
  var offset = TimeZone.getTimeZone(zones[i]).getRawOffset()/3600000;
  var m = offset % 1;
  if (m != 0) m = Math.abs(m * 60);
  if (m < 10) m = "0" + m;
  var h = Math.floor(offset);
  if (Math.abs(h) < 10) h = h < 0 ? "-0" + Math.abs(h) : "+0" + h; else if (h >= 0) h = "+" + h;
  values[zones[i]] = zones[i] + (zones[i] == "GMT" ? "" : " (GMT" + h + ":" + m + ")");
}
      
jps.settings.main.fields[0].showIf[2][2].values = values;
// Default timezone + NodeID-based default time on first install
jps.settings.main.fields[0].showIf[2][2].value = defaultTz;

var envInfo = api.env.control.GetEnvInfo('${env.envName}', session);
if (envInfo && envInfo.result == 0 && envInfo.nodes) {
  var cpNode = envInfo.nodes.filter(function(node) { 
    return node.nodeGroup == 'cp' && node.ismaster; 
  })[0];
  if (cpNode && cpNode.id) {
    jps.settings.main.fields[0].showIf[2][0].default = computeDefaultTimeFromNodeId(cpNode.id);
  }
}
      
return {
    result: 0,
    settings: jps.settings
};
