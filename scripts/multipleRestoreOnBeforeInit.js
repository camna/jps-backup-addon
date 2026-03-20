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
                      'restic snapshots --json 2>&1';
        
        var cmdResp = api.env.control.ExecCmdById('${env.envName}', session, cpNode.id, 
            toJSON([{"command": listCmd, "params": ""}]), true, "root");
        
        if (cmdResp.result != 0) {
            error_markup = "Unable to list backups: " + (cmdResp.error || "command failed");
        } else {
            var output = cmdResp.responses[0].out || "";
            var errOut = cmdResp.responses[0].errOut || "";
            var exitCode = cmdResp.responses[0].exitCode;
            
            if (exitCode && exitCode != 0) {
                if (exitCode == 10) {
                    error_markup = "Backup repository not initialized. Create a backup first.";
                } else {
                    error_markup = "Failed to list backups (exit " + exitCode + "): " + (errOut || output).substring(0, 200);
                }
            } else {
                try {
                    var snapshots = toNative(new JSONArray(String(output)));
                    backupListPrepared = prepareBackups(snapshots);
                    if (backupListPrepared.length === 0) {
                        error_markup = "No backups found in the repository. Create a backup first.";
                    }
                } catch (e) {
                    error_markup = "Unable to parse backup list: " + e.message + ". Output: " + output.substring(0, 100);
                }
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
    }, {
        "type": "checkbox",
        "name": "backupBeforeRestore",
        "caption": "Backup before restore",
        "value": false
    }, {
        "type": "displayfield",
        "hideLabel": true,
        "markup": "<hr style='margin:5px 0'><b>Restore Source Configuration</b><br><small>These settings determine which backup repository to restore from. Modify to restore from a different environment.</small>"
    }, {
        "type": "string",
        "name": "restoreEnvName",
        "caption": "Environment Name",
        "tooltip": "Environment name used as the folder path in the backup repository. Change to restore from a different environment's backups.",
        "default": "${env.envName}",
        "required": true
    }, {
        "type": "string",
        "name": "restoreWasabiEndpoint",
        "caption": "Wasabi Endpoint",
        "tooltip": "S3-compatible endpoint for restore",
        "default": "${settings.wasabiEndpoint}",
        "required": true
    }, {
        "type": "string",
        "name": "restoreWasabiBucket",
        "caption": "Wasabi Bucket",
        "tooltip": "Bucket name for restore",
        "default": "${settings.wasabiBucket}",
        "required": true
    }, {
        "type": "string",
        "name": "restoreWasabiAccessKeyId",
        "caption": "Access Key ID",
        "tooltip": "Wasabi access key ID for restore",
        "default": "${settings.wasabiAccessKeyId}",
        "required": true
    }, {
        "type": "string",
        "name": "restoreWasabiSecretAccessKey",
        "caption": "Secret Access Key",
        "tooltip": "Leave blank to use the configured backup secret key. Fill in only to override for this restore.",
        "inputType": "password",
        "required": false
    }, {
        "type": "string",
        "name": "restoreResticPassword",
        "caption": "Restic Password",
        "tooltip": "Leave blank to use the configured backup restic password. Fill in only to override for this restore.",
        "inputType": "password",
        "required": false
    });
} else {
    settings.fields.push(
        {"type": "displayfield", "cls": "warning", "height": 30, "hideLabel": true, "markup": error_markup}
    );
}

return settings;
