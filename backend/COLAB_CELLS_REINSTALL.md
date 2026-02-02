# Colab – Cellules à copier-coller (réinstall tout + reprendre)

Exécute les cellules **dans l’ordre**, une par une. Après une déco Colab, tout ce qui est dans `/content` est perdu : il faut tout refaire puis reprendre avec `last.ckpt`.

---

## Cell 1 : Mount Drive

```python
from google.colab import drive
drive.mount('/content/drive')
print("✓ Drive monté")
```

---

## Cell 2 : Installer micromamba

L’URL « latest » renvoie une **archive** (tar.bz2), pas l’exécutable. Il faut télécharger l’archive, l’extraire, puis utiliser le binaire à l’intérieur.

```python
import os
import urllib.request
import tarfile
import bz2
import shutil

os.makedirs("/content/bin", exist_ok=True)
# Télécharger l’archive linux-64
url = "https://micro.mamba.pm/api/micromamba/linux-64/latest"
archive_path = "/content/micromamba.tar.bz2"
urllib.request.urlretrieve(url, archive_path)

# Extraire : l’archive contient bin/micromamba
extract_dir = "/content/micromamba_extract"
os.makedirs(extract_dir, exist_ok=True)
with tarfile.open(archive_path, "r:bz2") as tf:
    tf.extractall(extract_dir)

# Copier le binaire (l’archive contient bin/micromamba, parfois sous un préfixe)
binary_dst = "/content/bin/micromamba"
binary_src = None
for root, dirs, files in os.walk(extract_dir):
    for f in files:
        if f == "micromamba":
            binary_src = os.path.join(root, f)
            break
    if binary_src:
        break
if not binary_src:
    binary_src = os.path.join(extract_dir, "bin", "micromamba")
if binary_src and os.path.exists(binary_src):
    shutil.copy2(binary_src, binary_dst)
    os.chmod(binary_dst, 0o755)
    print("✓ Micromamba installé:", binary_dst)
else:
    print("❌ Binaire micromamba introuvable. Contenu extrait:", os.listdir(extract_dir))

if os.path.exists(archive_path):
    os.remove(archive_path)
if os.path.exists(extract_dir):
    shutil.rmtree(extract_dir)
```

---

## Cell 3 : Créer l’env diffmst + PyTorch + deps

```python
# Créer l’env avec Python 3.11
!MPLBACKEND=Agg /content/bin/micromamba create -n diffmst -y python=3.11 numpy=1.26.4 scipy=1.12.0 -c conda-forge

# PyTorch avec CUDA 12.1
!MPLBACKEND=Agg /content/bin/micromamba run -n diffmst pip install torch==2.2.0 torchaudio==2.2.0 torchvision==0.17.0 --index-url https://download.pytorch.org/whl/cu121

# Reste des deps Diff-MST
!MPLBACKEND=Agg /content/bin/micromamba run -n diffmst pip install pytorch-lightning==2.1.4 "jsonargparse[signatures]>=4.26.1,<4.28" auraloss==0.4.0 librosa matplotlib tensorboard soundfile pyyaml tqdm pedalboard==0.8.7 dasp-pytorch pyloudnorm

print("✓ Env diffmst prêt")
```

---

## Cell 4 : Télécharger Diff-MST

```python
import os
import urllib.request
import zipfile
import shutil

# Nettoyer si déjà présent
if os.path.exists("/content/Diff-MST"):
    shutil.rmtree("/content/Diff-MST")

# Télécharger le zip (sans git)
zip_path = "/content/Diff-MST.zip"
url = "https://github.com/sai-soum/Diff-MST/archive/refs/heads/main.zip"
urllib.request.urlretrieve(url, zip_path)

with zipfile.ZipFile(zip_path, "r") as z:
    z.extractall("/content")

# Renommer Diff-MST-main -> Diff-MST
if os.path.exists("/content/Diff-MST-main"):
    shutil.move("/content/Diff-MST-main", "/content/Diff-MST")
os.remove(zip_path)

# Installer le package en mode editable
!MPLBACKEND=Agg /content/bin/micromamba run -n diffmst pip install -e /content/Diff-MST

print("✓ Diff-MST installé dans /content/Diff-MST")
```

