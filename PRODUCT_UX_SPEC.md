# SaaS Mix – Spec UX produit (pistes, mix, render, mastering)

Document de référence pour l’implémentation frontend et backend.

---

## 1. Pistes

- L’utilisateur peut **ajouter autant de pistes qu’il veut** via un bouton **« + »** en bas de la dernière piste.
- Chaque piste :
  - **Upload** d’un fichier WAV.
  - **Catégorie** : `Lead voix` | `Adlibs/backs` | `Instrumental`.
- Une seule piste (ou plus) par catégorie possible ; l’ordre et le nombre sont libres.

---

## 2. Gain par piste (temps réel)

- **Chaque piste** a un contrôle de **gain** (slider ou knob).
- Le gain doit **modifier la piste en temps réel** : quand l’utilisateur bouge le gain, l’audio joué (preview) reflète immédiatement le nouveau niveau, sans re-render.
- Implémentation côté frontend : appliquer le gain dans le graphe Web Audio (GainNode) sur le flux déjà chargé, pas de re-rendu backend pour le gain seul.

---

## 3. Bouton « Mix » (pistes vocales uniquement)

- **Pistes Lead voix et Adlibs/backs** : bouton **« Mix »** sur chaque piste.
- **Piste Instrumental** : **pas de bouton Mix** ; uniquement le gain (voir §2).
- Comportement du bouton **Mix** :
  - Applique la chaîne de mixage (paramètres actuels : Tone, Delay, Reverb, etc.) sur **toute la piste**.
  - **Pendant le traitement** : afficher un **pourcentage** sur la piste (ex. « Mix en cours… 42 % »). Aucun changement d’UI à part ça.
  - **Quand c’est fini** : la piste devient la version mixée. L’utilisateur peut **rejouer la même piste** comme avant (même player, play/pause) — sauf qu’il entend maintenant la piste **mixée**. Pas de notion de « preview » séparé : c’est juste la piste qui est remplacée par sa version mixée.
  - Si l’utilisateur n’a pas modifié les paramètres → mix avec **paramètres par défaut**.
  - Si l’utilisateur a modifié les paramètres → il réappuie sur **Mix** pour régénérer la piste mixée (à nouveau pourcentage pendant le traitement, puis piste mise à jour).
- **Après un Mix** : un bouton permet d’**enlever / remettre le mix** pour comparer :
  - L’utilisateur peut basculer entre **avant** (piste brute, sans mix) et **après** (piste mixée).
  - Même player : selon le mode choisi, on joue soit le WAV d’origine, soit le WAV mixé. L’user peut ainsi entendre l’avant/après mix sur chaque piste vocale.

---

## 4. Traitement Adlibs/backs

- **Même chaîne** que le Lead voix (gate, de-esser, tone, delay, reverb, etc.).
- **Différence** : application d’un **EQ supplémentaire** pour changer un peu le rendu (caractère distinct du lead).

---

## 5. Render : deux boutons

Une fois les pistes vocales mixées (bouton Mix utilisé), l’utilisateur a **deux boutons** :

| Bouton | Action |
|--------|--------|
| **Télécharger** | Télécharge le **mix** (toutes les pistes avec leurs gains + pistes vocales mixées), sans mastering. Un seul fichier WAV. |
| **Masteriser** | Envoie le mix au mastering (backend applique `master.vst3`), puis affiche **avant/après** pour comparer, puis un bouton pour **télécharger la version masterisée**. |

- Pas de bouton « Render » unique : uniquement **Télécharger** (mix) et **Masteriser** (mix + master).

---

## 6. Flow mastering (détail)

1. L’utilisateur clique sur **Masteriser**.
2. Backend : assemble toutes les pistes (vocales mixées + instrumental avec gains), puis applique **master.vst3** (`--master-only` ou endpoint dédié).
3. Frontend reçoit :
   - le **mix** (avant master) et
   - le **master** (après master).
4. Interface : **comparaison avant/après** (écoute des deux versions, A/B).
5. Bouton **Télécharger** pour la **version masterisée** uniquement (ou les deux si on décide d’ajouter « Télécharger avant » plus tard).

---

## 7. Récap implémentation

| Élément | Frontend | Backend |
|--------|----------|--------|
| Gain temps réel | GainNode Web Audio sur le flux de la piste | — |
| Mix (piste vocale) | Bouton Mix → pendant le traitement : **pourcentage** affiché ; à la fin : piste = version mixée. **Bouton avant/après** : basculer entre piste brute et piste mixée (même player) pour comparer | Backend : endpoint qui mixe une piste (WAV), renvoie progression (% si possible) puis URL du WAV mixé. Front garde les deux (brut + mixé) et affiche le bouton pour basculer |
| Télécharger (mix) | Lien de téléchargement du WAV mix | Endpoint : assemble pistes + gains, renvoie WAV mix |
| Masteriser | Envoi mix → réception avant + après → UI A/B + bouton télécharger master | Endpoint : mix → master.vst3 → renvoie avant (mix) + après (master) |
| Adlibs/backs | Même UI que lead (Mix + params) | Même chaîne que lead + **EQ supplémentaire** (à définir) |

---

*Dernière mise à jour : d’après échanges 26/01/2025.*
