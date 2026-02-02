# Setup Diff-MST : Guide Complet pour Vocal Mixing

## 🎯 Objectif

Installer et adapter Diff-MST pour fine-tuner avec tes **222 paires** de vocal mixing (single track).

---

## ⚠️ Défi : Diff-MST est Multitrack

**Problème :** Diff-MST est conçu pour **multitrack** (vocal + drums + bass + etc.)

**Solution :** On va l'adapter pour **single track vocal** (vocal seul)

---

## 🚀 Étape 1 : Installation (Google Colab - Recommandé)

### Pourquoi Colab ?
- ✅ GPU T4 gratuit
- ✅ Environnement propre
- ✅ Pas besoin d'installer sur ton PC

### Cell 1 : Setup de Base

```python
# Installer Diff-MST
!git clone https://github.com/sai-soum/Diff-MST.git
%cd Diff-MST

# Installer le package
!pip install -e .

# Installer dépendances
!pip install torch torchaudio pytorch-lightning wandb librosa soundfile pyyaml tqdm
```

### Cell 2 : Mount Google Drive

```python
from google.colab import drive
drive.mount('/content/drive')
```

### Cell 3 : Préparer Dataset

```python
# Option A : Si dataset déjà dans Drive
!cp -r /content/drive/MyDrive/dataset /content/dataset

# Option B : Upload manuellement
# - Créer dataset.zip avec raw/ et mixed/
# - Upload vers Drive
# - Décompresser :
!unzip /content/drive/MyDrive/dataset.zip -d /content/

# Vérifier
!ls /content/dataset/raw | head -5
!ls /content/dataset/mixed | head -5
```

---

## 🔧 Étape 2 : Adapter Diff-MST pour Single Track

### Problème

Diff-MST attend plusieurs pistes. On doit adapter pour **vocal seul**.

### Solution : Créer un DataLoader Custom

Créer `mst/dataloaders/vocal_single_track.py` :

```python
"""
DataLoader custom pour vocal mixing single track
Adapte Diff-MST pour travailler avec vocal seul (pas multitrack)
"""
import os
import torch
from torch.utils.data import Dataset
import librosa
import soundfile as sf
import numpy as np
from typing import List, Tuple

class VocalSingleTrackDataset(Dataset):
    """Dataset pour vocal mixing single track"""
    
    def __init__(
        self,
        raw_dir: str,
        mixed_dir: str,
        sample_rate: int = 48000,
        segment_length: int = 192000,  # 4 secondes à 48kHz
        augment: bool = True
    ):
        self.raw_dir = raw_dir
        self.mixed_dir = mixed_dir
        self.sample_rate = sample_rate
        self.segment_length = segment_length
        self.augment = augment
        
        # Trouver les paires
        self.pairs = self._find_pairs()
        print(f"Found {len(self.pairs)} vocal pairs")
    
    def _find_pairs(self) -> List[Tuple[str, str]]:
        """Trouve les paires raw/mixed"""
        pairs = []
        raw_files = {f for f in os.listdir(self.raw_dir) if f.endswith('.wav')}
        mixed_files = {f for f in os.listdir(self.mixed_dir) if f.endswith('.wav')}
        
        for filename in raw_files:
            if filename in mixed_files:
                pairs.append((
                    os.path.join(self.raw_dir, filename),
                    os.path.join(self.mixed_dir, filename)
                ))
        
        return pairs
    
    def _load_audio(self, path: str) -> np.ndarray:
        """Charge audio en mono"""
        audio, sr = librosa.load(path, sr=self.sample_rate, mono=True)
        return audio
    
    def _extract_segment(self, audio: np.ndarray) -> np.ndarray:
        """Extrait un segment de 4 secondes"""
        if len(audio) <= self.segment_length:
            # Pad si trop court
            padded = np.zeros(self.segment_length)
            padded[:len(audio)] = audio
            return padded
        else:
            # Segment aléatoire
            start = np.random.randint(0, len(audio) - self.segment_length)
            return audio[start:start + self.segment_length]
    
    def __len__(self):
        return len(self.pairs)
    
    def __getitem__(self, idx):
        raw_path, mixed_path = self.pairs[idx]
        
        # Charger
        raw = self._load_audio(raw_path)
        mixed = self._load_audio(mixed_path)
        
        # Extraire segments
        raw_seg = self._extract_segment(raw)
        mixed_seg = self._extract_segment(mixed)
        
        # Convertir en tensor [1, samples] (1 channel)
        raw_tensor = torch.FloatTensor(raw_seg).unsqueeze(0)
        mixed_tensor = torch.FloatTensor(mixed_seg).unsqueeze(0)
        
        return raw_tensor, mixed_tensor
```

