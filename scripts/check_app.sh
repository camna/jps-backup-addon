#!/bin/bash

# Install is allowed for any stack with the standard Jelastic webroot. WordPress is optional:
# - Files backup works for any content under WEBROOT.
# - Database backup still reads credentials from wp-config.php (WordPress-style constants).

WEBROOT="/var/www/webroot/ROOT"
LOG="/var/log/backup_addon.log"

if [ ! -d "${WEBROOT}" ]; then
    echo "$(date) No application webroot at ${WEBROOT}; backup add-on cannot run here" >> "${LOG}"
    echo "Non-supported"
    exit 0
fi

echo "$(date) trying to install the backup add-on (webroot ${WEBROOT})" >> "${LOG}"

if [ -f "${WEBROOT}/wp-config.php" ]; then
    if [ -e /home/jelastic/bin/wp ]; then
        /home/jelastic/bin/wp --info >> "${LOG}" 2>&1 || true
    fi
else
    echo "$(date) Non-WordPress webroot: use Configure → Backup content → Files only, or add wp-config.php with DB_* constants for DB backup/restore." >> "${LOG}"
fi
