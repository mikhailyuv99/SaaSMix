# Fine-Tuning Diff-MST : Guide Complet

## 🎯 Objectif

Fine-tuner Diff-MST avec tes **222 paires** pour avoir un modèle qui apprend ton style de mixing vocal.

---

## 📋 Prérequis

- ✅ Dataset prêt : 222 paires raw/mixed (vérifié ✓)
- ✅ Python 3.10+ installé
- ✅ GPU recommandé (ou CPU si pas de GPU)
- ✅ Environnement Python propre

---

## 🚀 Étape 1 : Installation Diff-MST

### Option A : Google Colab (Recommandé - GPU Gratuit)

**Avantages :**
- ✅ GPU T4 gratuit
- ✅ Pas besoin d'installer sur ton PC
- ✅ Environnement propre

**Inconvénient :**
- ⚠️ Session limitée (12h max)

### Option B : Local (Si tu as un GPU)

**Avantages :**
- ✅ Pas de limite de temps
- ✅ Contrôle total

**Inconvénient :**
- ⚠️ Nécessite GPU NVIDIA

---

## 📦 Installation (Google Colab)

### Cell 1 : Setup Environnement

```python
# Installer Diff-MST
!git clone https://github.com/sai-soum/Diff-MST.git
%cd Diff-MST
!pip install -e .

# Installer dépendances
!pip install torch torchaudio lightning wandb librosa soundfile
```

### Cell 2 : Upload Dataset

```python
# Upload ton dataset.zip vers Google Drive
# Ou upload directement les dossiers raw/mixed

# Si dans Drive :
from google.colab import drive
drive.mount('/content/drive')

# Copier dataset depuis Drive
!cp -r /content/drive/MyDrive/dataset /content/dataset
```

### Cell 3 : Préparer Configuration

```python
# Créer config pour vocal mixing
import yaml
import os

config = {
    'data': {
        'track_root_dirs': ['/content/dataset/raw'],
        'mix_root_dirs': ['/content/dataset/mixed'],
        'batch_size': 4,
        'num_workers': 0,
        'sample_rate': 48000,
        'segment_length': 48000 * 4,  # 4 secondes
    },
    'model': {
        'generate_mix': False,  # On a déjà les mixed
        'n_tracks': 1,  # Single track (vocal)
    },
    'training': {
        'max_epochs': 100,
        'learning_rate': 1e-5,
    }
}

# Sauvegarder config
os.makedirs('/content/Diff-MST/configs/data', exist_ok=True)
with open('/content/Diff-MST/configs/data/vocal_mixing.yaml', 'w') as f:
    yaml.dump(config, f)
```

### Cell 4 : Fine-Tuning

```python
# Fine-tune Diff-MST
!python main.py fit \
  -c configs/config.yaml \
  -c configs/optimizer.yaml \
  -c configs/data/vocal_mixing.yaml \
  -c configs/models/naive+feat.yaml
```

---

## 🚀 Installation (Local)

### Étape 1 : Cloner Diff-MST

```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix"
git clone https://github.com/sai-soum/Diff-MST.git
cd Diff-MST
pip install -e .
```

### Étape 2 : Installer Dépendances

```powershell
pip install torch torchaudio pytorch-lightning wandb librosa soundfile pyyaml
```

### Étape 3 : Préparer Configuration

Créer `configs/data/vocal_mixing.yaml` :

```yaml
track_root_dirs:
  - C:\Users\mikha\Desktop\dataset\raw
mix_root_dirs:
  - C:\Users\mikha\Desktop\dataset\mixed
batch_size: 4
num_workers: 0
sample_rate: 48000
segment_length: 192000  # 4 secondes à 48kHz
```

### Étape 4 : Fine-Tuning

```powershell
python main.py fit `
  -c configs/config.yaml `
  -c configs/optimizer.yaml `
  -c configs/data/vocal_mixing.yaml `
  -c configs/models/naive+feat.yaml
```

---

## ⚠️ Problèmes Potentiels

### Diff-MST est conçu pour Multitrack

**Problème :** Diff-MST attend plusieurs pistes (vocal, drums, bass, etc.)

**Solution :** Adapter pour single track (vocal seul)

**On devra :**
- Modifier le data loader pour single track
- Adapter la configuration
- Possiblement modifier le modèle

---

## 🎯 Plan d'Action

### Option 1 : Google Colab (Recommandé)

1. ✅ Créer un nouveau notebook Colab
2. ✅ Installer Diff-MST
3. ✅ Upload dataset
4. ✅ Adapter pour vocal mixing
5. ✅ Fine-tune (6-8 heures)
6. ✅ Télécharger le modèle

### Option 2 : Local

1. ✅ Installer Diff-MST
2. ✅ Préparer configuration
3. ✅ Adapter pour vocal mixing
4. ✅ Fine-tune (6-8 heures)
5. ✅ Tester le modèle

---

## 💡 Alternative : Adapter Notre Modèle Actuel

**Si Diff-MST est trop complexe à adapter :**

On peut améliorer notre modèle actuel (AudioUNet) :
- ✅ Déjà fonctionnel
- ✅ Déjà adapté pour vocal mixing
- ✅ On peut juste réentraîner avec 222 paires

**Avantages :**
- ✅ Plus simple
- ✅ On connaît déjà le code
- ✅ Moins de risques

**Inconvénients :**
- ⚠️ Qualité peut être inférieure à Diff-MST
- ⚠️ Pas de paramètres interprétables

---

## 🤔 Quelle Approche ?

**Question pour toi :**

1. **Diff-MST** (plus complexe, meilleure qualité potentielle)
2. **Notre modèle actuel** (plus simple, on connaît déjà)

**Ma recommandation :** Commencer par **notre modèle actuel** avec 222 paires (plus simple, moins de risques), puis migrer vers Diff-MST plus tard si besoin.

**Qu'est-ce que tu préfères ?**
