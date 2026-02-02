# DeepAFx-ST Colab — tout comme les créateurs (copier-coller)

**Un seul doc.** Tu exécutes les cellules dans l’ordre. Comme les créateurs : sox, Lightning 1.x, clone propre, `setup.py` assoupli (torch seulement), install, données, entraînement. Aucun autre patch.

---

## Cell 1 — Deps système (comme le README)

```python
!apt-get update -qq && apt-get install -y -qq sox libsndfile1 ffmpeg wget
print("sox, libsndfile1, ffmpeg, wget installés")
```

---

## Cell 2 — Lightning 1.9.x (comme les créateurs)

```python
!pip install "pytorch-lightning>=1.8,<2.0" -q
import pytorch_lightning as pl
print("Lightning version:", pl.__version__)  # doit être 1.x
```

---

## Cell 3 — Drive + chemins

```python
from google.colab import drive
import os

drive.mount("/content/drive")
ZIP_PATH = "/content/drive/MyDrive/vocals_24k.zip"
DATASET_ZIP = "/content/drive/MyDrive/dataset.zip"
DATA_ROOT = "/content/data"
VOCALS_DIR = os.path.join(DATA_ROOT, "vocals_24k")
DEEPAFX_ROOT = "/content/DeepAFx-ST"
CKPT_SAVE_DIR = "/content/drive/MyDrive/deepafx_vocal_checkpoints"
os.makedirs(CKPT_SAVE_DIR, exist_ok=True)
print("Drive OK. DEEPAFX_ROOT =", DEEPAFX_ROOT)
```

---

## Cell 4 — Nettoyer + clone DeepAFx-ST

Important : remettre le répertoire courant sur `/content` avant de supprimer le repo, sinon le shell perd le cwd et le clone échoue.

```python
import shutil
%cd /content
if os.path.exists(DEEPAFX_ROOT):
    shutil.rmtree(DEEPAFX_ROOT)
!git clone https://github.com/adobe-research/DeepAFx-ST.git {DEEPAFX_ROOT}
print("Clone OK")
```

---

## Cell 5 — setup.py + pyproject.toml : assouplir deps (Colab Python 3.12)

- torchvision en **0.x** (0.17…) : corriger partout.
- **torchopenl3** tire **resampy** 0.2.x dont la build plante → retirer de `install_requires` (optionnel pour l’entraînement / process).
- **setuptools==58.2.0** peut bloquer → retirer ou assouplir.

```python
import re
import os

def fix_torchvision(s):
    s = re.sub(r'torchvision\s*>=\s*2\.0', 'torchvision>=0.17', s)
    s = re.sub(r'torchvision\s*==\s*[\d.]+', 'torchvision>=0.17', s)
    return s

# setup.py
setup_path = os.path.join(DEEPAFX_ROOT, "setup.py")
if os.path.exists(setup_path):
    with open(setup_path, "r") as f:
        c = f.read()
    c = re.sub(r'(torch|torchaudio)\s*==\s*[\d.]+', r'\1>=2.0', c)
    c = fix_torchvision(c)
    # Retirer torchopenl3 (resampy 0.2.x ne build pas) et setuptools==58.2.0 (ligne entière)
    c = re.sub(r'[^\n]*torchopenl3[^\n]*\n', '\n', c)
    c = re.sub(r'[^\n]*setuptools\s*==\s*58\.2\.0[^\n]*\n', '\n', c)
    with open(setup_path, "w") as f:
        f.write(c)
    print("setup.py OK")

# pyproject.toml (pip le lit en priorité)
pyproject_path = os.path.join(DEEPAFX_ROOT, "pyproject.toml")
if os.path.exists(pyproject_path):
    with open(pyproject_path, "r") as f:
        c = f.read()
    c = fix_torchvision(c)
    with open(pyproject_path, "w") as f:
        f.write(c)
    print("pyproject.toml OK")
else:
    print("pas de pyproject.toml (normal pour ce repo)")
```

---

## Cell 6 — Install deepafx_st

Enlever le cache de build (sinon pip peut réutiliser l’ancienne métadonnée avec torchvision>=2.0), puis installer.

