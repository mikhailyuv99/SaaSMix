# HISE VST3 – Référence complète (pour tes prochains plugins)

Résumé de tout ce qu’on a mis en place pour utiliser des VST3 exportés depuis HISE dans le backend SaaS Mix, avec **rendu identique** à FL Studio.

---

## 1. Export HISE → VST3

- Dans HISE : **File → Export → Export as VST3** (ou Compile → Export).
- **Si la compilation échoue (erreur `ipp.h`)** : dans HISE **Development Settings**, désactiver **"Use IPP"** puis réexporter.
- **Pour utiliser le plugin en effet (audio externe)** : la chaîne FX (Dynamics, EQ, Saturator, Delay, Reverb, etc.) doit être sur la **chaîne FX racine** du projet (directement sous le projet), **pas** à l’intérieur d’un Sampler. Sinon l’audio entrant ne passe pas par les effets.
- Le `.vst3` se trouve en général dans :  
  `ProjectX\Binaries\Compiled\VST3\ProjectX.vst3` (ou dans le dossier Builds selon la config).

---

## 2. Host C++ (rendu identique à FL Studio)

**Pourquoi** : Pedalboard (Python) donne des artéfacts avec les VST3 HISE. Un petit exe C++ qui charge le VST3 et traite un WAV donne **exactement** le même rendu que FL Studio.

**Où** : `hise_vst3_host/` à la racine du repo (CMake + JUCE).

**Build (une fois, ou après modif du host)** :

- Prérequis : **CMake** (ex. `winget install Kitware.CMake`), **Visual Studio 2022** (Build Tools OK). Pas besoin de Git : JUCE est téléchargé en ZIP.
- Commandes :
  ```powershell
  cd "c:\Users\mikha\Desktop\SaaS Mix\hise_vst3_host"
  cmake -B build -G "Visual Studio 17 2022" -A x64
  cmake --build build --config Release
  ```
- Exe produit :  
  `hise_vst3_host\build\hise_vst3_host_artefacts\Release\hise_vst3_host.exe`

**Usage en ligne de commande** :

```text
hise_vst3_host.exe <plugin.vst3> <input.wav> <output.wav> [block_size]
```

- `block_size` optionnel, défaut 1024.

---

## 3. Config backend (Python)

- **Chemins VST** : dans `backend/vst_config.py`, ajouter ou modifier une entrée, par ex. :
  ```python
  "hise_vocal_chain": r"C:\Users\mikha\Desktop\HISE\Project1\Binaries\Compiled\VST3\Project1.vst3",
  ```
  Pour un **nouveau** plugin HISE, tu peux ajouter une clé (ex. `"hise_reverb"`) et le chemin vers son `.vst3`.

- **Détection du host** : `vst_preset_chain.py` cherche l’exe dans l’ordre :
  1. Variable d’environnement **`HISE_VST3_HOST_EXE`** (chemin complet vers `hise_vst3_host.exe`),
  2. Sinon : `repo/hise_vst3_host/build/Release/hise_vst3_host.exe` ou `.../build/hise_vst3_host_artefacts/Release/hise_vst3_host.exe`.

- Si l’exe est trouvé **et** qu’un plugin HISE est configuré (ex. `hise_vocal_chain`), le backend appelle le host au lieu de Pedalboard pour ce plugin → rendu identique.

---

## 4. Pour plusieurs VST3 HISE

- **Même host** : un seul exe `hise_vst3_host.exe` peut charger **n’importe quel** VST3 (chaque appel : `plugin.vst3` + `input.wav` + `output.wav`).
- **Plusieurs chaînes** : dans `vst_config.py`, ajoute une entrée par plugin (ex. `hise_vocal_chain`, `hise_reverb`, …). Dans `vst_preset_chain.py`, pour utiliser le host sur une autre chaîne que `hise_vocal_chain`, il faudra appeler `_process_via_hise_host(chemin_plugin, audio, sr)` avec le bon chemin (ex. `VST_PATHS["hise_reverb"]`).
- **SaaS** : déployer **un seul** exe `hise_vst3_host.exe` + tous les `.vst3` nécessaires ; définir `HISE_VST3_HOST_EXE` sur le serveur si l’exe n’est pas au chemin relatif attendu.

---

## 5. Fichiers clés

| Fichier | Rôle |
|--------|------|
| `hise_vst3_host/CMakeLists.txt` | Projet CMake, télécharge JUCE (ZIP), définit l’exe console. |
| `hise_vst3_host/main.cpp` | Charge le VST3, lit/écrit WAV, appelle le plugin (blocs 48 kHz). |
| `backend/vst_config.py` | Chemins des VST (dont HISE). |
| `backend/vst_preset_chain.py` | `_hise_host_exe()`, `_process_via_hise_host()` ; pour `hise_vocal_chain`, utilise le host si l’exe est trouvé. |
| `backend/EQ_VST3_MAPPING.md` | Mapping EQ1–EQ9 → ancien Tone (Basses/Mids/Aigus) pour les futurs VST3 en début de chaîne. |
| `backend/HISE_NEXT_STEPS.md` | Résumé “Option A / Option B”. |
| `hise_vst3_host/README.md` | Build et déploiement du host. |

---

## 6. Rappel rapide “nouveau VST3 HISE”

1. **HISE** : FX en chaîne racine, export VST3, désactiver IPP si erreur de build.
2. **Backend** : ajouter le chemin du `.vst3` dans `vst_config.py` (nouvelle clé si besoin).
3. **Host** : déjà compilé une fois ; réutiliser le même exe pour tous les VST3.
4. **Chaîne** : soit utiliser la clé existante `hise_vocal_chain`, soit brancher `_process_via_hise_host(VST_PATHS["ta_cle"], audio, sr)` dans `process_chain()` pour une autre chaîne.

Souviens-toi de ce doc pour tes prochains VST3 HISE.
