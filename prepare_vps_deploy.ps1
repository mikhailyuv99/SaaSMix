# Prepare VPS_Deploy sur le Bureau : backend + hise_vst3_host.exe + VST3
# Lance ce script en PowerShell depuis : c:\Users\mikha\Desktop\SaaS Mix

$Desktop = [Environment]::GetFolderPath("Desktop")
$Dest = Join-Path $Desktop "VPS_Deploy"
$BackendSrc = "c:\Users\mikha\Desktop\SaaS Mix\backend"
$HiseHostSrc = "c:\Users\mikha\Desktop\SaaS Mix\hise_vst3_host\build\hise_vst3_host_artefacts\Release\hise_vst3_host.exe"
$HiseBase = "c:\Users\mikha\Desktop\HISE"

# Dossiers VST3 (nom du projet -> chemin relatif dans HISE)
$Vst3List = @(
    @{ Name = "Project1.vst3"; Path = "Project1\Binaries\Compiled\VST3\Project1.vst3" },
    @{ Name = "master.vst3"; Path = "master\Binaries\Compiled\VST3\master.vst3" },
    @{ Name = "reverb1.vst3"; Path = "reverb1\Binaries\Compiled\VST3\reverb1.vst3" },
    @{ Name = "reverb2.vst3"; Path = "reverb2\Binaries\Compiled\VST3\reverb2.vst3" },
    @{ Name = "reverb3new.vst3"; Path = "reverb3new\Binaries\Compiled\VST3\reverb3new.vst3" },
    @{ Name = "doubler.vst3"; Path = "doubler\Binaries\Compiled\VST3\doubler.vst3" },
    @{ Name = "robot.vst3"; Path = "robot\Binaries\Compiled\VST3\robot.vst3" }
)

Write-Host "Creation de $Dest ..."
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Dest "backend") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Dest "vst3") -Force | Out-Null

# 1) Backend (exclure venv, __pycache__, .git)
Write-Host "Copie du backend ..."
robocopy $BackendSrc (Join-Path $Dest "backend") /E /XD venv __pycache__ .git /NFL /NDL /NJH /NJS | Out-Null

# 2) hise_vst3_host.exe
if (Test-Path $HiseHostSrc) {
    Copy-Item $HiseHostSrc -Destination $Dest -Force
    Write-Host "OK: hise_vst3_host.exe copie."
} else {
    Write-Host "ATTENTION: hise_vst3_host.exe introuvable ici: $HiseHostSrc"
    Write-Host "  Compile-le (voir hise_vst3_host\README.md) puis copie l'exe a la main dans $Dest"
}

# 3) VST3
foreach ($v in $Vst3List) {
    $srcPath = Join-Path $HiseBase $v.Path
    $destPath = Join-Path (Join-Path $Dest "vst3") $v.Name
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $destPath -Recurse -Force
        Write-Host "OK: $($v.Name)"
    } else {
        Write-Host "Manquant: $($v.Name) (source: $srcPath)"
    }
}

Write-Host ""
Write-Host "Termine. Dossier pret: $Dest"
Write-Host "  - backend\   : contenu du backend"
Write-Host "  - hise_vst3_host.exe (si compile)"
Write-Host "  - vst3\      : Project1.vst3, master.vst3, etc."
Write-Host ""
Write-Host "Tu peux zipper tout le dossier VPS_Deploy et le copier sur le VPS, ou glisser-deposer le contenu en RDP."
