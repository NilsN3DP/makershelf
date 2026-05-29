# makershelf Bridge - Protocol handler
# Invoked automatically by the installer script
param([string]$RawUrl)

Add-Type -AssemblyName System.Web

$bridgeDir = Join-Path $env:APPDATA 'MakershelfBridge'
$logPath = Join-Path $bridgeDir 'makershelf-bridge.log'
New-Item -ItemType Directory -Path $bridgeDir -Force | Out-Null

function Write-BridgeLog($message) {
    "[$(Get-Date -Format s)] $message" | Add-Content -Path $logPath -Encoding UTF8
}

Write-BridgeLog "RawUrl=$RawUrl"

try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
} catch {}

function Parse-QueryString($qs) {
    $result = @{}
    $qs = $qs.TrimStart('?')
    foreach ($pair in $qs -split '&') {
        $kv = $pair -split '=', 2
        if ($kv.Count -eq 2) {
            $result[[System.Web.HttpUtility]::UrlDecode($kv[0])] = [System.Web.HttpUtility]::UrlDecode($kv[1])
        }
    }
    return $result
}

function Read-QueryParam($url, $name) {
    $escapedName = [Regex]::Escape($name)
    $pattern = "(?:[?&])$escapedName=([^&]+)"
    $match = [Regex]::Match($url, $pattern)
    if ($match.Success) {
        return [System.Web.HttpUtility]::UrlDecode($match.Groups[1].Value)
    }
    return $null
}

# makershelf://open?fileUrl=...&fileName=...&app=bambu
# Older builds produced makershelf://open/file?url=... — both remain valid
# so an already-installed Bridge does not break after an update.
$normalized = $RawUrl -replace '^(pv|makershelf)://', 'http://makershelf-internal/'
try {
    $uri = [System.Uri]$normalized
    $params = Parse-QueryString $uri.Query
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "makershelf Bridge could not parse the incoming request.`n$RawUrl`n`n$_",
        'makershelf Bridge',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    exit 1
}

$fileUrl  = $params['fileUrl']
$fileName = $params['fileName']
$app      = $params['app']
$testMode = $params['test']
$manifestUrl = $params['manifestUrl']

if (-not $fileUrl) { $fileUrl = Read-QueryParam $RawUrl 'fileUrl' }
if (-not $fileUrl) { $fileUrl = $params['url'] }
if (-not $fileUrl) { $fileUrl = Read-QueryParam $RawUrl 'url' }
if (-not $fileUrl) { $fileUrl = $params['file'] }
if (-not $fileUrl) { $fileUrl = Read-QueryParam $RawUrl 'file' }
if (-not $fileName) { $fileName = Read-QueryParam $RawUrl 'fileName' }
if (-not $app) { $app = Read-QueryParam $RawUrl 'app' }
if (-not $testMode) { $testMode = Read-QueryParam $RawUrl 'test' }
if (-not $manifestUrl) { $manifestUrl = Read-QueryParam $RawUrl 'manifestUrl' }

if ($testMode -eq '1' -or $testMode -eq 'true') {
    Write-BridgeLog 'Test mode completed successfully.'
    exit 0
}

$downloadItems = @()

if ($manifestUrl) {
    Write-BridgeLog "Loading manifest $manifestUrl"
    try {
        $manifest = Invoke-RestMethod -Uri $manifestUrl -UseBasicParsing -TimeoutSec 60
        foreach ($entry in @($manifest.files)) {
            if ($entry.url) {
                $downloadItems += [PSCustomObject]@{
                    Url = [string]$entry.url
                    Name = [string]$entry.name
                }
            }
        }
        Write-BridgeLog "Manifest contains $($downloadItems.Count) file(s)."
    } catch {
        Write-BridgeLog "ERROR: Manifest download failed: $_"
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "Could not load the file list.`n$_",
            'makershelf Bridge',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        exit 1
    }
} else {
    if (-not $fileName -and $fileUrl) {
        try {
            $fileName = [System.IO.Path]::GetFileName(([System.Uri]$fileUrl).AbsolutePath)
        } catch {
            $fileName = "makershelf-file"
        }
    }
    if ($fileUrl) {
        $downloadItems += [PSCustomObject]@{
            Url = $fileUrl
            Name = $fileName
        }
    }
}

