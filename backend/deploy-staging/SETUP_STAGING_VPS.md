# Mise en place du backend STAGING sur le VPS

Tu as déjà la prod dans `C:\app\backend` et Caddy. Ce guide ajoute un **second** backend (staging) sur le même VPS, sans toucher à la prod.

---

## 1. Créer le dossier staging sur le VPS

Dans PowerShell (ou l’explorateur) :

```powershell
mkdir C:\app\backend-staging
```

---

## 2. Mettre le code staging dans `C:\app\backend-staging`

**Option A – Git sur le VPS**

```powershell
cd C:\app
git clone https://github.com/mikhailyuv99/SaaSMix.git repo-staging
cd repo-staging
git checkout staging
# Copier uniquement le dossier backend
xcopy /E /I backend C:\app\backend-staging
```

(Adapte l’URL du repo si besoin. Si tu as déjà un clone, tu peux faire un second clone dans un autre dossier puis copier `backend` vers `C:\app\backend-staging`.)

**Option B – WeTransfer depuis ton PC**

- Sur ton PC : zipper le contenu de `backend` (branche `staging`).
- Envoyer par WeTransfer, télécharger sur le VPS, extraire dans `C:\app\backend-staging`.

---

## 3. Environnement Python et .env

```powershell
cd C:\app\backend-staging
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copier le fichier **`.env.staging.example`** (du dossier `deploy-staging`) dans `C:\app\backend-staging` et le renommer en **`.env`**.  
Remplir les valeurs : `DATABASE_URL` (base **staging** dédiée), Stripe **test**, `SECRET_KEY`, AWS si besoin.

Créer la base PostgreSQL staging si ce n’est pas déjà fait (ex. `saas_mix_staging`).

---

## 4. Installer le service Windows (NSSM)

Sur le VPS, ouvre **PowerShell en tant qu’administrateur**.

- Copie le script **`install-staging-service.ps1`** (dossier `deploy-staging`) sur le VPS (ex. Bureau ou `C:\app\deploy-staging`).
- Ouvre le script et vérifie :
  - `$BackendStagingPath = "C:\app\backend-staging"`
  - `$NssmPath` = chemin vers `nssm.exe` (comme pour SaasMixBackend prod).

Puis exécute :

```powershell
cd C:\app\deploy-staging
.\install-staging-service.ps1
```

Vérification :

```powershell
Get-Service -Name "SaasMixBackend","SaasMixBackendStaging","SaasMixCaddy"
```

Tu dois voir les trois en **Running**.

**Mix (VST3) :** Le script `install-staging-service.ps1` définit dans le service les variables `HISE_VST3_HOST_EXE` et `VST_BASE` vers le même exe et le même dossier VST3 que la prod (`C:\app\hise_vst3_host.exe` et `C:\Users\Administrator\Desktop\vps vst3`). Ainsi le mix fonctionne sur staging sans copie supplémentaire. Si tu as installé le service avant cette mise à jour, ajoute ces variables à la main :

```powershell
nssm set SaasMixBackendStaging AppEnvironmentExtra "PATH=C:\app\backend-staging\venv\Scripts;%PATH%`nHISE_VST3_HOST_EXE=C:\app\hise_vst3_host.exe`nVST_BASE=C:\Users\Administrator\Desktop\vps vst3"
```

Puis redémarre : `Restart-Service SaasMixBackendStaging`.

---

## 5. Caddy – sous-domaine staging

Ouvre le **Caddyfile** (là où est configuré `api.siberiamix.com`, ex. dans `C:\app\caddy` ou `C:\caddy`).

Ajoute le bloc du fichier **`Caddyfile.staging.snippet`** (même niveau que le bloc api.siberiamix.com) :

```
api-staging.siberiamix.com {
    reverse_proxy localhost:8001
}
```

Recharge Caddy (selon ta config) :

```powershell
# Si Caddy est en service et utilise reload :
cd C:\app\caddy
caddy reload

# Ou redémarre le service :
Restart-Service SaasMixCaddy
```

---

## 6. DNS (OVH)

Dans le manager OVH : pour le domaine **siberiamix.com**, ajoute un enregistrement **A** :

- Sous-domaine : **api-staging**
- Cible : **IP du VPS** (même que pour l’API prod).

---

## 7. Frontend staging (Netlify)

Site staging : **https://stagingsiberiamix.netlify.app**

Sur ce site Netlify (celui qui build la branche **staging**) :  
Variables d’environnement :
- **NEXT_PUBLIC_API_URL** = `https://api-staging.siberiamix.com`
- **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** = `pk_test_...`
- **NEXT_PUBLIC_STRIPE_PRICE_MONTHLY** = `price_...` (test)
- **NEXT_PUBLIC_STRIPE_PRICE_ANNUAL** = `price_...` (test)
- **NEXT_PUBLIC_SITE_URL** = `https://stagingsiberiamix.netlify.app` (optionnel, pour liens/redirects)

---

## 8. CORS (optionnel)

L’origine `https://stagingsiberiamix.netlify.app` est déjà dans `main.py` (`allow_origins`). Après modification du backend, redémarre le service staging :

```powershell
Restart-Service SaasMixBackendStaging
```

---

## Récap

| Élément              | Prod                    | Staging                        |
|----------------------|-------------------------|--------------------------------|
| Dossier backend      | `C:\app\backend`        | `C:\app\backend-staging`       |
| Port                 | 8000                    | 8001                           |
| Service              | SaasMixBackend          | SaasMixBackendStaging          |
| URL API              | api.siberiamix.com      | api-staging.siberiamix.com     |
| Base de données      | saas_mix (prod)         | saas_mix_staging               |
| Stripe               | Clés live               | Clés test                      |
| Mix (VST3)           | Host + `vps vst3`       | **Même** host + dossier (partagés sur le VPS) |

Une fois tout ça en place, tu n’as plus besoin de WeTransfer pour le quotidien : sur le VPS, `cd C:\app\backend-staging`, `git pull origin staging` (si tu utilises un clone git), puis `Restart-Service SaasMixBackendStaging`.
