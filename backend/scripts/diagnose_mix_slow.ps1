# ===========================================
# Script de diagnostic : mix lent
# À exécuter sur le VPS (PowerShell) pendant ou après un mix lent.
# Ne modifie rien, affiche uniquement des infos.
# ===========================================

Write-Host "=== DIAGNOSTIC MIX LENT ===" -ForegroundColor Cyan
Write-Host ""

# 1. Priorité des services (NSSM)
Write-Host "1. Priorité des services NSSM" -ForegroundColor Yellow
$nssm = "C:\nssm\nssm-2.24\win64\nssm.exe"
if (Test-Path $nssm) {
    foreach ($svc in @("SaasMixBackend", "SaasMixBackendStaging")) {
        try {
            $out = & $nssm get $svc AppPriority 2>$null
            Write-Host "   $svc : $out"
        } catch {
            Write-Host "   $svc : (non installé ou erreur)"
        }
    }
} else {
    Write-Host "   NSSM non trouvé à $nssm"
}
Write-Host ""

# 2. Processus Python / hise_vst3_host (CPU, priorité)
Write-Host "2. Processus backend (CPU, mémoire)" -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -match "python|hise" } | 
    Select-Object Id, ProcessName, @{N='CPU(s)';E={[math]::Round($_.CPU,1)}}, @{N='RAM(MB)';E={[math]::Round($_.WorkingSet64/1MB,1)}} |
    Format-Table -AutoSize
Write-Host ""

# 3. Espace disque
Write-Host "3. Espace disque C:" -ForegroundColor Yellow
Get-PSDrive C | Select-Object @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}} | Format-Table -AutoSize
Write-Host ""

# 4. Dossiers temp mix
Write-Host "4. Dossiers temp mix (saas_mix_*)" -ForegroundColor Yellow
$temp = [System.IO.Path]::GetTempPath()
$mixed = Join-Path $temp "saas_mix_mixed"
$render = Join-Path $temp "saas_mix_render"
foreach ($d in @($mixed, $render)) {
    if (Test-Path $d) {
        $count = (Get-ChildItem $d -Filter "*.wav" -ErrorAction SilentlyContinue | Measure-Object).Count
        $size = (Get-ChildItem $d -Filter "*.wav" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "   $d : $count fichiers WAV, $([math]::Round($size,1)) MB"
    } else {
        Write-Host "   $d : (n'existe pas)"
    }
}
Write-Host ""

# 5. Test download localhost (si un fichier existe)
Write-Host "5. Test download localhost (staging port 8001)" -ForegroundColor Yellow
$sampleFile = Get-ChildItem $render -Filter "*.wav" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($sampleFile) {
    $id = $sampleFile.BaseName -replace "^mix_|^master_", ""
    $type = if ($sampleFile.Name -match "master") { "master" } else { "mix" }
    $url = "http://localhost:8001/api/download/render?id=$id&type=$type"
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        $sw.Stop()
        $sizeMB = $r.Content.Length / 1MB
        $sec = $sw.Elapsed.TotalSeconds
        $mbps = if ($sec -gt 0) { [math]::Round(($sizeMB * 8) / $sec, 2) } else { 0 }
        Write-Host "   Localhost: $([math]::Round($sizeMB,2)) MB en $([math]::Round($sec,1)) s (~$mbps Mbps)"
    } catch {
        Write-Host "   Erreur: $_"
    }
} else {
    Write-Host "   Aucun fichier dans RENDER_DIR pour tester. Lance un master d'abord."
}
Write-Host ""

# 6. Résumé
Write-Host "=== ACTIONS RECOMMANDÉES ===" -ForegroundColor Cyan
Write-Host "Si le mix (barre de progression) est lent :"
Write-Host "  -> nssm set SaasMixBackend AppPriority HIGH_PRIORITY_CLASS"
Write-Host "  -> Restart-Service SaasMixBackend"
Write-Host ""
Write-Host "Si le download/lecture est lent après 100% :"
Write-Host "  -> Problème réseau. Tester depuis 4G ou autre WiFi."
Write-Host "  -> Voir CDN_OVH_GUIDE.md pour CDN."
Write-Host ""
