# DeepAFx-ST : résumé, comparaison Diff-MST, et usage de vrais plugins

D’après le papier *Style Transfer of Audio Effects with Differentiable Signal Processing* (Steinmetz, Bryan, Reiss).

---

## 1. Résumé en clair

**Objectif :** Transférer le **style de production** (effets, EQ, compression) d’un enregistrement de référence vers un autre enregistrement. Tu donnes : (1) un audio à traiter, (2) un audio de référence “style”. Le système prédit les **paramètres d’effets** (EQ + compresseur) pour que le premier sonne comme le second en termes de traitement.

**Fonctionnement :**
- Un **encodeur** (CNN, poids partagés) analyse l’input et la référence → sort des représentations.
- Un **contrôleur** (MLP) reçoit ces représentations et prédit les **paramètres** (gain, fréquence, Q pour l’EQ ; threshold, ratio, attack, release pour le compresseur).
- Une **chaîne d’effets** (EQ paramétrique 6 bandes + compresseur) applique ces paramètres à l’input. Le rendu est comparé à la cible via une **loss dans le domaine audio** (temps + fréquence).

**Point fort : entraînement self-supervised (sans paires raw/mixed).**
- Pas besoin de vrais couples “raw / mixé”. On part d’un gros dataset d’audio quelconque.
- Pour chaque exemple : on prend un enregistrement, on lui applique **deux chaînes d’effets avec des paramètres tirés au hasard** → on obtient deux versions (style A et style B). Une moitié du fichier sert d’input, l’autre de référence de style (ou l’inverse). La “cible” pour la loss est générée par la même chaîne d’effets, donc on a toujours une paire (input, cible) **synthétique**.
- Ça permet d’entraîner sur LibriTTS, MTG-Jamendo, etc. sans jamais étiqueter de paires.

**Effets utilisés dans le papier :** EQ paramétrique 6 bandes (low-shelf, 4 bandes paramétriques, high-shelf) + un compresseur (ratio, threshold, attack, release, knee, makeup gain). Tous implémentés de façon **differentiable** (ou approximée) pour que la backprop passe à travers.

**Résultats :** Bon transfert de style sur parole et musique, généralisation à des enregistrements et des sample rates non vus en train. Les **paramètres estimés sont interprétables** (l’utilisateur peut les modifier). Plusieurs stratégies pour “différencier” les effets sont comparées (voir plus bas).

---

## 2. Comparaison avec Diff-MST

| | **DeepAFx-ST** | **Diff-MST** |
|---|----------------|--------------|
| **Idée** | Input + ref style → réseau prédit params → chaîne d’effets (EQ + comp) | Input (multi-pistes) + ref mix → Transformer prédit params → console de mix (EQ, comp, pan, etc.) |
| **Données d’entraînement** | **Self-supervised** : pas de paires raw/mixed. N’importe quel gros dataset d’audio ; les paires sont générées en appliquant des effets aléatoires. | **Supervised** : il faut des **paires (raw, mixed)** alignées. Tu dois construire ou avoir un dataset de type “vocal raw / vocal mixé”. |
| **Effets** | EQ 6 bandes + 1 compresseur (chaîne simple). | Console plus riche : EQ, comp, pan, bus FX, master, etc. (multi-pistes). |
| **Architecture** | Encodeur CNN (EfficientNet) + MLP contrôleur. | Transformer + encodeurs spectro + console différentiable (Pedalboard / custom). |
| **Sortie** | Paramètres d’effets (interprétables, modifiables). | Paramètres de la console (interprétables). |
| **Sample rate** | Testé avec généralisation à un sample rate différent du train (encoder à 24 kHz, effets à 44,1 kHz). | Souvent fixe (ex. 44,1 kHz) selon l’implémentation. |
| **Implémentation des effets** | Plusieurs stratégies : **AD** (effets différentiables à la main), **NP** (réseau qui émule l’effet), **NP-HH/NP-FH** (hybride proxy + vrai DSP), **SPSA** (approximation numérique des gradients, **boîte noire**). | Console implémentée en differentiable (Pedalboard/custom) ; pas de variante “boîte noire” ou “vrai VST” dans le papier. |

**En pratique :**
- **DeepAFx-ST** : tu peux entraîner **sans** dataset raw/mixed ; tu as besoin seulement de beaucoup d’audio (parole ou musique). En revanche la chaîne d’effets du papier est limitée (EQ + comp).
- **Diff-MST** : plus adapté au **mix multi-pistes** et à une console riche, mais il **faut** des paires (raw, mixed) de qualité, ce qui est ton goulot actuel.
- **DeepAFx-ST** propose explicitement des méthodes (**SPSA**, **NP-FH**) pour utiliser des effets **non différentiables** ou des **vrais plugins** (voir section 3).

---

## 3. Comment utiliser de vrais plugins

Le papier ne branche pas directement des VST, mais il décrit des façons d’utiliser des **effets “boîte noire”** (dont un vrai plugin pourrait faire partie).

