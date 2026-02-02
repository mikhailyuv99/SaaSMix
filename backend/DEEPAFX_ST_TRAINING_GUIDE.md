# DeepAFx-ST : entraîner sur tes vocaux (Colab)

Objectif : **entraîner** DeepAFx-ST en **self-supervised** sur tes 222 vocaux (sans paires raw/mixed), récupérer un checkpoint, puis l’utiliser pour l’inférence (vocal + ref → WAV mixé) et éventuellement le brancher en API SaaS.

---

## 1. Pourquoi entraîner ?

- Les modèles pré-entraînés (LibriTTS, Jamendo) sont faits pour parole/musique générique. Sur du **chant produit**, le rendu peut être “bizarre” (sons étranges, pas de voix claire).
- En entraînant sur **tes** vocaux (raw, mixed, ou les deux), le modèle apprend des styles plus proches de ta production.
- **Self-supervised** = pas besoin de paires (raw, mixed). Un seul dossier de WAV suffit : le modèle génère des paires synthétiques en appliquant des effets aléatoires (EQ + compresseur) à chaque extrait.

### Important : pas de paires (raw → mixed)

DeepAFx-ST **ne s’entraîne pas** avec des couples (raw, mixed). Il n’utilise pas la correspondance entre tes fichiers raw et mixed. Il a juste besoin d’un **pool d’audio** (n’importe quels WAV) pour tirer des segments et appliquer des effets aléatoires. Donc si tu as déjà un dossier `dataset/` avec `raw/` et `mixed/` (ex. 48 kHz mono), tu peux **tout mettre dans un seul dossier** (raw + mixed mélangés), resample en 24 kHz, et lancer l’entraînement — les paires ne sont pas utilisées, seul le contenu audio compte.

---

## 2. Format des données

### Ce dont tu as besoin

- **Un dossier de WAV** : tes 222 vocaux (raw, mixed, ou les deux mélangés). Pas besoin de deux dossiers séparés.
- **Format** : WAV, **mono**, **24 kHz** (obligatoire pour DeepAFx-ST).
- **Durée minimale par fichier** : au moins **~11 secondes** (262 144 échantillons à 24 kHz). Les fichiers plus courts sont **ignorés** par le dataloader.  
  - Si beaucoup de tes fichiers sont plus courts, on peut réduire la longueur d’entraînement (voir plus bas) pour accepter ~5,5 s.

### Structure attendue sur Colab

À la fin de la préparation, Colab doit voir :

```
/content/data/
  vocals_24k/
    fichier1.wav
    fichier2.wav
    ...
```

Donc : `audio_dir` = `/content/data`, `input_dirs` = `["vocals_24k"]`.

---

## 3. Préparer les données sur ton PC (avant Colab)

### Option A : Tes WAV sont déjà en 24 kHz mono

1. Crée un dossier, ex. `vocals_24k`.
2. Copie dedans **tous** tes vocaux (raw et/ou mixed) qui font **≥ 11 secondes**.
3. Compresse en ZIP : `vocals_24k.zip` (contenu = le dossier `vocals_24k` avec les .wav dedans).
4. Upload `vocals_24k.zip` sur Google Drive (ex. `My Drive/vocals_24k.zip`).

### Option B : Tu as déjà dataset/raw et dataset/mixed (ex. 48 kHz mono)

Comme DeepAFx-ST ne utilise pas les paires, tu peux :

1. **Sur ton PC** : copier **tous** les WAV de `dataset/raw/` et `dataset/mixed/` dans un seul dossier (ex. `vocals_24k`), puis resample 48k → 24k mono (FFmpeg, script Python, etc.). ZIP ce dossier et upload sur Drive.
2. **Ou en Colab** : uploader ton `dataset.zip` (contenant `raw/` et `mixed/`), puis une cellule peut fusionner raw + mixed, resample 48k → 24k, et remplir `vocals_24k/` automatiquement (voir Cell 6 bis ci-dessous).

Exemple FFmpeg (48k → 24k mono) :
```powershell
ffmpeg -i input.wav -ar 24000 -ac 1 output.wav
```

### Option C : Autre sample rate (44,1 kHz, stéréo, MP3)

Convertis d’abord en 24 kHz mono (script local ou FFmpeg), puis un dossier `vocals_24k` avec les .wav, ZIP, upload sur Drive.

---

## 4. Colab : setup (clone + install)

Exécute les cellules **dans l’ordre**.

### Cell 1 : Drive + chemins

```python
from google.colab import drive
import os

drive.mount("/content/drive")
# Chemin du ZIP sur ton Drive
ZIP_PATH = "/content/drive/MyDrive/vocals_24k.zip"
DATA_ROOT = "/content/data"
VOCALS_DIR = os.path.join(DATA_ROOT, "vocals_24k")
DEEPAFX_ROOT = "/content/DeepAFx-ST"
print("Drive OK. ZIP_PATH =", ZIP_PATH)
```

