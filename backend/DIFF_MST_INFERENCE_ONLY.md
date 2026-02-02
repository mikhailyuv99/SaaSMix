# Diff-MST : UNE SEULE SÉQUENCE – VOCAL MIXÉ PAR TON MODÈLE

**But :** upload ton vocal raw + une ref mix → Colab lance l’inférence Diff-MST → tu récupères le WAV mixé sur Drive.

**Prérequis :** ton checkpoint est sur Drive dans `My Drive/diffmst_checkpoints/` (ex. `last.ckpt`).

**Ordre :** exécute les cellules **dans l’ordre**, une par une. Si tu as déjà fait le reinstall (Cells 1–7 de COLAB_CELLS_REINSTALL), exécute quand même la **Cell 7** ici (configs inférence), puis **Cell 8 (Upload)**, puis 9 et 10.

---

## Cell 1 : Monter Drive

```python
from google.colab import drive
drive.mount('/content/drive')
print("Drive monte")
```

---

## Cell 2 : Installer micromamba

```python
import os
import urllib.request
import tarfile
import shutil

os.makedirs("/content/bin", exist_ok=True)
url = "https://micro.mamba.pm/api/micromamba/linux-64/latest"
archive_path = "/content/micromamba.tar.bz2"
urllib.request.urlretrieve(url, archive_path)
extract_dir = "/content/micromamba_extract"
os.makedirs(extract_dir, exist_ok=True)
with tarfile.open(archive_path, "r:bz2") as tf:
    tf.extractall(extract_dir)
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
    print("Micromamba OK:", binary_dst)
if os.path.exists(archive_path):
    os.remove(archive_path)
if os.path.exists(extract_dir):
    shutil.rmtree(extract_dir)
```

---

## Cell 3 : Env diffmst + PyTorch + deps

```python
!MPLBACKEND=Agg /content/bin/micromamba create -n diffmst -y python=3.11 numpy=1.26.4 scipy=1.12.0 -c conda-forge
!MPLBACKEND=Agg /content/bin/micromamba run -n diffmst pip install torch==2.2.0 torchaudio==2.2.0 torchvision==0.17.0 --index-url https://download.pytorch.org/whl/cu121
!MPLBACKEND=Agg /content/bin/micromamba run -n diffmst pip install pytorch-lightning==2.1.4 "jsonargparse[signatures]>=4.26.1,<4.28" auraloss==0.4.0 librosa matplotlib tensorboard soundfile pyyaml tqdm pedalboard==0.8.7 dasp-pytorch pyloudnorm
print("Env diffmst OK")
```

---

## Cell 4 : Télécharger Diff-MST

```python
import os
import urllib.request
import zipfile
import shutil

if os.path.exists("/content/Diff-MST"):
    shutil.rmtree("/content/Diff-MST")
zip_path = "/content/Diff-MST.zip"
urllib.request.urlretrieve("https://github.com/sai-soum/Diff-MST/archive/refs/heads/main.zip", zip_path)
with zipfile.ZipFile(zip_path, "r") as z:
    z.extractall("/content")
if os.path.exists("/content/Diff-MST-main"):
    shutil.move("/content/Diff-MST-main", "/content/Diff-MST")
os.remove(zip_path)
!MPLBACKEND=Agg /content/bin/micromamba run -n diffmst pip install -e /content/Diff-MST
print("Diff-MST OK")
```

---

## Cell 5 : Config model (naive_feat)

```python
import os
import glob

base = "/content/Diff-MST"
models_dir = os.path.join(base, "configs", "models")
dst = os.path.join(models_dir, "naive_feat.yaml")
candidates = glob.glob(os.path.join(models_dir, "naive*feat*.yaml"))
src = next((c for c in candidates if "naive" in os.path.basename(c) and "feat" in os.path.basename(c)), None) or os.path.join(models_dir, "naive+feat.yaml")
if os.path.exists(src):
    with open(src, "r") as f:
        content = f.read()
    content = content.replace("generate_mix: true", "generate_mix: false").replace("use_clap: true", "use_clap: false")
    import re
    if "weights:" in content:
        content = re.sub(r"weights:\s*\n(\s*-\s*[\d.]+\s*\n)+", "weights:\n        - 0.1\n        - 0.001\n        - 1.0\n        - 1.0\n        - 0.1\n", content, count=1)
    with open(dst, "w") as f:
        f.write(content)
    print("Config model OK:", dst)
else:
    print("Fichier source absent:", models_dir)
```