---

## Cell 5 : Config model (naive_feat)

```python
import os
import glob

base = "/content/Diff-MST"
models_dir = os.path.join(base, "configs", "models")
dst = os.path.join(models_dir, "naive_feat.yaml")

# Trouver naive+feat.yaml (le + peut être échappé selon l'OS)
candidates = glob.glob(os.path.join(models_dir, "naive*feat*.yaml"))
src = None
for c in candidates:
    if "naive" in os.path.basename(c) and "feat" in os.path.basename(c):
        src = c
        break
if src is None:
    src = os.path.join(models_dir, "naive+feat.yaml")

if os.path.exists(src):
    with open(src, "r") as f:
        content = f.read()
    content = content.replace("generate_mix: true", "generate_mix: false")
    content = content.replace("use_clap: true", "use_clap: false")
    # 5 weights pour les 5 transforms (use_clap false)
    if "weights:" in content:
        import re
        content = re.sub(r"weights:\s*\n(\s*-\s*[\d.]+\s*\n)+", "weights:\n        - 0.1\n        - 0.001\n        - 1.0\n        - 1.0\n        - 0.1\n", content, count=1)
    with open(dst, "w") as f:
        f.write(content)
    print("✓ Config model:", dst)
else:
    print("⚠️ Fichier source absent. Liste:", os.listdir(models_dir))
```

---

## Cell 6 : Configs user (trainer, optimizer, data)

```python
import os

base = "/content/Diff-MST"
user = os.path.join(base, "configs", "user")
os.makedirs(user, exist_ok=True)

# trainer.yaml – checkpoints sur Drive, pas de W&B
trainer_yaml = """seed_everything: 42
trainer:
  accelerator: gpu
  devices: 1
  max_epochs: 300
  precision: "32"
  gradient_clip_val: 10.0
  check_val_every_n_epoch: 1
  log_every_n_steps: 50
  enable_checkpointing: true
  enable_model_summary: true
  num_sanity_val_steps: 0
  default_root_dir: /content/drive/MyDrive/diffmst_logs
  logger: false
  callbacks:
    - class_path: pytorch_lightning.callbacks.ModelCheckpoint
      init_args:
        dirpath: /content/drive/MyDrive/diffmst_checkpoints
        filename: "vocal_epoch{epoch}-step{step}"
        monitor: val/loss
        mode: min
        save_top_k: 3
        save_last: true
        every_n_epochs: 1
        save_on_train_epoch_end: true
"""

with open(os.path.join(user, "trainer.yaml"), "w") as f:
    f.write(trainer_yaml)

# optimizer.yaml
optimizer_yaml = """optimizer:
  class_path: torch.optim.Adam
  init_args:
    lr: 0.000002
"""
with open(os.path.join(user, "optimizer.yaml"), "w") as f:
    f.write(optimizer_yaml)

# data.yaml – VocalPairDataModule
data_yaml = """data:
  class_path: mst.vocal_dataloader.VocalPairDataModule
  init_args:
    raw_dir: /content/dataset/raw
    mixed_dir: /content/dataset/mixed
    sample_rate: 44100
    segment_length: 131072
    batch_size: 1
    num_workers: 2
    val_split: 0.1
    seed: 42
"""
with open(os.path.join(user, "data.yaml"), "w") as f:
    f.write(data_yaml)

# metadata minimal (au cas où)
data_dir = os.path.join(base, "data")
os.makedirs(data_dir, exist_ok=True)
with open(os.path.join(data_dir, "vocal_metadata.yaml"), "w") as f:
    f.write("train: []\nval: []\n")

print("✓ Configs user créées:", user)
```

---

## Cell 7 : Vocal dataloader (mst/vocal_dataloader.py)

