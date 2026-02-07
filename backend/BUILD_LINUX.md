# Étape 1 : Compiler le host + exporter les VST3 pour Linux

Tu as besoin d’un **environnement Linux** (pas de cross-compilation Windows → Linux). Le plus simple sur ta machine : **WSL2 (Ubuntu)**.

---

## A. Préparer Linux (WSL2 Ubuntu)

1. **Activer WSL2** (si pas déjà fait) :
   - PowerShell en admin : `wsl --install`
   - Redémarrer, puis ouvrir **Ubuntu** depuis le menu Démarrer.

2. **Installer les outils de build** :
   ```bash
   sudo apt update
   sudo apt install -y build-essential cmake git
   ```

---

## B. Compiler hise_vst3_host pour Linux

Le host est dans le repo (CMake + JUCE). Il se compile comme n’importe quel projet CMake sous Linux.

1. **Copier le projet dans WSL** (ou cloner le repo dans WSL) :
   ```bash
   # Exemple : le repo est sur Windows, accès via /mnt/c/
   cd /mnt/c/Users/mikha/Desktop/SaaS\ Mix/hise_vst3_host
   ```
   Ou depuis ton home WSL :
   ```bash
   cd ~
   git clone <ton-repo> SaasMix   # si tu préfères cloner
   cd SaasMix/hise_vst3_host
   ```

2. **Configurer et compiler** :
   ```bash
   cmake -B build -DCMAKE_BUILD_TYPE=Release
   cmake --build build
   ```

3. **Récupérer le binaire** :
   - Il se trouve ici : `build/hise_vst3_host` (sans `.exe`).
   - C’est ce fichier que tu mettras dans R2 sous le nom `vst_linux/hise_vst3_host`.

---

## C. Exporter les plugins HISE en VST3 Linux

**Important** : HISE ne permet pas d’exporter un VST3 Linux depuis Windows. Il faut exporter **depuis HISE tournant sous Linux** (ou au minimum lancer la compilation Linux depuis Linux avec les fichiers de projet HISE).

### Option 1 : HISE sous Linux (recommandé si tu peux)

1. **Installer HISE sur Linux** (ou le compiler depuis les sources, voir le forum HISE).
2. **Copier tes projets HISE** (Project1, master, reverb1, reverb2, reverb3new, doubler, robot) sur la machine Linux (ou les ouvrir depuis un partage).
3. Dans HISE, pour **chaque** projet :
   - Ouvre le projet (ex. Project1.hip).
   - **File → Export → Export as VST3** (ou l’équivalent pour Linux).
   - Choisis la cible **Linux** si proposée, ou lance la compilation Linux (souvent un script du type `batchCompileLinux.sh` est généré dans le dossier du projet).
4. Les VST3 compilés se trouvent en général dans :
   - `~/.vst3/` ou
   - Un dossier du type `Builds/Linux/build/VST3/Release/` dans chaque projet.

5. **Pour chaque plugin**, tu dois obtenir un **dossier** (ex. `Project1.vst3/`) contenant la structure Linux (souvent un `.so` dans `Contents/x86_64-linux/` ou similaire). Tu zippes ce dossier :
   ```bash
   cd /chemin/vers/Project1.vst3
   zip -r Project1.vst3.zip .
   # Ou depuis le parent :
   zip -r Project1.vst3.zip Project1.vst3
   ```
   Le zip doit contenir à la racine le dossier du plugin (ex. `Project1.vst3/Contents/...`) pour que, après extraction côté backend, on ait bien `base/Project1.vst3/...`.

### Option 2 : Pas de HISE sous Linux (contournement)

Si tu n’as pas HISE sous Linux :

- Utiliser une **machine virtuelle Linux** ou un **serveur Linux** (ex. un VPS) où tu installes HISE une fois, tu y copies tes projets, et tu fais les exports.
- Ou demander à quelqu’un avec HISE sous Linux de faire l’export et de te donner les `.vst3` (ou les zips).
- En dernier recours : la **production reste sous Windows** (Option B du guide précédent : héberger le backend sur un Windows Server avec les binaires Windows existants), et tu ne passes pas par R2 pour Linux.

---

## D. Résumé des fichiers à uploader sur R2

| Fichier / Zip | Origine |
|---------------|--------|
| `hise_vst3_host` | Build Linux du projet `hise_vst3_host` (section B). |
| `Project1.vst3.zip` | Dossier `Project1.vst3` exporté Linux, zippé (section C). |
| `master.vst3.zip` | Idem pour le projet master. |
| `reverb1.vst3.zip`, `reverb2.vst3.zip`, `reverb3new.vst3.zip` | Idem pour chaque reverb. |
| `doubler.vst3.zip`, `robot.vst3.zip` | Idem pour doubler et robot. |

Structure du zip : à la racine du zip, il doit y avoir le **nom du dossier** du plugin (ex. `Project1.vst3`), puis à l’intérieur `Contents/...` et le `.so`. Exemple après extraction :

```
/tmp/saas_mix_vst_linux/
  hise_vst3_host
  Project1.vst3/
    Contents/
      x86_64-linux/
        Project1.so
  master.vst3/
    ...
```

Comme ça, le backend trouve bien `get_linux_vst_path("Project1")` → `base/Project1.vst3`.

---

## E. Vérifier le host sous Linux

Dans WSL (ou ta machine Linux) :

```bash
cd /mnt/c/Users/mikha/Desktop/SaaS\ Mix/hise_vst3_host/build
./hise_vst3_host --help
# Ou avec un plugin et des WAV de test (si tu as déjà un .vst3 Linux) :
# ./hise_vst3_host /chemin/vers/Project1.vst3 input.wav output.wav 1024
```

Si la commande s’exécute sans erreur, le binaire est bon pour R2.

Une fois les binaires prêts (host + zips VST3), tu peux suivre **R2_SETUP.md** à partir de la section « Upload des fichiers vers R2 ».
