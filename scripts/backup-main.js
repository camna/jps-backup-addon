//@auth

var action = getParam("action", "backup"),
    baseUrl = "${baseUrl}";

function run() {
    var config = {
        session              : session,
        baseUrl              : baseUrl,
        uid                  : user.uid,
        cronTime             : "${cronTime}",
        scriptName           : "${scriptName}",
        envName              : "${envName}",
        envAppid             : "${envAppid}",
        backupExecNode       : "${backupExecNode}",
        backupCount          : "${backupCount}",
        wasabiEndpoint       : "${wasabiEndpoint}",
        wasabiBucket         : "${wasabiBucket}",
        wasabiAccessKeyId    : "${wasabiAccessKeyId}",
        wasabiSecretAccessKey: "${wasabiSecretAccessKey}",
        resticPassword       : "${resticPassword}"
    };

    if (action === "restore") {
        var p;
        p = getParam("restoreEnvName", "");
        if (p) config.restoreSourceEnvName = p;
        p = getParam("restoreWasabiEndpoint", "");
        if (p) config.wasabiEndpoint = p;
        p = getParam("restoreWasabiBucket", "");
        if (p) config.wasabiBucket = p;
        p = getParam("restoreWasabiAccessKeyId", "");
        if (p) config.wasabiAccessKeyId = p;
        p = getParam("restoreWasabiSecretAccessKey", "");
        if (p) config.wasabiSecretAccessKey = p;
        p = getParam("restoreResticPassword", "");
        if (p) config.resticPassword = p;
    }

    var BackupManager = use("scripts/backup-manager.js", config);

    api.local.ReturnResult(
        BackupManager.invoke(action)
    );
}

function use(script, config) {
    var Transport = com.hivext.api.core.utils.Transport,
        body = new Transport().get(baseUrl + "/" + script + "?_r=" + Math.random());
    var debug = baseUrl + "/" + script + "?_r=" + Math.random();

    return new (new Function("return " + body)())(config);
}

try {
    run();
} catch (ex) {
    var resp = {
        result : com.hivext.api.Response.ERROR_UNKNOWN,
        error: "Error: " + toJSON(ex)
    };

    api.marketplace.console.WriteLog(appid, signature, "ERROR: " + resp);
    api.local.ReturnResult(resp);
}
