# DeepAFx-ST sur Colab — comme les créateurs (sans patches)

Les créateurs utilisent **Python 3.8**, **PyTorch Lightning 1.x** et **sox** (README). Sur Colab tu as Python 3.12 et Lightning 2.x par défaut, donc leur code casse. Pour que l’entraînement démarre **sans tous les patches**, il faut :

1. Installer **sox** et **libsndfile1** (comme dans le README).
2. Installer **PyTorch Lightning 1.9.x** avant d’installer `deepafx_st`.

Ensuite : clone propre, `pip install -e .`, et lancer la même commande que dans leurs configs (avec tes chemins de données).

---

## Procédure Colab (à faire dans l’ordre)

### 1) Installer les deps système (comme le README)

```python
!apt-get update -qq && apt-get install -y -qq sox libsndfile1 ffmpeg wget
print("sox, libsndfile1, ffmpeg, wget installés")
```

### 2) Downgrade PyTorch Lightning en 1.9.x

```python
!pip install "pytorch-lightning>=1.8,<2.0" -q
import pytorch_lightning as pl
print("Lightning version:", pl.__version__)  # doit être 1.x
```

### 3) Nettoyer + clone DeepAFx-ST

```python
import os
import shutil
DEEPAFX_ROOT = "/content/DeepAFx-ST"
if os.path.exists(DEEPAFX_ROOT):
    shutil.rmtree(DEEPAFX_ROOT)
!git clone https://github.com/adobe-research/DeepAFx-ST.git {DEEPAFX_ROOT}
print("Clone OK")
```

### 4) Assouplir setup.py (uniquement versions torch)

```python
import re
path = "/content/DeepAFx-ST/setup.py"
with open(path, "r") as f:
    c = f.read()
c = re.sub(r'(torch|torchaudio|torchvision)\s*==\s*[\d.]+', r'\1>=2.0', c)
with open(path, "w") as f:
    f.write(c)
print("setup.py OK")
```

### 5) Installer deepafx_st (sans autre patch)

```python
!cd /content/DeepAFx-ST && pip install --upgrade pip -q && pip install --pre -e .
print("deepafx_st installé")
```

### 6) Données : vocals_24k comme d’habitude

Tu gardes ta préparation actuelle : `/content/data/vocals_24k/` avec tes WAV 24 kHz (ex. après extraction du ZIP ou 6 bis). Rien à changer.

### 7) Lancer l’entraînement (commande comme dans leur config)

Même structure que `configs/train_all_libritts_style.sh`, mais avec tes chemins et 1 GPU :

```python
import os
import subprocess

DEEPAFX_ROOT = "/content/DeepAFx-ST"
DATA_ROOT = "/content/data"
VOCALS_DIR_NAME = "vocals_24k"
CKPT_SAVE_DIR = "/content/drive/MyDrive/deepafx_vocal_checkpoints"
os.makedirs(CKPT_SAVE_DIR, exist_ok=True)
default_root = os.path.join(DEEPAFX_ROOT, "logs_style_vocal")

cmd = [
    "python", os.path.join(DEEPAFX_ROOT, "scripts", "train_style.py"),
    "--processor_model", "autodiff",
    "--gpus", "1",
    "--audio_dir", DATA_ROOT,
    "--input_dirs", VOCALS_DIR_NAME,
    "--style_transfer",
    "--buffer_size_gb", "1.0",
    "--buffer_reload_rate", "2000",
    "--train_frac", "0.9",
    "--freq_corrupt",
    "--drc_corrupt",
    "--sample_rate", "24000",
    "--train_length", "131072",
    "--train_examples_per_epoch", "20000",
    "--val_length", "131072",
    "--val_examples_per_epoch", "200",
    "--random_scale_input",
    "--encoder_model", "efficient_net",
    "--encoder_embed_dim", "1024",
    "--encoder_width_mult", "1",
    "--recon_losses", "mrstft", "l1",
    "--recon_loss_weight", "1.0", "100.0",
    "--lr", "1e-4",
    "--num_workers", "2",
    "--batch_size", "6",
    "--gradient_clip_val", "4.0",
    "--max_epochs", "400",
    "--accelerator", "ddp",
    "--default_root_dir", default_root,
]
print(" ".join(cmd))
```

```python
proc = subprocess.run(cmd, cwd=DEEPAFX_ROOT, capture_output=True, text=True)
print(proc.stdout)
if proc.stderr:
    print("STDERR:", proc.stderr)
if proc.returncode != 0:
    print("Code:", proc.returncode)
```

---

## Résumé

| Ce que font les créateurs | Ce qu’on fait sur Colab |
|---------------------------|-------------------------|
| `apt-get install sox libsndfile1 ffmpeg wget` | Cell 1 |
| Python 3.8 + `pip install -e .` | Python 3.12 + Lightning 1.x (cell 2) + install (cell 5) |
| `train_style.py` avec leurs args | Même args, chemins vers `/content/data` et `vocals_24k` |

Avec **sox** installé et **Lightning 1.x**, tu n’as plus besoin des patches (train_style, system, audio, augmentations, callbacks). Si une erreur apparaît quand même, envoie le message exact (et la version de Lightning affichée en sortie de la cell 2).