```python
import shutil
import glob
for d in ["build", "dist", "*.egg-info"]:
    for p in glob.glob(os.path.join(DEEPAFX_ROOT, d)):
        shutil.rmtree(p, ignore_errors=True)
!cd {DEEPAFX_ROOT} && pip install --upgrade pip -q && pip install --pre -e .
print("deepafx_st installé")
```

---

## (Optionnel) Trouver ton ZIP sur Drive

Si **ZIP non trouvé** : soit le fichier n’est pas encore uploadé, soit il est dans un autre dossier. Exécute ça pour lister le contenu de ton Drive et adapter `ZIP_PATH` dans la Cell 3 (puis réexécuter la Cell 3 et la cellule données).

```python
import os
from google.colab import drive
drive.mount("/content/drive", force_remount=True)
# Lister la racine de My Drive
for f in sorted(os.listdir("/content/drive/MyDrive"))[:40]:
    print(f)
# Si ton ZIP est ailleurs, ex. "Colab/vocals_24k.zip", mets dans Cell 3 :
# ZIP_PATH = "/content/drive/MyDrive/Colab/vocals_24k.zip"
# Si tu as dataset.zip (raw + mixed), utilise la Cell 7b et DATASET_ZIP.
```

---

## Cell 7a — Données : vocals_24k.zip (déjà 24 kHz)

Si tu as uploadé `vocals_24k.zip` (un dossier de WAV 24 kHz) **à l’emplacement défini par `ZIP_PATH`** (Cell 3 = `/content/drive/MyDrive/vocals_24k.zip` par défaut) :

```python
import zipfile
os.makedirs(DATA_ROOT, exist_ok=True)
if not os.path.exists(ZIP_PATH):
    raise FileNotFoundError(f"ZIP non trouvé: {ZIP_PATH}. Mets vocals_24k.zip sur Drive.")
with zipfile.ZipFile(ZIP_PATH, "r") as z:
    z.extractall(DATA_ROOT)
if not os.path.isdir(VOCALS_DIR):
    os.makedirs(VOCALS_DIR, exist_ok=True)
    for f in os.listdir(DATA_ROOT):
        if f.endswith(".wav"):
            os.rename(os.path.join(DATA_ROOT, f), os.path.join(VOCALS_DIR, f))
n = len([f for f in os.listdir(VOCALS_DIR) if f.endswith(".wav")])
print(f"Fichiers WAV dans vocals_24k: {n}")
```

---

## Cell 7b — Données : dataset.zip (raw + mixed 48k → vocals_24k 24k)

À la place de 7a si ton ZIP contient `raw/` et `mixed/` (48k) :

```python
import zipfile
import glob
os.makedirs(DATA_ROOT, exist_ok=True)
if not os.path.exists(DATASET_ZIP):
    raise FileNotFoundError(f"ZIP non trouvé: {DATASET_ZIP}")
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
print(f"Fichiers écrits dans vocals_24k (24 kHz): {count}")
```

---

## Cell 8 — (Optionnel) Checkpoints pré-entraînés + patch weights_only

Seulement si tu veux **tester** les checkpoints fournis (LibriTTS / Jamendo) avant d’entraîner. Si une erreur pickle apparaît au chargement, exécute la deuxième partie.

```python
# Télécharger checkpoints + exemples
!wget -q https://github.com/adobe-research/DeepAFx-ST/releases/download/v0.1.0/checkpoints_and_examples.tar.gz -O /tmp/ckpt.tar.gz
!tar -xzf /tmp/ckpt.tar.gz -C {DEEPAFX_ROOT}
print("Checkpoints extraits dans", DEEPAFX_ROOT)
```

Si au lancement de `process.py` tu as une erreur du type `UnpicklingError` / `Weights only load failed` / `GLOBAL deepafx_st.utils.DSPMode`, exécute cette cellule **une fois** (le `torch.load` est dans **lightning_fabric**, pas seulement Lightning) :