### Cell 2 : Nettoyer un éventuel clone précédent

```python
import shutil
if os.path.exists(DEEPAFX_ROOT):
    shutil.rmtree(DEEPAFX_ROOT)
print("Nettoyé:", DEEPAFX_ROOT)
```

### Cell 3 : Clone DeepAFx-ST

```python
!git clone https://github.com/adobe-research/DeepAFx-ST.git {DEEPAFX_ROOT}
!ls {DEEPAFX_ROOT}
```

### Cell 4 : Assouplir les versions dans setup.py (éviter erreurs Colab Python 3.12)

Le `setup.py` impose des versions strictes (torch==…). On les remplace par des versions minimales pour que pip trouve des binaires compatibles.

```python
setup_py = os.path.join(DEEPAFX_ROOT, "setup.py")
with open(setup_py, "r") as f:
    content = f.read()
# Remplacer ==X.Y.Z par >=X.Y pour torch, torchaudio, torchvision
import re
content = re.sub(r'(torch|torchaudio|torchvision)\s*==\s*[\d.]+', r'\1>=2.0', content)
with open(setup_py, "w") as f:
    f.write(content)
print("setup.py patché (versions assouplies)")
```

### Cell 5 : Installer deepafx_st

```python
!cd {DEEPAFX_ROOT} && pip install --upgrade pip && pip install --pre -e .
```

Si une erreur persiste sur torch/torchaudio, installe d’abord PyTorch depuis le site (CUDA 12.1 ou 11.8 selon la Colab), puis refais `pip install --pre -e .` dans `DEEPAFX_ROOT`.

### Cell 6 : Extraire les données (vocaux)

**Si tu as uploadé `vocals_24k.zip`** (un seul dossier déjà en 24 kHz) :

```python
import zipfile

os.makedirs(DATA_ROOT, exist_ok=True)
if not os.path.exists(ZIP_PATH):
    raise FileNotFoundError(f"ZIP non trouvé: {ZIP_PATH}. Mets vocals_24k.zip sur Drive.")
with zipfile.ZipFile(ZIP_PATH, "r") as z:
    z.extractall(DATA_ROOT)
# Si le ZIP contient directement des .wav (sans sous-dossier vocals_24k)
if not os.path.isdir(VOCALS_DIR):
    os.makedirs(VOCALS_DIR, exist_ok=True)
    for f in os.listdir(DATA_ROOT):
        if f.endswith(".wav"):
            os.rename(os.path.join(DATA_ROOT, f), os.path.join(VOCALS_DIR, f))
else:
    pass  # déjà vocals_24k/
n = len([f for f in os.listdir(VOCALS_DIR) if f.endswith(".wav")])
print(f"Fichiers WAV dans vocals_24k: {n}")
```

**Si tu as ton `dataset.zip` avec raw/ et mixed/ (48k mono)** → utilise **Cell 6 bis** à la place.

### Cell 6 bis : Partir de dataset/raw + dataset/mixed (48k) → vocals_24k (24k)

À utiliser à la place de la Cell 6 si ton ZIP contient `dataset/raw/` et `dataset/mixed/`. Les paires ne sont pas utilisées : on fusionne tout et on resample en 24 kHz.

```python
import zipfile
import glob

# Chemin de ton dataset.zip sur Drive (raw + mixed)
DATASET_ZIP = "/content/drive/MyDrive/dataset.zip"
DATA_ROOT = "/content/data"
VOCALS_DIR = os.path.join(DATA_ROOT, "vocals_24k")

os.makedirs(DATA_ROOT, exist_ok=True)
if not os.path.exists(DATASET_ZIP):
    raise FileNotFoundError(f"ZIP non trouvé: {DATASET_ZIP}")
with zipfile.ZipFile(DATASET_ZIP, "r") as z:
    z.extractall(DATA_ROOT)
# Repérer raw/ et mixed/ (peut être dataset/raw ou directement raw/)
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
        out_path = os.path.join(VOCALS_DIR, out_name)
        sf.write(out_path, x, target_sr)
        count += 1
print(f"Fichiers écrits dans vocals_24k (24 kHz): {count}")
```

---

## 5. Colab : entraînement (un seul modèle : autodiff)

On entraîne **un** modèle (autodiff = pas besoin de proxies pré-entraînés). Un seul GPU suffit.

### Cell 6b : Patch train_style.py pour PyTorch Lightning 2.x (obligatoire)

Sous Lightning 2.0+, `Trainer.add_argparse_args` et `Trainer.from_argparse_args` n'existent plus. Exécute **une fois** cette cellule avant de lancer l'entraînement.

