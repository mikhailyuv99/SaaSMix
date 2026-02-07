# Configuration Cloudflare R2 pour la chaîne HISE (Linux)

En production sur Render (Linux), le backend ne peut pas utiliser les binaires Windows. Les binaires Linux (hise_vst3_host + VST3) sont stockés sur **Cloudflare R2** et téléchargés au démarrage du service.

## 1. Créer un bucket R2

1. Va sur [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage**.
2. **Create bucket** : nomme-le par ex. `saas-mix-vst` (sans espaces).
3. Note ton **Account ID** (visible dans l’URL ou dans R2 Overview, à droite).

## 2. Créer des identifiants API R2

1. Dans R2 → **Manage R2 API Tokens**.
2. **Create API token** :
   - Nom : `saas-mix-render`
   - Permissions : **Object Read & Write** (ou au minimum Read pour le backend).
   - Spécifie le bucket si tu veux limiter l’accès à un seul bucket.
3. Récupère **Access Key ID** et **Secret Access Key** (le secret ne s’affiche qu’une fois).

## 3. Préparer les binaires Linux

Tu dois avoir :

- **hise_vst3_host** : binaire Linux compilé (sans `.exe`).
- **VST3** : un zip par plugin, qui une fois décompressé donne un dossier `.vst3/` (structure Linux habituelle).

Noms attendus dans le bucket (sous le préfixe `vst_linux/` par défaut) :

| Objet R2 | Description |
|----------|-------------|
| `vst_linux/hise_vst3_host` | Exécutable host (chmod 755 après téléchargement) |
| `vst_linux/Project1.vst3.zip` | Zip du dossier Project1.vst3 (chaîne vocale) |
| `vst_linux/master.vst3.zip` | Zip du dossier master.vst3 |
| `vst_linux/reverb1.vst3.zip` | Zip reverb1.vst3 |
| `vst_linux/reverb2.vst3.zip` | Zip reverb2.vst3 |
| `vst_linux/reverb3new.vst3.zip` | Zip reverb3new.vst3 |
| `vst_linux/doubler.vst3.zip` | Zip doubler.vst3 |
| `vst_linux/robot.vst3.zip` | Zip robot.vst3 |

Pour chaque plugin HISE exporté en Linux, crée un dossier `NomPlugin.vst3/` avec le `.so` dedans, zippe-le en `NomPlugin.vst3.zip`, puis uploade dans R2 sous `vst_linux/NomPlugin.vst3.zip`.

## 4. Upload des fichiers vers R2

- **Depuis le dashboard** : R2 → ton bucket → **Upload** (glisser-déposer).
- **En ligne de commande** (avec AWS CLI configuré pour R2) :

```bash
# Configurer l’endpoint R2 (une fois)
export AWS_ACCESS_KEY_ID="ton_r2_access_key"
export AWS_SECRET_ACCESS_KEY="ton_r2_secret_key"
export AWS_ENDPOINT_URL="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"

# Upload (remplace <BUCKET> et <ACCOUNT_ID>)
aws s3 cp hise_vst3_host s3://<BUCKET>/vst_linux/hise_vst3_host --endpoint-url $AWS_ENDPOINT_URL
aws s3 cp Project1.vst3.zip s3://<BUCKET>/vst_linux/Project1.vst3.zip --endpoint-url $AWS_ENDPOINT_URL
# ... idem pour les autres .zip
```

Ou avec un script Python (boto3) : voir la doc Cloudflare R2 + boto3.

## 5. Variables d’environnement sur Render

Dans le service **SIBERIA MIX SAAS** sur Render, ajoute :

| Variable | Valeur |
|----------|--------|
| `R2_ACCOUNT_ID` | Ton Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Access Key ID du token R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key du token R2 |
| `R2_BUCKET_NAME` | Nom du bucket (ex. `saas-mix-vst`) |

Optionnel :

- `R2_VST_PREFIX` : préfixe des objets (défaut : `vst_linux`).
- `VST_LINUX_DIR` : dossier local où extraire (défaut : `/tmp/saas_mix_vst_linux`).

## 6. Comportement au démarrage

Au démarrage du backend sur Render (Linux) :

1. Si `R2_BUCKET_NAME` est défini, `startup_sync_r2()` appelle `ensure_r2_assets()`.
2. Les objets listés dans `r2_assets.py` sont téléchargés dans `VST_LINUX_DIR` (ou `/tmp/saas_mix_vst_linux`).
3. Les `.zip` sont décompressés (ex. `Project1.vst3.zip` → dossier `Project1.vst3/`).
4. Le binaire `hise_vst3_host` reçoit les droits exécutables (chmod 755).
5. Lors du premier mix, `test_hise_direct` utilise ces chemins Linux ; la chaîne est identique à ta chaîne locale (même host, mêmes VST3).

Si R2 n’est pas configuré ou si un fichier manque, le mix en production continuera d’échouer avec « chaîne HISE » ; vérifier les logs Render et la présence des objets dans le bucket.
