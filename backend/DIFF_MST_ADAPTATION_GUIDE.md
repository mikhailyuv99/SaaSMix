# Adapter Diff-MST pour Vocal Mixing : Guide Pratique

## 🎯 Objectif

Adapter Diff-MST (conçu pour multitrack) pour **vocal mixing single track** avec tes 222 paires.

---

## ⚠️ Défi Principal

**Diff-MST est conçu pour :**
- Plusieurs pistes (vocal, drums, bass, etc.)
- Reference mix (exemple de mix complet)
- Prédiction de paramètres pour chaque piste

**On veut :**
- Single track (vocal seul)
- Raw vocal → Mixed vocal (pas de reference mix)
- Apprendre ton style de mixing

---

## 🔧 Solution : Deux Approches

### Approche 1 : Utiliser Mixed comme "Reference Mix" (Plus Simple)

**Idée :** Traiter le mixed comme une "reference mix" et le raw comme la piste à mixer.

**Comment :**
- Raw vocal = piste à mixer
- Mixed vocal = reference mix (exemple de ce qu'on veut)
- Diff-MST apprend à transformer raw → mixed

**Avantages :**
- ✅ Utilise l'architecture Diff-MST existante
- ✅ Moins de modifications nécessaires
- ✅ Plus simple à implémenter

### Approche 2 : Adapter Complètement pour Single Track (Plus Complexe)

**Idée :** Modifier Diff-MST pour travailler directement avec raw → mixed.

**Comment :**
- Modifier le DataLoader
- Adapter le modèle pour single track
- Changer la loss function

**Avantages :**
- ✅ Plus adapté à notre cas
- ✅ Plus efficace

**Inconvénients :**
- ⚠️ Plus de modifications nécessaires
- ⚠️ Plus complexe

---

## 🚀 Plan d'Action : Approche 1 (Recommandée)

### Étape 1 : Installer Diff-MST dans Colab

```python
# Cell 1 : Setup
!git clone https://github.com/sai-soum/Diff-MST.git
%cd Diff-MST
!pip install -e .
!pip install torch torchaudio pytorch-lightning wandb librosa soundfile pyyaml tqdm

# Cell 2 : Mount Drive
from google.colab import drive
drive.mount('/content/drive')

# Cell 3 : Préparer Dataset
!cp -r /content/drive/MyDrive/dataset /content/dataset
# Ou upload dataset.zip et décompresser
```

### Étape 2 : Créer DataLoader Custom

**Créer `mst/dataloaders/vocal_reference_dataset.py` :**

```python
"""
DataLoader pour vocal mixing avec reference mix
Traite le mixed comme reference et le raw comme piste à mixer
"""
import os
import torch
from torch.utils.data import Dataset
import librosa
import numpy as np
from typing import List, Tuple
import random

class VocalReferenceDataset(Dataset):
    """Dataset pour vocal mixing avec reference"""
    
    def __init__(
        self,
        raw_dir: str,
        mixed_dir: str,
        sample_rate: int = 48000,
        segment_length: int = 192000,  # 4 secondes
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
        
        for filename in sorted(raw_files):
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
            padded = np.zeros(self.segment_length)
            padded[:len(audio)] = audio
            return padded
        else:
            # Même position pour raw et mixed (important!)
            max_start = len(audio) - self.segment_length
            start = random.randint(0, max_start) if self.augment else 0
            return audio[start:start + self.segment_length]
    
    def __len__(self):
        return len(self.pairs)
    
    def __getitem__(self, idx):
        raw_path, mixed_path = self.pairs[idx]
        
        # Charger
        raw = self._load_audio(raw_path)
        mixed = self._load_audio(mixed_path)
        
        # Extraire segments (même position)
        if len(raw) > self.segment_length and len(mixed) > self.segment_length:
            max_start = min(len(raw), len(mixed)) - self.segment_length
            start = random.randint(0, max_start) if self.augment else 0
            raw_seg = raw[start:start + self.segment_length]
            mixed_seg = mixed[start:start + self.segment_length]
        else:
            raw_seg = self._extract_segment(raw)
            mixed_seg = self._extract_segment(mixed)
        
        # Convertir en tensor [batch, channels, samples]
        # Pour Diff-MST : [1, 1, samples] (1 track, 1 channel)
        raw_tensor = torch.FloatTensor(raw_seg).unsqueeze(0).unsqueeze(0)
        mixed_tensor = torch.FloatTensor(mixed_seg).unsqueeze(0).unsqueeze(0)
        
        return {
            'tracks': raw_tensor,  # Piste à mixer
            'reference': mixed_tensor  # Reference mix (ce qu'on veut obtenir)
        }
```

### Étape 3 : Créer Script de Training Custom

**Créer `train_vocal_diffmst.py` :**

```python
"""
Fine-tuning Diff-MST pour vocal mixing
"""
import torch
from pytorch_lightning import Trainer, LightningModule
from pytorch_lightning.callbacks import ModelCheckpoint
from torch.utils.data import DataLoader
import sys
sys.path.append('/content/Diff-MST')

from mst.modules import DiffMSTModel
from mst.dataloaders.vocal_reference_dataset import VocalReferenceDataset

class VocalMixingModule(LightningModule):
    """Module Lightning pour vocal mixing"""
    
    def __init__(self):
        super().__init__()
        # Charger Diff-MST pré-entraîné ou créer nouveau
        self.model = DiffMSTModel(
            n_tracks=1,  # Single track
            sample_rate=48000
        )
    
    def training_step(self, batch, batch_idx):
        tracks = batch['tracks']  # Raw vocal
        reference = batch['reference']  # Mixed vocal (target)
        
        # Diff-MST prédit les paramètres et applique
        output = self.model(tracks, reference)
        
        # Loss : comparer output avec reference
        loss = torch.nn.functional.l1_loss(output, reference)
        
        self.log('train_loss', loss)
        return loss
    
    def configure_optimizers(self):
        return torch.optim.Adam(self.parameters(), lr=1e-5)

# Dataset
dataset = VocalReferenceDataset(
    raw_dir="/content/dataset/raw",
    mixed_dir="/content/dataset/mixed",
    sample_rate=48000,
    segment_length=192000,
    augment=True
)

train_loader = DataLoader(
    dataset,
    batch_size=4,
    shuffle=True,
    num_workers=0
)

# Trainer
trainer = Trainer(
    max_epochs=100,
    gpus=1 if torch.cuda.is_available() else 0,
    callbacks=[
        ModelCheckpoint(
            dirpath="/content/models",
            filename="vocal_mixing-{epoch:02d}-{loss:.4f}",
            save_top_k=3,
            monitor="train_loss"
        )
    ]
)

# Training
model = VocalMixingModule()
trainer.fit(model, train_loader)
```

---

## ⚠️ Problèmes Potentiels et Solutions

### Problème 1 : Diff-MST Nécessite Plusieurs Pistes

**Solution :** Utiliser 1 piste (vocal) et adapter le modèle pour accepter n_tracks=1

### Problème 2 : Reference Mix Format

**Solution :** Utiliser le mixed comme reference mix (même format)

### Problème 3 : Architecture Complexe

**Solution :** On explore le code Diff-MST ensemble et on adapte étape par étape

---

## 🎯 Plan d'Action Concret

### Phase 1 : Explorer Diff-MST (Maintenant)

1. ✅ Cloner le repo
2. ✅ Lire la structure
3. ✅ Identifier les fichiers clés
4. ✅ Comprendre comment adapter

### Phase 2 : Créer DataLoader (1-2 heures)

1. ✅ Créer `VocalReferenceDataset`
2. ✅ Tester avec quelques fichiers
3. ✅ Vérifier que ça fonctionne

### Phase 3 : Adapter le Modèle (2-4 heures)

1. ✅ Modifier pour single track
2. ✅ Adapter la loss function
3. ✅ Tester le forward pass

### Phase 4 : Fine-Tuning (6-8 heures)

1. ✅ Lancer le training
2. ✅ Monitorer
3. ✅ Sauvegarder checkpoints

---

## 💡 Alternative : Commencer Simple

**Si c'est trop complexe au début :**

1. **Essayer d'abord** avec notre modèle actuel + 222 paires
2. **Voir la qualité** obtenue
3. **Si pas satisfait** → adapter Diff-MST

**Mais tu as raison :** Diff-MST = meilleure qualité à long terme.

---

## 🚀 On Commence ?

**Je propose :**

1. **Explorer Diff-MST** (voir ce qu'il faut adapter)
2. **Créer le DataLoader custom** ensemble
3. **Adapter le modèle** si nécessaire
4. **Lancer le fine-tuning**

**Tu veux qu'on commence par explorer le code Diff-MST pour voir exactement ce qu'il faut adapter ?**
