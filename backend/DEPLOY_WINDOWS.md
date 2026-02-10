# Héberger le backend sur Windows (Option B)

Même chaîne qu’en local : **aucun Linux**, **pas de R2**. Tu déploies le backend + `hise_vst3_host.exe` + tes VST3 Windows sur un serveur Windows.

---

## 1. Choisir l’hébergeur Windows

- **VPS Windows** : OVH, Contabo, Scaleway, etc. (Windows Server, tu as un bureau à distance).
- **Azure App Service** : crée une app **Windows** (pas Linux), déploiement par Git/FTP/zip.
- **Autre** : tout hébergeur qui te donne une machine ou une app **Windows** avec Python possible.

---

## 2. Sur le serveur Windows : à installer / copier

1. **Python 3.11** (même version qu’en local, ex. 3.11.7)  
   - [python.org](https://www.python.org/downloads/) ou `winget install Python.Python.3.11`  
   - Coche “Add to PATH”.

2. **Le backend** (tout le dossier `backend/` du repo)  
   - Git clone, ou copie des fichiers (sans `node_modules` / sans le frontend).

3. **hise_vst3_host.exe**  
   - Copie depuis :  
     `SaaS Mix\hise_vst3_host\build\hise_vst3_host_artefacts\Release\hise_vst3_host.exe`  
   - Par ex. dans : `C:\app\backend\hise_vst3_host.exe` (ou un dossier dédié).

4. **Les VST3 HISE** (Project1, master, reverb1, reverb2, reverb3new, doubler, robot)  
   - Soit tu **copies les dossiers .vst3** au même endroit qu’en local (ex. `C:\HISE\Project1\Binaries\...`),  
   - Soit tu les mets ailleurs et tu adapte **un seul fichier de config** (voir ci‑dessous).

5. **PostgreSQL**  
   - Soit une base sur le même serveur (install Postgres Windows),  
   - Soit une base gérée (ex. Render PostgreSQL, Neon, Supabase) : tu n’installes que le client sur le serveur et tu mets l’URL dans `DATABASE_URL`.

---

## 3. Configurer les chemins (backend Windows)

Le backend lit les chemins dans `vst_config.py` ou via l’exe par défaut. Sur le serveur, deux possibilités :

**A) Même structure qu’en local**  
Si tu mets les VST3 au même chemin qu’en local (ex. `C:\Users\...\HISE\...`), tu peux garder ton `vst_config.py` actuel.  
Si l’utilisateur Windows du serveur est différent (ex. `Administrator`), crée un `vst_config.py` **spécifique au serveur** (ou un `.env` / variables d’env) avec les vrais chemins.

**B) Dossier unique sur le serveur**  
Exemple :  
- Exe : `C:\app\hise_vst3_host.exe`  
- VST3 : `C:\app\vst3\Project1.vst3`, `C:\app\vst3\master.vst3`, etc.

Alors sur le serveur, dans `vst_config.py` (ou un override), mets par ex. :

```python
import os
BASE = os.environ.get("VST_BASE", r"C:\app")
HOST_EXE = os.path.join(BASE, "hise_vst3_host.exe")
VST_PATHS = {
    "hise_vocal_chain": os.path.join(BASE, "vst3", "Project1.vst3"),
    "master": os.path.join(BASE, "vst3", "master.vst3"),
    "reverb1": os.path.join(BASE, "vst3", "reverb1.vst3"),
    # ... idem reverb2, reverb3new, doubler, robot
}
```

Et dans `test_hise_direct.py`, le début du fichier utilise déjà `HOST_EXE` et les chemins ; si tu définis `HOST_EXE` via variable d’environnement, tu peux ajouter en haut de `test_hise_direct.py` :

```python
import os
if os.environ.get("HISE_VST3_HOST_EXE"):
    HOST_EXE = Path(os.environ["HISE_VST3_HOST_EXE"])
```

Comme ça, sur le serveur tu définis `HISE_VST3_HOST_EXE=C:\app\hise_vst3_host.exe` et un `vst_config` qui pointe vers `C:\app\vst3\...`.

**C) Structure HISE (sous-dossiers)**  
Si `VST_BASE` pointe vers un dossier qui contient des **sous-dossiers par plugin** (comme après un export HISE), le code essaie automatiquement ce layout quand le chemin plat n'existe pas :  
`VST_BASE\Project1\Binaries\Compiled\VST3\Project1.vst3`, idem pour master, reverb1, reverb2, reverb3new, doubler, robot. Tu peux donc avoir soit des `.vst3` plats (ou dans `vst3\`), soit cette structure en sous-dossiers ; le fallback est géré dans `test_hise_direct.py`.

---

## 4. Variables d’environnement (serveur Windows)

À définir sur l’hébergeur (Azure “Application settings”, ou variables système / `.env` sur un VPS) :

- `DATABASE_URL` : URL Postgres (ex. `postgresql://user:pass@host:5432/db`)
- `SECRET_KEY` : même clé que pour les JWT (garde-la secrète)
- Optionnel : `HISE_VST3_HOST_EXE` = chemin complet vers `hise_vst3_host.exe`
- Optionnel : `VST_BASE` si tu utilises le schéma “dossier unique” ci‑dessus

Pas besoin de **R2_*** ni de **VST_LINUX_DIR** : on est sous Windows.

---

## 5. Lancer le backend

En ligne de commande (PowerShell), depuis le dossier du backend :

```powershell
cd C:\app\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Pour la prod, soit tu laisses une fenêtre ouverte (ou un outil comme NSSM / un service Windows), soit tu utilises le mécanisme de l’hébergeur (ex. Azure gère le process une fois que tu pointes vers `main:app`).

---

## 6. CORS et frontend

Dans `main.py`, les origines CORS sont déjà configurées. Ajoute l’URL du frontend en prod si besoin (ex. `https://siberiamix.netlify.app`).  
Sur Netlify, mets `NEXT_PUBLIC_API_URL` vers l’URL de ton backend Windows (ex. `https://ton-backend.azurewebsites.net` ou `http://IP_DU_SERVEUR:8000` si pas de HTTPS devant).

---

## 7. Résumé

- **Pas de Linux**, **pas de R2**, pas de recompilation.
- Tu copies : backend + `hise_vst3_host.exe` + VST3 Windows.
- Tu configures les chemins (et optionnellement `HISE_VST3_HOST_EXE` / `VST_BASE`).
- Tu définis `DATABASE_URL` et `SECRET_KEY`, tu lances avec `uvicorn`.
- Tu pointes le frontend vers cette URL backend.

Tu gardes exactement la même chaîne qu’en local.
