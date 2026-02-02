# Google Colab : Fine-Tuning Diff-MST pour Vocal Mixing

## 🎯 Objectif

Fine-tuner Diff-MST avec tes **222 paires** dans Google Colab (GPU gratuit).

---

## 📋 Prérequis

- ✅ Compte Google (pour Colab)
- ✅ Dataset prêt : 222 paires dans `C:\Users\mikha\Desktop\dataset`
- ✅ Google Drive (pour sauvegarder le dataset)

---

## 🚀 Étape 1 : Préparer le Dataset pour Colab

### Option A : Upload vers Google Drive (Recommandé)

1. **Créer un fichier ZIP** de ton dataset :
   ```powershell
   # Sur ton PC
   cd C:\Users\mikha\Desktop
   Compress-Archive -Path dataset -DestinationPath dataset.zip
   ```

2. **Upload `dataset.zip` vers Google Drive** :
   - Va sur https://drive.google.com
   - Upload `dataset.zip` dans `MyDrive`

3. **Dans Colab**, on le décompressera automatiquement

### Option B : Upload Direct dans Colab

- Plus lent mais plus simple
- On upload les fichiers directement dans Colab

---

## 🚀 Étape 2 : Créer le Notebook Colab

### Créer un Nouveau Notebook

1. Va sur https://colab.research.google.com
2. **File → New notebook**
3. Nomme-le : "Diff-MST Vocal Mixing"

---

## 📝 Cell 1 : Setup Environnement

```python
# Installer Diff-MST
!git clone https://github.com/sai-soum/Diff-MST.git
%cd Diff-MST

# Installer le package
!pip install -e .

# Installer dépendances
!pip install torch torchaudio pytorch-lightning wandb librosa soundfile pyyaml tqdm tensorboard

print("✓ Installation terminée!")
```

**Exécute cette cell** (Runtime → Run cell ou Shift+Enter)

---

## 📝 Cell 2 : Mount Google Drive

```python
from google.colab import drive
drive.mount('/content/drive')

print("✓ Google Drive monté!")
```

**Exécute et autorise l'accès** quand demandé.

---

## 📝 Cell 3 : Préparer Dataset

```python
import os
import zipfile

# Chemin vers dataset.zip dans Drive
dataset_zip = '/content/drive/MyDrive/dataset.zip'
dataset_dir = '/content/dataset'

# Décompresser si pas déjà fait
if not os.path.exists(dataset_dir):
    print("Décompression du dataset...")
    with zipfile.ZipFile(dataset_zip, 'r') as zip_ref:
        zip_ref.extractall('/content')
    print("✓ Dataset décompressé!")
else:
    print("✓ Dataset déjà présent!")

# Vérifier
raw_dir = '/content/dataset/raw'
mixed_dir = '/content/dataset/mixed'

if os.path.exists(raw_dir) and os.path.exists(mixed_dir):
    raw_count = len([f for f in os.listdir(raw_dir) if f.endswith('.wav')])
    mixed_count = len([f for f in os.listdir(mixed_dir) if f.endswith('.wav')])
    print(f"✓ Raw: {raw_count} fichiers")
    print(f"✓ Mixed: {mixed_count} fichiers")
else:
    print("❌ Dossiers raw/mixed introuvables!")
```

**Exécute cette cell** et vérifie que ça affiche 222 fichiers.

---

## 📝 Cell 4 : Créer DataLoader Custom pour Vocal Mixing

