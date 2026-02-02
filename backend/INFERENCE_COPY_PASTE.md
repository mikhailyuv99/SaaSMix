# Inférence song1 – étapes copier-coller

Une cellule = une étape. Colle, exécute, passe à la suivante.

---

## Étape 1 – Configs inférence (data song1 + trainer + optimizer)

On utilise le **même** fichier modèle que l’entraînement : `configs/models/naive_feat.yaml` (créé par la Cell 5 du reinstall). On crée seulement data_song1 + trainer + optimizer.

```python
import os

base = "/content/Diff-MST"
user = os.path.join(base, "configs", "user")
os.makedirs(user, exist_ok=True)

# 1) S’assurer que naive_feat.yaml existe (comme Cell 5 du reinstall)
models_dir = os.path.join(base, "configs", "models")
naive_feat = os.path.join(models_dir, "naive_feat.yaml")
if not os.path.exists(naive_feat):
    import glob
    src = None
    for f in glob.glob(os.path.join(models_dir, "naive*feat*.yaml")):
        src = f
        break
    if src:
        with open(src, "r") as f:
            c = f.read()
        c = c.replace("generate_mix: True", "generate_mix: false").replace("generate_mix: true", "generate_mix: false")
        c = c.replace("use_clap: True", "use_clap: false").replace("use_clap: true", "use_clap: false")
        with open(naive_feat, "w") as f:
            f.write(c)
        print("Créé", naive_feat)

# 2) data_song1
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

# 3) trainer + optimizer (créés seulement s’ils n’existent pas)
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
        print("Créé", p)

print("OK data_song1.yaml dans", user, "; modèle = configs/models/naive_feat.yaml")
```

---

## Étape 2 – Écrire le script inference_song1.py (sans LightningCLI)

Le script instancie le modèle à la main (config en dict Python), charge le checkpoint, lance 1 batch de validation et sauve le WAV. **Aucun parser LightningCLI.**

```python
script = r'''
import os
import sys
import shutil
import importlib
import torch
import soundfile as sf
import numpy as np
import yaml

sys.path.insert(0, "/content/Diff-MST")
os.chdir("/content/Diff-MST")

OUT_PATH = "/content/drive/MyDrive/song1_mixed_output.wav"
SR_OUT = 48000
CKPT = "/content/drive/MyDrive/diffmst_checkpoints/last.ckpt"

# Copier song1 dans dataset_song1
dataset_song1 = "/content/dataset_song1"
if os.path.exists(dataset_song1):
    shutil.rmtree(dataset_song1)
for sub in ["raw", "mixed"]:
    d = os.path.join(dataset_song1, sub)
    os.makedirs(d, exist_ok=True)
    parent = os.path.join("/content/dataset", sub)
    for f in os.listdir(parent):
        if f.lower().startswith("song1"):
            shutil.copy2(os.path.join(parent, f), os.path.join(d, f))
            break

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

# Config modèle complète en dict (évite tout parser LightningCLI)
_inner = {
    "class_path": "mst.modules.MixStyleTransferModel",
    "init_args": {
        "track_encoder": {"class_path": "mst.modules.SpectrogramEncoder", "init_args": {"embed_dim": 512, "n_fft": 2048, "hop_length": 512, "input_batchnorm": False}},
        "mix_encoder": {"class_path": "mst.modules.SpectrogramEncoder", "init_args": {"embed_dim": 512, "n_fft": 2048, "hop_length": 512, "input_batchnorm": False}},
        "controller": {"class_path": "mst.modules.TransformerController", "init_args": {"embed_dim": 512, "num_track_control_params": 27, "num_fx_bus_control_params": 25, "num_master_bus_control_params": 26, "num_layers": 12, "nhead": 8}},
    },
}
# AdvancedMixConsole n'a que des params scalaires (pas de "model") : le module interne est créé en interne
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

# Data config
with open("/content/Diff-MST/configs/user/data_song1.yaml") as f:
    data_cfg = yaml.safe_load(f)["data"]

model = _instantiate(model_cfg)
model.load_state_dict(_ckpt["state_dict"], strict=True)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
model.eval()

# Charger le vocal ENTIER (pas un seul segment de 3 s)
import librosa
import glob
raw_dir = "/content/dataset_song1/raw"
mixed_dir = "/content/dataset_song1/mixed"
raw_files = sorted(glob.glob(os.path.join(raw_dir, "*.*")))
mixed_files = sorted(glob.glob(os.path.join(mixed_dir, "*.*")))
if not raw_files or not mixed_files:
    raise FileNotFoundError("Aucun fichier song1 dans " + raw_dir + " / " + mixed_dir)
raw_path = raw_files[0]
mixed_path = mixed_files[0]
raw_mono, sr = librosa.load(raw_path, sr=44100, mono=True)
ref_mix, _ = librosa.load(mixed_path, sr=44100, mono=False)
if ref_mix.ndim == 1:
    ref_mix = np.stack([ref_mix, ref_mix])
# Aligner la longueur sur le plus court
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
        tracks = torch.from_numpy(raw_seg).float().reshape(1, 1, 1, -1).to(device)
        ref_t = torch.from_numpy(ref_seg).float().unsqueeze(0).to(device)
        instrument_id = torch.tensor([0], dtype=torch.long, device=device)
        stereo_info = torch.tensor([0], dtype=torch.long, device=device)
        track_padding = torch.tensor([False], device=device)
        batch = (tracks, instrument_id, stereo_info, track_padding, ref_t, "song1")
        out = model.validation_step(batch, i)
        p = out.get("pred_mix_b_norm")
        if p is not None:
            preds.append(p.squeeze(0).cpu().numpy())
        if (i + 1) % 10 == 0:
            print(i + 1, "/", n_segments)

if not preds:
    print("Aucune sortie. Clés du dernier batch:", list(out.keys()) if out else "?")
else:
    pred_full = np.concatenate(preds, axis=1)
    if pred_full.ndim == 1:
        pred_full = np.stack([pred_full, pred_full])
    pred_full = pred_full[:, :min_len]
    import librosa
    pred_48 = librosa.resample(pred_full, orig_sr=44100, target_sr=SR_OUT)
    sf.write(OUT_PATH, pred_48.T, SR_OUT)
    print("OK Sortie (pleine longueur):", OUT_PATH, "durée", pred_48.shape[1] / SR_OUT, "s")
'''

with open("/content/inference_song1.py", "w") as f:
    f.write(script.strip())
print("OK Script écrit")
```

---

## Étape 3 – Lancer l’inférence

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
```

---

Résumé : **1** → **2** → **3**. Le fichier mixé sera dans Drive : `song1_mixed_output.wav`.
