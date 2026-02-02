# SaaS Mix – Prochaines étapes d’implémentation

Suite à la spec UX ([PRODUCT_UX_SPEC.md](PRODUCT_UX_SPEC.md)), voici l’ordre logique pour avancer.

---

## Où on en est

- **Backend** : `main.py` avec `/api/process` (vocal + instrumental, preset) qui utilise `MixingService` → **AudioProcessor** (DSP/ML). La chaîne “prod” (HISE) est dans **`test_hise_direct.py`** (CLI, pas d’API).
- **Frontend** : page d’accueil “Coming soon”, pas encore d’UI pistes / mix / render.

---

## Plan en 6 étapes

### 1. Backend – Mix piste vocale (une piste)

- **Objectif** : débloquer le bouton “Mix” côté frontend.
- **Comportement attendu** : pas de “preview” séparé — pendant le mix on affiche un **pourcentage** sur la piste ; à la fin la piste devient la version mixée (même player, l’user rejoue et entend le mix).
- **À faire** :
  - Nouvel endpoint, ex. `POST /api/track/mix` :
    - Reçoit : 1 fichier WAV (piste vocale) + paramètres (tone, delay, reverb, etc. ; optionnel, défauts si absents).
    - Appelle la chaîne HISE (`test_hise_direct.py` ou un module qui réutilise sa logique) sur **toute** la piste.
    - **Option A (simple)** : traitement synchrone ; à la fin retourne l’URL du WAV mixé. Le front affiche un loader / “Mix en cours…” sans % précis, puis remplace la piste par l’URL.
    - **Option B (meilleure UX)** : traitement asynchrone (job + polling ou SSE/WebSocket) qui envoie la **progression en %** ; à la fin retourne l’URL du WAV mixé. Le front affiche le % sur la piste pendant le traitement, puis remplace la piste par la version mixée.
  - Sauvegarde le WAV mixé en temp (ou stockage temporaire avec ID de session).
  - Retourne une **URL** pour jouer/télécharger la piste mixée (même player qu’avant, juste la source audio qui change).
- **Note** : soit on expose un sous-process `test_hise_direct.py` avec des args, soit on factorise la logique dans un module Python appelé par FastAPI (plus propre pour la suite).

### 2. Frontend – UI pistes (squelette)

- **Objectif** : voir l’interface pistes et le flux.
- **À faire** :
  - État : liste de pistes `{ id, file, category, gain, rawAudioUrl?, mixedAudioUrl?, mixParams?, isMixing?, mixProgress?, playMode? }`. Garder **brut** et **mixé** pour chaque piste vocale (pas seulement le mixé).
  - Bouton **“+”** en bas pour ajouter une piste.
  - Par piste : upload WAV, select **catégorie** (Lead vocal | Adlibs/backs | Instrumental).
  - **Gain** : slider par piste (valeur 0–100 % ou 0–2 en linéaire). Pour l’instant stocker la valeur ; le “temps réel” viendra à l’étape 3.
  - Si catégorie = Lead vocal ou Adlibs/backs : afficher **bouton “Mix”** + (optionnel) panneau réduit pour Tone/Delay/Reverb.
  - Si catégorie = Instrumental : **pas** de bouton Mix.
  - **Pendant le Mix** : afficher un **pourcentage** sur la piste (ex. « Mix en cours… 42 % »). Rien d’autre ne change.
  - **Après le Mix** : la piste a à la fois `rawAudioUrl` (brut) et `mixedAudioUrl` (mixé). Par défaut le player joue la version mixée. **Bouton « Avant / Après »** (ou « Sans mix » / « Avec mix ») : basculer entre brut et mixé pour que l’user puisse comparer l’avant/après mix sur la même piste (même player, juste la source qui change).

### 3. Frontend – Gain en temps réel

- **Objectif** : bouger le gain → le son change tout de suite.
- **À faire** :
  - Pour chaque piste jouée : charger l’audio (piste mixée ou WAV brut) dans un **AudioBuffer** (Web Audio).
  - Lecture via **AudioContext** + **GainNode** dont la valeur est pilotée par le slider. Quand l’utilisateur bouge le gain, mettre à jour `gainNode.gain.value` → pas de re-render backend.

### 4. Backend – Télécharger le mix

- **Objectif** : bouton “Télécharger” qui renvoie le WAV mix (sans mastering).
- **À faire** :
  - Endpoint `POST /api/mix/download` (ou `POST /api/render/mix`) :
    - Reçoit la description des pistes : pour chaque piste, soit fichier WAV + gain + type (vocal / adlibs / instrumental), soit référence à un preview déjà calculé (ex. `previewId`) + gain.
    - Pour les pistes vocales : appliquer la chaîne HISE (même logique que mix piste) si pas déjà fait, sinon réutiliser le WAV mixé déjà généré.
    - Assembler toutes les pistes (gains appliqués, même durée, sample rate) et sommer.
    - Retourner le WAV (stream ou URL de téléchargement).

### 5. Backend – Masteriser (avant/après + téléchargement)

- **Objectif** : bouton “Masteriser” + comparaison A/B + télécharger le master.
- **À faire** :
  - Endpoint `POST /api/master` :
    - Reçoit le **mix** (WAV) ou les mêmes infos que “Télécharger” pour reconstruire le mix.
    - Applique **master.vst3** (`--master-only` ou équivalent) sur le mix.
    - Retourne `{ beforeUrl, afterUrl }` (mix = avant, master = après).
  - Côté front : page ou modal **avant/après** (écoute des deux), puis bouton **Télécharger** pour la version masterisée (fichier pointé par `afterUrl`).

### 6. Frontend – Boutons Télécharger & Masteriser + flow complet

- **Objectif** : enchaîner tout le flow jusqu’au téléchargement.
- **À faire** :
  - En bas de l’écran : **Télécharger** (mix) et **Masteriser**.
  - Télécharger : appel `POST /api/mix/download` avec les pistes actuelles → téléchargement du WAV mix.
  - Masteriser : appel `POST /api/master` → affichage avant/après (players côte à côte ou A/B) + bouton “Télécharger la version masterisée” (lien vers `afterUrl`).
  - Gestion des états (loading, erreurs) et validation (ex. au moins une piste, pistes vocales “Mix”-ées si on veut les inclure).

---

## Par quoi commencer ?

- **Option A** : **Étape 1 (Backend mix-preview)** → tu peux ensuite brancher le bouton “Mix” et le player dès que l’étape 2 est en place.
- **Option B** : **Étape 2 (Frontend UI pistes)** → tu vois tout de suite l’UI ; le bouton “Mix” appellera un endpoint mock ou l’étape 1 une fois prête.

Recommandation : **1 puis 2** (backend mix piste d’abord, puis UI qui l’utilise), pour avoir un flux “Mix → pourcentage → piste remplacée par la version mixée” le plus tôt possible.

---

## Adlibs/backs (rappel)

- Même chaîne que le lead + **EQ supplémentaire** (à définir plus tard). Pour les étapes 1–6, on peut traiter adlibs comme le lead (même endpoint mix piste) et ajouter l’EQ dédié en backend ensuite sans changer le flow UX.
