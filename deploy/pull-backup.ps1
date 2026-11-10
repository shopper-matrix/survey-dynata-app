<#
.SYNOPSIS
  Makes a fresh production database backup on the server and downloads it to this computer
  (DSA-803). Run it once a day, by hand or as a scheduled task (docs/runbook.md).

.EXAMPLE
  .\deploy\pull-backup.ps1
  .\deploy\pull-backup.ps1 -Destination D:\survey-backups -KeepDays 30
#>
param(
  # Server address and the SSH key that may log in as root.
  [string]$Server = '76.13.8.47',
  [string]$KeyFile = "$env:USERPROFILE\.ssh\serafima_vps",
  # Stack directory on the server: /opt/survey (production) or /opt/survey-staging.
  [string]$Stack = '/opt/survey',
  # Local folder for the backups; files older than KeepDays are deleted from it.
  [string]$Destination = "$env:USERPROFILE\Documents\survey-backups",
  [int]$KeepDays = 14
)

$ErrorActionPreference = 'Stop'
$sshOptions = @('-i', $KeyFile, '-o', 'BatchMode=yes')

New-Item -ItemType Directory -Force $Destination | Out-Null

Write-Host "Creating backup on $Server ($Stack)..."
$output = & ssh @sshOptions "root@$Server" "bash $Stack/current/deploy/backup.sh daily"
if ($LASTEXITCODE -ne 0) { throw "Backup on the server failed (exit code $LASTEXITCODE)." }
$output | ForEach-Object { Write-Host "  $_" }

$match = $output | Select-String -Pattern 'Backup written: (\S+\.dump)' | Select-Object -Last 1
if (-not $match) { throw 'The server did not report a backup file.' }
$remoteFile = $match.Matches[0].Groups[1].Value
$localFile = Join-Path $Destination (Split-Path $remoteFile -Leaf)

Write-Host "Downloading to $localFile..."
& scp @sshOptions "root@${Server}:$remoteFile" $localFile
if ($LASTEXITCODE -ne 0) { throw "Download failed (exit code $LASTEXITCODE)." }

# The download must be byte-for-byte the file on the server.
$remoteHash = ((& ssh @sshOptions "root@$Server" "sha256sum $remoteFile") -split '\s+')[0]
$localHash = (Get-FileHash -Algorithm SHA256 $localFile).Hash
if ($remoteHash -ne $localHash.ToLower()) {
  Remove-Item $localFile
  throw 'Checksum mismatch: the downloaded backup was deleted, run the script again.'
}

$removed = Get-ChildItem $Destination -Filter '*.dump' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
$removed | Remove-Item

$size = '{0:N0} KB' -f ((Get-Item $localFile).Length / 1KB)
Write-Host "Done: $localFile ($size, checksum ok). Removed $(@($removed).Count) backup(s) older than $KeepDays days."
