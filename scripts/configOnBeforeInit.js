var scheduleType = '${settings.scheduleType}';
var defaultTz = "America/New_York";

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

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

import java.util.TimeZone;
var zones = toNative(TimeZone.getAvailableIDs());
var values = {};

for (var i = 0, n = zones.length; i < n; i++) {
  var offset = TimeZone.getTimeZone(zones[i]).getRawOffset()/3600000;
  var m = offset % 1;
  if (m != 0) m = Math.abs(m * 60);
  if (m < 10) m = "0" + m;
  var h = Math.floor(offset);
  if (Math.abs(h) < 10) h = h < 0 ? "-0" + Math.abs(h) : "+0" + h; else if (h >= 0) h = "+" + h;
  values[zones[i]] = zones[i] + (zones[i] == "GMT" ? "" : " (GMT" + h + ":" + m + ")");
}

// Default to Custom schedule unless explicitly set
if (isEmpty(scheduleType)) scheduleType = "2";
jps.settings.main.fields[0].default = scheduleType;

if (scheduleType == '1') {
    jps.settings.main.fields[0].showIf[1][0].default = '${settings.cronTime}';
} else if (scheduleType == '2') {
    var envInfo = api.env.control.GetEnvInfo('${env.envName}', session);
    var cpNodeId = "";
    try {
      if (envInfo && envInfo.result == 0 && envInfo.nodes) {
        var nodes = envInfo.nodes.filter(function(node) { 
          return node.nodeGroup == 'cp' && node.ismaster; 
        });
        if (nodes && nodes[0]) cpNodeId = nodes[0].id;
      }
    } catch (e) {}

    var backupTime = '${settings.backupTime}';
    if (isEmpty(backupTime)) backupTime = computeDefaultTimeFromNodeId(cpNodeId);
    jps.settings.main.fields[0].showIf[2][0].default = backupTime;
    var sun = ('${settings.sun}' === 'true'), 
        mon = ('${settings.mon}' === 'true'), 
        tue = ('${settings.tue}' === 'true'), 
        wed = ('${settings.wed}' === 'true'), 
        thu = ('${settings.thu}' === 'true'), 
        fri = ('${settings.fri}' === 'true'), 
        sat = ('${settings.sat}' === 'true');
    var selectedDays = {
      "caption": "Days",
      "type": "compositefield",
      "name": "days",
      "defaultMargins": "0 12 0 0",
      "items": [
        { "name": "sun", "value": sun, "type": "checkbox", "caption": "Su" },
        { "name": "mon", "value": mon, "type": "checkbox", "caption": "Mo" },
        { "name": "tue", "value": tue, "type": "checkbox", "caption": "Tu" },
        { "name": "wed", "value": wed, "type": "checkbox", "caption": "We" },
        { "name": "thu", "value": thu, "type": "checkbox", "caption": "Th" },
        { "name": "fri", "value": fri, "type": "checkbox", "caption": "Fr" },
        { "name": "sat", "value": sat, "type": "checkbox", "caption": "Sa" }
      ]
    };
    jps.settings.main.fields[0].showIf[2][1] = selectedDays;
    jps.settings.main.fields[0].showIf[2][2].values = values;
    var tz = '${settings.tz}';
    if (isEmpty(tz)) tz = defaultTz;
    jps.settings.main.fields[0].showIf[2][2].value = tz;    
} else {
    jps.settings.main.fields[0].showIf[3][0].default = '${settings.cronTime}';
}

var wasabiEndpoint = '${settings.wasabiEndpoint}';
if (isEmpty(wasabiEndpoint)) wasabiEndpoint = "s3.us-east-2.wasabisys.com";
jps.settings.main.fields[1].default = wasabiEndpoint;

// backupScope is inserted before wasabiBucket in the manifest
var backupScope = '${settings.backupScope}';
if (isEmpty(backupScope)) backupScope = "both";
jps.settings.main.fields[2].default = backupScope;

jps.settings.main.fields[3].default = '${settings.wasabiBucket}';
jps.settings.main.fields[4].default = '${settings.wasabiAccessKeyId}';
jps.settings.main.fields[5].default = '${settings.wasabiSecretAccessKey}';
jps.settings.main.fields[6].default = '${settings.resticPassword}';
jps.settings.main.fields[7].default = '${settings.backupCount}';

return settings;
