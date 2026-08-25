import java.util.TimeZone;

var zones = toNative(TimeZone.getAvailableIDs());
var values = {};
var defaultTz = "America/New_York";

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  var s = String(v).trim();
  if (/^\$\{[a-zA-Z0-9_.\[\]]+\}$/.test(s)) return true;
  if (/^\$\{fn\.secret\([^)]*\)\}$/.test(s)) return true;
  return s === "";
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

/**
 * Map env identifiers -> HH:MM caption.
 * Dashboard replaces value "${env.appid}" after open, selecting the matching row.
 * Captions are plain HH:MM. Submitted value may be appid; convert uses node ID for cron.
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

var tzField = jps.settings.main.fields[0].showIf[2][2];
if (isEmpty(tzField.value) && isEmpty(tzField.default)) {
  tzField.value = defaultTz;
}

var savedBackupTime = '${settings.backupTime}';
var timeValues = buildBackupTimeValuesByEnv();
var timeValue = "${env.appid}";
if (!isEmpty(savedBackupTime)) {
  timeValue = savedBackupTime;
}

jps.settings.main.fields[0].showIf[2][0] = {
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

applyPlatformSecretDefault(jps.settings.main.fields[3], "wasabiBucket");
applyPlatformSecretDefault(jps.settings.main.fields[4], "wasabiAccessKeyId");
applyPlatformSecretDefault(jps.settings.main.fields[5], "wasabiSecretAccessKey");
applyPlatformSecretDefault(jps.settings.main.fields[6], "resticPassword");

return {
  result: 0,
  settings: jps.settings
};
