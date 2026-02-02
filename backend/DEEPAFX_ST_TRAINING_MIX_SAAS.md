# DeepAFx-ST: Training cycle for your mix SaaS

One flow: prep data from your `dataset.zip` → train → save checkpoint → run inference with your checkpoint. No extra complexity.

**Prerequisite:** You already ran the "test checkpoints" setup (cells 1–6 + Cell 7 patches from `DEEPAFX_ST_TEST_CHECKPOINTS_COLAB.md`). So you have: DeepAFx-ST cloned, Lightning 1.x, `pip install -e .`, and `process.py` patched (weights_only + soundfile load/save + reshape). If not, run those first.

---

## Order: 1 → 2 → 3 → 4 → 5

---

### Cell 1 — Paths and data root

```python
import os
from google.colab import drive
drive.mount("/content/drive")

DEEPAFX_ROOT = "/content/DeepAFx-ST"
DATA_ROOT = "/content/data"
VOCALS_DIR = os.path.join(DATA_ROOT, "vocals_24k")
DATASET_ZIP = "/content/drive/MyDrive/dataset.zip"
CKPT_SAVE_DIR = "/content/drive/MyDrive/deepafx_vocal_checkpoints"
os.makedirs(CKPT_SAVE_DIR, exist_ok=True)
print("Paths OK. DATASET_ZIP =", DATASET_ZIP)
```

---

### Cell 2 — Build vocals_24k from dataset.zip (raw + mixed → 24 kHz)

```python
import zipfile
import glob
os.makedirs(DATA_ROOT, exist_ok=True)
if not os.path.exists(DATASET_ZIP):
    raise FileNotFoundError(f"Put dataset.zip on Drive: {DATASET_ZIP}")
with zipfile.ZipFile(DATASET_ZIP, "r") as z:
    z.extractall(DATA_ROOT)

raw_dir = os.path.join(DATA_ROOT, "raw") if os.path.isdir(os.path.join(DATA_ROOT, "raw")) else os.path.join(DATA_ROOT, "dataset", "raw")
mixed_dir = os.path.join(DATA_ROOT, "mixed") if os.path.isdir(os.path.join(DATA_ROOT, "mixed")) else os.path.join(DATA_ROOT, "dataset", "mixed")
if not os.path.isdir(raw_dir):
    raw_dir = None
if not os.path.isdir(mixed_dir):
    mixed_dir = None

os.makedirs(VOCALS_DIR, exist_ok=True)
try:
    import soundfile as sf
    import resampy
except ImportError:
    !pip install soundfile resampy -q
    import soundfile as sf
    import resampy

target_sr = 24000
count = 0
for folder in [raw_dir, mixed_dir]:
    if folder is None:
        continue
    for path in glob.glob(os.path.join(folder, "*.wav")):
        x, sr = sf.read(path)
        if x.ndim > 1:
            x = x.mean(axis=1)
        if sr != target_sr:
            x = resampy.resample(x, sr, target_sr, axis=0)
        out_name = os.path.basename(path).replace(".wav", "") + "_" + os.path.basename(folder) + ".wav"
        sf.write(os.path.join(VOCALS_DIR, out_name), x, target_sr)
        count += 1
print(f"Wrote {count} files to vocals_24k (24 kHz)")
```

---

### Cell 2b — Patch train_style.py (DDPPlugin deprecated in Lightning 1.8+)

Run **once** before Cell 3. Replaces `DDPPlugin` with `strategy="ddp"`.

```python
import os
path = os.path.join(DEEPAFX_ROOT, "scripts", "train_style.py")
with open(path, "r") as f:
    c = f.read()
# Remove DDPPlugin import
c = c.replace("from pytorch_lightning.plugins import DDPPlugin\n", "")
c = c.replace("from pytorch_lightning.plugins import DDPPlugin", "")
# Replace plugins=DDPPlugin(...) with strategy="ddp"
c = c.replace("plugins=DDPPlugin(find_unused_parameters=False),", "strategy=\"ddp\",")
c = c.replace("plugins=[DDPPlugin(find_unused_parameters=False)],", "strategy=\"ddp\",")
with open(path, "w") as f:
    f.write(c)
print("train_style.py patched (DDPPlugin -> strategy=ddp). Run Cell 3.")
```

