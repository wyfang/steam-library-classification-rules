param(
    [string]$AccountId = "89582913",
    [string]$SteamPath = ""
)

$ErrorActionPreference = "Stop"

if (Get-Process -Name "steam", "steamwebhelper" -ErrorAction SilentlyContinue) {
    throw "Steam is still running. Exit Steam completely, then run this tool again."
}

if ([string]::IsNullOrWhiteSpace($SteamPath)) {
    $registryCandidates = @(
        @{ Path = "HKCU:\Software\Valve\Steam"; Name = "SteamPath" },
        @{ Path = "HKLM:\Software\WOW6432Node\Valve\Steam"; Name = "InstallPath" },
        @{ Path = "HKLM:\Software\Valve\Steam"; Name = "InstallPath" }
    )

    foreach ($candidate in $registryCandidates) {
        try {
            $value = Get-ItemPropertyValue -Path $candidate.Path -Name $candidate.Name
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                $SteamPath = $value
                break
            }
        } catch {}
    }
}

if ([string]::IsNullOrWhiteSpace($SteamPath)) {
    $SteamPath = "${env:ProgramFiles(x86)}\Steam"
}

$cloudDirectory = Join-Path $SteamPath "userdata\$AccountId\config\cloudstorage"
$cloudPath = Join-Path $cloudDirectory "cloud-storage-namespace-1.json"
$modifiedPath = Join-Path $cloudDirectory "cloud-storage-namespace-1.modified.json"

if (-not (Test-Path -LiteralPath $cloudPath)) {
    throw "Steam collection config was not found: $cloudPath. Use -SteamPath to specify the Steam installation folder."
}

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$backupDirectory = Join-Path $cloudDirectory ("collection-backup-before-legacy-cleanup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backupDirectory | Out-Null
Copy-Item -LiteralPath $cloudPath -Destination $backupDirectory
if (Test-Path -LiteralPath $modifiedPath) {
    Copy-Item -LiteralPath $modifiedPath -Destination $backupDirectory
}

Add-Type -AssemblyName System.Web.Extensions
$jsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$jsonSerializer.MaxJsonLength = [int]::MaxValue
$jsonSerializer.RecursionLimit = 100

# Use the .NET Framework JSON parser instead of ConvertFrom-Json. Windows
# PowerShell 5 can flatten Steam's nested [[key, record], ...] arrays.
$cloudJsonSource = Get-Content -LiteralPath $cloudPath -Raw -Encoding UTF8
$cloud = $jsonSerializer.DeserializeObject($cloudJsonSource)
if ($null -eq $cloud -or $cloud.Count -eq 0) {
    throw "Steam collection config is empty or has an unexpected JSON structure. No changes were made."
}

$deletedKeys = [System.Collections.Generic.List[string]]::new()
$output = [System.Collections.Generic.List[object]]::new()

foreach ($pair in $cloud) {
    $key = [string]$pair[0]
    $record = $pair[1]
    $isLegacyCollection = $key.StartsWith("user-collections.uc-ai-v2-")
    $alreadyDeleted = $record.ContainsKey("is_deleted") -and [bool]$record["is_deleted"]

    if ($isLegacyCollection -and -not $alreadyDeleted) {
        $tombstone = New-Object 'System.Collections.Generic.Dictionary[string,object]'
        $tombstone.Add("key", $key)
        $tombstone.Add("timestamp", $timestamp)
        $tombstone.Add("is_deleted", $true)
        $tombstone.Add("version", [string]$timestamp)
        $output.Add(@($key, $tombstone))
        $deletedKeys.Add($key)
    } else {
        $output.Add($pair)
    }
}

Write-Host "Loaded $($cloud.Count) Steam Cloud records; found $($deletedKeys.Count) active legacy collections."

if ($deletedKeys.Count -eq 0) {
    Write-Host "No active legacy uc-ai-v2 collections were found. The config was not changed."
    Write-Host "Backup folder: $backupDirectory"
    exit 0
}

$modifiedKeys = [System.Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $modifiedPath) {
    $modifiedJsonSource = Get-Content -LiteralPath $modifiedPath -Raw -Encoding UTF8
    foreach ($key in @($jsonSerializer.DeserializeObject($modifiedJsonSource))) {
        if (-not $modifiedKeys.Contains([string]$key)) {
            $modifiedKeys.Add([string]$key)
        }
    }
}
foreach ($key in $deletedKeys) {
    if (-not $modifiedKeys.Contains($key)) {
        $modifiedKeys.Add($key)
    }
}

$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
$cloudTemp = "$cloudPath.legacy-cleanup.tmp"
$modifiedTemp = "$modifiedPath.legacy-cleanup.tmp"

# Explicit casts enumerate the generic lists into plain CLR arrays. Calling
# ToArray() here can leave a PowerShell adapter object under Windows PowerShell
# 5.1, which JavaScriptSerializer then mistakes for a circular reference.
$outputArray = [object[]]$output
$modifiedArray = [string[]]$modifiedKeys
$outputJson = ConvertTo-Json -InputObject $outputArray -Depth 10 -Compress
$modifiedJson = ConvertTo-Json -InputObject $modifiedArray -Depth 3 -Compress
[System.IO.File]::WriteAllText($cloudTemp, $outputJson, $utf8WithoutBom)
[System.IO.File]::WriteAllText($modifiedTemp, $modifiedJson, $utf8WithoutBom)
Move-Item -LiteralPath $cloudTemp -Destination $cloudPath -Force
Move-Item -LiteralPath $modifiedTemp -Destination $modifiedPath -Force

Write-Host "Marked $($deletedKeys.Count) legacy collections as deleted."
Write-Host "Backup folder: $backupDirectory"
Write-Host "Start Steam now and wait for Steam Cloud to show Up to date before using another computer."