---

## Cell 6 : vocal_dataloader.py

```python
import os

code = '''"""
DataLoader pour paires raw/mixed vocal (single track).
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
        start = random.randint(0, len(y) - length) if train else 0
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
        self.pairs = [(os.path.join(self.raw_dir, f), os.path.join(self.mixed_dir, f)) for f in raw_files if f in mixed_files]
        n = len(self.pairs)
        random.Random(self.hparams.seed).shuffle(self.pairs)
        split = max(1, int(n * (1 - self.hparams.val_split)))
        self.train_pairs = self.pairs[:split]
        self.val_pairs = self.pairs[split:]
        print("Train pairs:", len(self.train_pairs), "Val pairs:", len(self.val_pairs))

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
print("vocal_dataloader OK")
```

---

## Cell 7 : Configs inférence (data_song1 + trainer + optimizer)

```python
import os

base = "/content/Diff-MST"
user = os.path.join(base, "configs", "user")
os.makedirs(user, exist_ok=True)

models_dir = os.path.join(base, "configs", "models")
naive_feat = os.path.join(models_dir, "naive_feat.yaml")
if not os.path.exists(naive_feat):
    import glob
    src = next(glob.glob(os.path.join(models_dir, "naive*feat*.yaml")), None)
    if src:
        with open(src, "r") as f:
            c = f.read()
        c = c.replace("generate_mix: True", "generate_mix: false").replace("generate_mix: true", "generate_mix: false")
        c = c.replace("use_clap: True", "use_clap: false").replace("use_clap: true", "use_clap: false")
        with open(naive_feat, "w") as f:
            f.write(c)

data_song1 = """data:
  class_path: mst.vocal_dataloader.VocalPairDataModule
  init_args:
    raw_dir: /content/dataset_song1/raw
    mixed_dir: /content/dataset_song1/mixed
    sample_rate: 44100
    segment_length: 131072
    batch_size: 1
    num_workers: 2
    val_split: 1.0
    seed: 42
"""
with open(os.path.join(user, "data_song1.yaml"), "w") as f:
    f.write(data_song1)

trainer_yaml = """seed_everything: 42
trainer:
  accelerator: gpu
  devices: 1
  max_epochs: 1
  precision: "32"
  limit_train_batches: 0
  limit_val_batches: 1
  num_sanity_val_steps: 0
  logger: false
  enable_checkpointing: false
"""
optimizer_yaml = """optimizer:
  class_path: torch.optim.Adam
  init_args:
    lr: 0.000002
"""
for name, content in [("trainer.yaml", trainer_yaml), ("optimizer.yaml", optimizer_yaml)]:
    p = os.path.join(user, name)
    if not os.path.exists(p):
        with open(p, "w") as f:
            f.write(content)
print("Configs inference OK")
```

---

## Cell 8 : UPLOAD – Ton vocal raw + ta ref mix

**Tu dois uploader 2 fichiers :**
1. **Raw vocal** : le vocal brut que tu veux faire mixer par Diff-MST.
2. **Reference mixed** : un vocal déjà mixé (style cible), par ex. un de tes mixed du dataset d’entraînement.

Colab va ouvrir un sélecteur. Choisis **d’abord le raw**, puis **le ref mixed** (ou les deux d’un coup). Ils seront enregistrés comme `song1.wav` dans `raw` et `mixed`.

```python
from google.colab import files
import os

dataset_song1 = "/content/dataset_song1"
for sub in ["raw", "mixed"]:
    os.makedirs(os.path.join(dataset_song1, sub), exist_ok=True)

uploaded = files.upload()
keys = sorted(uploaded.keys())
if len(keys) < 2:
    raise SystemExit("Il faut 2 fichiers : 1 = raw vocal, 2 = reference mixed. Relance la cellule et selectionne les 2.")
raw_path = os.path.join(dataset_song1, "raw", "song1.wav")
mixed_path = os.path.join(dataset_song1, "mixed", "song1.wav")
with open(raw_path, "wb") as f:
    f.write(uploaded[keys[0]])
with open(mixed_path, "wb") as f:
    f.write(uploaded[keys[1]])
print("Raw vocal ->", raw_path)
print("Ref mixed ->", mixed_path)
print("OK, passe a la cellule suivante.")
```