---

### Cell 2c — Save checkpoints every epoch + enable resume

Run **once** before Cell 3. Adds a callback that saves `last.ckpt` every epoch so you can resume after a crash. Adds `--resume_from_checkpoint` so you can restart from that file.

```python
import os
path = os.path.join(DEEPAFX_ROOT, "scripts", "train_style.py")
with open(path, "r") as f:
    c = f.read()
# Add ModelCheckpoint that saves last.ckpt every epoch
old = """ pl.callbacks.ModelCheckpoint(
 monitor=args.val_monitor,
 filename="{epoch}-{step}-val-" + f"{dataset_name}-{args.processor_model}",
 ),
 CopyPretrainedCheckpoints(),"""
new = """ pl.callbacks.ModelCheckpoint(
 monitor=args.val_monitor,
 filename="{epoch}-{step}-val-" + f"{dataset_name}-{args.processor_model}",
 ),
 pl.callbacks.ModelCheckpoint(save_last=True, every_n_epochs=1),
 CopyPretrainedCheckpoints(),"""
if "save_last=True" not in c:
    c = c.replace(old, new)
# Add --resume_from_checkpoint arg
if "resume_from_checkpoint" not in c:
    c = c.replace(
        "parser = System.add_model_specific_args(parser)\n\n # parse them args",
        "parser = System.add_model_specific_args(parser)\n parser.add_argument(\"--resume_from_checkpoint\", type=str, default=None)\n\n # parse them args"
    )
# Pass ckpt_path to fit()
c = c.replace("trainer.fit(system)", "trainer.fit(system, ckpt_path=args.resume_from_checkpoint)")
with open(path, "w") as f:
    f.write(c)
print("train_style.py patched (save every epoch + resume). Run Cell 3.")
```

---

### Cell 2d — Patch system.py (ReduceLROnPlateau: remove deprecated `verbose`)

Run **once** before Cell 3. PyTorch 2.x removed the `verbose` argument from `ReduceLROnPlateau`.

```python
import os
path = os.path.join(DEEPAFX_ROOT, "deepafx_st", "system.py")
with open(path, "r") as f:
    c = f.read()
# Remove verbose=True or verbose=False from ReduceLROnPlateau
import re
c = re.sub(r",\s*verbose\s*=\s*(True|False)", "", c)
with open(path, "w") as f:
    f.write(c)
print("system.py patched (ReduceLROnPlateau verbose removed). Run Cell 3.")
```

---

### Cell 2e — Patch audio.py (torchaudio.info + torchaudio.load → soundfile)

Run **once** before Cell 3. Training uses `torchaudio.info` (metadata) and `torchaudio.load` (load); both hit TorchCodec. Use `soundfile` for both.

```python
import os
path = os.path.join(DEEPAFX_ROOT, "deepafx_st", "data", "audio.py")
with open(path, "r") as f:
    c = f.read()
# 1) Add soundfile import
if "import soundfile" not in c:
    c = c.replace("import torchaudio", "import torchaudio\nimport soundfile as sf")
# 2) Replace torchaudio.info with soundfile (metadata). Use same indent as next line (1 space in repo).
if "metadata = torchaudio.info(filepath)" in c:
    c = c.replace(
        "metadata = torchaudio.info(filepath)",
        "_sf_info = sf.info(filepath)\n _m = type('_M', (), {})()\n _m.sample_rate = _sf_info.samplerate\n _m.num_frames = _sf_info.frames\n _m.num_channels = _sf_info.channels\n metadata = _m"
    )
# 3) Replace torchaudio.load in load() with soundfile (DataLoader workers need this)
if "torchaudio.load(self.filepath" in c:
    c = c.replace(
        "audio, sr = torchaudio.load(self.filepath, normalize=True)",
        "data, sr = sf.read(self.filepath, dtype='float32'); audio = torch.from_numpy(data.T if data.ndim > 1 else data.reshape(1, -1)).float(); self.sample_rate = sr"
    )
with open(path, "w") as f:
    f.write(c)
print("audio.py patched (info + load -> soundfile). Run Cell 3.")
```

