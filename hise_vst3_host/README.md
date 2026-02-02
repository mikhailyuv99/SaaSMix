# HISE VST3 Host

Console app qui charge un VST3 (ex. ton plugin HISE Project1) et traite un fichier WAV. Utilisé par le backend SaaS Mix pour un **rendu identique** à FL Studio (sans artéfacts Pedalboard).

## Usage

```text
hise_vst3_host.exe <plugin.vst3> <input.wav> <output.wav> [block_size]
```

- **block_size** : optionnel, défaut 1024.

## Build (Windows)

Prérequis : **CMake 3.22+** (installer via `winget install Kitware.CMake` puis **redémarrer PowerShell** pour que `cmake` soit dans le PATH), **Visual Studio 2022** (ou outil C++ avec support C++17). Si `cmake` n’est pas reconnu après installation, ajouter à la main au PATH : `C:\Program Files\CMake\bin`.

```powershell
cd c:\Users\mikha\Desktop\SaaS Mix\hise_vst3_host
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

L’exe se trouve dans `build\Release\hise_vst3_host.exe`.

La première config télécharge JUCE (Git) ; les builds suivants sont plus rapides.

## Intégration backend (Python)

Le script `backend/vst_preset_chain.py` utilise automatiquement le host si l’exe est trouvé :

1. **Automatique** : exe dans `SaaS Mix/hise_vst3_host/build/Release/hise_vst3_host.exe`
2. **Variable d’environnement** : `HISE_VST3_HOST_EXE=C:\chemin\hise_vst3_host.exe`

Si l’exe est absent, le backend repasse sur Pedalboard (risque d’artéfacts avec HISE).

## SaaS / déploiement

- **Même machine** : déploie l’exe à côté du backend (même serveur ou même container).
- **Windows** : compiler en Release x64 et copier `hise_vst3_host.exe` + le `.vst3` sur le serveur.
- **Variable** : sur le serveur, définir `HISE_VST3_HOST_EXE` vers le chemin de l’exe (ou placer l’exe au chemin par défaut relatif au repo).
- **Linux/macOS** : recompiler le host pour la cible (JUCE est multi‑plateforme) et adapter le chemin dans le backend si besoin.

L’exe est **sans GUI** et **stateless** (input WAV → output WAV), adapté à un usage par requête (un process par rendu).
