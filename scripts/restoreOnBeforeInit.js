import org.json.JSONObject;
import org.json.JSONArray;
var Response = com.hivext.api.Response;
var error_markup = "";
var backupListPrepared = [];

var envInfo = api.env.control.GetEnvInfo('${env.envName}', session);
if (envInfo.result != 0) {
    error_markup = "Unable to get environment info.";
} else {
    var cpNode = envInfo.nodes.filter(function(node) { 
        return node.nodeGroup == 'cp' && node.ismaster; 
    })[0];
    
    if (!cpNode) {
        error_markup = "Application node not found.";
    } else {
        var listCmd = 'export AWS_ACCESS_KEY_ID="${settings.wasabiAccessKeyId}" && ' +
                      'export AWS_SECRET_ACCESS_KEY="${settings.wasabiSecretAccessKey}" && ' +
                      'export RESTIC_REPOSITORY="s3:${settings.wasabiEndpoint}/${settings.wasabiBucket}/${env.envName}" && ' +
                      'export RESTIC_PASSWORD="${settings.resticPassword}" && ' +
                      'restic snapshots --json 2>/dev/null || echo "[]"';
        
        var cmdResp = api.env.control.ExecCmdById('${env.envName}', session, cpNode.id, 
            toJSON([{"command": listCmd, "params": ""}]), true, "root");
        
        if (cmdResp.result != 0) {
            error_markup = "Unable to list backups: " + (cmdResp.error || "command failed");
        } else {
            try {
                var output = cmdResp.responses[0].out || "[]";
                var snapshots = toNative(new JSONArray(String(output)));
                backupListPrepared = prepareBackups(snapshots);
                if (backupListPrepared.length === 0) {
                    error_markup = "No backups found in the repository. Create a backup first.";
                }
            } catch (e) {
                error_markup = "Unable to parse backup list: " + e.message;
            }
        }
    }
}

function prepareBackups(snapshots) {
    var aResultValues = [];
    snapshots = snapshots || [];
    
    for (var i = 0, n = snapshots.length; i < n; i++) {
        var snapshot = snapshots[i];
        var tags = snapshot.tags || [];
        var timestamp = "";
        
        for (var j = 0; j < tags.length; j++) {
            if (tags[j].match(/^\d{4}-\d{2}-\d{2}_\d{6}_/)) {
                timestamp = tags[j];
                break;
            }
        }
        
        if (!timestamp && snapshot.time) {
            timestamp = snapshot.time.substring(0, 19).replace("T", " ");
        }
        
        if (timestamp) {
            aResultValues.push({
                caption: timestamp,
                value: timestamp
            });
        }
    }
    
    aResultValues.sort(function(a, b) {
        return b.value.localeCompare(a.value);
    });
    
    return aResultValues;
}

if (error_markup === "") {
    settings.fields.push({
        "caption": "Backup",
        "type": "list",
        "tooltip": "Select the time stamp for which you want to restore the contents of the web site",          
        "name": "backupDir",
        "required": true,
        "values": backupListPrepared
    });
} else {
    settings.fields.push(
        {"type": "displayfield", "cls": "warning", "height": 30, "hideLabel": true, "markup": error_markup}
    );
}

return settings;
