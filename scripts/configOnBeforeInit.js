var scheduleType = '${settings.scheduleType}';
var defaultTz = "America/New_York";

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  var s = String(v).trim();
  // Unresolved JPS placeholders must not wipe marketplace / secret defaults
  if (/^\$\{[a-zA-Z0-9_.\[\]]+\}$/.test(s)) return true;
  if (/^\$\{fn\.secret\([^)]*\)\}$/.test(s)) return true;
  return s === "";
}

function setDefaultIfPresent(field, value) {
  if (!isEmpty(value) && field) field.default = value;
}

function boolSetting(raw, fallback) {
  if (isEmpty(raw)) return fallback;
  return String(raw) === "true";
}

function isMasterNode(node) {
  return node && (node.ismaster === true || node.ismaster === 1 || String(node.ismaster) === "true");
}

function isComputeNode(node) {
  if (!node) return false;
  if (node.nodeGroup == "cp") return true;
  var computeTypes = {
    nginxphp: 1,
    litespeedphp: 1,
    "nginxphp-dockerized": 1,
    lemp: 1,
    llsmp: 1
  };
  return !!computeTypes[node.nodeType];
}

function pickCpNodeId(nodes) {
  if (!nodes || !nodes.length) return "";
  var i, n, node;
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (node.nodeGroup == "cp" && isMasterNode(node) && node.id) return node.id;
  }
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (node.nodeGroup == "cp" && node.id) return node.id;
  }
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (isComputeNode(node) && isMasterNode(node) && node.id) return node.id;
  }
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (isComputeNode(node) && node.id) return node.id;
  }
  return nodes[0] && nodes[0].id ? nodes[0].id : "";
}

function normalizeEnvName(name) {
  if (isEmpty(name)) return "";
  var s = String(name).trim();
  // GetEnvInfo requires the short env name, not the FQDN shown in the install UI
  var dot = s.indexOf(".");
  if (dot > 0) s = s.substring(0, dot);
  return s;
}

function resolveCpMasterNodeId() {
  var resolved = [
    '${nodes.cp.master.id}',
    '${nodes.cp[0].id}',
    '${nodes.lemp.master.id}',
    '${nodes.lemp[0].id}'
  ];
  for (var p = 0; p < resolved.length; p++) {
    if (!isEmpty(resolved[p])) return resolved[p];
  }

  var envNames = [
    normalizeEnvName('${env.envName}'),
    normalizeEnvName('${env.name}'),
    normalizeEnvName('${env.domain}')
  ];
  for (var e = 0; e < envNames.length; e++) {
    if (isEmpty(envNames[e])) continue;
    try {
      var envInfo = api.env.control.GetEnvInfo(envNames[e], session);
      if (envInfo && envInfo.result == 0 && envInfo.nodes) {
        var id = pickCpNodeId(envInfo.nodes);
        if (!isEmpty(id)) return id;
      }
    } catch (err) {}
  }
  return "";
}

function getPlatformSecret(secretName) {
  try {
    var resp = api.configuration.secrets.GetSecret({
      session: session,
      secretName: secretName
    });
    if (resp && resp.result == 0 && resp.secret && !isEmpty(resp.secret.data)) {
      return String(resp.secret.data);
    }
  } catch (e) {}
  try {
    var list = api.configuration.secrets.ListSecrets({ session: session });
    if (list && list.result == 0 && list.secrets) {
      for (var i = 0, n = list.secrets.length; i < n; i++) {
        if (list.secrets[i].name == secretName && !isEmpty(list.secrets[i].data)) {
          return String(list.secrets[i].data);
        }
      }
    }
  } catch (e2) {}
  return "";
}

function applyPlatformSecretDefault(field, secretName) {
  if (!field || !isEmpty(field.default)) return;
  var data = getPlatformSecret(secretName);
  if (!isEmpty(data)) field.default = data;
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
    setDefaultIfPresent(jps.settings.main.fields[0].showIf[1][0], '${settings.cronTime}');
} else if (scheduleType == '2') {
    var backupTime = '${settings.backupTime}';
    var cpNodeIdForTime = "";
    if (isEmpty(backupTime)) {
      cpNodeIdForTime = resolveCpMasterNodeId();
      backupTime = computeDefaultTimeFromNodeId(cpNodeIdForTime);
    }
    // Replace the whole field (like Days) so inputType:time picks up the value
    jps.settings.main.fields[0].showIf[2][0] = {
      type: "string",
      name: "backupTime",
      caption: "Time",
      inputType: "time",
      tooltip: isEmpty(cpNodeIdForTime)
        ? "Defaults from the CP node ID: last digit = hour, previous two digits = minutes (e.g. node 316 → 06:31)."
        : ("CP node ID " + cpNodeIdForTime + " → " + backupTime + " (last digit = hour, previous two = minutes)."),
      default: backupTime,
      value: backupTime,
      cls: "x-form-text",
      width: 120,
      required: true
    };
    var sun = boolSetting('${settings.sun}', true),
        mon = boolSetting('${settings.mon}', true),
        tue = boolSetting('${settings.tue}', true),
        wed = boolSetting('${settings.wed}', true),
        thu = boolSetting('${settings.thu}', true),
        fri = boolSetting('${settings.fri}', true),
        sat = boolSetting('${settings.sat}', true);
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
    if (isEmpty(tz)) {
      var existingTz = jps.settings.main.fields[0].showIf[2][2].value || jps.settings.main.fields[0].showIf[2][2].default;
      tz = isEmpty(existingTz) ? defaultTz : existingTz;
    }
    jps.settings.main.fields[0].showIf[2][2].value = tz;    
} else {
    setDefaultIfPresent(jps.settings.main.fields[0].showIf[3][0], '${settings.cronTime}');
}

var wasabiEndpoint = '${settings.wasabiEndpoint}';
if (isEmpty(wasabiEndpoint)) {
  var existingEndpoint = jps.settings.main.fields[1].default;
  wasabiEndpoint = isEmpty(existingEndpoint) ? "s3.us-east-2.wasabisys.com" : existingEndpoint;
}
jps.settings.main.fields[1].default = wasabiEndpoint;

// backupScope is inserted before wasabiBucket in the manifest
var backupScope = '${settings.backupScope}';
if (isEmpty(backupScope)) {
  var existingScope = jps.settings.main.fields[2].default;
  backupScope = isEmpty(existingScope) ? "both" : existingScope;
}
jps.settings.main.fields[2].default = backupScope;

// Only apply settings when present so marketplace / secret-manager defaults are preserved
setDefaultIfPresent(jps.settings.main.fields[3], '${settings.wasabiBucket}');
setDefaultIfPresent(jps.settings.main.fields[4], '${settings.wasabiAccessKeyId}');
setDefaultIfPresent(jps.settings.main.fields[5], '${settings.wasabiSecretAccessKey}');
setDefaultIfPresent(jps.settings.main.fields[6], '${settings.resticPassword}');
setDefaultIfPresent(jps.settings.main.fields[7], '${settings.backupCount}');

// fn.secret() often does not resolve in field defaults at UI time; load via API
applyPlatformSecretDefault(jps.settings.main.fields[3], "wasabiBucket");
applyPlatformSecretDefault(jps.settings.main.fields[4], "wasabiAccessKeyId");
applyPlatformSecretDefault(jps.settings.main.fields[5], "wasabiSecretAccessKey");
applyPlatformSecretDefault(jps.settings.main.fields[6], "resticPassword");

return {
  result: 0,
  settings: jps.settings
};