```python
# Créer le dossier pour notre DataLoader
!mkdir -p /content/Diff-MST/mst/dataloaders

# Créer le fichier vocal_reference_dataset.py
vocal_loader_code = '''
"""
DataLoader pour vocal mixing avec reference mix
Adapte Diff-MST pour single track vocal
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
    
    def __len__(self):
        return len(self.pairs)
    
    def __getitem__(self, idx):
        raw_path, mixed_path = self.pairs[idx]
        
        # Charger
        raw = self._load_audio(raw_path)
        mixed = self._load_audio(mixed_path)
        
        # Extraire segments (même position pour raw et mixed)
        min_len = min(len(raw), len(mixed))
        if min_len <= self.segment_length:
            # Pad si trop court
            raw_seg = np.zeros(self.segment_length)
            mixed_seg = np.zeros(self.segment_length)
            raw_seg[:len(raw)] = raw
            mixed_seg[:len(mixed)] = mixed
        else:
            # Segment aléatoire (même position)
            max_start = min_len - self.segment_length
            start = random.randint(0, max_start) if self.augment else 0
            raw_seg = raw[start:start + self.segment_length]
            mixed_seg = mixed[start:start + self.segment_length]
        
        # Convertir en tensor [batch, channels, samples]
        # Pour Diff-MST : [1, 1, samples] (1 track, 1 channel)
        raw_tensor = torch.FloatTensor(raw_seg).unsqueeze(0).unsqueeze(0)
        mixed_tensor = torch.FloatTensor(mixed_seg).unsqueeze(0).unsqueeze(0)
        
        return {
            'tracks': raw_tensor,  # Piste à mixer
            'reference': mixed_tensor  # Reference mix (target)
        }
'''

# Écrire le fichier
with open('/content/Diff-MST/mst/dataloaders/vocal_reference_dataset.py', 'w') as f:
    f.write(vocal_loader_code)

print("✓ DataLoader custom créé!")
```

**Exécute cette cell.**

---

## 📝 Cell 5 : Explorer Diff-MST (Comprendre la Structure)

```python
# Explorer la structure de Diff-MST
import os

print("Structure Diff-MST:")
for root, dirs, files in os.walk('/content/Diff-MST'):
    level = root.replace('/content/Diff-MST', '').count(os.sep)
    indent = ' ' * 2 * level
    print(f"{indent}{os.path.basename(root)}/")
    subindent = ' ' * 2 * (level + 1)
    for file in files[:5]:  # Afficher max 5 fichiers par dossier
        if file.endswith('.py'):
            print(f"{subindent}{file}")

# Lire le README
print("\n" + "="*60)
print("README Diff-MST:")
print("="*60)
with open('/content/Diff-MST/README.md', 'r') as f:
    print(f.read()[:2000])  # Premiers 2000 caractères
```

**Exécute pour comprendre la structure.**

---

## 📝 Cell 6 : Vérifier GPU

```python
import torch

print(f"CUDA disponible: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
else:
    print("⚠️ Pas de GPU - Training sera très lent sur CPU")
```

**Important :** Active le GPU dans Colab :
- **Runtime → Change runtime type → GPU (T4)**

---

## ⚠️ Prochaine Étape : Adapter Diff-MST

**Avant de continuer, on doit :**

1. ✅ Explorer le code Diff-MST (voir comment il fonctionne)
2. ✅ Comprendre comment adapter pour single track
3. ✅ Créer le script de training adapté

**Je vais créer les cells suivantes une fois qu'on a exploré Diff-MST.**

---

## 🎯 Plan d'Action

### Maintenant

1. ✅ **Créer le notebook Colab**
2. ✅ **Exécuter les cells 1-6** (setup, dataset, exploration)
3. ✅ **Explorer Diff-MST** pour comprendre l'adaptation

### Ensuite

4. ✅ **Adapter Diff-MST** pour vocal mixing
5. ✅ **Créer le script de training**
6. ✅ **Lancer le fine-tuning**

---

## 💡 Alternative : Commencer Simple

**Si l'adaptation Diff-MST est trop complexe :**

On peut d'abord **réentraîner notre modèle actuel avec 222 paires** :
- ✅ Plus simple
- ✅ On connaît déjà le code
- ✅ Qualité probablement très bonne avec 7.7x plus de données
- ✅ On peut tester rapidement

**Puis migrer vers Diff-MST plus tard si besoin.**

---

## 🚀 On Commence ?

**Actions immédiates :**

1. **Créer le notebook Colab** (https://colab.research.google.com)
2. **Copier les cells 1-6** ci-dessus
3. **Exécuter** et me dire ce qui se passe
4. **On explore Diff-MST** ensemble pour l'adapter

**Tu veux que je te guide cell par cell, ou tu préfères que je crée un notebook complet prêt à copier-coller ?**
