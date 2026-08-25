import java.util.TimeZone;

/**
 * settings.main.onBeforeInit — must return the `settings` form object
 * (not { result:0, settings: jps.settings }, which is only for top-level onBeforeInit).
 *
 * Do not embed ${settings.wasabiSecretAccessKey} / resticPassword etc. into JS
 * string literals — arbitrary secret characters break script parsing. Saved
 * values are applied by the dashboard; platform secrets come from the API.
 */

var defaultTz = "America/New_York";
var scheduleType = '${settings.scheduleType}';

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  var s = String(v).trim();
  if (/^\$\{[a-zA-Z0-9_.\[\]]+\}$/.test(s)) return true;
  if (/^\$\{fn\.secret\([^)]*\)\}$/.test(s)) return true;
  return s === "";
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
    if (node.nodeGroup == "cp" && isMasterNode(node) && node.id) return String(node.id);
  }
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (node.nodeGroup == "cp" && node.id) return String(node.id);
  }
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (isComputeNode(node) && isMasterNode(node) && node.id) return String(node.id);
  }
  for (i = 0, n = nodes.length; i < n; i++) {
    node = nodes[i];
    if (isComputeNode(node) && node.id) return String(node.id);
  }
  return nodes[0] && nodes[0].id ? String(nodes[0].id) : "";
}

function computeDefaultTimeFromNodeId(nodeId) {
  var s = String(nodeId == null ? "" : nodeId).replace(/\D/g, "");
  if (s.length === 0) return "";
  if (s.length < 3) s = ("000" + s).slice(-3);
  var hour = parseInt(s.slice(-1), 10);
  var minute = parseInt(s.slice(-3, -1), 10);
  if (isNaN(hour)) hour = 0;
  if (isNaN(minute)) minute = 0;
  minute = minute % 60;
  hour = hour % 24;
  var hh = (hour < 10 ? "0" : "") + hour;
  var mm = (minute < 10 ? "0" : "") + minute;
  return hh + ":" + mm;
}

function isHhMm(v) {
  return /^\d{1,2}:\d{2}$/.test(String(v || "").trim());
}

/**
 * Same map as Install: appid/domain/name -> HH:MM caption.
 * Saved backupTime may be an appid (install list) or HH:MM (older installs).
 */
