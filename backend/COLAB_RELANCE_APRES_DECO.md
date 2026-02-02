# Relancer l'entraînement après déconnexion Colab

Après une déco, `/content` est vide. Il faut tout réinstaller puis reprendre avec le dernier checkpoint.

---

## Réinstall tout – ordre des cellules

Exécute tes cellules **dans cet ordre** (une par une) :

| # | À faire | Ce que ça fait |
|---|---------|-----------------|
| 1 | **Mount Drive** | `drive.mount('/content/drive')` |
| 2 | **Installer micromamba** | Binaire dans `/content/bin/micromamba` |
| 3 | **Créer l’env diffmst** | `micromamba create -n diffmst` + Python 3.11, numpy, scipy |
| 4 | **Installer PyTorch (CUDA)** | `pip install torch torchaudio ...` avec `--index-url` cu121 |
| 5 | **Installer le reste** | pytorch-lightning 2.1.4, jsonargparse, auraloss, librosa, etc. |
| 6 | **Télécharger Diff-MST** | `curl` + `unzip` (pas git), dossier `/content/Diff-MST` |
| 7 | **Config model** | Copier `naive+feat.yaml` → `naive_feat.yaml` + tes modifs |
| 8 | **Configs user** | Créer/recopier `trainer.yaml`, `optimizer.yaml`, `data.yaml` dans `configs/user/` |
| 9 | **Vocal dataloader** | Recréer `mst/vocal_dataloader.py` (VocalPairDataset, VocalPairDataModule) |
| 10 | **Dataset** | Extraire ou lier `dataset.zip` → `/content/dataset/raw` et `.../mixed` (avec fix structure imbriquée si besoin) |
| 11 | **Dernier checkpoint** | Cellule qui liste les `.ckpt` et affiche le chemin pour `--ckpt_path` |
| 12 | **Lancer l’entraînement** | `main.py fit ... --ckpt_path /content/drive/MyDrive/diffmst_checkpoints/last.ckpt` |

Si une de ces étapes est regroupée dans une seule cellule dans ton notebook, exécute quand même dans cet ordre logique.

---

## 1. Remonter Drive

```python
from google.colab import drive
drive.mount('/content/drive')
```

---

## 2. Trouver le dernier checkpoint

Colle ça dans une cellule pour lister les checkpoints et choisir le plus récent (par epoch ou par date) :

```python
import os
import re
import glob

ckpt_dir = '/content/drive/MyDrive/diffmst_checkpoints'
if not os.path.exists(ckpt_dir):
    print('Dossier checkpoints introuvable:', ckpt_dir)
else:
    files = glob.glob(os.path.join(ckpt_dir, '*.ckpt'))
    if not files:
        print('Aucun .ckpt dans', ckpt_dir)
    else:
        # Trier par date de modif (plus récent en dernier)
        files.sort(key=lambda f: os.path.getmtime(f))
        latest = files[-1]
        print('Dernier checkpoint (par date):', latest)
        print('Tous les checkpoints:')
        for f in files:
            print(' ', os.path.basename(f))
        # Pour reprendre, utilise --ckpt_path avec ce chemin
        print('\nÀ utiliser: --ckpt_path', latest)
```

Copie le chemin affiché pour `--ckpt_path` (ex: `/content/drive/MyDrive/diffmst_checkpoints/vocal_epoch130-stepXXXXX.ckpt`).

---

## 3. Refaire le setup puis relancer

Tu dois **re-exécuter toutes les cellules de setup** (micromamba, env diffmst, clone Diff-MST, configs, `vocal_dataloader.py`, dataset, etc.) car tout a été effacé dans `/content`.

Ensuite, dans la cellule d’entraînement, lance avec le dernier checkpoint :

```bash
# Remplace <CHEMIN_CKPT> par le chemin affiché à l’étape 2
# Exemple: /content/drive/MyDrive/diffmst_checkpoints/vocal_epoch130-step12345.ckpt

!/content/bin/micromamba run -n diffmst python /content/Diff-MST/main.py fit \
  -c /content/Diff-MST/configs/user/trainer.yaml \
  -c /content/Diff-MST/configs/user/optimizer.yaml \
  -c /content/Diff-MST/configs/models/naive_feat.yaml \
  -c /content/Diff-MST/configs/user/data.yaml \
  --ckpt_path <CHEMIN_CKPT>
```

En une seule ligne (Colab) :

```python
ckpt = '/content/drive/MyDrive/diffmst_checkpoints/vocal_epoch130-stepXXXXX.ckpt'  # ← remplace par le vrai chemin
import subprocess
subprocess.run([
    '/content/bin/micromamba', 'run', '-n', 'diffmst', 'python', '/content/Diff-MST/main.py', 'fit',
    '-c', '/content/Diff-MST/configs/user/trainer.yaml',
    '-c', '/content/Diff-MST/configs/user/optimizer.yaml',
    '-c', '/content/Diff-MST/configs/models/naive_feat.yaml',
    '-c', '/content/Diff-MST/configs/user/data.yaml',
    '--ckpt_path', ckpt
], cwd='/content/Diff-MST')
```

---

## Résumé

1. **Mount Drive** → exécute la cellule de mount.
2. **Setup** → re-exécute toutes les cellules qui installent micromamba, créent l’env, clonent Diff-MST, recréent les configs et le dataloader vocal, préparent le dataset.
3. **Dernier checkpoint** → exécute la cellule qui liste les `.ckpt` et note le chemin du dernier.
4. **Relance** → exécute la cellule d’entraînement avec `--ckpt_path` = ce chemin.

Lightning reprendra à l’epoch suivant celui du checkpoint (ex: checkpoint epoch 130 → reprise à l’epoch 131).