if (-not $downloadItems.Count) {
    Write-BridgeLog "ERROR: Missing fileUrl in $RawUrl"
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "makershelf Bridge did not receive a valid file link.`n$RawUrl",
        'makershelf Bridge',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    exit 1
}

# Temp folder
$tempDir = Join-Path $env:TEMP 'MakershelfBridge'
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Keep at most 30 files; remove the oldest ones
Get-ChildItem $tempDir -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 30 |
    Remove-Item -Force -ErrorAction SilentlyContinue

$localFiles = @()
foreach ($item in $downloadItems) {
    $itemName = $item.Name
    if ([string]::IsNullOrWhiteSpace($itemName)) {
        try {
            $itemName = [System.IO.Path]::GetFileName(([System.Uri]$item.Url).AbsolutePath)
        } catch {
            $itemName = "makershelf-file"
        }
    }

    $safeFileName = $itemName -replace '[\\/:*?"<>|]', '_'
    if ([string]::IsNullOrWhiteSpace($safeFileName)) {
        $safeFileName = "makershelf-file"
    }
    $localFile = Join-Path $tempDir $safeFileName
    Write-BridgeLog "Downloading $($item.Url) to $localFile"

    try {
        Invoke-WebRequest -Uri $item.Url -OutFile $localFile -UseBasicParsing -TimeoutSec 60
        $localFiles += $localFile
        Write-BridgeLog "Download finished: $localFile"
    } catch {
        Write-BridgeLog "ERROR: Download failed: $_"
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "Could not download the file.`n$_",
            'makershelf Bridge',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        exit 1
    }
}

# Resolve application path
$candidates = switch ($app) {
    'bambu'    { @(
        'C:\Program Files\Bambu Studio\bambu-studio.exe',
        'C:\Program Files\Bambu Studio\BambuStudio.exe',
        "$env:LOCALAPPDATA\BambuStudio\bambu-studio.exe",
        "$env:LOCALAPPDATA\BambuStudio\BambuStudio.exe"
    )}
    'orca'     { @(
        'C:\Program Files\OrcaSlicer\orca-slicer.exe',
        'C:\Program Files\OrcaSlicer\OrcaSlicer.exe',
        "$env:LOCALAPPDATA\OrcaSlicer\orca-slicer.exe",
        'C:\Program Files\Snapmaker_Orca\snapmaker-orca.exe'
    )}
    'prusa'    { @(
        'C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer.exe',
        'C:\Program Files\Prusa3D\PrusaSlicer\PrusaSlicer.exe',
        "$env:LOCALAPPDATA\PrusaSlicer\prusa-slicer.exe"
    )}
    'fusion360'{ @(
        "$env:LOCALAPPDATA\Autodesk\webdeploy\production\FusionLauncher.exe",
        'C:\Program Files\Autodesk\Fusion 360\Fusion360.exe'
    )}
    'freecad'  { @(
        'C:\Program Files\FreeCAD 1.0\bin\FreeCAD.exe',
        'C:\Program Files\FreeCAD 0.21\bin\FreeCAD.exe'
    )}
    default    { @() }
}

$exePath = $null
foreach ($c in $candidates) {
    if (Test-Path $c) { $exePath = $c; break }
}

if ($exePath) {
    $arguments = @()
    if ($app -eq 'prusa' -and $localFiles.Count -gt 1) {
        $arguments += "--merge"
        Write-BridgeLog "Prusa multi-file mode enabled with --merge."
    }
    $arguments += $localFiles | ForEach-Object { "`"$_`"" }
    $argumentLine = $arguments -join " "
    Write-BridgeLog "Opening with app=$exePath args=$argumentLine"
    Start-Process $exePath -ArgumentList $argumentLine
} else {
    # Fallback: use Windows file association
    Write-BridgeLog "Opening with Windows file association: $($localFiles[0])"
    Start-Process $localFiles[0]
}
