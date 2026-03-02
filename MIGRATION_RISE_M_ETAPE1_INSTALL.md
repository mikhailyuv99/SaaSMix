# Migration RISE-M — Étape 1 : Installer les logiciels

À exécuter **sur le RISE-M en RDP**, dans **PowerShell en tant qu’administrateur** (clic droit sur PowerShell → « Exécuter en tant qu’administrateur »).

---

## 1. Créer la structure des dossiers

```powershell
New-Item -ItemType Directory -Force -Path "C:\app"
New-Item -ItemType Directory -Force -Path "C:\app\backend"
New-Item -ItemType Directory -Force -Path "C:\app\backend-staging"
New-Item -ItemType Directory -Force -Path "C:\app\repo-staging"
```

---

## 2. Installer Python 3.11

```powershell
winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements
```

Ferme et rouvre PowerShell après l’install (pour que `python` soit dans le PATH), ou ouvre une **nouvelle** fenêtre PowerShell.

Vérification :

```powershell
python --version
```

Tu dois voir `Python 3.11.x`.

---

## 3. Installer Git

```powershell
winget install Git.Git --accept-package-agreements --accept-source-agreements
```

Rouvre PowerShell si besoin. Vérification :

```powershell
git --version
```

---

## 4. Installer PostgreSQL

```powershell
winget install PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements
```

- Pendant l’installation, note le **mot de passe** que tu choisis pour l’utilisateur `postgres`.
- Par défaut le service écoute sur `localhost:5432`.

Vérification (après redémarrage du serveur ou du service) :

```powershell
Get-Service -Name "postgresql*"
```

---

## 5. Installer Redis (Windows)

Redis n’est plus officiellement fourni pour Windows. Option simple : **port Windows** (tporadowski).

1. Télécharge le ZIP : https://github.com/tporadowski/redis/releases (prendre **Redis-x64-5.0.14.1.zip** ou la dernière release).
2. Extrais dans `C:\Redis` (par ex. `C:\Redis\redis-server.exe`).
3. Installer en service (PowerShell admin) :

```powershell
# Adapter le chemin si tu as extrait ailleurs
cd C:\Redis
.\redis-server.exe --service-install
.\redis-server.exe --service-start
```

Vérification :

```powershell
Get-Service -Name "Redis"
```

---

## 6. Installer NSSM

1. Télécharge NSSM : https://nssm.cc/download ou https://github.com/scavin/nssm-2.24 (ex. **nssm-2.24.zip**).
2. Extrais le ZIP dans **C:\nssm** (tu obtiens `C:\nssm\nssm-2.24\win64\nssm.exe`).

Vérification :

```powershell
& "C:\nssm\nssm-2.24\win64\nssm.exe" version
```

---

## 7. Installer Caddy

```powershell
winget install Caddy.Caddy --accept-package-agreements --accept-source-agreements
```

Ou téléchargement manuel : https://caddyserver.com/download → Windows 64-bit, place **caddy.exe** dans `C:\app\caddy` (ou `C:\caddy`).

Vérification :

```powershell
caddy version
```

---

## Récap

| Logiciel     | Vérification                    |
|-------------|----------------------------------|
| Python 3.11 | `python --version`               |
| Git         | `git --version`                  |
| PostgreSQL  | `Get-Service postgresql*`        |
| Redis       | `Get-Service Redis`              |
| NSSM        | `& "C:\nssm\nssm-2.24\win64\nssm.exe" version` |
| Caddy       | `caddy version`                  |

Une fois tout installé, passe à l’étape 2 (clone repo, venv, .env, VST3, hise_vst3_host.exe, services NSSM + Caddy).