```python
# Patch train_style.py pour PyTorch Lightning 2.x
path = "/content/DeepAFx-ST/scripts/train_style.py"
with open(path, "r") as f:
    content = f.read()

content = content.replace(" parser = pl.Trainer.add_argparse_args(parser)\n", "")
content = content.replace(" parser = pl.Trainer.add_argparse_args(parser)", "")

old = """ parser = ArgumentParser()

 # add all the available trainer and system options to argparse"""
new = """ parser = ArgumentParser()
 parser.add_argument("--max_epochs", type=int, default=100)
 parser.add_argument("--accelerator", type=str, default="gpu")
 parser.add_argument("--devices", type=int, default=1)
 parser.add_argument("--gpus", type=int, default=None, help="legacy")
 parser.add_argument("--default_root_dir", type=str, default=None)
 parser.add_argument("--gradient_clip_val", type=float, default=None)
 parser = System.add_model_specific_args(parser)"""
content = content.replace(old, new)
content = content.replace(
    " parser = System.add_model_specific_args(parser)\n parser = System.add_model_specific_args(parser)",
    " parser = System.add_model_specific_args(parser)"
)

old_trainer = """ # create PyTorch Lightning trainer
 trainer = pl.Trainer.from_argparse_args(
 args,
 callbacks=callbacks,
 plugins=DDPPlugin(find_unused_parameters=False),
 )"""
new_trainer = """ # create PyTorch Lightning trainer
 _devices = args.devices if getattr(args, 'gpus', None) is None else args.gpus
 trainer = pl.Trainer(
  max_epochs=args.max_epochs,
  accelerator=args.accelerator,
  devices=_devices,
  default_root_dir=args.default_root_dir,
  gradient_clip_val=args.gradient_clip_val,
  callbacks=callbacks,
  plugins=[DDPPlugin(find_unused_parameters=False)],
 )"""
content = content.replace(old_trainer, new_trainer)

with open(path, "w") as f:
    f.write(content)
print("train_style.py patché pour Lightning 2.x")
```

### Cell 7 : Lancer l’entraînement

Tu peux réduire `train_length` pour garder des fichiers plus courts (ex. 65536 → segment ~5,5 s par moitié). Ici on garde 131072 comme le script officiel ; adapte si tu as beaucoup de fichiers < 11 s.

```python
import os
DEEPAFX_ROOT = "/content/DeepAFx-ST"
DATA_ROOT = "/content/data"
VOCALS_DIR_NAME = "vocals_24k"
CKPT_SAVE_DIR = "/content/drive/MyDrive/deepafx_vocal_checkpoints"
os.makedirs(CKPT_SAVE_DIR, exist_ok=True)

# Répertoire des logs Lightning (optionnel : à l’intérieur de DeepAFx pour éviter les chemins longs)
default_root = os.path.join(DEEPAFX_ROOT, "logs_style_vocal")

cmd = [
    "python", os.path.join(DEEPAFX_ROOT, "scripts", "train_style.py"),
    "--processor_model", "autodiff",
    "--gpus", "1",
    "--audio_dir", DATA_ROOT,
    "--input_dirs", VOCALS_DIR_NAME,
    "--style_transfer",
    "--buffer_size_gb", "0.5",
    "--buffer_reload_rate", "500",
    "--train_frac", "0.9",
    "--freq_corrupt",
    "--drc_corrupt",
    "--sample_rate", "24000",
    "--train_length", "131072",
    "--train_examples_per_epoch", "5000",
    "--val_length", "131072",
    "--val_examples_per_epoch", "100",
    "--random_scale_input",
    "--encoder_model", "efficient_net",
    "--encoder_embed_dim", "1024",
    "--encoder_width_mult", "1",
    "--recon_losses", "mrstft", "l1",
    "--recon_loss_weight", "1.0", "100.0",
    "--lr", "1e-4",
    "--num_workers", "2",
    "--batch_size", "4",
    "--gradient_clip_val", "4.0",
    "--max_epochs", "100",
    "--accelerator", "gpu",
    "--devices", "1",
    "--default_root_dir", default_root,
]
print(" ".join(cmd))
```

```python
import subprocess
proc = subprocess.run(cmd, cwd=DEEPAFX_ROOT)
if proc.returncode != 0:
    print("Erreur entraînement:", proc.returncode)
```

### Cell 8 : Copier le meilleur checkpoint sur Drive

À exécuter **après** l’entraînement (ou en fin de run). Les checkpoints sont dans `default_root_dir` (sous-dossiers Lightning `lightning_logs/version_0/checkpoints/`).

