# makershelf Bridge - One-time installation script
# Registers the makershelf:// protocol for the current Windows user (no admin rights required)
$ErrorActionPreference = 'Stop'

# Remove the internet block mark if the script was downloaded and blocked by Windows
try { Unblock-File -Path $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue } catch {}

$script:Dir = Join-Path $env:APPDATA 'MakershelfBridge'
$script:InstallLogPath = Join-Path $script:Dir 'makershelf-bridge-install.log'
$script:BridgeLogPath = Join-Path $script:Dir 'makershelf-bridge.log'
$script:TranscriptStarted = $false
$script:PauseOnExit = $env:MAKERSHELF_BRIDGE_NO_PAUSE -ne '1'

function Write-InstallLog($message) {
  try {
    New-Item -ItemType Directory -Path $script:Dir -Force | Out-Null
    "[$(Get-Date -Format s)] $message" | Add-Content -Path $script:InstallLogPath -Encoding UTF8
  } catch {}
}

function Show-ErrorDialog($message) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      $message,
      'makershelf Bridge',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {}
}

function Close-BridgeInstaller {
  param([int]$ExitCode = 0)
  try {
    if ($script:TranscriptStarted) {
      Stop-Transcript | Out-Null
    }
  } catch {}

  if ($script:PauseOnExit) {
    if ($ExitCode -ne 0) {
      Show-ErrorDialog "Installation failed.`nSee log file for details:`n$script:InstallLogPath"
    } else {
      Write-Host ''
      Write-Host "  Bridge log: $script:BridgeLogPath"
      Write-Host "  Install log: $script:InstallLogPath"
      try { Read-Host '  Press Enter to close' } catch {}
    }
  }
  exit $ExitCode
}

try {
  New-Item -ItemType Directory -Path $script:Dir -Force | Out-Null
  # Transcript may fail if a session is already running (e.g. from PowerShell ISE) - non-fatal
  try {
    Start-Transcript -Path $script:InstallLogPath -Append | Out-Null
    $script:TranscriptStarted = $true
  } catch {}

  Write-Host ''
  Write-Host '  makershelf Bridge - Installation' -ForegroundColor Cyan
  Write-Host '  =====================================' -ForegroundColor Cyan
  Write-Host ''

  $handlerPath = Join-Path $script:Dir 'makershelf-bridge.ps1'
  $powerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

  Write-InstallLog 'Starting makershelf Bridge installation.'

  if (-not (Test-Path $powerShellPath)) {
    $powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
  }

  Write-InstallLog "Using PowerShell executable: $powerShellPath"

  $handlerContent = @'
HANDLER_PLACEHOLDER
'@

  Set-Content -Path $handlerPath -Value $handlerContent -Encoding UTF8
  Unblock-File -Path $handlerPath -ErrorAction SilentlyContinue
  Write-InstallLog "Wrote handler: $handlerPath"

  # Register protocols in HKCU (no admin required).
  # pv:// is kept as a short legacy alias; old OPV names are intentionally not re-registered.
  foreach ($scheme in @('makershelf', 'pv')) {
    $reg = "HKCU:\SOFTWARE\Classes\$scheme"
    New-Item -Path $reg -Force | Out-Null
    Set-Item -Path $reg -Value 'makershelf Bridge'
    Set-ItemProperty -Path $reg -Name 'URL Protocol' -Value ''

    New-Item -Path "$reg\DefaultIcon" -Force | Out-Null
    Set-Item -Path "$reg\DefaultIcon" -Value "`"$powerShellPath`",0"

    New-Item -Path "$reg\shell\open\command" -Force | Out-Null
    $command = "`"$powerShellPath`" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$handlerPath`" `"%1`""
    Set-Item -Path "$reg\shell\open\command" -Value $command

    $registeredCommand = (Get-Item -Path "$reg\shell\open\command").GetValue('')
    if ($registeredCommand -ne $command) {
      throw "Registry validation failed for $scheme. Expected '$command' but found '$registeredCommand'."
    }

    Write-InstallLog "Registered $scheme protocol: $registeredCommand"
  }

  Write-Host '  Done! makershelf:// protocol registered successfully.' -ForegroundColor Green
  Write-Host '  Note: pv:// is also registered as a legacy alias.' -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '  Return to makershelf and click "Open in slicer" again.'
  Write-InstallLog 'Installation finished successfully.'
  Close-BridgeInstaller 0
} catch {
  $errMsg = $_.Exception.Message
  Write-InstallLog "ERROR: $errMsg"
  Write-Host ''
  Write-Host '  makershelf Bridge installation failed.' -ForegroundColor Red
  Write-Host "  $errMsg" -ForegroundColor Red
  Show-ErrorDialog "makershelf Bridge - Installation failed`n`n$errMsg`n`nLog file: $script:InstallLogPath"
  Close-BridgeInstaller 1
}