---

## 🎯 Étape 3 : Configuration pour Vocal Mixing

### Créer `configs/data/vocal_mixing.yaml`

```yaml
# Configuration pour vocal mixing single track
data:
  raw_dir: /content/dataset/raw
  mixed_dir: /content/dataset/mixed
  batch_size: 4
  num_workers: 0
  sample_rate: 48000
  segment_length: 192000  # 4 secondes
  augment: true

model:
  n_tracks: 1  # Single track (vocal seul)
  generate_mix: false  # On a déjà les mixed
  sample_rate: 48000

training:
  max_epochs: 100
  learning_rate: 1e-5
  val_check_interval: 0.5
```

---

## 🚀 Étape 4 : Fine-Tuning

### Option A : Utiliser le DataLoader Custom

**Créer un script de training custom** `train_vocal_mixing.py` :

```python
"""
Script de fine-tuning Diff-MST pour vocal mixing
"""
import torch
from pytorch_lightning import Trainer
from pytorch_lightning.callbacks import ModelCheckpoint
from mst.modules import DiffMSTModel
from mst.dataloaders.vocal_single_track import VocalSingleTrackDataset
from torch.utils.data import DataLoader

# Configuration
raw_dir = "/content/dataset/raw"
mixed_dir = "/content/dataset/mixed"
batch_size = 4
sample_rate = 48000
segment_length = 192000  # 4 secondes

# Dataset
train_dataset = VocalSingleTrackDataset(
    raw_dir=raw_dir,
    mixed_dir=mixed_dir,
    sample_rate=sample_rate,
    segment_length=segment_length,
    augment=True
)

train_loader = DataLoader(
    train_dataset,
    batch_size=batch_size,
    shuffle=True,
    num_workers=0
)

# Modèle (charger pré-entraîné si disponible)
model = DiffMSTModel.from_pretrained("diff-mst-base")  # Si disponible
# Ou créer nouveau :
# model = DiffMSTModel(n_tracks=1, ...)

# Trainer
trainer = Trainer(
    max_epochs=100,
    gpus=1 if torch.cuda.is_available() else 0,
    callbacks=[
        ModelCheckpoint(
            dirpath="/content/models",
            filename="vocal_mixing-{epoch:02d}-{val_loss:.2f}",
            save_top_k=3,
            monitor="val_loss"
        )
    ]
)

# Training
trainer.fit(model, train_loader)
```

### Option B : Adapter les Configs Existantes

**Modifier les configs Diff-MST** pour single track (plus complexe).

---

## ⚠️ Problèmes Potentiels

### 1. Diff-MST Nécessite Reference Mix

**Problème :** Diff-MST peut nécessiter une "reference mix" (exemple de mix de référence)

**Solution :** Utiliser le mixed comme référence, ou adapter l'architecture

### 2. Architecture Multitrack

**Problème :** Diff-MST attend plusieurs pistes en entrée

**Solution :** Adapter pour single track (vocal seul = 1 piste)

### 3. Complexité

**Problème :** Diff-MST est complexe à adapter

**Solution :** On le fait ensemble, étape par étape

---

## 🎯 Plan d'Action Recommandé

### Phase 1 : Explorer Diff-MST (1-2 heures)

1. ✅ Cloner le repo
2. ✅ Lire la documentation
3. ✅ Comprendre la structure
4. ✅ Identifier ce qu'il faut adapter

### Phase 2 : Adapter pour Single Track (2-4 heures)

1. ✅ Créer DataLoader custom
2. ✅ Adapter la configuration
3. ✅ Modifier le modèle si nécessaire
4. ✅ Tester avec quelques fichiers

### Phase 3 : Fine-Tuning (6-8 heures)

1. ✅ Lancer le training
2. ✅ Monitorer la loss
3. ✅ Sauvegarder les checkpoints
4. ✅ Tester le modèle

---

## 💡 Alternative Plus Simple

**Si l'adaptation Diff-MST est trop complexe :**

On peut **améliorer notre modèle actuel** avec :
- ✅ Plus de données (222 au lieu de 29)
- ✅ Meilleure architecture (plus de filtres)
- ✅ Hyperparamètres optimisés
- ✅ Plus d'epochs (1000 au lieu de 300)

**Résultat :** Qualité probablement très bonne aussi !

---

## 🤔 On Commence Comment ?

**Je propose :**

1. **D'abord explorer Diff-MST** (voir ce qu'il faut adapter)
2. **Si trop complexe** → améliorer notre modèle actuel
3. **Si faisable** → adapter Diff-MST

**Tu veux qu'on commence par explorer Diff-MST ou tu préfères améliorer notre modèle actuel directement ?**
