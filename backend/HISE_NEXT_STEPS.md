# HISE : prochaines étapes (rendu identique au plugin)

Ton VST3 **Project1** fonctionne correctement dans FL Studio, mais avec **Pedalboard** (Python) tu obtiens des artéfacts. Pour avoir **exactement** le même rendu que HISE dans le backend, le projet utilise maintenant **Option A** : un host VST3 en C++ appelé par Python.

---

## Option A — En place : host VST3 (hise_vst3_host)

Un host console est fourni dans **`hise_vst3_host/`** (CMake + JUCE). Le backend Python l’utilise automatiquement s’il trouve l’exe.

**Tu fais quoi :**

1. **Compiler le host** (depuis la racine du repo) :
   ```powershell
   cd hise_vst3_host
   cmake -B build -G "Visual Studio 17 2022" -A x64
   cmake --build build --config Release
   ```
   → Exe : `hise_vst3_host/build/Release/hise_vst3_host.exe`

2. **Rien à changer dans le code Python** : si l’exe est au chemin ci‑dessus (ou défini par `HISE_VST3_HOST_EXE`), `vst_preset_chain.py` l’appelle pour `hise_vocal_chain` et lit le WAV de sortie. Sinon, fallback sur Pedalboard.

3. **Pour le SaaS** : déployer l’exe avec le backend (même machine/container), et définir `HISE_VST3_HOST_EXE` si besoin. Voir `hise_vst3_host/README.md`.

---

### Option B — Chaîne Python uniquement (pas bit-à-bit identique)

Si tu acceptes un rendu “proche” mais pas strictement identique au plugin HISE :

- Utiliser **uniquement** `audio_processor.py` (Dynamics, EQ, saturation, delay, reverb en Python) et caler les paramètres sur ton preset HISE (valeurs lues dans HISE ou exportées).
- Ne plus utiliser le VST3 HISE dans le backend.

C’est plus simple à maintenir, mais ce n’est pas le “même” rendu que le plugin.

---

## Résumé

| Objectif              | Action |
|-----------------------|--------|
| Rendu **identique** HISE/FL Studio dans le backend | Option A : **hise_vst3_host** (déjà en place) — compiler l’exe, le backend l’utilise automatiquement. |
| Rendu **proche**, sans C++ | Option B : tout en Python avec `audio_processor` et paramètres calés sur le preset. |

**SaaS** : oui, Option A fonctionne pour le SaaS : déploie l’exe + le VST3 avec le backend (même serveur/container), et configure `HISE_VST3_HOST_EXE` si besoin.