---

## Cell 8b (optionnelle) : Choisir le meilleur checkpoint (val/loss)

Lance cette cellule **avant** la Cell 9 si tu veux utiliser le **meilleur epoch** (celui avec la plus faible val/loss) au lieu de `last.ckpt`. Elle parcourt tous les `.ckpt` dans Drive, lit la val/loss enregistrée par Lightning, et définit `best_ckpt_path`. La Cell 9 utilisera ce chemin automatiquement.

```python
import os
import glob
import torch

ckpt_dir = "/content/drive/MyDrive/diffmst_checkpoints"
paths = sorted(glob.glob(os.path.join(ckpt_dir, "*.ckpt")))
if not paths:
    print("Aucun .ckpt dans", ckpt_dir)
    best_ckpt_path = None
else:
    scores = []
    for p in paths:
        try:
            ckpt = torch.load(p, map_location="cpu", weights_only=False)
            cb = (ckpt.get("callbacks") or {})
            score = None
            for k, v in (cb.items() if isinstance(cb, dict) else []):
                if isinstance(v, dict) and ("current_score" in v or "best_model_score" in v):
                    score = v.get("current_score") or v.get("best_model_score")
                    if score is not None and hasattr(score, "item"):
                        score = score.item()
                    break
            if score is None and "epoch" in ckpt:
                score = float(ckpt.get("epoch", 0))
            scores.append((p, score))
        except Exception as e:
            scores.append((p, None))
    valid = [(p, s) for p, s in scores if s is not None]
    if valid:
        best_path = min(valid, key=lambda x: x[1])
        best_ckpt_path = best_path[0]
        print("Meilleur checkpoint (val/loss min):", best_ckpt_path)
        print("Val/loss:", best_path[1])
    else:
        best_ckpt_path = os.path.join(ckpt_dir, "last.ckpt") if os.path.exists(os.path.join(ckpt_dir, "last.ckpt")) else paths[-1]
        print("Pas de score dans les checkpoints, utilisation:", best_ckpt_path)
    for p, s in scores:
        print(" ", p, "->", s)
```

---

## Cell 9 : Écrire et lancer le script d’inférence Diff-MST

Cette cellule écrit le script qui utilise **uniquement** les fichiers dans `dataset_song1` (pas `/content/dataset`), charge ton checkpoint sur Drive, fait l’inférence **pleine longueur** et enregistre le WAV sur Drive.  
Si tu as exécuté la **Cell 8b**, le script utilisera le **meilleur checkpoint** (val/loss min). Sinon il utilisera `last.ckpt`.