function buildBackupTimeValuesByEnv() {
  var map = {};
  try {
    var resp = jelastic.env.control.GetEnvs();
    if (!resp || resp.result !== 0 || !resp.infos) return map;
    for (var i = 0; i < resp.infos.length; i++) {
      var info = resp.infos[i];
      var env = info.env || {};
      var nodeId = pickCpNodeId(info.nodes);
      if (isEmpty(nodeId)) continue;
      var time = computeDefaultTimeFromNodeId(nodeId);
      if (isEmpty(time)) continue;
      if (env.appid) map[String(env.appid)] = time;
      if (env.domain) map[String(env.domain)] = time;
      if (env.envName) map[String(env.envName)] = time;
      if (env.shortdomain) map[String(env.shortdomain)] = time;
      map[time] = time;
    }
  } catch (e) {}
  return map;
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

var form = settings;
if ((!form || !form.fields) && typeof jps !== "undefined" && jps.settings && jps.settings.main) {
  form = jps.settings.main;
}

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

if (isEmpty(scheduleType)) scheduleType = "2";
form.fields[0].default = scheduleType;

if (scheduleType == "1") {
  var cronPre = '${settings.cronTime}';
  if (!isEmpty(cronPre)) form.fields[0].showIf[1][0].default = cronPre;
} else if (scheduleType == "2") {
  var savedBackupTime = '${settings.backupTime}';
  var timeValues = buildBackupTimeValuesByEnv();
  var timeValue = "${env.appid}";
  if (!isEmpty(savedBackupTime)) {
    timeValue = savedBackupTime;
  }
  if (isHhMm(savedBackupTime) && !timeValues[String(savedBackupTime)]) {
    timeValues[String(savedBackupTime)] = String(savedBackupTime).trim();
  }
  if (!isEmpty(savedBackupTime) && !isHhMm(savedBackupTime) && !timeValues[String(savedBackupTime)]) {
    // Unknown saved key (e.g. stale appid) — still show a usable HH:MM fallback
    var fallback = "05:00";
    try {
      var envInfo = api.env.control.GetEnvInfo('${env.envName}', session);
      if (envInfo && envInfo.result == 0 && envInfo.nodes) {
        var nid = pickCpNodeId(envInfo.nodes);
        var t = computeDefaultTimeFromNodeId(nid);
        if (!isEmpty(t)) fallback = t;
      }
    } catch (eEnv) {}
    timeValues[String(savedBackupTime)] = fallback;
    timeValues[fallback] = fallback;
  }

  form.fields[0].showIf[2][0] = {
    type: "list",
    name: "backupTime",
    caption: "Time",
    required: true,
    editable: false,
    forceSelection: true,
    hideTrigger: true,
    readOnly: true,
    width: 120,
    tooltip: "Backup time from the CP node ID: last digit = hour, previous two digits = minutes (e.g. node 316 -> 06:31, node 1164 -> 04:16).",
    value: timeValue,
    values: timeValues
  };

  var sun = boolSetting('${settings.sun}', true),
      mon = boolSetting('${settings.mon}', true),
      tue = boolSetting('${settings.tue}', true),
      wed = boolSetting('${settings.wed}', true),
      thu = boolSetting('${settings.thu}', true),
      fri = boolSetting('${settings.fri}', true),
      sat = boolSetting('${settings.sat}', true);
  form.fields[0].showIf[2][1] = {
    caption: "Days",
    type: "compositefield",
    name: "days",
    defaultMargins: "0 12 0 0",
    items: [
      { name: "sun", value: sun, type: "checkbox", caption: "Su" },
      { name: "mon", value: mon, type: "checkbox", caption: "Mo" },
      { name: "tue", value: tue, type: "checkbox", caption: "Tu" },
      { name: "wed", value: wed, type: "checkbox", caption: "We" },
      { name: "thu", value: thu, type: "checkbox", caption: "Th" },
      { name: "fri", value: fri, type: "checkbox", caption: "Fr" },
      { name: "sat", value: sat, type: "checkbox", caption: "Sa" }
    ]
  };

  form.fields[0].showIf[2][2].values = values;
  var tz = '${settings.tz}';
  if (isEmpty(tz)) {
    var existingTz = form.fields[0].showIf[2][2].value || form.fields[0].showIf[2][2].default;
    tz = isEmpty(existingTz) ? defaultTz : existingTz;
  }
  form.fields[0].showIf[2][2].value = tz;
} else {
  var cronMan = '${settings.cronTime}';
  if (!isEmpty(cronMan)) form.fields[0].showIf[3][0].default = cronMan;
}

var wasabiEndpoint = '${settings.wasabiEndpoint}';
if (isEmpty(wasabiEndpoint)) {
  var existingEndpoint = form.fields[1].default;
  wasabiEndpoint = isEmpty(existingEndpoint) ? "s3.us-east-2.wasabisys.com" : existingEndpoint;
}
form.fields[1].default = wasabiEndpoint;

var backupScope = '${settings.backupScope}';
if (isEmpty(backupScope)) {
  var existingScope = form.fields[2].default;
  backupScope = isEmpty(existingScope) ? "both" : existingScope;
}
form.fields[2].default = backupScope;

var backupCount = '${settings.backupCount}';
if (!isEmpty(backupCount)) form.fields[7].default = backupCount;

// Secrets: never interpolate settings.* into source. Use API only if default empty;
// the dashboard also re-applies saved field values after this script runs.
applyPlatformSecretDefault(form.fields[3], "wasabiBucket");
applyPlatformSecretDefault(form.fields[4], "wasabiAccessKeyId");
applyPlatformSecretDefault(form.fields[5], "wasabiSecretAccessKey");
applyPlatformSecretDefault(form.fields[6], "resticPassword");

return settings;