```python
import os

code = '''"""
DataLoader pour paires raw/mixed vocal (single track).
Format batch attendu par Diff-MST : tracks, instrument_id, stereo_info, track_padding, ref_mix, song_name.
"""
import os
import random
import torch
import pytorch_lightning as pl
import numpy as np
import librosa


def _to_stereo(x):
    if x.ndim == 1:
        return np.stack([x, x], axis=0)
    return x


def _to_mono_track(x):
    if x.ndim == 2:
        return x.mean(axis=0)
    return x


def _resample_if_needed(y, sr, target_sr):
    if sr != target_sr:
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
    return y


def _crop_or_pad(y, length, train=True):
    if len(y) >= length:
        if train:
            start = random.randint(0, len(y) - length)
        else:
            start = 0
        return y[start:start + length]
    out = np.zeros(length, dtype=y.dtype)
    out[:len(y)] = y
    return out


class VocalPairDataset(torch.utils.data.Dataset):
    def __init__(self, pairs, sample_rate=44100, segment_length=131072, train=True):
        self.pairs = pairs
        self.sample_rate = sample_rate
        self.segment_length = segment_length
        self.train = train

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        raw_path, mixed_path = self.pairs[idx]
        raw, sr_raw = librosa.load(raw_path, sr=None, mono=True)
        mixed, sr_mix = librosa.load(mixed_path, sr=None, mono=False)
        raw = _resample_if_needed(raw, sr_raw, self.sample_rate)
        mixed = _resample_if_needed(mixed, sr_mix, self.sample_rate)
        mixed = _to_stereo(_to_mono_track(mixed)) if mixed.ndim == 1 else _to_stereo(mixed)
        raw = _crop_or_pad(raw, self.segment_length, self.train)
        # mixed (2, T) -> crop/pad each channel
        mixed = np.stack([_crop_or_pad(mixed[i], self.segment_length, self.train) for i in range(mixed.shape[0])], axis=0)
        raw = torch.from_numpy(raw).float()
        mixed = torch.from_numpy(mixed).float()
        tracks = raw.reshape(1, -1)
        instrument_id = torch.tensor([0], dtype=torch.long)
        stereo_info = torch.tensor([0], dtype=torch.long)
        track_padding = torch.tensor([False])
        ref_mix = mixed
        song_name = os.path.splitext(os.path.basename(raw_path))[0]
        return tracks, instrument_id, stereo_info, track_padding, ref_mix, song_name


class VocalPairDataModule(pl.LightningDataModule):
    def __init__(self, raw_dir, mixed_dir, sample_rate=44100, segment_length=131072, batch_size=1, num_workers=2, val_split=0.1, seed=42):
        super().__init__()
        self.save_hyperparameters()
        self.raw_dir = raw_dir
        self.mixed_dir = mixed_dir
        self.pairs = []

    def setup(self, stage=None):
        raw_files = sorted([f for f in os.listdir(self.raw_dir) if f.lower().endswith((".wav", ".flac", ".mp3"))])
        mixed_files = {f for f in os.listdir(self.mixed_dir) if f.lower().endswith((".wav", ".flac", ".mp3"))}
        self.pairs = []
        for f in raw_files:
            if f in mixed_files:
                self.pairs.append((os.path.join(self.raw_dir, f), os.path.join(self.mixed_dir, f)))
        n = len(self.pairs)
        random.Random(self.hparams.seed).shuffle(self.pairs)
        split = max(1, int(n * (1 - self.hparams.val_split)))
        self.train_pairs = self.pairs[:split]
        self.val_pairs = self.pairs[split:]
        print(f"Train pairs: {len(self.train_pairs)}, Val pairs: {len(self.val_pairs)}")

    def train_dataloader(self):
        ds = VocalPairDataset(self.train_pairs, self.hparams.sample_rate, self.hparams.segment_length, train=True)
        return torch.utils.data.DataLoader(ds, batch_size=self.hparams.batch_size, shuffle=True, num_workers=self.hparams.num_workers, pin_memory=True)

    def val_dataloader(self):
        ds = VocalPairDataset(self.val_pairs, self.hparams.sample_rate, self.hparams.segment_length, train=False)
        return torch.utils.data.DataLoader(ds, batch_size=self.hparams.batch_size, shuffle=False, num_workers=self.hparams.num_workers)
'''

path = "/content/Diff-MST/mst/vocal_dataloader.py"
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    f.write(code)
print("✓ vocal_dataloader.py créé")
```

