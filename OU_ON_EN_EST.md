# SaaS Mix – Où on en est et par où commencer

Résumé de l’état du projet et des prochaines étapes possibles.

---

## Ce qui est déjà fait

| Fonctionnalité | État |
|----------------|------|
| **Pistes** | OK – Ajout de pistes, upload WAV, catégorie (Lead vocal / Adlibs / Instrumental) |
| **Gain par piste** | OK – Slider 0–200 %, appliqué en temps réel pendant la lecture |
| **Bouton Mix (vocaux)** | OK – Envoi au backend, « Mix en cours… », puis piste mixée |
| **Paramètres mix** | OK – Delay, Reverb, Tone low/mid/high, Air, BPM, division delay (panneau repliable) |
| **Avant / Après mix** | OK – Bouton « Sans mix » / « Avec mix » pour comparer sur la même piste |
| **Play tout / Pause** | OK – Lecture synchronisée de toutes les pistes, reprise au bon endroit |
| **Waveform** | OK – Affichage par piste, clic = déplacement (seek), curseur de lecture |
| **Backend mix** | OK – `POST /api/track/mix` + téléchargement du WAV mixé |

---

## Ce qu’il reste à faire (dans l’ordre logique)

### 1. **UI / Layout** (tu en as parlé)
- Améliorer la mise en page : plus lisible, plus pro
- Hiérarchie claire (header, contrôles globaux, pistes)
- Espacements, typo, couleurs cohérentes
- Responsive si besoin

**Par où commencer :** refaire une maquette mentale (ou sur papier) de la page, puis ajuster le CSS / structure des blocs dans `page.tsx`. On peut le faire ensemble étape par étape.

---

### 2. **Télécharger le mix** (spec §5)
- **Bouton « Télécharger »** : télécharge un seul WAV = toutes les pistes assemblées (gains + vocaux mixés), sans mastering.
- **Backend :** nouvel endpoint (ex. `POST /api/render/mix`) qui reçoit la liste des pistes (fichiers ou URLs déjà mixées + gains), assemble tout, renvoie le WAV.
- **Frontend :** bouton qui envoie l’état des pistes, reçoit l’URL du fichier, déclenche le téléchargement.

C’est la prochaine grosse feature « produit » après le mix par piste.

---

### 3. **Masteriser** (spec §5–6)
- **Bouton « Masteriser »** : envoie le mix au backend → applique `master.vst3` → renvoie **avant** (mix) et **après** (master).
- **Frontend :** affichage **avant/après** (écoute A/B), puis bouton **Télécharger la version masterisée**.
- **Backend :** endpoint (ex. `POST /api/master`) qui prend le mix, applique le master, renvoie `{ beforeUrl, afterUrl }`.

À faire après « Télécharger le mix », car le master part du mix assemblé.

---

### 4. **Progression % pendant le Mix** (spec §3, optionnel)
- Aujourd’hui : « Mix en cours… » sans pourcentage.
- Idéal : « Mix en cours… 42 % ».
- Nécessite soit du **streaming** (SSE/WebSocket) depuis le backend, soit des **polls** avec un job + endpoint de statut. Plus lourd à mettre en place, on peut le faire après Télécharger + Masteriser.

---

### 5. **Adlibs/backs – EQ supplémentaire** (spec §4)
- Même chaîne que le lead vocal pour l’instant.
- Plus tard : en backend, appliquer un **EQ en plus** sur les adlibs/backs pour les différencier du lead. Pas de changement d’UI nécessaire au début.

---

### 6. **Backend audio (déjà en place)**
- Le mix utilise déjà **test_hise_direct** → **hise_vst3_host** + **Project1.vst3** (et reverbs VST3). Rien à changer pour l’instant.
- En déploiement (autre machine / serveur) : s’assurer que l’exe du host et les chemins vers les VST3 sont corrects (voir `HISE_NEXT_STEPS.md` si besoin).

---

## Par quoi commencer ?

- **Tu veux que le produit soit plus présentable tout de suite** → commencer par **1. UI / Layout**.
- **Tu veux que le flow soit complet (mix → télécharger → masteriser)** → enchaîner **2. Télécharger le mix** puis **3. Masteriser**.
- **Tu déploies sur un autre serveur** → vérifier **6.** (chemins host + VST3).

Tu peux aussi mélanger : par ex. améliorer un peu le layout, puis ajouter le bouton « Télécharger le mix » quand tu te sens prêt.

---

*Dernière mise à jour : 26/01/2025*