### 3.1 SPSA (approximation numérique des gradients)

- **Principe :** Les effets n’ont pas besoin d’être différentiables. On a une fonction `y = effet(x, p)`. Pour entraîner, on a besoin du gradient de la loss par rapport à `p`. SPSA estime ce gradient en **perturbant** `p` (petit bruit), en rappelant l’effet 2 fois (p+εΔ, p−εΔ), et en utilisant la différence pour approximer la dérivée. Donc **2 appels à l’effet par batch** pour estimer le gradient.
- **Conséquence :** Tout effet que tu peux appeler depuis Python avec des paramètres `p` et qui renvoie un signal peut servir, **y compris un vrai plugin** (si tu as un wrapper Python qui applique le plugin à un buffer et renvoie le résultat). Tu n’as pas à écrire de version differentiable du plugin.
- **Inconvénients :** gradients approximés → entraînement un peu moins stable, réglage de ε et du learning rate. Le papier montre que SPSA reste compétitif.

**Pour toi :** Si tu exposes tes plugins (VST, AU, etc.) via une API du type `output = plugin.process(input, params)` (par ex. via un host type Pedalboard, JUCE, ou un serveur VST), tu peux utiliser **SPSA** pour entraîner un réseau qui prédit `params` à partir de (input, ref style), en utilisant ce plugin comme boîte noire.

### 3.2 Neural Proxy Hybrid (NP-FH / NP-HH)

- **Principe :** On entraîne d’abord un **réseau “proxy”** qui **imite** l’effet (input + params → output). Ce proxy est differentiable. Ensuite :
  - **NP-FH (full hybrid) :** À l’entraînement du style transfer, la **forward** utilise le **vrai effet** (ou le vrai plugin) ; la **backward** utilise le **proxy** pour calculer les gradients. À l’inférence, on n’utilise que le **vrai effet** (ou plugin).
  - **NP-HH (half hybrid) :** Forward et backward pendant l’entraînement utilisent le proxy ; à l’inférence on utilise le vrai effet.
- **Conséquence :** Tu peux avoir un **vrai plugin** à l’inférence (et en forward pendant l’entraînement en NP-FH). Le proxy sert uniquement à fournir des gradients pendant l’entraînement.
- **Pour entraîner le proxy :** Il faut générer beaucoup de (input, params, output) en appelant le **vrai plugin** avec des paramètres variés, puis entraîner le réseau à prédire output à partir de (input, params).

**Pour toi :**  
1) Choisir un ou plusieurs plugins (ex. un EQ + un compresseur).  
2) Générer des données : beaucoup de signaux + paramètres aléatoires → appeler le plugin → enregistrer les sorties.  
3) Entraîner un réseau “proxy” (ex. TCN comme dans le papier) qui émule input+params → output.  
4) Entraîner le système de style transfer (encodeur + contrôleur) avec NP-FH : forward = vrai plugin, backward = proxy.  
5) En prod / inférence : uniquement le **vrai plugin** avec les paramètres prédits par le réseau.

### 3.3 Projet DeepAFx (Adobe) – VST dans le graphe

- Le **projet DeepAFx** (pas seulement DeepAFx-ST) vise à intégrer des **plugins audio réels** (VST, etc.) dans un graphe de calcul pour l’entraînement. Les références du papier pointent vers des travaux sur “black-box audio effects” et “differentiable signal processing with black-box audio effects”.
- En pratique, ça passe soit par des **proxies** (réseau qui imite le plugin), soit par des **schémas d’approximation de gradients** (type SPSA). Donc “utiliser des vrais plugins” avec DeepAFx/DeepAFx-ST = soit SPSA (plugin = boîte noire), soit Neural Proxy Hybrid (plugin utilisé en forward / inférence, proxy pour la backprop).

---

## 4. Synthèse pour ton usage

- **Résumé DeepAFx-ST :** Style transfer “par l’exemple” (input + ref → paramètres d’effets), avec **entraînement self-supervised** (pas de paires raw/mixed), et comparaison de plusieurs stratégies pour différencier les effets (dont SPSA et NP hybrid).
- **Vs Diff-MST :** Même idée “ref → paramètres”, mais DeepAFx-ST se contente de moins d’effets (EQ+comp) et **ne nécessite pas de paires raw/mixed** ; Diff-MST est plus “console complète” mais demande ton dataset de paires.
- **Utiliser de vrais plugins :**  
  - **SPSA :** Tu branches n’importe quel effet ou plugin que tu peux appeler en Python (input, params) → output ; pas de version differentiable à écrire.  
  - **NP-FH :** Tu entraînes un proxy qui imite le plugin, puis tu entraînes le style transfer en forward = vrai plugin, backward = proxy ; en prod tu n’utilises que le vrai plugin.

Si tu veux, on peut détailler une chaîne concrète (ex. PyTorch + SPSA + un seul plugin VST) ou comment récupérer le code DeepAFx-ST / DeepAFx pour reproduire ça.