```python
import os

ckpt_path = globals().get("best_ckpt_path") or "/content/drive/MyDrive/diffmst_checkpoints/last.ckpt"
print("Checkpoint utilise:", ckpt_path)

script = r'''
import os
import sys
import importlib
import torch
import soundfile as sf
import numpy as np
import yaml

sys.path.insert(0, "/content/Diff-MST")
os.chdir("/content/Diff-MST")

OUT_PATH = "/content/drive/MyDrive/song1_mixed_output.wav"
SR_OUT = 48000
CKPT = "__CKPT_PATH__"

def _instantiate(cfg):
    if isinstance(cfg, dict) and "class_path" in cfg:
        path = cfg["class_path"]
        init_args = cfg.get("init_args", {})
        if isinstance(path, str):
            mod, _, name = path.rpartition(".")
            m = importlib.import_module(mod)
            cls = getattr(m, name)
        else:
            cls = path
        kwargs = {k: _instantiate(v) for k, v in init_args.items()}
        return cls(**kwargs)
    if isinstance(cfg, dict):
        return {k: _instantiate(v) for k, v in cfg.items()}
    if isinstance(cfg, list):
        return [_instantiate(x) for x in cfg]
    if isinstance(cfg, str) and "." in cfg and "mst." in cfg:
        mod, _, name = cfg.rpartition(".")
        m = importlib.import_module(mod)
        return getattr(m, name)
    return cfg

_inner = {
    "class_path": "mst.modules.MixStyleTransferModel",
    "init_args": {
        "track_encoder": {"class_path": "mst.modules.SpectrogramEncoder", "init_args": {"embed_dim": 512, "n_fft": 2048, "hop_length": 512, "input_batchnorm": False}},
        "mix_encoder": {"class_path": "mst.modules.SpectrogramEncoder", "init_args": {"embed_dim": 512, "n_fft": 2048, "hop_length": 512, "input_batchnorm": False}},
        "controller": {"class_path": "mst.modules.TransformerController", "init_args": {"embed_dim": 512, "num_track_control_params": 27, "num_fx_bus_control_params": 25, "num_master_bus_control_params": 26, "num_layers": 12, "nhead": 8}},
    },
}
_ckpt = torch.load(CKPT, map_location="cpu")
import inspect
from mst.modules import AdvancedMixConsole
_sig = inspect.signature(AdvancedMixConsole.__init__)
mix_console_init = {}
for p in _sig.parameters:
    if p == "self":
        continue
    par = _sig.parameters[p]
    if par.default is not inspect.Parameter.empty:
        mix_console_init[p] = par.default
mix_console_init.update({
    "sample_rate": 44100,
    "input_min_gain_db": -48.0,
    "input_max_gain_db": 48.0,
    "output_min_gain_db": -48.0,
    "output_max_gain_db": 48.0,
    "eq_min_gain_db": -12.0,
    "eq_max_gain_db": 12.0,
    "min_pan": 0.0,
    "max_pan": 1.0,
})
mix_console_cfg = {"class_path": "mst.modules.AdvancedMixConsole", "init_args": mix_console_init}
model_cfg = {
    "class_path": "mst.system.System",
    "init_args": {
        "model": _inner,
        "mix_console": mix_console_cfg,
        "mix_fn": "mst.mixing.naive_random_mix",
        "loss": {"class_path": "mst.loss.AudioFeatureLoss", "init_args": {"sample_rate": 44100, "stem_separation": False, "use_clap": False, "weights": [0.1, 0.001, 1.0, 1.0, 0.1]}},
        "generate_mix": False,
        "use_track_loss": False,
        "use_mix_loss": True,
        "use_param_loss": False,
        "active_eq_epoch": 0,
        "active_compressor_epoch": 0,
        "active_fx_bus_epoch": 1000,
        "active_master_bus_epoch": 0,
    },
}
with open("/content/Diff-MST/configs/user/data_song1.yaml") as f:
    data_cfg = yaml.safe_load(f)["data"]

model = _instantiate(model_cfg)
model.load_state_dict(_ckpt["state_dict"], strict=True)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
model.eval()

import librosa
import glob
raw_dir = "/content/dataset_song1/raw"
mixed_dir = "/content/dataset_song1/mixed"
raw_files = sorted(glob.glob(os.path.join(raw_dir, "*.*")))
mixed_files = sorted(glob.glob(os.path.join(mixed_dir, "*.*")))
if not raw_files or not mixed_files:
    raise FileNotFoundError("Fichiers manquants dans " + raw_dir + " ou " + mixed_dir)
raw_path = raw_files[0]
mixed_path = mixed_files[0]
raw_mono, sr = librosa.load(raw_path, sr=44100, mono=True)
ref_mix, _ = librosa.load(mixed_path, sr=44100, mono=False)
if ref_mix.ndim == 1:
    ref_mix = np.stack([ref_mix, ref_mix])
min_len = min(len(raw_mono), ref_mix.shape[1])
raw_mono = raw_mono[:min_len]
ref_mix = ref_mix[:, :min_len]

SEG_LEN = 131072
n_segments = max(1, min_len // SEG_LEN)
preds = []
with torch.no_grad():
    for i in range(n_segments):
        start = i * SEG_LEN
        end = start + SEG_LEN
        raw_seg = raw_mono[start:end]
        ref_seg = ref_mix[:, start:end]
        if len(raw_seg) < SEG_LEN:
            raw_seg = np.pad(raw_seg, (0, SEG_LEN - len(raw_seg)), mode="constant")
        if ref_seg.shape[1] < SEG_LEN:
            ref_seg = np.pad(ref_seg, ((0, 0), (0, SEG_LEN - ref_seg.shape[1])), mode="constant")
        tracks = torch.from_numpy(raw_seg).float().reshape(1, 1, -1).to(device)
        ref_t = torch.from_numpy(ref_seg).float().unsqueeze(0).to(device)
        instrument_id = torch.tensor([0], dtype=torch.long, device=device)
        stereo_info = torch.tensor([0], dtype=torch.long, device=device)
        track_padding = torch.tensor([[False]], device=device)
        batch = (tracks, instrument_id, stereo_info, track_padding, ref_t, "song1")
        out = model.validation_step(batch, i)
        p = out.get("pred_mix_b_norm")
        if p is not None:
            preds.append(p.squeeze(0).cpu().numpy())
        if (i + 1) % 10 == 0:
            print(i + 1, "/", n_segments)

if not preds:
    print("Aucune sortie. Cles:", list(out.keys()) if out else "?")
else:
    pred_full = np.concatenate(preds, axis=1)
    if pred_full.ndim == 1:
        pred_full = np.stack([pred_full, pred_full])
    pred_full = pred_full[:, :min_len]
    pred_48 = librosa.resample(pred_full, orig_sr=44100, target_sr=SR_OUT)
    sf.write(OUT_PATH, pred_48.T, SR_OUT)
    print("OK Sortie (pleine longueur):", OUT_PATH, "duree", pred_48.shape[1] / SR_OUT, "s")
'''

script = script.replace("__CKPT_PATH__", repr(ckpt_path))
with open("/content/inference_song1.py", "w") as f:
    f.write(script.strip())
print("Script ecrit. Lancement inference Diff-MST...")
```