```python
# Patch weights_only=False : pytorch_lightning ET lightning_fabric (cloud_io.py charge le checkpoint)
import os
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
print("cloud_io.py OK — relance process.py")
```

---

## Cell 9 — Lancer l’entraînement (comme les créateurs)

Commande = même structure que leur config (train_all_libritts_style), avec tes chemins et 1 GPU.

```python
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
    "--accelerator", "ddp",
    "--default_root_dir", default_root,
]
print(" ".join(cmd))
```

```python
import subprocess
proc = subprocess.run(cmd, cwd=DEEPAFX_ROOT, capture_output=True, text=True)
print(proc.stdout)
if proc.stderr:
    print("STDERR:", proc.stderr)
print("Code:", proc.returncode)
```

---

## Cell 10 — Copier le meilleur checkpoint sur Drive

À exécuter après l’entraînement.

```python
import glob
import shutil
log_dir = os.path.join(DEEPAFX_ROOT, "logs_style_vocal")
ckpts = glob.glob(os.path.join(log_dir, "lightning_logs", "version_*", "checkpoints", "*.ckpt"))
if not ckpts:
    print("Aucun checkpoint dans", log_dir)
else:
    val_ckpts = [c for c in ckpts if "val" in os.path.basename(c)]
    chosen = val_ckpts[-1] if val_ckpts else ckpts[-1]
    dest = os.path.join(CKPT_SAVE_DIR, "vocal_autodiff.ckpt")
    shutil.copy2(chosen, dest)
    print("Checkpoint copié:", chosen, "->", dest)
```

---

## Cell 11 — Tester les checkpoints pré-entraînés (process.py)

Remplace par ton vocal et ta ref. `-i` = input brut, `-r` = ref mixée, `-c` = checkpoint.

```python
# Exemple : checkpoint LibriTTS autodiff (speech)
CKPT = os.path.join(DEEPAFX_ROOT, "checkpoints", "style", "libritts", "autodiff", "lightning_logs", "version_1", "checkpoints", "epoch=367-step=1226911-val-libritts-autodiff.ckpt")
INPUT_WAV = "/content/ton_vocal_raw.wav"
REF_WAV = "/content/ta_ref_mixee.wav"
!cd {DEEPAFX_ROOT} && python scripts/process.py -i {INPUT_WAV} -r {REF_WAV} -c {CKPT}
```

---

## Cell 12 — Inférence avec ton checkpoint entraîné

```python
MY_CKPT = os.path.join(CKPT_SAVE_DIR, "vocal_autodiff.ckpt")
INPUT_WAV = "/content/ton_vocal_raw.wav"
REF_WAV = "/content/ta_ref_mixee.wav"
!cd {DEEPAFX_ROOT} && python scripts/process.py -i {INPUT_WAV} -r {REF_WAV} -c {MY_CKPT}
```

---

## Récap ordre des cellules

| Ordre | Cellule | Rôle |
|-------|---------|------|
| 1 | Deps système | sox, libsndfile1, ffmpeg, wget |
| 2 | Lightning 1.9.x | Pas de Lightning 2.x, pas de patches train_style/system/audio/callbacks |
| 3 | Drive + chemins | ZIP_PATH, DATA_ROOT, DEEPAFX_ROOT, etc. |
| 4 | Clone | Nettoyer + clone DeepAFx-ST |
| 5 | setup.py | torch/torchaudio/torchvision >=2.0 |
| 6 | Install | pip install -e . dans DeepAFx-ST |
| 7a ou 7b | Données | vocals_24k.zip **ou** dataset.zip → vocals_24k 24k |
| 8 | (Optionnel) Checkpoints + weights_only | Si tu testes les pré-entraînés et erreur pickle |
| 9 | Entraînement | train_style.py comme les créateurs |
| 10 | Copie ckpt | Meilleur .ckpt → Drive |
| 11 | Test pré-entraînés | process.py avec checkpoint LibriTTS/Jamendo |
| 12 | Inférence ton ckpt | process.py avec vocal_autodiff.ckpt |

C’est tout. Comme les créateurs : sox, Lightning 1.x, clone, setup assoupli, install, données, train. Rien d’autre.
