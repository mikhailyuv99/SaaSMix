# Migration VPS → RISE-M — Brief pour agent

Utilise ce document pour migrer le backend Siberia Mix depuis le VPS actuel (OVH) vers un serveur **RISE-M** (OVH). Le RISE-M offre un CPU beaucoup plus rapide (Ryzen 9 9900X 5.6 GHz vs Intel Haswell 2.4 GHz) pour réduire le temps de mix d’environ 1 minute à ~25–40 secondes.

---

## 1. Contexte SaaS

**Siberia Mix** : SaaS de mix vocal automatique. L’utilisateur uploade des stems vocaux + instrumental (WAV), choisit un preset, reçoit un mix (full mix + vocal traité). Cible Hip-Hop/R&B.

**Stack backend :**
- Python 3.11+, FastAPI, PostgreSQL, Celery + Redis
- AWS S3 (stockage fichiers)
- **Chaîne de mix** : Python appelle un exe C++ `hise_vst3_host.exe` qui charge des VST3 HISE et traite des WAV. Chaîne actuelle : Tone → Gate (VST3) → FX téléphone → **MIXCHAIN** (VST3, le plus lourd) → De-esser → Air → Delay → Reverb (VST3) → Doubler → Robot (VST3).

**Frontend :** Next.js 14 sur Netlify. Prod = siberiamix.com ; Staging = stagingsiberiamix.netlify.app.

---

## 2. VPS actuel (à migrer)

**Hardware :**
- Intel Core (Haswell, no TSX) — 2.4 GHz
- 8 vCPU (8 processeurs logiques)
- Windows Server

**Chemins principaux :**
| Élément | Chemin |
|--------|--------|
| Base app | `C:\app\` |
| Backend prod | `C:\app\backend` |
| Backend staging | `C:\app\backend-staging` |
| Host VST3 | `C:\app\hise_vst3_host.exe` |
| Dossier VST3 | `C:\Users\Administrator\Desktop\vps vst3` |
| NSSM | `C:\nssm\nssm-2.24\win64\nssm.exe` |
| Caddy | `C:\app\caddy` ou `C:\caddy` (Caddyfile) |
| Clone git staging | `C:\app\repo-staging` |

**Services Windows (NSSM) :**
| Service | Port | Rôle |
|---------|------|------|
| SaasMixBackend | 8000 | Prod API |
| SaasMixBackendStaging | 8001 | Staging API |
| SaasMixCaddy | 80/443 | Reverse proxy HTTPS |

**Variables d’environnement (dans les services NSSM) :**
- `PATH` : inclut `C:\app\backend\venv\Scripts` (prod) ou `C:\app\backend-staging\venv\Scripts` (staging)
- `HISE_VST3_HOST_EXE` : `C:\app\hise_vst3_host.exe`
- `VST_BASE` : `C:\Users\Administrator\Desktop\vps vst3`

**Fichier `.env` (dans chaque backend) :**
- `DATABASE_URL` : PostgreSQL (prod et staging ont des bases différentes)
- `REDIS_URL` : `redis://localhost:6379`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- `SECRET_KEY`

**DNS actuels :**
- `api.siberiamix.com` → IP du VPS (prod)
- `api-staging.siberiamix.com` → même IP (staging, Caddy route selon le host)

---

## 3. Cible : RISE-M (OVH)

**Spécifications :**
- AMD Ryzen 9 9900X — 4.4 / 5.6 GHz boost
- 12c / 24t
- 64 Go DDR5 ECC
- 2×512 Go NVMe
- 94,99 € HT/mois
- Datacenter : Gravelines

**OS :** Windows Server (installer si proposé par OVH).

---

## 4. VST3 et hise_vst3_host

**Fichiers à copier sur le nouveau serveur :**
- `hise_vst3_host.exe` → `C:\app\hise_vst3_host.exe`
- Tous les `.vst3` du dossier `vps vst3` vers un dossier équivalent (ex. `C:\Users\Administrator\Desktop\vps vst3` ou `C:\app\vst3`)

**Plugins VST3 utilisés par la chaîne de mix :**
- MIXCHAIN.vst3 (core staging)
- GATE1, GATE2, GATE2Point5, GATE3 (noise gate)
- REVERB1Point5, reverb2, reverb3new (reverb)
- robot.vst3, doubler.vst3
- master2 ou master (si utilisé)

Sur le VPS, `VST_BASE` pointe vers un dossier contenant les `.vst3`. Le backend scanne récursivement ce dossier et indexe par nom (stem du fichier). Si la structure change, adapter `VST_BASE`.

**Référence :** `backend/HISE_VST3_REFERENCE.md`, `prepare_vps_deploy.ps1` (liste des VST3 à copier).

---

## 5. Chaîne de mix (mix_chain_b.py)

Ordre des étapes : **Tone** (Python) → **Gate** (VST3) → **FX téléphone** (Python) → **MIXCHAIN** (VST3) → **De-esser** (Python) → **Air** (Python) → **Delay** (Python) → **Reverb** (VST3) → **Doubler** (Python) → **Robot** (VST3).

