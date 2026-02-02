# DeepAFx-ST: Listen to the creators' checkpoints (Colab)

Goal: run `process.py` with the **creators' pretrained checkpoints** and **example files**, then listen to the output.  
Colab’s default env (Python 3.12, new Lightning/torchaudio) doesn’t match the paper’s; these cells do what the creators say **plus** the minimal patches so it runs on Colab.

---

## Order: run cells 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

### Cell 1 — System deps (what they say: apt sox, libsndfile, ffmpeg, wget)

```python
!apt-get update -qq && apt-get install -y -qq sox libsndfile1 ffmpeg wget
print("OK")
```

---

### Cell 2 — Lightning 1.x (so their checkpoint loads without API breakage)

```python
!pip install "pytorch-lightning>=1.8,<2.0" -q
import pytorch_lightning as pl
print("Lightning:", pl.__version__)
```

---

### Cell 3 — Clone DeepAFx-ST (what they say)

```python
import os, shutil
%cd /content
DEEPAFX_ROOT = "/content/DeepAFx-ST"
if os.path.exists(DEEPAFX_ROOT):
    shutil.rmtree(DEEPAFX_ROOT)
!git clone https://github.com/adobe-research/DeepAFx-ST.git {DEEPAFX_ROOT}
print("Clone OK")
```

---

### Cell 4 — Patch setup.py (Colab only: torch/torchvision + drop torchopenl3/setuptools pin)

```python
import re, os
path = os.path.join(DEEPAFX_ROOT, "setup.py")
with open(path, "r") as f:
    c = f.read()
c = re.sub(r'(torch|torchaudio)\s*==\s*[\d.]+', r'\1>=2.0', c)
c = re.sub(r'torchvision\s*>=\s*2\.0', 'torchvision>=0.17', c)
c = re.sub(r'torchvision\s*==\s*[\d.]+', 'torchvision>=0.17', c)
c = re.sub(r'[^\n]*torchopenl3[^\n]*\n', '\n', c)
c = re.sub(r'[^\n]*setuptools\s*==\s*58\.2\.0[^\n]*\n', '\n', c)
with open(path, "w") as f:
    f.write(c)
# pyproject.toml if present
py = os.path.join(DEEPAFX_ROOT, "pyproject.toml")
if os.path.exists(py):
    with open(py, "r") as f:
        c = f.read()
    c = re.sub(r'torchvision\s*>=\s*2\.0', 'torchvision>=0.17', c)
    with open(py, "w") as f:
        f.write(c)
print("setup OK")
```

---

### Cell 5 — Install (what they say: pip install -e .)

```python
import shutil, glob
for d in ["build", "dist", "*.egg-info"]:
    for p in glob.glob(os.path.join(DEEPAFX_ROOT, d)):
        shutil.rmtree(p, ignore_errors=True)
!cd {DEEPAFX_ROOT} && pip install --upgrade pip -q && pip install --pre -e .
print("deepafx_st installed")
```

---

### Cell 6 — Download checkpoints + examples (what they say: wget ... | tar -xz)

```python
!wget -q https://github.com/adobe-research/DeepAFx-ST/releases/download/v0.1.0/checkpoints_and_examples.tar.gz -O /tmp/ckpt.tar.gz
!tar -xzf /tmp/ckpt.tar.gz -C {DEEPAFX_ROOT}
print("Checkpoints and examples OK")
```

---

### Cell 7 — Colab-only patches (so process.py actually runs)

Run this **once**. (1) Checkpoint load: `weights_only=False` in Lightning/lightning_fabric. (2) Audio load: use soundfile instead of torchaudio so TorchCodec is not needed.

