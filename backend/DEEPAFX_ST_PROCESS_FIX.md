# DeepAFx-ST : pourquoi 5 secondes + correctif pleine longueur

## Ce qui se passait

Ce n’était **pas une erreur de notre part**. Le script **officiel** DeepAFx-ST `scripts/process.py` tronque **en dur** l’input et la référence à **5 secondes** :

```python
# Lignes 105-106 (input)
x_24000 = x_24000[0:1, : 24000 * 5]   # ← garde seulement les 5 premières secondes

# Lignes 111-112 (reference)
r_24000 = r_24000[0:1, : 24000 * 5]   # ← pareil pour la ref
```

Donc :
- **Sortie 5 secondes** = comportement normal du script officiel.
- **Sons bizarres** peuvent venir du fait que (1) seulement 5 s de ref ne représentent pas bien le style, (2) ou d’un autre souci (sample rate, format). Mais la **longueur** vient bien de ce truncat.

---

## Correctif 1 : enlever la troncature (tester pleine longueur)

Dans `scripts/process.py`, **supprime** la partie qui coupe à 5 s :

**Avant :**
```python
# peak normalize to -12 dBFS
x_24000 = x_24000[0:1, : 24000 * 5]
x_24000 /= x_24000.abs().max()
...
r_24000 = r_24000[0:1, : 24000 * 5]
r_24000 /= r_24000.abs().max()
```

**Après :**
```python
# peak normalize to -12 dBFS (pleine longueur)
x_24000 = x_24000[0:1, :]
x_24000 /= x_24000.abs().max()
x_24000 *= 10 ** (-12 / 20.0)
x_24000 = x_24000.view(1, 1, -1)
...
r_24000 = r_24000[0:1, :]
r_24000 /= r_24000.abs().max()
r_24000 *= 10 ** (-12 / 20.0)
r_24000 = r_24000.view(1, 1, -1)
```

(Adapte si le script a déjà la normalisation -12 dBFS ; l’important est de **ne plus** faire `: 24000 * 5`.)

Si le modèle accepte une longueur variable, tu obtiendras une sortie **pleine longueur**. Si ça plante (ex. taille fixe dans le réseau), il faudra passer au correctif 2 (chunks).

---

## Correctif 2 : pleine longueur par chunks (si le modèle a une longueur max)

Si en enlevant la troncature tu as une erreur (ex. shape, CUDA), le modèle attend peut‑être une longueur fixe (ex. 131072 échantillons ≈ 5,5 s). Dans ce cas :

1. Découper l’input en segments de cette longueur (avec un petit overlap optionnel).
2. Garder la **référence** entière (ou un segment représentatif) pour le style.
3. Pour chaque segment d’input : `system(segment, ref)` → segment sortie.
4. Recoller les segments (avec recouvrement + crossfade si besoin) et sauver le WAV.

Ça demande d’écrire un petit script Python qui charge le modèle, lit le WAV, boucle sur les chunks, appelle `system(...)`, concatène et sauve. Si tu veux, on peut détailler ce script pas à pas.

---

## Récap

| Problème | Cause | Action |
|----------|--------|--------|
| Sortie 5 s | Script officiel tronque à `24000 * 5` | Enlever `: 24000 * 5` dans `process.py` (correctif 1). |
| Sons bizarres | Possiblement ref trop courte ou format | Tester avec correctif 1 + ref et input 24 kHz mono. |
| Erreur après correctif 1 | Longueur max du modèle | Faire pleine longueur par chunks (correctif 2). |

Une fois le script corrigé, relance l’inférence avec le checkpoint LibriTTS (autodiff) ; le rendu devrait être cohérent avec la démo (voix parlée / chantée).

---

## Voix disparue, que des artefacts

Si la sortie fait bien ~5 s mais qu’**on n’entend plus la voix** et qu’il n’y a **que des artefacts**, la cause la plus probable est un **bug de shape ou de format** introduit quand on a remplacé `torchaudio.load` par `soundfile.read`.

### Pourquoi

- **torchaudio.load** renvoie `(waveform, sr)` avec `waveform` de shape **(canaux, échantillons)** → ex. `(1, 120000)` pour 5 s mono.
- **soundfile.read** renvoie `(data, sr)` avec `data` de shape **(échantillons,)** en mono ou **(échantillons, canaux)** en stéréo.

Si on a fait par exemple :
```python
x, x_sr = sf.read(args.input)
x_24000 = torch.tensor(x)   # shape (samples,) en mono !
```
alors `x_24000` a la shape **(samples,)**. Ensuite le script fait `x_24000[0:1, : 24000*5]` : sur un tenseur 1D, `x[0:1]` ne garde qu’**un seul échantillon**. Le modèle reçoit donc un signal faux → voix illisible, que des artefacts.

### Correctif : garder la même shape que torchaudio

Quand tu utilises `soundfile` à la place de `torchaudio.load`, il faut que le tenseur ait la même shape que torchaudio : **(1, samples)** en mono, float32.

**Remplacer le chargement audio par :**

```python
import soundfile as sf

# Charger
x, x_sr = sf.read(args.input)
r, r_sr = sf.read(args.reference)

# Mono : shape (samples,) -> (1, samples). Stéréo : (samples, 2) -> (2, samples) puis prendre un canal si besoin
if x.ndim == 1:
    x = x[np.newaxis, :]
else:
    x = x.T  # (samples, ch) -> (ch, samples)
    if x.shape[0] > 1:
        x = x[:1, :]  # mono = premier canal
if r.ndim == 1:
    r = r[np.newaxis, :]
else:
    r = r.T
    if r.shape[0] > 1:
        r = r[:1, :]

# En torch, float32
x = torch.tensor(x, dtype=torch.float32)
r = torch.tensor(r, dtype=torch.float32)
```

Puis **resample si besoin** (comme dans le script : 24 kHz), et **ne pas** réappliquer un slice du type `[0:1, : 24000*5]` sur un tenseur qui serait encore 1D. Après resample, garder `x_24000` de shape **(1, n_samples)** avant normalisation et `view(1, 1, -1)` pour le modèle.

### Recommandation

1. **Réessayer sans patch soundfile** : utiliser le script **officiel** (torchaudio uniquement), en ne changeant que la troncature 5 s (correctif 1). Si torchaudio plante sur Colab (torchcodec), installer une version de torchaudio qui marche ou un backend compatible.
2. Si tu **dois** garder soundfile (torchaudio cassé), appliquer le chargement ci‑dessus pour avoir **(1, samples)** et float32, et vérifier que jusqu’à l’appel au modèle les shapes restent **(1, 1, n_samples)**.

Résumé : **voix disparue + artefacts** = très souvent une mauvaise shape (signal 1D au lieu de 2D) ou un mauvais dtype après le patch soundfile. Corriger le chargement comme ci‑dessus et la sortie devrait redevenir lisible.