Le MIXCHAIN est le plus lourd (~52 % du temps). Un meilleur CPU (RISE-M) accélère surtout cette étape.

---

## 6. Étapes de migration

### Phase 1 : Préparer le RISE-M (sans couper la prod)

1. Commander le RISE-M, installer Windows Server.
2. Installer : Python 3.11+, Git, PostgreSQL (ou pointer vers une DB managée), Redis, NSSM, Caddy.
3. Créer `C:\app\`, `C:\app\backend`, `C:\app\backend-staging`, `C:\app\repo-staging`.
4. Cloner le repo : `git clone https://github.com/mikhailyuv99/SaaSMix.git C:\app\repo-staging`, `git checkout staging`.
5. Copier `repo-staging\backend` vers `C:\app\backend` (prod) et `C:\app\backend-staging` (staging). Ou deux clones (master pour prod, staging pour staging).
6. Créer les venv : `python -m venv venv`, `pip install -r requirements.txt` dans chaque backend.
7. Copier les fichiers `.env` depuis l’ancien VPS (sans modifier les clés) ; adapter si les chemins (DB, Redis, VST_BASE) changent.
8. Copier `hise_vst3_host.exe` vers `C:\app\`.
9. Copier tout le dossier VST3 (`vps vst3`) vers le même chemin sur le RISE-M (ou un chemin cohérent et mettre à jour `VST_BASE`).
10. Créer les bases PostgreSQL (prod et staging) ou configurer les URLs si DB externes.
11. Installer les services NSSM (prod et staging) avec `install-staging-service.ps1` comme référence. Adapter `$VstBase` si le dossier VST3 change.
12. Configurer Caddy : blocs pour `api.siberiamix.com` → `localhost:8000` et `api-staging.siberiamix.com` → `localhost:8001`.
13. Ouvrir les ports 80, 443 (et éventuellement 8000, 8001 si besoin).
14. Tester en local : `Invoke-WebRequest http://localhost:8000/health`, `http://localhost:8001/health`, puis un mix complet.

### Phase 2 : Basculer le DNS

1. Réduire le TTL des enregistrements DNS (api.siberiamix.com, api-staging.siberiamix.com) à 300 s quelques heures avant.
2. Modifier les enregistrements A pour pointer vers l’**IP du RISE-M**.
3. Attendre la propagation (5–30 min selon le TTL).
4. Vérifier : health, mix, frontend, Stripe webhooks.

### Phase 3 : Nettoyage

1. Garder l’ancien VPS quelques jours en backup (arrêter les services pour éviter les doublons).
2. Vérifier les logs, erreurs, facturation Stripe.
3. Résilier l’ancien VPS quand tout est stable.

---

## 7. Fichiers de référence dans le projet

| Fichier | Rôle |
|---------|------|
| `BACKEND_URLS_REFERENCE.md` | Ports, services, URLs prod/staging |
| `backend/deploy-staging/install-staging-service.ps1` | Script d’installation service staging |
| `backend/deploy-staging/SETUP_STAGING_VPS.md` | Guide complet staging |
| `backend/deploy-staging/.env.staging.example` | Exemple .env staging |
| `prepare_vps_deploy.ps1` | Préparation déploiement (backend + exe + VST3) |
| `backend/HISE_VST3_REFERENCE.md` | Host VST3, chemins, usage |
| `backend/vst_config.py` | Config VST (vst_config peut être surchargé par VST_BASE sur le serveur) |

---

## 8. Checklist post-migration

- [ ] Health prod : `https://api.siberiamix.com/health`
- [ ] Health staging : `https://api-staging.siberiamix.com/health`
- [ ] Status VST staging : `https://api-staging.siberiamix.com/api/debug/vst-status`
- [ ] Test mix complet (upload vocal + preset + Mix) sur staging puis prod
- [ ] Vérifier Stripe (paiements, webhooks)
- [ ] Vérifier S3 (uploads, téléchargements)
- [ ] Comparer temps de mix (attendu : ~25–40 s au lieu de ~1 min)

---

## 9. Commandes utiles (PowerShell sur le VPS)

```powershell
# Services
Get-Service -Name "SaasMixBackend","SaasMixBackendStaging","SaasMixCaddy"
Restart-Service SaasMixBackend
Restart-Service SaasMixBackendStaging

# Health
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing

# Mise à jour staging (git)
cd C:\app\repo-staging
git pull origin staging
# Puis copier backend vers backend-staging (voir BACKEND_URLS_REFERENCE.md)
Restart-Service SaasMixBackendStaging
```

---

## 10. Règles du projet

- Ne jamais mélanger prod et staging (bases, clés Stripe, URLs).
- Commits/push : branche `staging` uniquement (sauf merge explicite vers master pour prod).
- Audio : WAV 44.1/48 kHz, pas de MP3 pour le traitement principal.