```python
import os

# 1) weights_only=False (checkpoint has pickle objects like DSPMode)
import pytorch_lightning as pl
saving_path = os.path.join(os.path.dirname(pl.core.saving.__file__), "saving.py")
if os.path.exists(saving_path):
    with open(saving_path, "r") as f:
        c = f.read()
    c = c.replace("weights_only=True", "weights_only=False")
    if "weights_only=False" not in c:
        c = c.replace("torch.load(checkpoint_path, map_location=map_location)", "torch.load(checkpoint_path, map_location=map_location, weights_only=False)")
    with open(saving_path, "w") as f:
        f.write(c)
    print("saving.py OK")

import lightning_fabric.utilities.cloud_io as cloud_io
cloud_path = os.path.join(os.path.dirname(cloud_io.__file__), "cloud_io.py")
with open(cloud_path, "r") as f:
    c = f.read()
c = c.replace("torch.load(f, map_location=map_location)", "torch.load(f, map_location=map_location, weights_only=False)")
with open(cloud_path, "w") as f:
    f.write(c)
print("cloud_io.py OK")

# 2) Load and save audio with soundfile (avoids TorchCodec for load and save)
path = os.path.join(DEEPAFX_ROOT, "scripts", "process.py")
with open(path, "r") as f:
    c = f.read()
if "_load_audio" not in c:
    c = c.replace(
        "import torchaudio",
        "import torchaudio\nimport soundfile as sf\n\ndef _load_audio(p):\n    data, sr = sf.read(p, dtype=\"float32\")\n    if data.ndim == 1:\n        data = data.reshape(1, -1)\n    else:\n        data = data.T\n    return torch.tensor(data), sr"
    )
    c = c.replace("x, x_sr = torchaudio.load(args.input)", "x, x_sr = _load_audio(args.input)")
    c = c.replace("r, r_sr = torchaudio.load(args.reference)", "r, r_sr = _load_audio(args.reference)")
# Replace all torchaudio.save with soundfile.write (tensor (1, samples) -> (samples,) for mono)
c = c.replace(
    "torchaudio.save(out_filepath, y_hat.cpu().view(1, -1), 24000)",
    "sf.write(out_filepath, y_hat.cpu().view(1, -1).numpy().T.squeeze(), 24000)"
)
c = c.replace(
    "torchaudio.save(in_filepath, x_24000.cpu().view(1, -1), 24000)",
    "sf.write(in_filepath, x_24000.cpu().view(1, -1).numpy().T.squeeze(), 24000)"
)
# Replace any other torchaudio.save(filepath, tensor, 24000) pattern
import re
c = re.sub(
    r'torchaudio\.save\((\w+),\s*(\w+)\.cpu\(\)\.view\(1,\s*-\s*1\),\s*24000\)',
    r'sf.write(\1, \2.cpu().view(1, -1).numpy().T.squeeze(), 24000)',
    c
)
# Resample: .view(-1) can fail on non-contiguous tensor; use .reshape(-1)
c = c.replace("x.view(-1).numpy()", "x.reshape(-1).numpy()")
c = c.replace("r.view(-1).numpy()", "r.reshape(-1).numpy()")
with open(path, "w") as f:
    f.write(c)
print("process.py OK — run Cell 8")
```

---

### Cell 8 — Run process.py with creators’ example (so you can listen)

Uses **their** example files and **their** autodiff speech checkpoint. Output is written next to the input or in the script’s output path; you can download it from Colab and listen.

```python
# Creators' exact example: autodiff speech
INPUT  = os.path.join(DEEPAFX_ROOT, "examples", "voice_raw.wav")
REF    = os.path.join(DEEPAFX_ROOT, "examples", "voice_produced.wav")
CKPT   = os.path.join(DEEPAFX_ROOT, "checkpoints", "style", "libritts", "autodiff", "lightning_logs", "version_1", "checkpoints", "epoch=367-step=1226911-val-libritts-autodiff.ckpt")

!cd {DEEPAFX_ROOT} && python scripts/process.py -i {INPUT} -r {REF} -c {CKPT}
```

If the script prints an output path, open that file in Colab (Files panel) and play it. Otherwise check the current directory for a new `.wav` and download it to listen.

---

## If Cell 8 fails

- **Weights_only / UnpicklingError:** run Cell 7 again, then Cell 8.
- **TorchCodec / no module 'torchcodec':** in Cell 7, the soundfile fallback (replacing `torchaudio.load` with `_load_audio`) should be in place; if not, say what error you get and we can patch only the load calls.
- **Other error:** paste the full traceback and we fix the next step.

Once Cell 8 runs and you have a WAV, you’re listening to the creators’ checkpoints.
