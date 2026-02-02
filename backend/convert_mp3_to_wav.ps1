param(
  [Parameter(Mandatory=$true)]
  [string]$InputDir,

  [Parameter(Mandatory=$true)]
  [string]$OutputDir,

  # If set, forces all output to this sample rate (e.g. 48000).
  # If 0, keeps original sample rate.
  [int]$ForceSampleRate = 48000,

  # If set, forces mono output (recommended for this project).
  [switch]$Mono,

  # Starting number for renaming (e.g. 30 for song30, song31, etc.)
  [int]$StartNumber = 0,

  # If set, allows overwriting existing output files.
  [switch]$OverwriteExisting
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Missing required command '$name'. Install FFmpeg first (winget: winget install Gyan.FFmpeg) then restart PowerShell."
  }
}

Require-Command "ffmpeg"

if (-not (Test-Path -LiteralPath $InputDir)) {
  throw "InputDir not found: $InputDir"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$inputFiles = Get-ChildItem -LiteralPath $InputDir -File -Recurse | Where-Object {
  $_.Extension -in @(".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg")
} | Sort-Object FullName

if ($inputFiles.Count -eq 0) {
  Write-Host "No supported audio files found in: $InputDir"
  exit 0
}

Write-Host "Found $($inputFiles.Count) audio files."
Write-Host "OutputDir: $OutputDir"
if ($ForceSampleRate -gt 0) { Write-Host "ForceSampleRate: $ForceSampleRate Hz" } else { Write-Host "ForceSampleRate: keep original" }
if ($Mono) { Write-Host "Channels: mono" } else { Write-Host "Channels: keep original" }
Write-Host ""

$i = 0
foreach ($f in $inputFiles) {
  $i++
  
  # Rename if StartNumber is specified
  if ($StartNumber -gt 0) {
    $songNumber = $StartNumber + $i - 1
    $base = "song$songNumber"
  } else {
    $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  }
  
  $outPath = Join-Path $OutputDir ($base + ".wav")
  
  # If output exists, avoid overwriting unless explicitly allowed.
  # If we're using StartNumber naming, auto-bump the song number until we find a free filename.
  if (-not $OverwriteExisting) {
    if ($StartNumber -gt 0) {
      while (Test-Path -LiteralPath $outPath) {
        $songNumber++
        $base = "song$songNumber"
        $outPath = Join-Path $OutputDir ($base + ".wav")
      }
    } else {
      if (Test-Path -LiteralPath $outPath) {
        Write-Host ("[{0}/{1}] SKIP {2} (output exists: {3})" -f $i, $inputFiles.Count, $f.Name, (Split-Path $outPath -Leaf))
        continue
      }
    }
  }

  $args = @(
    "-hide_banner",
    "-loglevel", "error",
    "-i", $f.FullName
  )

  # Overwrite behavior for ffmpeg
  if ($OverwriteExisting) {
    $args = @("-y") + $args
  } else {
    $args = @("-n") + $args
  }

  if ($ForceSampleRate -gt 0) {
    $args += @("-ar", "$ForceSampleRate")
  }

  if ($Mono) {
    $args += @("-ac", "1")
  }

  # 24-bit PCM WAV (good default for training/mixing)
  $args += @("-c:a", "pcm_s24le", $outPath)

  try {
    & ffmpeg @args
    Write-Host ("[{0}/{1}] OK {2} -> {3}" -f $i, $inputFiles.Count, $f.Name, (Split-Path $outPath -Leaf))
  } catch {
    Write-Host ("[{0}/{1}] ERROR {2}" -f $i, $inputFiles.Count, $f.Name)
    Write-Host $_
  }
}

Write-Host ""
Write-Host "Done."
