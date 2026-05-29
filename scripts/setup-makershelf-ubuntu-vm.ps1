param(
  [string]$VmName = "makershelf-ubuntu-test",
  [string]$VmRoot = "C:\VMs\MakershelfUbuntu",
  [string]$IsoDir = "C:\VMs\ISO",
  [string]$IsoUrl = "https://releases.ubuntu.com/24.04/ubuntu-24.04.4-live-server-amd64.iso",
  [int]$MemoryMB = 4096,
  [int]$CpuCount = 2,
  [int]$DiskGB = 40,
  [int]$SshPort = 3022,
  [int]$AppPort = 3000,
  [switch]$DownloadIso,
  [switch]$Start
)

$ErrorActionPreference = "Stop"

function Find-VBoxManage {
  $cmd = Get-Command VBoxManage.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $knownPath = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
  if (Test-Path $knownPath) { return $knownPath }

  throw "VBoxManage.exe wurde nicht gefunden. Bitte VirtualBox installieren oder den Pfad in PATH aufnehmen."
}

function Test-VirtualizationEnabled {
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  return [bool]$cpu.VirtualizationFirmwareEnabled
}

$vbox = Find-VBoxManage
$isoFile = Join-Path $IsoDir ([IO.Path]::GetFileName($IsoUrl))
$diskFile = Join-Path $VmRoot "$VmName.vdi"

New-Item -ItemType Directory -Path $VmRoot, $IsoDir -Force | Out-Null

if (-not (Test-VirtualizationEnabled)) {
  Write-Warning "Intel VT-x ist im BIOS/UEFI aktuell deaktiviert. Die VM wird erst nach Aktivierung starten."
  Write-Host "Aktiviere im BIOS/UEFI: Intel Virtualization Technology / VT-x, dann Windows neu starten."
  Write-Host "Vorbereitet wurden nur die Ordner:"
  Write-Host "  VM:  $VmRoot"
  Write-Host "  ISO: $IsoDir"
  exit 2
}

if ($DownloadIso -and -not (Test-Path $isoFile)) {
  Write-Host "Lade Ubuntu Server ISO herunter:"
  Write-Host "  $IsoUrl"
  Invoke-WebRequest -Uri $IsoUrl -OutFile $isoFile
}

if (-not (Test-Path $isoFile)) {
  throw "Ubuntu ISO fehlt: $isoFile. Starte das Skript mit -DownloadIso oder lege die ISO dort ab."
}

$existing = & $vbox list vms | Select-String "`"$VmName`""
if (-not $existing) {
  & $vbox createvm --name $VmName --ostype Ubuntu_64 --register --basefolder $VmRoot | Out-Null
  & $vbox modifyvm $VmName --memory $MemoryMB --cpus $CpuCount --ioapic on --boot1 dvd --boot2 disk --graphicscontroller vmsvga --vram 128 --nic1 nat | Out-Null
  & $vbox modifyvm $VmName --natpf1 "ssh,tcp,127.0.0.1,$SshPort,,22" | Out-Null
  & $vbox modifyvm $VmName --natpf1 "makershelf,tcp,127.0.0.1,$AppPort,,3000" | Out-Null

  & $vbox createmedium disk --filename $diskFile --size ($DiskGB * 1024) --format VDI | Out-Null
  & $vbox storagectl $VmName --name "SATA" --add sata --controller IntelAhci | Out-Null
  & $vbox storageattach $VmName --storagectl "SATA" --port 0 --device 0 --type hdd --medium $diskFile | Out-Null
  & $vbox storagectl $VmName --name "IDE" --add ide | Out-Null
  & $vbox storageattach $VmName --storagectl "IDE" --port 0 --device 0 --type dvddrive --medium $isoFile | Out-Null
} else {
  Write-Host "VM existiert bereits: $VmName"
}

Write-Host ""
Write-Host "Ubuntu-Test-VM ist vorbereitet."
Write-Host "Name:        $VmName"
Write-Host "RAM/CPU:     $MemoryMB MB / $CpuCount CPUs"
Write-Host "Disk:        $DiskGB GB"
Write-Host "SSH nach Installation: ssh -p $SshPort <user>@127.0.0.1"
Write-Host "Makershelf-Portforward: http://127.0.0.1:$AppPort"

if ($Start) {
  & $vbox startvm $VmName --type gui | Out-Null
  Write-Host "VM wurde gestartet."
} else {
  Write-Host "Starten mit:"
  Write-Host "  & `"$vbox`" startvm `"$VmName`" --type gui"
}