If you already patched and got **IndentationError**, run this (reapplies block with consistent indent):

```python
import os
path = os.path.join(DEEPAFX_ROOT, "deepafx_st", "data", "audio.py")
with open(path, "r") as f:
    lines = f.readlines()
out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "_sf_info = sf.info(filepath)" in line:
        prefix = line[: len(line) - len(line.lstrip())]
        out.append(prefix + "_sf_info = sf.info(filepath)\n")
        out.append(prefix + "_m = type('_M', (), {})()\n")
        out.append(prefix + "_m.sample_rate = _sf_info.samplerate\n")
        out.append(prefix + "_m.num_frames = _sf_info.frames\n")
        out.append(prefix + "_m.num_channels = _sf_info.channels\n")
        out.append(prefix + "metadata = _m\n")
        i += 1
        while i < len(lines) and ("_m = type" in lines[i] or "_m.sample_rate" in lines[i] or "_m.num_frames" in lines[i] or "_m.num_channels" in lines[i] or (lines[i].strip() == "metadata = _m" and i > 0)):
            i += 1
        continue
    out.append(line)
    i += 1
with open(path, "w") as f:
    f.writelines(out)
print("audio.py indent fixed. Run Cell 3 again.")
```

---

### Cell 2f — Patch augmentations.py (torchaudio.sox_effects → sox CLI fallback)

Run **once** before Cell 3. Colab’s torchaudio has no `sox_effects`; augmentations (e.g. `frequency_corruption`) then fail. This adds a helper that uses the `sox` CLI when `torchaudio.sox_effects` is missing.

```python
import os
path = os.path.join(DEEPAFX_ROOT, "deepafx_st", "data", "augmentations.py")
with open(path, "r") as f:
    c = f.read()

# 1) Add imports and apply_effects_tensor helper after "import numpy as np"
old_imports = "import torch\nimport torchaudio\nimport numpy as np\n\n\ndef gain"
helper = '''import torch
import torchaudio
import numpy as np
import os
import tempfile
import subprocess
import soundfile as sf


def _apply_effects_sox_cli(x, sr, effects, channels_first=True):
    """Fallback when torchaudio.sox_effects is not available (e.g. Colab)."""
    suffix = ".wav"
    fd, in_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    out_path = in_path.replace(suffix, "_out" + suffix)
    try:
        x_np = x.squeeze(0).numpy() if x.dim() > 1 else x.numpy()
        sf.write(in_path, x_np, sr)
        flat = []
        for cmd in effects:
            flat.extend(cmd)
        subprocess.run(["sox", in_path, out_path] + flat, check=True, capture_output=True)
        data, sr_out = sf.read(out_path, dtype="float32")
        y = torch.from_numpy(data).float()
        if y.dim() == 1:
            y = y.unsqueeze(0)
        return y, sr_out
    finally:
        if os.path.exists(in_path):
            os.remove(in_path)
        if os.path.exists(out_path):
            os.remove(out_path)


def apply_effects_tensor(x, sr, effects, channels_first=True):
    sox_effects = getattr(torchaudio, "sox_effects", None)
    if sox_effects is not None:
        return sox_effects.apply_effects_tensor(x, sr, effects, channels_first=channels_first)
    return _apply_effects_sox_cli(x, sr, effects, channels_first=channels_first)


def gain'''

if "def apply_effects_tensor" not in c:
    # Anchor: block before "def gain" (allow one or two newlines)
    for sep in ("\n\n\ndef gain", "\n\ndef gain"):
        old = "import torch\nimport torchaudio\nimport numpy as np" + sep
        if old in c:
            c = c.replace(old, helper)
            break
    # 2) Use our helper instead of torchaudio.sox_effects.apply_effects_tensor
    c = c.replace("torchaudio.sox_effects.apply_effects_tensor(", "apply_effects_tensor(")
    with open(path, "w") as f:
        f.write(c)
    print("augmentations.py patched (sox_effects -> sox CLI fallback). Run Cell 3.")
else:
    print("augmentations.py already patched. Run Cell 3.")
```

