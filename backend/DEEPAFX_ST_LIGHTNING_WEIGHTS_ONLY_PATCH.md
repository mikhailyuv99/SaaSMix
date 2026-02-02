# Patch Lightning saving.py : weights_only=False

## Pourquoi

En PyTorch récent, `torch.load(..., weights_only=True)` est utilisé par défaut dans certains chemins de chargement (ou imposé par Lightning). Les checkpoints DeepAFx-ST contiennent des objets pickle personnalisés (ex. `deepafx_st.utils.DSPMode`). Avec `weights_only=True`, le chargement échoue :

```text
_pickle.UnpicklingError: Weights only load failed. ... Unsupported global: GLOBAL deepafx_st.utils.DSPMode
```

En forçant `weights_only=False` dans le module de chargement de Lightning, les checkpoints se chargent correctement.

## Où patcher

Fichier cible (Colab typique) :

- `.../site-packages/pytorch_lightning/core/saving.py`

Sous Colab avec Python 3.12 :

- `/usr/local/lib/python3.12/dist-packages/pytorch_lightning/core/saving.py`

En local, le chemin dépend de ton env (venv ou `pip show pytorch-lightning` → Location).

## Cellule Colab à exécuter (une fois)

Colle et exécute **avant** de lancer `process.py` ou tout chargement de checkpoint DeepAFx-ST.

```python
# Patch Lightning saving.py : weights_only=False (pour checkpoints DeepAFx-ST avec objets pickle)
import pytorch_lightning as pl
import os

saving_dir = os.path.dirname(pl.core.saving.__file__)
path = os.path.join(saving_dir, "saving.py")

with open(path, "r") as f:
    content = f.read()

if "weights_only=False" in content and "weights_only=True" not in content:
    print("saving.py a déjà weights_only=False, rien à faire.")
else:
    # Forcer weights_only=False (remplacer True par False si présent, sinon ajouter l’argument)
    if "weights_only=True" in content:
        content = content.replace("weights_only=True", "weights_only=False")
    if "weights_only=False" not in content:
        # Ajouter weights_only=False au premier torch.load(...) typique
        content = content.replace(
            "torch.load(checkpoint_path, map_location=map_location)",
            "torch.load(checkpoint_path, map_location=map_location, weights_only=False)",
            1,
        )
    with open(path, "w") as f:
        f.write(content)
    print("saving.py patché : weights_only=False pour torch.load")
```

## Alternative manuelle

1. Ouvre `pytorch_lightning/core/saving.py`.
2. Cherche tous les appels `torch.load(...)`.
3. Pour chaque appel, ajoute `weights_only=False` comme argument (ou remplace `weights_only=True` par `weights_only=False`).

Exemple :

```python
# Avant
checkpoint = torch.load(checkpoint_path, map_location=...)

# Après
checkpoint = torch.load(checkpoint_path, map_location=..., weights_only=False)
```

## Après le patch

Relance le test des checkpoints (ex. boucle `process.py` sur les checkpoints LibriTTS / Jamendo). Le chargement ne doit plus lever d’erreur pickle sur les globals DeepAFx-ST.
