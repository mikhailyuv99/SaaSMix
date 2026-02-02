# Drop a vocal WAV (or pass path) → mix and save next to it as <name>_mixed.wav
# Usage:
#   .\mix_vocal.ps1 "C:\path\to\vocal.wav"
#   .\mix_vocal.ps1 .\my_vocal.wav
#   (or drag a file onto this script)
param(
  [Parameter(Mandatory = $false, Position = 0)]
  [string]$VocalPath,

  [Parameter(Mandatory = $false)]
  [string]$Output,
  [Parameter(Mandatory = $false)]
  [ValidateSet("modern_clean", "trap_aggressive", "smooth_rnb")]
  [string]$Preset = "modern_clean",
  [Parameter(Mandatory = $false)]
  [string]$Instrumental,
  [switch]$UseMl,
  [switch]$Open
)

$ErrorActionPreference = "Stop"
$BackendDir = $PSScriptRoot

$vocal = if ($VocalPath) { $VocalPath.Trim().Trim('"') } else { $null }
if (-not $vocal) {
  Write-Host "Usage: .\mix_vocal.ps1 <vocal.wav> [-Output path] [-Preset modern_clean|trap_aggressive|smooth_rnb] [-Instrumental path] [-UseMl] [-Open]"
  Write-Host "  Or drag a WAV file onto this script."
  exit 1
}
$vocalFull = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $vocal))
if (-not (Test-Path -LiteralPath $vocalFull)) {
  Write-Host "File not found: $vocalFull"
  exit 1
}

# Python: venv in backend, else py, else python
$py = $null
$venvPy = Join-Path $BackendDir "venv\Scripts\python.exe"
if (Test-Path -LiteralPath $venvPy) { $py = $venvPy }
if (-not $py) {
  $pyCmd = Get-Command py -ErrorAction SilentlyContinue
  if ($pyCmd) { $py = "py" } else { $py = "python" }
}

$mixScript = Join-Path $BackendDir "mix_vocal.py"
$cmdArgs = @($vocalFull, "--preset", $Preset)
if ($Output) { $cmdArgs += "-o"; $cmdArgs += $Output }
if ($Instrumental) { $cmdArgs += "--instrumental"; $cmdArgs += $Instrumental }
if ($UseMl) { $cmdArgs += "--use-ml" }

Write-Host "Mixing: $vocalFull"
Write-Host "Preset: $Preset"
$out = & $py $mixScript @cmdArgs 2>&1
$out | ForEach-Object { Write-Host $_ }
$lastLine = ($out | Where-Object { $_ -match '\.wav$' } | Select-Object -First 1)
if (-not $lastLine) { $lastLine = ($out | Select-Object -Last 1) }
$lastLine = $lastLine.Trim()
if ($LASTEXITCODE -ne 0) {
  Write-Host "Mix failed (exit $LASTEXITCODE)."
  exit $LASTEXITCODE
}
$outPath = if ($lastLine) { $lastLine.Trim() } else { $null }
if ([string]::IsNullOrWhiteSpace($outPath) -or -not (Test-Path -LiteralPath $outPath)) {
  Write-Host "Could not read output path from script."
  exit 1
}
Write-Host "Saved: $outPath"
if ($Open) {
  Start-Process $outPath
}
