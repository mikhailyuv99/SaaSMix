# Roadmap : tes propres algo DSP pour le SaaS

Tu pars sur **créer tes propres algorithmes DSP** pour avoir le son que tu veux, sans dépendre à des VST commerciaux. Tout le code reste à toi → légal pour ton SaaS.

---

## First steps (checklist)

| # | Étape | Détail |
|---|--------|--------|
| 1 | **Installer HISE** | hise.dev → Download Installer (v4.1.0) ou build depuis GitHub. Windows / macOS / Linux. |
| 2 | **Premier projet** | Créer un projet HISE, ajouter un premier effet (gain, ou EQ simple) pour valider le flow. |
| 3 | **Exporter en VST3** | Build → export VST3. Récupérer le `.vst3` (dossier ou bundle selon l’OS). |
| 4 | **Brancher le backend** | Dans `vst_config.py`, ajouter un chemin vers **ton** `.vst3` (ex. `"ma_chain_vocal": "C:\...\MonPlugin.vst3"`). |
| 5 | **Tester la chaîne** | Lancer `vst_preset_chain.py` avec un WAV : il charge ton plugin au lieu de Waves/FabFilter. |
| 6 | **Enrichir la chaîne** | Ajouter EQ → compresseur → limiter → saturation / de-esser / reverb dans HISE, rebuilder, re-tester. |

Une fois l’étape 5 OK, tu as le pipeline complet : HISE/JUCE → VST3 → Python → SaaS.

---

## Deux façons de les faire tourner

| Option | Outil | Avantages | Inconvénients |
|--------|--------|-----------|----------------|
| **A** | **JUCE (C++)** → VST3 | Performance, pro, même logique qu’un vrai plugin | Courbe d’apprentissage C++/JUCE, build, debug |
| **B** | **Python** (NumPy/SciPy + Pedalboard natif) | Rapide à prototyper, tout dans le même repo, pas de compilo | Moins rapide que du C++, mais souvent suffisant pour du rendu offline |

Tu peux commencer en **B** pour définir le son (EQ, comp, saturation, etc.), puis porter les algo qui comptent en **A** si tu veux du temps réel ou du déploiement plus léger.

---

## Par quoi commencer (ordre logique)

1. **Gain / trim** – niveau d’entrée/sortie (trivial).
2. **EQ** – filtres biquad (high-pass, low-pass, peaking). C’est la base du “couleur” et du de-esser.
3. **Compresseur** – seuil, ratio, attack/release. Le cœur du “niveau” et du punch.
4. **Limiter** – brickwall en fin de chaîne pour éviter les clips.
5. **Saturation / couleur** – soft clipping, waveshaping (tu définis la courbe qui te plaît).
6. **De-esser** – EQ dynamique ou compresseur sidechain sur les aigus (ex. 4–8 kHz).
7. **Reverb / delay** – si tu en veux dans la chaîne (convo ou algo simple).

Tu peux t’arrêter à 1–4 pour une première version “propre et serrée”, puis ajouter 5–7 pour coller à ton preset FL.

---

## Ton choix : JUCE + HISE

Tu fais **tes propres plugins** avec le son exact que tu veux en **JUCE** et **HISE**.

- **JUCE** : framework C++ pour construire des VST3/AU. Tu écris le DSP (processBlock, filtres, compresseur, etc.) en C++.
- **HISE** : construit sur JUCE ; éditeur visuel, modules (synths, effets), scripting. Tu peux prototyper des chaînes (EQ, comp, reverb, etc.) plus vite qu’en pur C++, puis exporter en VST3. Idéal pour définir le son et la structure du plugin avant d’affiner en JUCE si besoin.
- **Export** : HISE et JUCE produisent tous les deux des `.vst3`. Ton backend Python (Pedalboard) charge **tes** `.vst3` comme aujourd’hui — même `vst_config.py` / `vst_preset_chain.py`, en pointant vers tes builds. Pas de licence tierce.

**Liens**
- JUCE : https://juce.com  
- HISE : https://hise.dev (installer v4.1.0 ou build depuis GitHub)  

---

## Option A : JUCE seul (C++) → VST3

- **Site** : https://juce.com  
- **Install** : Projucer ou CMake, SDK JUCE, build en VST3.
- **Workflow** : tu codes tes algo en C++ dans le plugin (processBlock), tu build, tu obtiens un `.vst3`. Dans ton backend Python tu gardes un host (ex. Pedalboard) qui charge **ton** `.vst3`.
- **Où ça s’intègre** : même schéma que `vst_config.py` / `vst_preset_chain.py`, chemins vers **tes** plugins (ex. `MaComp.vst3`, `MonEQ.vst3`).

Si tu ne connais pas encore JUCE : commencer par le “Getting Started” et un plugin “gain only”, puis biquad (EQ), puis compresseur.

---

## Option B : Python (tout dans le backend)

- **Libs** : NumPy, SciPy (filtres, convolution), éventuellement **Pedalboard** pour les briques natives (Limiter, Reverb, etc.) si tu veux aller vite sur certains étages.
- **Structure** : un module du type `dsp_chain.py` qui enchaîne tes fonctions :  
  `audio → ton_eq(audio) → ton_comp(audio) → ton_limiter(audio) → out`.
- **Avantage** : tu peux itérer très vite sur courbes, time constants, etc. Tu “dessines” le son que tu veux, puis tu peux le recoder en C++ plus tard si besoin.

On peut ajouter dans le repo un squelette `dsp_chain.py` (gain + EQ simple + comp basique + limiter) que tu remplis avec **tes** formules au fur et à mesure.

---

## Intégration dans ton SaaS

- **Rendu vocal** : tes plugins **JUCE / HISE** exportés en `.vst3` sont chargés via Pedalboard comme aujourd’hui. Tu remplaces les chemins Waves/FabFilter dans `vst_config.py` par les chemins vers **tes** builds (ex. `MaChaîneVocal.vst3` ou plusieurs plugins séparés). Même `vst_preset_chain.py`, tu pointes juste vers tes VST3.
- **Config** : prévoir un config (ou presets) pour les chemins de tes plugins et les paramètres par preset “vocal mix” (gain, freq EQ, threshold, etc.).

En résumé : tu designs le son dans HISE/JUCE → tu exportes en VST3 → le backend Python charge tes plugins et applique tes presets. Tout le DSP est à toi, légal pour le SaaS.
