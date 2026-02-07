# Étape 1 : Compiler le host + exporter les VST3 pour Linux

Pour que la prod (Render) utilise la même chaîne HISE que en local, il faut des **binaires Linux** :  
1) l’exécutable **hise_vst3_host**, 2) les **VST3** (Project1, master, reverb1/2/3, doubler, robot).

Il n’y a **pas de cross-compilation** : il faut compiler **sur une machine (ou VM) Linux**. La solution la plus simple depuis Windows est **WSL2** (Ubuntu).

---

## A. Préparer un environnement Linux (WSL2)

1. **Activer WSL2** (si pas déjà fait) :
   ```powershell
   wsl --install -d Ubuntu
   ```
   Redémarre si demandé, puis ouvre **Ubuntu** depuis le menu Démarrer.

2. **Mettre à jour et installer les outils de build** :
   ```bash
   sudo apt update && sudo apt install -y build-essential cmake ninja-build libasound2-dev libfreetype6-dev libx11-dev libxrandr-dev libxcursor-dev libxinerama-dev libgl1-mesa-dev
   ```
   (Ces paquets couvrent JUCE / ALSA / X11 pour le host et souvent pour HISE.)

3. **Accéder au projet** : le disque Windows est monté sous `/mnt/c/` :
   ```bash
   cd /mnt/c/Users/mikha/Desktop/SaaS\ Mix/hise_vst3_host
   ```

---

## B. Compiler hise_vst3_host pour Linux

Dans WSL2, depuis le dossier du host :

```bash
cd /mnt/c/Users/mikha/Desktop/SaaS\ Mix/hise_vst3_host
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

- Le binaire sera dans **`build/hise_vst3_host`** (sans `.exe`).
- Test rapide (si tu as un `.vst3` Linux et un WAV) :
  ```bash
  ./build/hise_vst3_host /chemin/vers/Project1.vst3 input.wav output.wav 1024
  ```

Pour R2, tu uploaderas ce fichier **`hise_vst3_host`** (pas le .exe Windows) sous le nom `vst_linux/hise_vst3_host` (voir R2_SETUP.md).

---

## C. Exporter les VST3 HISE pour Linux

Les plugins (Project1, master, reverb1, reverb2, reverb3new, doubler, robot) doivent être **compilés sous Linux**. Deux approches :

### Option C1 – HISE installé sur Linux (dans WSL2 ou une VM)

1. **Installer HISE sur Linux**  
   - Télécharge la version Linux depuis [HISE](https://github.com/ChristophHart/HISE/releases) (ou build depuis les sources si tu as l’habitude).  
   - Installe les dépendances (VST3 SDK, etc. ; la doc / le forum HISE décrivent les prérequis Linux).

2. **Ouvrir chaque projet** (Project1, master, reverb1, reverb2, reverb3new, doubler, robot) dans HISE sous Linux.

3. **Activer VST3**  
   - Dans HISE : **Settings** (ou **Preferences**) → **Compiler** → cocher **Enable VST3** (et indiquer le chemin du VST3 SDK si demandé).

4. **Exporter en VST3**  
   - **File** → **Export** → **Export as VST3** (ou équivalent selon ta version).  
   - Choisir un dossier de build (ex. `Builds/Linux`).  
   - Une fois la compilation terminée, le plugin Linux est en général dans :
     - un dossier du type `Builds/.../VST3/Release/` ou  
     - `~/.vst3/` (dossier caché dans ton home).

5. **Récupérer le dossier `.vst3`**  
   - Sous Linux, un VST3 est un **dossier** (ex. `Project1.vst3/` avec `Contents/x86_64-linux/Project1.so` dedans).  
   - Pour R2 : zipper ce dossier :
     ```bash
     zip -r Project1.vst3.zip Project1.vst3/
     ```
   - Puis uploader `Project1.vst3.zip` (et les autres) vers R2 comme dans R2_SETUP.md.

### Option C2 – Projet déjà exporté depuis Windows (Builds + script Linux)

Si tu as déjà exporté tes projets depuis HISE sous Windows, tu as souvent un dossier **Builds** avec des scripts de compilation.

1. **Copier tout le projet HISE** (par ex. Project1, master, etc.) dans WSL2 (ou sur une machine Linux).  
   - Par exemple :
     ```bash
     cp -r /mnt/c/Users/mikha/Desktop/HISE/Project1 ~/Project1
     ```

2. **Vérifier la présence d’un script Linux**  
   - Cherche dans le projet un script du type **`batchCompileLinux.sh`** ou **`Builds/Linux/...`** (souvent dans `Binaries/` ou à la racine du projet exporté).  
   - La doc HISE et le forum parlent de `batchCompileLinux.sh` avec VST3 activé dans les réglages du projet.

3. **Installer le VST3 SDK sur Linux**  
   - Télécharge le [VST3 SDK](https://github.com/steinbergmedia/vst3sdk) et indique son chemin dans les réglages HISE / dans le script (selon ce que le script attend).

4. **Lancer la compilation**  
   - Exemple (à adapter au chemin réel du script) :
     ```bash
     cd ~/Project1
     ./batchCompileLinux.sh
     ```
   - Les VST3 compilés se retrouvent souvent dans `~/.vst3/` ou dans un sous-dossier du projet.

5. **Créer les zip pour R2**  
   - Pour chaque plugin :
     ```bash
     cd ~/.vst3   # ou le dossier où se trouve le .vst3
     zip -r Project1.vst3.zip Project1.vst3/
     zip -r master.vst3.zip master.vst3/
     # idem reverb1, reverb2, reverb3new, doubler, robot
     ```

---

## D. Récap pour R2

Une fois que tu as :

- **`hise_vst3_host`** (binaire Linux, sans .exe),
- **`Project1.vst3.zip`**, **`master.vst3.zip`**, **`reverb1.vst3.zip`**, **`reverb2.vst3.zip`**, **`reverb3new.vst3.zip`**, **`doubler.vst3.zip`**, **`robot.vst3.zip`** (chaque zip = un dossier `Nom.vst3/` avec le .so dedans),

tu les envoies dans le bucket R2 comme décrit dans **R2_SETUP.md** (préfixe `vst_linux/`). Le backend sur Render les téléchargera au démarrage et utilisera la même chaîne qu’en local.

---

## En cas de blocage

- **hise_vst3_host** : erreurs de libs manquantes → installer les paquets listés en A.2 (ALSA, X11, Mesa, etc.).
- **HISE sous Linux** : le forum [HISE (Linux build / Exporting for Linux)](https://forum.hise.audio) et la doc officielle donnent les prérequis exacts (VST3 SDK, GCC version, etc.).
- **Pas de script batchCompileLinux** : dans ce cas il faut soit installer HISE sur Linux et exporter depuis l’interface (C1), soit récupérer un export HISE qui contient déjà les fichiers de build Linux (certaines versions génèrent un dossier Builds avec CMake pour Linux).

Si tu me dis sur quoi tu bloques (WSL2, host, ou un projet HISE en particulier), je peux détailler juste cette partie (commandes exactes, chemins, etc.).
