# Guide de Préparation du Dataset

## Structure des dossiers

**Organise tes fichiers comme ça :**

```
dataset/
├── raw/
│   ├── vocal1.wav
│   ├── vocal2.wav
│   ├── vocal3.wav
│   └── ... (tous les vocals RAW)
└── mixed/
    ├── vocal1.wav
    ├── vocal2.wav
    ├── vocal3.wav
    └── ... (tous les vocals MIXÉS - mêmes noms!)
```

**⚠️ IMPORTANT :**
- Les noms de fichiers doivent être **identiques** dans `raw/` et `mixed/`
- Format recommandé : **WAV** (44.1kHz, mono ou stéréo)
- Chaque fichier dans `raw/` doit avoir son équivalent dans `mixed/`

---

## Conseils pour mixer les vocals

### 1. Utilise ton style de mixage habituel
- Mixe les vocals comme tu le ferais normalement
- Garde un style **cohérent** entre tous les fichiers
- C'est ce style que le modèle va apprendre !

### 2. Qualité audio
- **Sample rate :** 44.1kHz (ou 48kHz, sera converti automatiquement)
- **Format :** WAV (non compressé)
- **Durée :** 2-3 minutes minimum par fichier (plus c'est long, mieux c'est)

### 3. Normalisation
- Normalise les fichiers mixed à **-0.3dB** maximum
- Évite le clipping
- Garde un niveau cohérent entre tous les fichiers

### 4. Nombre de fichiers
- **Minimum :** 50 paires
- **Recommandé :** 100+ paires
- **Idéal :** 200+ paires pour un modèle vraiment professionnel

---

## Vérification avant entraînement

### Script de vérification (à copier dans Colab) :

```python
import os
from pathlib import Path

raw_dir = "/content/dataset/raw"
mixed_dir = "/content/dataset/mixed"

# Vérifier que les dossiers existent
if not os.path.exists(raw_dir):
    print(f"❌ {raw_dir} n'existe pas!")
if not os.path.exists(mixed_dir):
    print(f"❌ {mixed_dir} n'existe pas!")

# Lister les fichiers
raw_files = {f for f in os.listdir(raw_dir) if f.endswith(('.wav', '.mp3', '.flac'))}
mixed_files = {f for f in os.listdir(mixed_dir) if f.endswith(('.wav', '.mp3', '.flac'))}

# Trouver les paires
pairs = raw_files & mixed_files
missing_in_mixed = raw_files - mixed_files
missing_in_raw = mixed_files - raw_files

print(f"\n✅ Paires trouvées: {len(pairs)}")
if missing_in_mixed:
    print(f"⚠️  {len(missing_in_mixed)} fichiers RAW sans équivalent MIXED:")
    for f in list(missing_in_mixed)[:5]:
        print(f"   - {f}")
if missing_in_raw:
    print(f"⚠️  {len(missing_in_raw)} fichiers MIXED sans équivalent RAW:")
    for f in list(missing_in_raw)[:5]:
        print(f"   - {f}")

# Vérifier la durée totale
import librosa
total_duration = 0
for f in pairs:
    try:
        y, sr = librosa.load(os.path.join(raw_dir, f), sr=None)
        duration = len(y) / sr
        total_duration += duration
    except:
        pass

print(f"\n📊 Durée totale: {total_duration/60:.1f} minutes")
print(f"📊 Durée moyenne par fichier: {total_duration/len(pairs)/60:.1f} minutes")

if len(pairs) >= 50:
    print("\n✅ Dataset prêt pour l'entraînement!")
else:
    print(f"\n⚠️  Seulement {len(pairs)} paires. Recommandé: 50+ paires")
```

---

## Quand tu es prêt à entraîner

### 1. Compresse le dataset

```powershell
# Sur Windows, crée un ZIP du dossier dataset
# Envoie-le sur Google Drive
```

### 2. Dans Google Colab

**Cell 1 - Setup :**
```python
from google.colab import drive
drive.mount('/content/drive')
```

**Cell 2 - Upload dataset :**
```python
# Si tu as uploadé dataset.zip sur Drive
import zipfile
import os

zip_path = "/content/drive/MyDrive/dataset.zip"
extract_path = "/content/"

if os.path.exists(zip_path):
    print("Extraction du dataset...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_path)
    
    # Vérifier la structure
    if os.path.exists("/content/dataset/dataset"):
        # Cas: dataset/dataset/raw et dataset/dataset/mixed
        os.system("mv /content/dataset/dataset/* /content/dataset/")
        os.rmdir("/content/dataset/dataset")
    
    print("✅ Dataset extrait!")
else:
    print("❌ dataset.zip non trouvé dans Drive")
```

**Cell 3 - Vérification :**
```python
# Copie le script de vérification ci-dessus
```

**Cell 4 - Upload Python files :**
```python
# Copie ml_model.py, data_loader.py, train_model.py depuis Drive
import shutil

files = ['ml_model.py', 'data_loader.py', 'train_model.py']
for f in files:
    src = f"/content/drive/MyDrive/{f}"
    dst = f"/content/{f}"
    if os.path.exists(src):
        shutil.copy(src, dst)
        print(f"✓ {f} copié")
    else:
        print(f"✗ {f} introuvable")
```

**Cell 5 - Install dependencies :**
```python
!pip install torch torchaudio librosa soundfile tqdm tensorboard
```

**Cell 6 - Training (avec plus d'epochs) :**
```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 4 \
    --num_epochs 1000 \
    --learning_rate 0.00005 \
    --segment_length 176400
```

**Cell 7 - Download model :**
```python
# À la fin de l'entraînement
from google.colab import files
files.download('/content/models/best_model.pt')
```

---

## Paramètres d'entraînement recommandés

### Pour 50-100 paires :
- **Epochs :** 500-1000
- **Batch size :** 4-8
- **Learning rate :** 0.00005
- **Temps estimé :** 8-16 heures

### Pour 100-200+ paires :
- **Epochs :** 300-500
- **Batch size :** 8-16
- **Learning rate :** 0.0001
- **Temps estimé :** 12-24 heures

---

## Checklist avant entraînement

- [ ] Au moins 50 paires raw/mixed
- [ ] Noms de fichiers identiques dans raw/ et mixed/
- [ ] Fichiers en format WAV (ou MP3/FLAC)
- [ ] Durée totale > 2 heures (idéal)
- [ ] Style de mixage cohérent
- [ ] Pas de clipping dans les fichiers mixed
- [ ] Dataset uploadé sur Google Drive
- [ ] Python files (ml_model.py, etc.) sur Drive

---

## Tips

1. **Mixe en batch :** Si tu as beaucoup de fichiers, crée un preset dans ton DAW et applique-le à tous
2. **Qualité > Quantité :** Mieux vaut 50 bons mixes que 100 mauvais
3. **Cohérence :** Garde le même style de mixage pour tous les fichiers
4. **Backup :** Sauvegarde ton dataset avant de l'envoyer sur Drive

---

Bon courage pour la collecte de données ! 🎵