---

## Cell 10 : Lancer l’inférence

```python
import subprocess
import os

env = os.environ.copy()
env["MPLBACKEND"] = "Agg"
result = subprocess.run(
    ["/content/bin/micromamba", "run", "-n", "diffmst", "python", "/content/inference_song1.py"],
    cwd="/content/Diff-MST",
    env=env,
    capture_output=True,
    text=True
)
print("STDOUT:", result.stdout or "(vide)")
print("STDERR:", result.stderr or "(vide)")
print("returncode:", result.returncode)
if result.returncode != 0:
    print(">>> Si returncode != 0, copie tout STDERR ci-dessus pour debug.")
```

---

## Résultat

- Si tout est OK : le fichier **`song1_mixed_output.wav`** est dans **Google Drive** → `Mon Drive/song1_mixed_output.wav`.
- C’est ton vocal raw mixé par **Diff-MST** (pleine longueur), avec le style de la ref mix.

**Checkpoint ailleurs ?** Modifie dans le script (Cell 9) la ligne `CKPT = "/content/drive/MyDrive/diffmst_checkpoints/last.ckpt"` pour pointer vers ton `.ckpt` (ex. un autre dossier sur Drive).

---

## Problèmes connus / qualité

Après écoute, tu peux avoir :

| Problème | Cause probable | Piste |
|----------|----------------|--------|
| **Bruit de fond constant** (type ventilateur) | Artefacts du modèle / bruit numérique, pas dans le raw | Post-traitement : high-pass léger ou débruiteur (Cell 11 optionnelle). À long terme : plus d’epochs, refs plus propres. |
| **Voix trop compressée** | Le modèle (ou les refs) pousse la compresseur trop fort | Refs avec moins de compression ; ou entraîner plus longtemps avec des refs plus équilibrées. |
| **EQ pas gérée comme la ref** | Style transfer pas parfait, peu de données, ou ref peu représentative | Refs avec EQ très clair ; plus de paires raw/mixed ; essayer une autre ref mix. |
| **Stereo bizarre** (parfois gauche, droite, centre) | Inférence par segments : pan différent par chunk, pas de cohérence | Post-traitement : forcer mono centré (Cell 11 optionnelle) pour avoir au moins un centre stable. |

