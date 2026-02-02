# Google Colab : Cells à Copier-Coller (Étape par Étape)

## 🎯 Instructions

1. **Ouvre Google Colab** : https://colab.research.google.com
2. **Crée un nouveau notebook**
3. **Active GPU T4** : Runtime → Change runtime type → GPU T4
4. **Copie-colle chaque cell** ci-dessous dans l'ordre
5. **Exécute** chaque cell (Shift+Enter)

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

**Exécute et attends que ça finisse** (2-3 minutes)

---

## 📝 Cell 2 : Mount Google Drive

```python
from google.colab import drive
drive.mount('/content/drive')

print("✓ Google Drive monté!")
```

**Exécute et :**
- Clique sur le lien qui apparaît
- Autorise l'accès
- Copie le code d'autorisation
- Colle-le dans la cell
- Appuie sur Enter

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
    
    if raw_count == mixed_count and raw_count == 222:
        print("✅ Dataset parfait! 222 paires prêtes.")
    else:
        print(f"⚠️  Attendu 222, trouvé {raw_count} raw et {mixed_count} mixed")
else:
    print("❌ Dossiers raw/mixed introuvables!")
    print(f"   Cherché dans: {raw_dir} et {mixed_dir}")
```

**Exécute et vérifie** qu'il affiche "222 paires prêtes"

---

## 📝 Cell 4 : Vérifier GPU

```python
import torch

print(f"CUDA disponible: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    print("✅ GPU prêt pour l'entraînement!")
else:
    print("⚠️  Pas de GPU - Active GPU T4 dans Runtime → Change runtime type")
```

**Exécute et vérifie** qu'il affiche "GPU: Tesla T4" (ou similaire)

---

## 📝 Cell 5 : Explorer Diff-MST

```python
# Explorer la structure de Diff-MST
import os

print("Structure Diff-MST:")
print("="*60)
mst_dir = '/content/Diff-MST'
if os.path.exists(mst_dir):
    for item in sorted(os.listdir(mst_dir)):
        item_path = os.path.join(mst_dir, item)
        if os.path.isdir(item_path) and not item.startswith('.'):
            print(f"📁 {item}/")
            # Lister quelques fichiers Python
            py_files = [f for f in os.listdir(item_path) if f.endswith('.py')][:3]
            for f in py_files:
                print(f"   - {f}")
        elif item.endswith('.py'):
            print(f"📄 {item}")

print("\n" + "="*60)
print("Modules importants:")
print("  - mst/modules/ : Architecture du modèle")
print("  - mst/mixing/ : Console de mixing")
print("  - mst/dataloaders/ : Chargeurs de données")
```

**Exécute pour voir la structure**

---

## 📝 Cell 6 : Créer DataLoader Custom

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
print("   Fichier: /content/Diff-MST/mst/dataloaders/vocal_reference_dataset.py")
```

**Exécute cette cell**

---

## ⏸️ Pause : Explorer Diff-MST

**Avant de continuer, on doit comprendre comment Diff-MST fonctionne pour l'adapter.**

**Dis-moi quand tu as exécuté les cells 1-6, et on explore ensemble le code Diff-MST pour voir exactement ce qu'il faut adapter.**

---

## 📋 Checklist

- [ ] Cell 1 exécutée (Installation)
- [ ] Cell 2 exécutée (Drive monté)
- [ ] Cell 3 exécutée (Dataset décompressé, 222 paires)
- [ ] Cell 4 exécutée (GPU T4 actif)
- [ ] Cell 5 exécutée (Structure explorée)
- [ ] Cell 6 exécutée (DataLoader créé)

**Quand tout est fait, dis-moi et on continue avec l'adaptation de Diff-MST !**
