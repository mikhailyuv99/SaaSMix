# Migration RISE-M — Étape 2 : Code, venv, .env, VST3, services

À exécuter **sur le RISE-M en RDP**. PowerShell en **administrateur** pour les services NSSM.

Sur le RISE-M l’utilisateur est **admin** (pas Administrator) → chemins utilisateur : `C:\Users\admin\...`

---

## 1. Clone du repo et copie du backend

```powershell
$env:Path += ";C:\Program Files\Git\cmd"
cd C:\app
git clone https://github.com/mikhailyuv99/SaaSMix.git repo-staging
cd repo-staging
git checkout staging
```

Copier le backend vers prod et staging :

```powershell
xcopy /E /I /Y backend C:\app\backend
xcopy /E /I /Y backend C:\app\backend-staging
```

---

## 2. Venv et dépendances (prod et staging)

**Backend prod :**

```powershell
cd C:\app\backend
C:\Python311\python.exe -m venv venv
.\venv\Scripts\pip.exe install -r requirements.txt
```

**Backend staging :**

```powershell
cd C:\app\backend-staging
C:\Python311\python.exe -m venv venv
.\venv\Scripts\pip.exe install -r requirements.txt
```

---

## 3. Fichiers .env

- **Prod :** copier le `.env` de l’ancien VPS (`C:\app\backend\.env`) vers `C:\app\backend\.env` sur le RISE-M (ou recréer à partir de `.env.example`).
- **Staging :** idem avec le `.env` staging vers `C:\app\backend-staging\.env`.

À adapter dans chaque `.env` si besoin :
- `DATABASE_URL` (PostgreSQL sur le RISE-M : `postgresql://postgres:MOT_DE_PASSE@localhost:5432/nom_base`)
- `REDIS_URL=redis://localhost:6379`
- `VST_BASE` et `HISE_VST3_HOST_EXE` peuvent être laissés vides si définis dans NSSM.

Créer les bases PostgreSQL (prod + staging) si nécessaire, puis mettre à jour les `DATABASE_URL`.

---

## 4. hise_vst3_host.exe

Copier **hise_vst3_host.exe** depuis l’ancien VPS (ou ton PC) vers **C:\app\hise_vst3_host.exe** sur le RISE-M.

---

## 5. Dossier VST3

- Télécharger l’archive depuis SwissTransfer sur le RISE-M.
- Extraire dans **C:\Users\admin\Desktop\vps vst3** (créer le dossier si besoin).

Tu dois avoir par exemple :  
`C:\Users\admin\Desktop\vps vst3\MIXCHAIN`, `GATE1`, `reverb2`, etc.

---

## 6. Service NSSM — Prod (port 8000)

PowerShell **en administrateur** :

```powershell
$Nssm = "C:\nssm\nssm-2.24\win64\nssm.exe"
$BackendPath = "C:\app\backend"
$PythonExe = "C:\app\backend\venv\Scripts\python.exe"
$HostExe = "C:\app\hise_vst3_host.exe"
$VstBase = "C:\Users\admin\Desktop\vps vst3"
$EnvExtra = "PATH=$BackendPath\venv\Scripts;%PATH%`nHISE_VST3_HOST_EXE=$HostExe`nVST_BASE=$VstBase"

& $Nssm install SaasMixBackend $PythonExe "-m uvicorn main:app --host 0.0.0.0 --port 8000"
& $Nssm set SaasMixBackend AppDirectory $BackendPath
& $Nssm set SaasMixBackend AppEnvironmentExtra $EnvExtra
& $Nssm set SaasMixBackend Description "SaaS Mix Backend - Prod (port 8000)"
& $Nssm set SaasMixBackend Start SERVICE_AUTO_START
Start-Service SaasMixBackend
Get-Service SaasMixBackend
```

---

## 7. Service NSSM — Staging (port 8001)

Sur le RISE-M l’utilisateur est **admin**, donc adapter le chemin VST dans le script.

Ouvre **C:\app\backend-staging\deploy-staging\install-staging-service.ps1** (ou le chemin où tu as copié le script) et modifie la ligne :

```powershell
$VstBase = "C:\Users\admin\Desktop\vps vst3"
```

Puis exécute (PowerShell admin) :

```powershell
cd C:\app\backend-staging\deploy-staging
.\install-staging-service.ps1
```

(Si le script n’est pas sur le RISE-M, copie-le depuis le repo ou exécute les mêmes commandes NSSM que pour prod en changeant port 8001, chemin backend-staging, nom service SaasMixBackendStaging.)

---

## 8. Caddy — Caddyfile et service

Créer **C:\app\caddy\Caddyfile** avec :

```
api.siberiamix.com {
    reverse_proxy localhost:8000
}

api-staging.siberiamix.com {
    reverse_proxy localhost:8001
}
```

Installer Caddy comme service avec NSSM (PowerShell admin) :

```powershell
$Nssm = "C:\nssm\nssm-2.24\win64\nssm.exe"
& $Nssm install SaasMixCaddy "C:\app\caddy\caddy.exe" "run --config C:\app\caddy\Caddyfile"
& $Nssm set SaasMixCaddy AppDirectory "C:\app\caddy"
& $Nssm set SaasMixCaddy Start SERVICE_AUTO_START
Start-Service SaasMixCaddy
```

---

## 9. Vérifications

```powershell
Get-Service -Name "SaasMixBackend","SaasMixBackendStaging","SaasMixCaddy"
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing
```

Après bascule DNS vers le RISE-M :  
https://api.siberiamix.com/health et https://api-staging.siberiamix.com/health

---

## Rappel

- **VST_BASE** sur le RISE-M : `C:\Users\admin\Desktop\vps vst3`
- **Bases PostgreSQL** : créer et mettre à jour les `DATABASE_URL` dans les `.env` (prod et staging).