En résumé : une partie vient du **post-traitement** (bruit, stereo) qu’on peut atténuer avec la Cell 11 ; le reste (compression, EQ) dépend surtout du **modèle et de l’entraînement** (qualité des refs, nombre d’epochs, taille du dataset).

---

## Pourquoi le mix pue (et quoi faire)

**En bref :** Diff-MST ne “invente” pas un bon mix. Il essaie de **copier le style** des refs sur lesquelles tu l’as entraîné. Refs pourries ou incohérentes, peu de données ou peu d’epochs → rendu pourri. L’inférence par petits segments n’aide pas (pas de cohérence stereo / niveau / EQ sur toute la chanson).

**Les vrais leviers :**

1. **Données**  
   - Assez de paires **raw / mixed** (idéalement des dizaines, pas 5).  
   - **Même chanson** : le “mixed” doit être le vrai mix du “raw”, pas une autre prise.  
   - Refs **propres** (pas de hiss, pas de clip), **style cohérent** (même genre de traitement d’un morceau à l’autre).  
   Si les refs sont incohérentes (un mix trap, un mix pop, un mix live), le modèle moyenne tout et ça donne un truc bizarre.

2. **Entraînement**  
   - **Plus d’epochs** souvent = moins de bruit / artefacts, meilleure cohérence (jusqu’à un plafond).  
   - Checkpoint “last” pas forcément le meilleur : parfois un epoch un peu avant overfit mieux. Tester d’autres `.ckpt` peut aider.

3. **Ref à l’inférence**  
   - La ref que tu upload en “reference mixed” doit **ressembler** au type de mix sur lequel le modèle a été entraîné (même genre, même chaîne de traitement).  
   Une ref très différente du training → transfer bizarre (trop comprimé, mauvaise EQ, etc.).

4. **Limites structurelles**  
   - Traitement **segment par segment** (~3 s) sans contexte long → pan, niveau, EQ peuvent sauter d’un segment à l’autre. D’où le “parfois gauche, droite, centre”. Le post-traitement (Cell 11) ne fait que recentrer, ça ne corrige pas la cause.  
   - Le modèle fait du **style transfer**, pas “je connais la définition du bon mix”. Si tes refs sont moyennes, le rendu restera moyen.

**Concrètement :**  
- Vérifier **nombre de paires**, **alignement raw/mixed**, **propreté et cohérence des refs**.  
- Entraîner **plus longtemps**, essayer **une autre ref** à l’inférence (proche du training).  
- Utiliser la **Cell 11** pour limiter la casse (stereo centré, moins de hiss).  
Si après ça le mix pue encore, le goulot d’étranglement est soit les données / refs, soit les limites du modèle (archi, tâche) – là ça demande de revoir la stratégie (plus de data, autre objectif, autre archi).

---

## Cell 11 (optionnelle) : Post-traitement – centrage stereo + réduction hiss

À lancer **après** la Cell 10, si tu veux :
- un vocal **toujours au centre** (plus de sauts gauche/droite),
- un peu moins de **bruit de fond** (high-pass léger).

Le résultat est enregistré dans **Drive** : `song1_mixed_output_fixed.wav`.

```python
import numpy as np
import soundfile as sf
import scipy.signal as signal

path_in = "/content/drive/MyDrive/song1_mixed_output.wav"
path_out = "/content/drive/MyDrive/song1_mixed_output_fixed.wav"
sr = 48000
y, sr_read = sf.read(path_in)
if y.ndim == 1:
    y = np.stack([y, y], axis=1)
sr = sr_read

# 1) Centrer : mono (L+R)/2 puis copier sur L et R -> plus de pan bizarre
mono = (y[:, 0] + y[:, 1]) * 0.5
y_centered = np.stack([mono, mono], axis=1)

# 2) High-pass leger (~80 Hz) pour reduire rumble / hiss basse
b, a = signal.butter(2, 80.0 / (sr / 2), btype="high")
y_fixed = signal.filtfilt(b, a, y_centered, axis=0)

sf.write(path_out, y_fixed, sr)
print("OK post-traitement:", path_out)
```
