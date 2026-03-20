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
      
jps.settings.main.fields[0].showIf[2][2].values = values;
jps.settings.main.fields[0].showIf[2][2].value = "GMT0";
      
return {
    result: 0,
    settings: jps.settings
};
