# Option 3 : Pré-entraîné + fine-tune (légal SaaS) + idée plugins JUCE

## À éviter pour un SaaS commercial

- **Diff-MST** (Differentiable Mixing Style Transfer)  
  Licence **CC BY-NC-SA 4.0** = **non commercial**. Tu ne peux pas l’utiliser tel quel dans un produit SaaS payant.  
  https://github.com/sai-soum/Diff-MST

---

## Modèles pré-entraînés utilisables en commercial

### 1. SonicMaster (recommandé pour “qualité preset”)

- **Rôle** : restoration + mastering en un seul modèle (reverb, disto, EQ, dynamique, stéréo, etc.).
- **Licence** : **Apache 2.0** → OK pour un SaaS commercial (y compris fine-tune et dérivés).
- **Code** : https://github.com/AMAAI-Lab/SonicMaster  
- **Article** : https://huggingface.co/papers/2508.03448  
- **Données** : ~166k paires dégradé / propre (Jamendo). Tu peux fine-tuner sur tes **222 paires raw → mixed** pour coller à ton son.
- **Contrôle** : mode texte (instructions) + mode automatique. Après fine-tune, tu peux exposer des presets ou des prompts fixes dans ton SaaS.

**Résumé** : Modèle “all-in-one” proche d’un preset mastering, open source, commercialisable. C’est la piste la plus propre pour l’option 3.

---

### 2. Hybrid Neural Audio Effects (effets par étage)

- **Rôle** : modèles **hybrides** (DSP + réseau) pour des effets type strip (compression, saturation, etc.), avec **poids pré-entraînés** (ex. Universal Audio 6176, TubeTech CL 1B).
- **Licence** : **LGPL-3.0** → utilisation commerciale possible, sous respect de la LGPL (ex. livraison du code modifié de la biblio, linking dynamique souvent suffisant).
- **Code** : https://github.com/RiccardoVib/Hybrid-Neural-Audio-Effects  
- **Contenu** : code + poids dans un dossier `weights`, exemples audio sur le site du projet.

**Résumé** : Utile si tu veux une chaîne “effet par effet” (compresseur, saturation, etc.) avec du neural déjà entraîné, puis fine-tune ou paramétrage pour ton preset. Plus de boulot d’intégration que SonicMaster, mais plus modulaire.

---

### 3. NablAFx (framework, pas un preset clé en main)

- **Rôle** : **framework PyTorch** pour modéliser des effets (black-box ou gray-box, avec blocs DSP différentiables). Pas de “preset vocal” pré-entraîné fourni.
- **Licence** : **MIT** → sans problème pour un SaaS.
- **Code** : https://github.com/mcomunita/nablafx  

**Résumé** : Tu t’en sers pour **entraîner toi-même** des effets ou une mini-chaîne sur tes 222 paires (raw → mixed). Idéal si tu veux tout contrôler (archi, perte, données) mais ça demande de l’entraînement et du temps.

---

## Autres (séparation / enhancement, pas “preset mix” direct)

- **Open-Unmix** : MIT, séparation de sources (vocals, drums, etc.), pas un modèle “raw → mixed vocal”.
- **Demucs** : séparation aussi ; vérifier la licence si tu veux l’intégrer.
- **SonicMaster** reste la piste la plus alignée “un seul modèle → qualité preset” + licence OK.

---

## Tes propres plugins (JUCE / C++)

Tu avais pensé à **créer tes propres plugins** (JUCE ou C++) et les intégrer au DSP.

- **Légal** : si tout le code et les algorithmes sont à toi (ou sous licence commerciale), tu peux les utiliser dans ton SaaS (en les chargeant via un host VST, ou en exportant du binaire et en l’appelant depuis Python).
- **Technique** :
  - **JUCE** : framework C++ pour créer des VST2/VST3/AU. Tu implémentes ta chaîne (EQ, compresseur, reverb, etc.) en C++, tu build un `.vst3`, et tu peux le charger avec **Pedalboard** (ou un autre host) depuis Python. Tu restes maître de la licence.
  - **Intégration** : même schéma qu’avant (chemin vers le `.vst3` dans ta config), mais au lieu de Waves/FabFilter, ce sont tes plugins. Pas de dépendance à des licences tierces pour l’usage commercial.

**Résumé** : Très propre juridiquement et qualitativement si tu maîtrises le DSP en C++. En contrepartie : temps de dev (JUCE, tests, déploiement) plus important qu’un modèle pré-entraîné + fine-tune.

---

## Synthèse pour un “preset de qualité” légal SaaS

| Option              | Type              | Licence   | Effort | Qualité potentielle      |
|---------------------|-------------------|-----------|--------|---------------------------|
| **SonicMaster**     | Pré-entraîné + FT | Apache 2  | Moyen  | Élevée (restauration+mastering) |
| **Hybrid Neural**   | Effets par étage  | LGPL-3    | Élevé  | Élevée (effets pro)       |
| **NablAFx**         | Framework         | MIT       | Élevé  | À définir (toi tu entraînes) |
| **Plugins JUCE**    | DSP à toi         | Toi       | Élevé  | Très élevée si bon DSP    |

Pour l’**option 3** (pré-entraîné + fine-tune) avec un bon compromis qualité / temps : **SonicMaster** (Apache 2.0, modèle unique, fine-tune sur tes 222 paires) est la piste la plus intéressante à explorer en premier.
