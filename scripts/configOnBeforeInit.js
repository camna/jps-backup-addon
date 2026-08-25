var scheduleType = '${settings.scheduleType}';
var defaultTz = "America/New_York";
var SYSTEM_APPID = "1dd8d191d38fff45e62564fcf67fdcd6";

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  var s = String(v).trim();
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

function normalizeEnvName(name) {
  if (isEmpty(name)) return "";
  var s = String(name).trim();
  var dot = s.indexOf(".");
  if (dot > 0) s = s.substring(0, dot);
  return s;
}

function scriptParam(name) {
  try {
    var v = getParam(name);
    if (v === null || v === undefined) return "";
    v = String(v).trim();
    if (!v || v.indexOf("$") === 0) return "";
    return v;
  } catch (e) {
    return "";
  }
}

function requestParam(name) {
  try {
    if (typeof Request === "undefined" || !Request) return "";
    var v = Request.getParameter(name);
    if (v === null || v === undefined) return "";
    v = String(v).trim();
    if (!v || v.indexOf("$") === 0) return "";
    return v;
  } catch (e) {
    return "";
  }
}

function envMatches(env, needle) {
  if (!env || isEmpty(needle)) return false;
  var n = String(needle);
  var shortNeedle = normalizeEnvName(n);
  return env.envName == n || env.envName == shortNeedle ||
    env.shortdomain == n || env.shortdomain == shortNeedle ||
    env.domain == n || env.appid == n ||
    normalizeEnvName(env.domain) == shortNeedle;
}

function getEnvInfoByName(name) {
  if (isEmpty(name)) return null;
  try {
    var envInfo = api.env.control.GetEnvInfo(name, session);
    if (envInfo && envInfo.result == 0 && envInfo.nodes) return envInfo;
  } catch (e1) {}
  try {
    var envInfo2 = jelastic.env.control.GetEnvInfo(name, session);
    if (envInfo2 && envInfo2.result == 0 && envInfo2.nodes) return envInfo2;
  } catch (e2) {}
  return null;
}

function resolveTargetEnvHints() {
  var hints = [];
  var keys = [
    "envName", "envname", "name", "domain", "envDomain", "envAppid",
    "appid", "targetEnv", "env", "shortdomain"
  ];
  var i, k, v;
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    v = scriptParam(k);
    if (!isEmpty(v)) hints.push(v);
    v = requestParam(k);
    if (!isEmpty(v)) hints.push(v);
  }
  try {
    if (typeof appid !== "undefined" && appid && String(appid) !== SYSTEM_APPID) {
      hints.push(String(appid));
    }
  } catch (eApp) {}
  try {
    if (typeof envName !== "undefined" && !isEmpty(envName)) hints.push(String(envName));
  } catch (eName) {}
  try {
    if (typeof env !== "undefined" && env) {
      if (env.envName) hints.push(String(env.envName));
      if (env.name) hints.push(String(env.name));
      if (env.domain) hints.push(String(env.domain));
      if (env.appid) hints.push(String(env.appid));
    }
  } catch (eEnv) {}

  var placeholders = [
    '${env.envName}',
    '${env.name}',
    '${env.domain}',
    '${env.appid}',
    '${env.shortdomain}'
  ];
  for (i = 0; i < placeholders.length; i++) {
    if (!isEmpty(placeholders[i])) hints.push(placeholders[i]);
  }
  return hints;
}

function resolveCpMasterNodeId() {
  var direct = [
    '${nodes.cp.master.id}',
    '${nodes.lemp.master.id}',
    '${targetNodes.master.id}'
  ];
  var d;
  for (d = 0; d < direct.length; d++) {
    if (!isEmpty(direct[d])) return String(direct[d]);
  }

  var hints = resolveTargetEnvHints();
  var h, name, envInfo, id, resp, i, info, env;

  for (h = 0; h < hints.length; h++) {
    name = normalizeEnvName(hints[h]);
    if (isEmpty(name)) name = hints[h];
    envInfo = getEnvInfoByName(name);
    if (envInfo) {
      id = pickCpNodeId(envInfo.nodes);
      if (!isEmpty(id)) return id;
    }
    envInfo = getEnvInfoByName(hints[h]);
    if (envInfo) {
      id = pickCpNodeId(envInfo.nodes);
      if (!isEmpty(id)) return id;
    }
  }

  try {
    resp = jelastic.env.control.GetEnvs();
    if (resp && resp.result === 0 && resp.infos) {
      for (i = 0; i < resp.infos.length; i++) {
        info = resp.infos[i];
        env = info.env || {};
        for (h = 0; h < hints.length; h++) {
          if (envMatches(env, hints[h])) {
            id = pickCpNodeId(info.nodes);
            if (!isEmpty(id)) return id;
          }
        }
      }
    }
  } catch (eGetEnvs) {}

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
    jps.settings.main.fields[0].showIf[2][0] = {
      type: "string",
      name: "backupTime",
      caption: "Time",
      inputType: "time",
      tooltip: isEmpty(cpNodeIdForTime)
        ? "Auto from CP node ID on install (last digit = hour, previous two = minutes). Example: node 1164 → 04:16."
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

var backupScope = '${settings.backupScope}';
if (isEmpty(backupScope)) {
  var existingScope = jps.settings.main.fields[2].default;
  backupScope = isEmpty(existingScope) ? "both" : existingScope;
}
jps.settings.main.fields[2].default = backupScope;

setDefaultIfPresent(jps.settings.main.fields[3], '${settings.wasabiBucket}');
setDefaultIfPresent(jps.settings.main.fields[4], '${settings.wasabiAccessKeyId}');
setDefaultIfPresent(jps.settings.main.fields[5], '${settings.wasabiSecretAccessKey}');
setDefaultIfPresent(jps.settings.main.fields[6], '${settings.resticPassword}');
setDefaultIfPresent(jps.settings.main.fields[7], '${settings.backupCount}');

applyPlatformSecretDefault(jps.settings.main.fields[3], "wasabiBucket");
applyPlatformSecretDefault(jps.settings.main.fields[4], "wasabiAccessKeyId");
applyPlatformSecretDefault(jps.settings.main.fields[5], "wasabiSecretAccessKey");
applyPlatformSecretDefault(jps.settings.main.fields[6], "resticPassword");

return {
  result: 0,
  settings: jps.settings
};