---

### Cell 3 — Start training (autodiff, 1 GPU)

```python
import os
import subprocess

default_root = os.path.join(DEEPAFX_ROOT, "logs_style_vocal")
cmd = [
    "python", os.path.join(DEEPAFX_ROOT, "scripts", "train_style.py"),
    "--processor_model", "autodiff",
    "--gpus", "1",
    "--audio_dir", DATA_ROOT,
    "--input_dirs", "vocals_24k",
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
    "--accelerator", "gpu",
    "--default_root_dir", default_root,
]
print(" ".join(cmd))
```

```python
proc = subprocess.run(cmd, cwd=DEEPAFX_ROOT, capture_output=True, text=True)
print(proc.stdout)
if proc.stderr:
    print("STDERR:", proc.stderr)
print("Return code:", proc.returncode)
```

Training runs in the background of the cell. Checkpoints are saved every epoch under `logs_style_vocal/lightning_logs/version_*/checkpoints/` (including `last.ckpt`).

**Resume after a crash:** Re-run Cell 1 (paths), then run the same command with `--resume_from_checkpoint` set to the last checkpoint. Example (run in a cell):

```python
RESUME_CKPT = "/content/DeepAFx-ST/logs_style_vocal/lightning_logs/version_0/checkpoints/last.ckpt"
cmd_resume = cmd + ["--resume_from_checkpoint", RESUME_CKPT]
# Only if the file exists
import os
if os.path.exists(RESUME_CKPT):
    import subprocess
    subprocess.run(cmd_resume, cwd=DEEPAFX_ROOT, capture_output=True, text=True)
else:
    print("No last.ckpt yet. Run full training first.")
```

Use the path that exists (e.g. `version_0` or `version_1`). After training, run Cell 4 to copy the best checkpoint to Drive.

---

### Cell 4 — Copy best checkpoint to Drive

Run after training has produced checkpoints.

```python
import glob
import shutil
log_dir = os.path.join(DEEPAFX_ROOT, "logs_style_vocal")
ckpts = glob.glob(os.path.join(log_dir, "lightning_logs", "version_*", "checkpoints", "*.ckpt"))
if not ckpts:
    print("No checkpoints in", log_dir)
else:
    val_ckpts = [c for c in ckpts if "val" in os.path.basename(c)]
    chosen = val_ckpts[-1] if val_ckpts else ckpts[-1]
    dest = os.path.join(CKPT_SAVE_DIR, "vocal_autodiff.ckpt")
    shutil.copy2(chosen, dest)
    print("Copied:", chosen, "->", dest)
```

---

### Cell 5 — Inference with your checkpoint (for your mix SaaS)

Use your saved checkpoint and your own input/ref.

```python
INPUT_WAV = "/content/drive/MyDrive/ton_input.wav"
REF_WAV   = "/content/drive/MyDrive/ta_ref.wav"
MY_CKPT   = os.path.join(CKPT_SAVE_DIR, "vocal_autodiff.ckpt")

!cd {DEEPAFX_ROOT} && python scripts/process.py -i {INPUT_WAV} -r {REF_WAV} -c {MY_CKPT}
```

Output WAV path is printed by the script (e.g. next to input or in `examples/`). Use that file in your SaaS (e.g. serve it or pass the path to your API).

---

## Summary

| Step | What it does |
|------|----------------|
| 1 | Mount Drive, set paths, create `CKPT_SAVE_DIR` |
| 2 | Extract `dataset.zip`, build `vocals_24k` at 24 kHz from raw + mixed |
| 3 | Train DeepAFx-ST (autodiff, 1 GPU) on `vocals_24k` |
| 4 | Copy best checkpoint to Drive as `vocal_autodiff.ckpt` |
| 5 | Run `process.py` with your input, ref, and `vocal_autodiff.ckpt` for your mix SaaS |

If training fails (e.g. `add_argparse_args` or DDP), you’re likely on Lightning 2.x. In that case either re-run the test-checkpoints setup with Lightning 1.x (Cell 2 of the test doc), or we can add a small `train_style.py` patch for Lightning 2.x.
