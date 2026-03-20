
<img src="images/backup-logo.svg" width="100" alt="Backup Storage"/>  

# Backup Add-On (Wasabi Edition)

Backup Add-On for WordPress that backs up the filesystem and database directly to [Wasabi](https://wasabi.com/) S3-compatible cloud storage using [Restic](https://restic.net/).

The list of supported web applications:

 - WordPress

## About Restic

Restic is a fast, secure, cross-platform backup program written in Go.

- **Encryption**: Restic encrypts data using AES-256 and authenticates it using Poly1305-AES
- **Incremental**: Backups are based on snapshots, making subsequent backups very fast
- **Deduplication**: Only changed data is uploaded, saving storage space

## How It Works

This add-on installs Restic on your WordPress application node and configures it to back up directly to your Wasabi S3 bucket. No intermediate storage node is required.

### Backup Flow

1. Database dump is generated from WordPress
2. Restic creates an encrypted, deduplicated snapshot
3. Snapshot is uploaded directly to your Wasabi bucket
4. Old snapshots are rotated based on your retention settings

### Restoration Flow

1. Select a backup timestamp from the restore UI
2. Restic downloads and decrypts the snapshot from Wasabi
3. Files and database are restored to your WordPress installation

## Installation

1. [Import](https://docs.jelastic.com/environment-import/) the manifest link within a dashboard of Virtuozzo Application Platform

2. Configure the add-on with:
   - **Backup schedule**: When to run automatic backups
   - **Wasabi Endpoint**: Your Wasabi region endpoint (e.g., `s3.wasabisys.com`)
   - **Wasabi Bucket**: Your Wasabi bucket name (can be shared across multiple sites - each site's backups are stored in a separate folder using the environment name)
   - **Access Key ID**: Your Wasabi access key
   - **Secret Access Key**: Your Wasabi secret key
   - **Restic Password**: Password to encrypt the backup repository (keep this safe!)
   - **Number of backups**: How many snapshots to retain

## Wasabi Setup

1. Create a Wasabi account at [wasabi.com](https://wasabi.com/)
2. Create an access key in the Wasabi console
3. Create a bucket for your backups (you can use one bucket for multiple sites)
4. Note your region endpoint (e.g., `s3.us-west-1.wasabisys.com`)

### Storage Structure

Backups are stored with site-specific paths within your bucket:

```
your-bucket/
├── site1-envname/
│   └── (restic repository files)
├── site2-envname/
│   └── (restic repository files)
└── site3-envname/
    └── (restic repository files)
```

This allows you to use a single bucket for multiple WordPress sites while keeping their backups isolated.

## Security Notes

- The restic password encrypts your backup data - **store it safely**
- Without the restic password, backups cannot be restored
- Wasabi credentials are stored in the add-on configuration
- Consider using separate Wasabi access keys per environment

## Usage

### Manual Backup

Click "Backup Now" in the add-on UI to create an immediate backup.

### Restore

1. Click "Restore" in the add-on UI
2. Select the backup timestamp you want to restore
3. Confirm the restore operation

**Warning**: Restore will overwrite your current data!

### Configuration

Click "Configure" to modify:
- Backup schedule
- Wasabi credentials
- Number of backups to retain

## Requirements

- Virtuozzo Application Platform with WordPress
- Wasabi account with:
  - Access key and secret key
  - A bucket created for backups
- Network access from your environment to Wasabi

## License

See [LICENSE](LICENSE) file.
