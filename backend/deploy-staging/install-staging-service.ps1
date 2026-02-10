# ===========================================
# Installation du service Windows "SaasMixBackendStaging"
# À exécuter en PowerShell en tant qu'Administrateur sur le VPS.
# ===========================================
# 1. Modifier les variables ci-dessous selon ton VPS.
# 2. NSSM doit être installé (même que pour SaasMixBackend prod).
# 3. Le dossier backend-staging doit exister avec le code (branche staging), venv et .env.

$ServiceName = "SaasMixBackendStaging"
$BackendStagingPath = "C:\app\backend-staging"        # Même base que prod (C:\app\backend)
$NssmPath = "C:\nssm\nssm.exe"                       # Chemin vers nssm.exe (adapte si différent)
$PortStaging = 8001

# Python : soit venv du dossier staging, soit Python système
$PythonExe = Join-Path $BackendStagingPath "venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python.exe"
}
$UvicornArgs = "-m uvicorn main:app --host 0.0.0.0 --port $PortStaging"

if (-not (Test-Path $BackendStagingPath)) {
    Write-Error "Dossier introuvable: $BackendStagingPath. Crée-le et copie le code backend (branche staging) dedans."
    exit 1
}

if (-not (Test-Path $NssmPath)) {
    Write-Error "NSSM introuvable: $NssmPath. Installe NSSM ou modifie `$NssmPath."
    exit 1
}

# Mix : même host et VST3 que la prod (même VPS)
$HostExe = "C:\app\hise_vst3_host.exe"
$VstBase = "C:\Users\Administrator\Desktop\vps vst3"
$EnvExtra = "PATH=$BackendStagingPath\venv\Scripts;%PATH%`nHISE_VST3_HOST_EXE=$HostExe`nVST_BASE=$VstBase"

# Installer le service
& $NssmPath install $ServiceName $PythonExe $UvicornArgs
& $NssmPath set $ServiceName AppDirectory $BackendStagingPath
& $NssmPath set $ServiceName AppEnvironmentExtra $EnvExtra
& $NssmPath set $ServiceName Description "SaaS Mix Backend - Staging (port $PortStaging)"
& $NssmPath set $ServiceName Start SERVICE_AUTO_START

Write-Host "Service $ServiceName installé. Démarrage..."
Start-Service $ServiceName
Get-Service $ServiceName

Write-Host ""
Write-Host "Pour vérifier : Get-Service -Name SaasMixBackendStaging"
Write-Host "Pour arrêter   : Stop-Service -Name SaasMixBackendStaging"
Write-Host "Pour démarrer  : Start-Service -Name SaasMixBackendStaging"
