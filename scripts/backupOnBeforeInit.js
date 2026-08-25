import java.util.TimeZone;
var zones = toNative(TimeZone.getAvailableIDs());
var values = {};
var defaultTz = "America/New_York";

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  var s = String(v).trim();
  if (/^\$\{settings\.[^}]+\}$/.test(s)) return true;
  if (/^\$\{secrets\.[^}]+\}$/.test(s)) return true;
  if (/^\$\{fn\.secret\([^)]*\)\}$/.test(s)) return true;
  return s === "";
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

// Preserve marketplace / secret-manager defaults; only fill gaps
var tzField = jps.settings.main.fields[0].showIf[2][2];
if (isEmpty(tzField.value) && isEmpty(tzField.default)) {
  tzField.value = defaultTz;
}

var timeField = jps.settings.main.fields[0].showIf[2][0];
var savedBackupTime = '${settings.backupTime}';
if (isEmpty(savedBackupTime)) {
  var envInfo = api.env.control.GetEnvInfo('${env.envName}', session);
  if (envInfo && envInfo.result == 0 && envInfo.nodes) {
    var cpNode = envInfo.nodes.filter(function(node) { 
      return node.nodeGroup == 'cp' && node.ismaster; 
    })[0];
    if (cpNode && cpNode.id) {
      timeField.default = computeDefaultTimeFromNodeId(cpNode.id);
    } else if (isEmpty(timeField.default)) {
      timeField.default = "05:00";
    }
  } else if (isEmpty(timeField.default)) {
    timeField.default = "05:00";
  }
} else {
  timeField.default = savedBackupTime;
}

// Prefill from platform Secret Manager when field defaults are still empty
applyPlatformSecretDefault(jps.settings.main.fields[3], "wasabiBucket");
applyPlatformSecretDefault(jps.settings.main.fields[4], "wasabiAccessKeyId");
applyPlatformSecretDefault(jps.settings.main.fields[5], "wasabiSecretAccessKey");
applyPlatformSecretDefault(jps.settings.main.fields[6], "resticPassword");
      
return {
    result: 0,
    settings: jps.settings
};