---

## Cell 8 : Dataset (extraire zip depuis Drive)

```python
import zipfile
import os
import shutil

zip_path = "/content/drive/MyDrive/dataset.zip"
extract_path = "/content/temp_extract"
final_path = "/content/dataset"

for p in [final_path, extract_path]:
    if os.path.exists(p):
        shutil.rmtree(p)
os.makedirs(extract_path, exist_ok=True)

print("Extraction...")
with zipfile.ZipFile(zip_path, "r") as z:
    z.extractall(extract_path)

contents = os.listdir(extract_path)
if "dataset" in contents:
    nested = os.path.join(extract_path, "dataset")
    if os.path.exists(os.path.join(nested, "raw")) and os.path.exists(os.path.join(nested, "mixed")):
        shutil.move(nested, final_path)
        print("✓ Structure imbriquée corrigée")
    else:
        print("Contenu nested:", os.listdir(nested))
elif "raw" in contents and "mixed" in contents:
    os.makedirs(final_path, exist_ok=True)
    shutil.move(os.path.join(extract_path, "raw"), os.path.join(final_path, "raw"))
    shutil.move(os.path.join(extract_path, "mixed"), os.path.join(final_path, "mixed"))
    print("✓ Structure directe")
else:
    print("Structure inattendue:", contents)

if os.path.exists(extract_path):
    shutil.rmtree(extract_path)

if os.path.exists(os.path.join(final_path, "raw")) and os.path.exists(os.path.join(final_path, "mixed")):
    r = len(os.listdir(os.path.join(final_path, "raw")))
    m = len(os.listdir(os.path.join(final_path, "mixed")))
    print(f"✓ Dataset: {r} raw, {m} mixed")
else:
    print("❌ raw ou mixed manquant dans", final_path)
```

---

## Cell 9 : Dernier checkpoint

```python
import os
import glob

ckpt_dir = "/content/drive/MyDrive/diffmst_checkpoints"
files = glob.glob(os.path.join(ckpt_dir, "*.ckpt"))
if not files:
    print("Aucun .ckpt dans", ckpt_dir)
else:
    files.sort(key=lambda f: os.path.getmtime(f))
    latest = files[-1]
    print("Dernier checkpoint:", latest)
    print("Utilise: --ckpt_path", latest)
```

---

## Cell 10 : Lancer l’entraînement (reprise)

Colle ce bloc (le chemin `ckpt` est bien passé au script) :

```python
import subprocess

ckpt = "/content/drive/MyDrive/diffmst_checkpoints/last.ckpt"  # ou le chemin affiché à la Cell 9

subprocess.run([
    "/content/bin/micromamba", "run", "-n", "diffmst", "python", "/content/Diff-MST/main.py", "fit",
    "-c", "/content/Diff-MST/configs/user/trainer.yaml",
    "-c", "/content/Diff-MST/configs/user/optimizer.yaml",
    "-c", "/content/Diff-MST/configs/models/naive_feat.yaml",
    "-c", "/content/Diff-MST/configs/user/data.yaml",
    "--ckpt_path", ckpt
], cwd="/content/Diff-MST")
```

---

## Ordre récap

| Cell | Action |
|------|--------|
| 1 | Mount Drive |
| 2 | Installer micromamba |
| 3 | Env diffmst + PyTorch + deps |
| 4 | Télécharger Diff-MST |
| 5 | Config model naive_feat |
| 6 | Configs user (trainer, optimizer, data) |
| 7 | vocal_dataloader.py |
| 8 | Extraire dataset |
| 9 | Afficher dernier checkpoint |
| 10 | Lancer fit avec --ckpt_path |

Lightning reprendra à l’epoch suivant celui enregistré dans le checkpoint.