```python
import glob
import shutil

log_dir = os.path.join(DEEPAFX_ROOT, "logs_style_vocal")
ckpts = glob.glob(os.path.join(log_dir, "lightning_logs", "version_*", "checkpoints", "*.ckpt"))
if not ckpts:
    print("Aucun checkpoint trouvé dans", log_dir)
else:
    # Prendre le dernier ou celui avec "val" dans le nom
    val_ckpts = [c for c in ckpts if "val" in os.path.basename(c)]
    chosen = val_ckpts[-1] if val_ckpts else ckpts[-1]
    dest = os.path.join(CKPT_SAVE_DIR, "vocal_autodiff.ckpt")
    shutil.copy2(chosen, dest)
    print("Checkpoint copié:", chosen, "->", dest)
```

---

## 6. Inférence avec le checkpoint entraîné

### Correctifs éventuels sur `process.py` (Colab / Python 3.12)

Si `process.py` plante :

- **`torch.load(..., weights_only=True)`** → `UnpicklingError` : dans `scripts/process.py`, remplacer tout `torch.load(...)` par `torch.load(..., weights_only=False)`.
- **`torchaudio.load` / `torchaudio.save`** → erreur backend (torchcodec) : remplacer par `soundfile.read` / `soundfile.write` (et `pip install soundfile` si besoin).

Ces correctifs sont les mêmes que pour l’inférence avec les checkpoints pré-entraînés (voir tes notes Colab précédentes).

### Sur Colab (après entraînement)

- **Input** : ton vocal brut (WAV).
- **Reference** : un vocal déjà mixé (style cible), ex. un de tes 222 mixed.
- **Checkpoint** : `vocal_autodiff.ckpt` sur Drive (ou le chemin dans `logs_style_vocal/...`).

Le script officiel `scripts/process.py` peut ne traiter qu’un **segment** (ex. 5 s). Pour une **inférence pleine longueur**, deux options :

1. **Boucle par chunks** : découper le WAV en segments, lancer `process.py` sur chaque segment (ou appeler le modèle en Python), recoller les WAV.
2. **Patcher `process.py`** : modifier le script pour qu’il lise tout le fichier et écrive toute la sortie (sans tronquer à une longueur fixe).

Commande de base (segment uniquement) :

```bash
cd /content/DeepAFx-ST
python scripts/process.py -i ton_vocal.wav -r ta_ref_mixee.wav -c /content/drive/MyDrive/deepafx_vocal_checkpoints/vocal_autodiff.ckpt
```

La sortie est en général à côté de l’input ou dans un dossier de sortie (vérifier la doc du script).

### Pleine longueur (idée)

En Python, après avoir chargé le modèle depuis le checkpoint :

- Découper l’audio en chunks de la longueur attendue par le modèle (ex. 131072 échantillons), avec overlap optionnel.
- Pour chaque chunk : forward (input_chunk, ref_chunk ou ref_global) → out_chunk.
- Recoller les chunks (avec fenêtre de recouvrement si besoin) et sauver le WAV.

Tu peux t’inspirer du flux déjà décrit dans tes docs d’inférence DeepAFx-ST en remplaçant le modèle par ton checkpoint DeepAFx-ST.

---

## 7. Intégration SaaS (résumé)

Une fois que le rendu te convient :

1. **Inférence fiable** : script ou fonction qui prend (vocal_wav, ref_wav, checkpoint_path) et renvoie un WAV (pleine longueur si tu l’as implémenté).
2. **API** : endpoint (ex. FastAPI) qui reçoit les fichiers (ou chemins), appelle cette fonction, renvoie le WAV ou un lien de téléchargement.
3. Voir **DEEPAFX_ST_SAAS_GUIDE.md** pour un exemple de `deepafx_service.py` (subprocess vers `process.py` ou appel direct au modèle).

---

## 8. Récap

| Étape | Action |
|-------|--------|
| Données | Un dossier de WAV 24 kHz mono, durée ≥ ~11 s par fichier (ou réduire `train_length`). |
| Colab | Clone DeepAFx-ST, patch setup.py, install, extraire `vocals_24k.zip` → `/content/data/vocals_24k/`. |
| Train | `train_style.py` avec `--processor_model autodiff`, `--audio_dir /content/data`, `--input_dirs vocals_24k`, 1 GPU. |
| Checkpoint | Copier le .ckpt vers Drive (`deepafx_vocal_checkpoints/vocal_autodiff.ckpt`). |
| Inférence | `process.py -i vocal.wav -r ref.wav -c vocal_autodiff.ckpt` (ou inférence pleine longueur en Python). |
| SaaS | Exposer l’inférence en API (voir DEEPAFX_ST_SAAS_GUIDE.md). |

Si tu veux, on peut détailler la boucle d’inférence pleine longueur en Python (chunks + recollage) ou un script Colab dédié “inférence seule” avec ton checkpoint.
