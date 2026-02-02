# Livrer un bon mix au client – options pour le SaaS

**Constat :** Diff-MST donne aujourd’hui un mix pas assez propre (bruit, stereo bizarre, compression/EQ pas stables). Pour le SaaS, il faut un moyen **fiable** de livrer un mix correct au client.

---

## Option A – DSP-first (recommandé pour lancer)

**Idée :** Le mix client = **MixingService** (presets DSP) : EQ, comp, reverb, delay. Pas de Diff-MST en prod.

**Pourquoi :**
- Rendu **prévisible** : pas de bruit de fond, stereo centré, pas de surprises.
- Déjà en place : `mixing_service.py`, `mix_vocal.ps1`, presets (modern_clean, trap_aggressive, smooth_rnb).
- Le client a un **mix cohérent** à chaque fois.

**Limite :** Ce n’est pas du “style transfer” appris sur tes refs, c’est un **style fixe par preset**. Mais c’est un vrai mix propre.

**À faire côté produit :**
- Exposer le mix DSP dans l’API / front : upload vocal → MixingService → WAV.
- Proposer 2–3 presets au choix (ou un seul par défaut).
- Optionnel : BPM auto, reverb/delay réglables (déjà dans `process_mix`).

---

## Option B – Diff-MST + post-process (ML avec filet de sécurité)

**Idée :** Garder Diff-MST comme moteur, mais **toujours** appliquer après :
- Centrage stereo (mono L+R).
- High-pass léger (réduction hiss/rumble).
- Optionnel : débruiteur, limiter doux.

**Pourquoi :** Le client reçoit un mix “style ML” mais **normalisé** (plus de pan gauche/droite, moins de bruit).

**Limite :** Si le ML est vraiment mauvais (compression, EQ), le post-process ne corrige pas tout. À réserver pour une phase “beta” ou quand le modèle est déjà correct.

---

## Option C – Hybride (DSP par défaut + ML en option)

**Idée :**
- **Par défaut :** mix **DSP** (MixingService) → chaque client a un mix correct garanti.
- **Option “Style ML” (beta) :** pour les clients qui veulent tester, on envoie le vocal à Diff-MST (+ ref que tu choisis) puis post-process. Tu peux afficher “Style personnalisé (beta)” dans l’UI.

**Pourquoi :** Tu lances le SaaS avec un mix **fiable** (DSP), et tu fais évoluer le ML à côté. Quand Diff-MST (ou un autre modèle) est bon, tu peux le proposer par défaut ou en option payante.

---

## Recommandation courte

**Pour construire le SaaS tout de suite :**  
→ **Option A (DSP-first)** : le “bon mix” client = MixingService + presets. C’est le chemin le plus court pour livrer un rendu propre et prévisible.

**En parallèle :**
- Améliorer données + entraînement Diff-MST (plus de paires, refs cohérentes, plus d’epochs).
- Quand le rendu ML est bon à l’écoute : soit le proposer en option “Style ML”, soit le remplacer au DSP par défaut.

**Résumé :**  
Utilise le **DSP (MixingService)** comme moteur principal du mix client pour lancer le SaaS. Garde Diff-MST pour plus tard, quand la qualité sera au niveau.
