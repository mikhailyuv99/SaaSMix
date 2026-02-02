# Utiliser le de-esser SNEX dans HISE

## Problème : « ça ne fait rien » et « les paramètres sont juste visuels »

1. **Le deesser ne fait rien** : si les paramètres ne sont pas connectés, HISE peut envoyer **0** au noeud, donc Threshold = 0 et Reduction = 0 → l’effet ne s’active pas.
2. **Les paramètres sont « juste visuels »** : les contrôles que tu as ajoutés ne sont pas **reliés** aux entrées du noeud. Il faut **brancher** chaque paramètre principal (Main parameter) vers le **bon slot** du noeud deesser.

---

## Étape 1 : Où sont les paramètres du noeud (slots 0, 1, 2, 3)

- Le **deesser** a 4 **entrées de paramètres** (index 0, 1, 2, 3) : Threshold, Reduction, FreqLow, FreqHigh.
- Ces entrées apparaissent sur le **noeud** : souvent des **petits cercles** ou **knobs** en haut du noeud (ou dans la liste à gauche quand le noeud est sélectionné).
- Ce qu’on appelle **« Edit Parameter List »** (la fenêtre avec `var data = {}`) sert à autre chose (mapping UI), **pas** à faire marcher le DSP. Les vrais paramètres du deesser, ce sont ces 4 slots (0, 1, 2, 3) sur le noeud.

---

## Étape 2 : Créer 4 Main parameters (barre de paramètres du ScriptNode)

1. Ouvre le **Scriptnode Workspace** (graph avec script_fx1 et le deesser).
2. Ouvre la **barre des paramètres** du ScriptNode (icône **knob** / paramètres en haut, ou panneau **Parameters** à gauche avec « Add parameter »).
3. Clique **Add parameter** (ou +) **4 fois** pour créer 4 paramètres. Donne-leur des noms et des plages, par exemple :

   | Nom              | Min   | Max    | Défaut | → Slot du deesser |
   |------------------|-------|--------|--------|-------------------|
   | DeesserThreshold | 0     | 1      | 0.3    | 0                 |
   | DeesserReduction | 0     | 1      | 0.5    | 1                 |
   | DeesserFreqLow  | 1000  | 8000   | 4000   | 2                 |
   | DeesserFreqHigh  | 4000  | 15000  | 10000  | 3                 |

4. Ajuste les **ranges** (double-clic sur le paramètre ou « range editor ») pour que Min/Max/Défaut correspondent au tableau.

---

## Étape 3 : Connecter chaque Main parameter au deesser (mode Connect)

1. Passe en **mode Connect** (icône **cible** / « connect » / « routing » dans la barre d’outils du ScriptNode).
2. Tu dois **tirer un câble** **depuis** un paramètre principal **vers** une **entrée du noeud deesser** :
   - **DeesserThreshold** → **1er slot** du deesser (param 0 = Threshold)
   - **DeesserReduction** → **2e slot** (param 1 = Reduction)
   - **DeesserFreqLow** → **3e slot** (param 2 = FreqLow)
   - **DeesserFreqHigh** → **4e slot** (param 3 = FreqHigh)
3. En mode Connect : **clic maintenu** sur le **Main parameter** (slider ou nom) → **glisser** jusqu’au **cercle/knob correspondant** sur le noeud deesser → relâcher. Un **câble de modulation** (souvent en haut des noeuds) doit apparaître.
4. Si le noeud n’a qu’une ligne de cercles, l’ordre est en général **0, 1, 2, 3** de gauche à droite.

Une fois ces câbles faits, bouger les sliders des Main parameters doit **vraiment** modifier le comportement du deesser (seuil, réduction, fréquences).

---

## Étape 4 : Vérifier la chaîne audio

- Le **Script FX** (script_fx1) doit être dans la **chaîne FX** de ton instrument ou de la Master Chain.
- L’audio doit **passer par** ce Script FX (pas en bypass).
- Le deesser est **dans** script_fx1 ; avec un seul noeud, l’entrée/sortie du Script FX est en général reliée automatiquement au deesser.

---

## Étape 5 : Tester que le deesser agit

1. Passe un **vocal avec des sifflantes** (S, CH, etc.).
2. Avec les paramètres **connectés** :
   - **Threshold** plus bas (ex. 0.15) → l’effet s’active plus facilement.
   - **Reduction** plus haut (ex. 0.7–0.8) → réduction plus forte.
3. Tu devrais entendre les sifflantes **diminuer** quand tu augmentes la réduction ou tu baisses le seuil.

---

## Résumé

- **Paramètres « juste visuels »** = pas de câble entre les Main parameters et les **4 entrées** du noeud deesser. Il faut être en **mode Connect** et **tirer les câbles** de chaque Main parameter vers le bon slot (0, 1, 2, 3).
- **Deesser qui ne fait rien** = souvent Threshold/Reduction à 0 parce qu’aucune valeur n’est envoyée (paramètres non connectés). Dès que les 4 paramètres sont correctement connectés et avec de bonnes valeurs par défaut (ex. 0.3, 0.5, 4000, 10000), l’effet doit devenir audible sur les sifflantes.
