# Backend URLs — Prod vs Staging (ne jamais mélanger)

**Règle :** Staging ne doit **jamais** appeler la prod. Prod = utilisateurs réels. Staging = tests uniquement.

---

## Production (live)

| | |
|--|--|
| **Dossier sur VPS** | `C:\app\backend` |
| **Port** | **8000** |
| **Service Windows** | `SaasMixBackend` |
| **URL API (publique)** | **https://api.siberiamix.com** |
| **Depuis le VPS (localhost)** | `http://localhost:8000` |

---

## Staging

| | |
|--|--|
| **Dossier sur VPS** | `C:\app\backend-staging` |
| **Port** | **8001** |
| **Service Windows** | `SaasMixBackendStaging` |
| **URL API (publique)** | **https://api-staging.siberiamix.com** |
| **Depuis le VPS (localhost)** | `http://localhost:8001` |
| **Frontend Netlify** | https://stagingsiberiamix.netlify.app |

---

## Mettre à jour le code staging sur le VPS (après push sur `staging`)

`C:\app\backend-staging` n’est pas un dépôt git (copie manuelle). Deux options :

### Option A — Clone git + copie (recommandé pour pouvoir faire `git pull` ensuite)

Sur le VPS, PowerShell (une fois la première fois, ensuite tu fais juste 1. + 2. + 4.) :

1. **Créer un clone dédié staging (une seule fois) :**
```powershell
cd C:\app
git clone https://github.com/mikhailyuv99/SaaSMix.git repo-staging
cd repo-staging
git checkout staging
```

2. **Mettre à jour le clone puis copier le backend vers backend-staging (à chaque déploiement) :**
```powershell
cd C:\app\repo-staging
git fetch origin staging
git checkout staging
git pull origin staging
Copy-Item -Path "C:\app\backend-staging\.env" -Destination "C:\app\backend-staging\.env.bak" -Force
xcopy /E /Y "C:\app\repo-staging\backend\*" "C:\app\backend-staging\"
Copy-Item -Path "C:\app\backend-staging\.env.bak" -Destination "C:\app\backend-staging\.env" -Force
```

3. **Redémarrer le service staging :**
```powershell
Restart-Service SaasMixBackendStaging
```

*(Remplace l’URL du repo si ce n’est pas la bonne.)*

### Option B — Mise à jour manuelle (sans git sur le VPS)

Depuis ton PC : zipper le contenu du dossier `backend` (branche `staging`), envoyer sur le VPS (WeTransfer, RDP, etc.), extraire dans `C:\app\backend-staging` en écrasant les fichiers (sauf `.env` : ne pas l’écraser pour garder la config staging). Puis sur le VPS : `Restart-Service SaasMixBackendStaging`.

---

## Commandes utiles (PowerShell sur le VPS)

**Diagnostic VST (staging uniquement — port 8001) :**
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/debug/vst-status"
```

**Diagnostic VST (prod — port 8000) :**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/debug/vst-status"
```

**Services :**
```powershell
Get-Service -Name "SaasMixBackend","SaasMixBackendStaging","SaasMixCaddy"
Restart-Service SaasMixBackendStaging   # redémarrer uniquement staging
Restart-Service SaasMixBackend         # redémarrer uniquement prod
```

---

## Résumé

- **Staging API** = `https://api-staging.siberiamix.com` ou `http://localhost:8001`
- **Prod API** = `https://api.siberiamix.com` ou `http://localhost:8000`
- Ne jamais pointer le frontend staging vers le port 8000 ou api.siberiamix.com.
