# Redémarrer Après Déconnexion Colab

## Si votre session Colab s'est déconnectée, suivez ces étapes :

### Étape 1 : Remonter Google Drive

```python
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
```

### Étape 2 : Ré-uploader les fichiers Python

**Option A : Upload direct (plus rapide)**

1. Cliquez sur l'icône dossier à gauche dans Colab
2. Cliquez sur "Upload"
3. Upload ces 3 fichiers :
   - `ml_model.py`
   - `data_loader.py`
   - `train_model.py`

**Option B : Copier depuis Drive (si vous les avez sauvegardés)**

```python
import shutil

# Ajustez le chemin si vos fichiers sont ailleurs dans Drive
drive_folder = '/content/drive/MyDrive'

# Copier les fichiers
shutil.copy(f'{drive_folder}/ml_model.py', '/content/')
shutil.copy(f'{drive_folder}/data_loader.py', '/content/')
shutil.copy(f'{drive_folder}/train_model.py', '/content/')

print("✓ Fichiers copiés!")
```

### Étape 3 : Ré-extraire le dataset

```python
import zipfile
import os
import shutil

zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/temp_extract'
final_path = '/content/dataset'

# Nettoyer si existe déjà
if os.path.exists(final_path):
    shutil.rmtree(final_path)
if os.path.exists(extract_path):
    shutil.rmtree(extract_path)

# Extraire
print("Extraction du dataset...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

# Vérifier la structure
contents = os.listdir(extract_path)

# Gérer le cas imbriqué
if 'dataset' in contents:
    nested_dataset = f'{extract_path}/dataset'
    if os.path.exists(f'{nested_dataset}/raw') and os.path.exists(f'{nested_dataset}/mixed'):
        shutil.move(nested_dataset, final_path)
        print("✓ Structure corrigée!")
elif 'raw' in contents and 'mixed' in contents:
    os.makedirs(final_path)
    shutil.move(f'{extract_path}/raw', f'{final_path}/raw')
    shutil.move(f'{extract_path}/mixed', f'{final_path}/mixed')
    print("✓ Fichiers déplacés!")

# Nettoyer
if os.path.exists(extract_path):
    shutil.rmtree(extract_path)

# Vérifier
if os.path.exists(f'{final_path}/raw') and os.path.exists(f'{final_path}/mixed'):
    raw_count = len(os.listdir(f'{final_path}/raw'))
    mixed_count = len(os.listdir(f'{final_path}/mixed'))
    print(f"\n✅ Dataset prêt!")
    print(f"   Fichiers raw: {raw_count}")
    print(f"   Fichiers mixed: {mixed_count}")
```

### Étape 4 : Vérifier que tout est là

```python
import os

files_needed = ['ml_model.py', 'data_loader.py', 'train_model.py']
missing = []

for file in files_needed:
    if os.path.exists(f'/content/{file}'):
        print(f"✓ {file}")
    else:
        print(f"✗ {file} MANQUANT!")
        missing.append(file)

if missing:
    print(f"\n❌ Fichiers manquants: {missing}")
    print("Ré-uploadez-les avant de continuer!")
else:
    print("\n✅ Tous les fichiers sont présents!")

# Vérifier dataset
if os.path.exists('/content/dataset/raw') and os.path.exists('/content/dataset/mixed'):
    print("✅ Dataset présent!")
else:
    print("❌ Dataset manquant! Relancez l'extraction.")
```

### Étape 5 : Relancer l'entraînement

Une fois que tout est en place, relancez Cell 6 :

```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 4 \
    --num_epochs 300 \
    --learning_rate 3e-5 \
    --model_type time_domain
```

## ⚠️ Important pour éviter ça à l'avenir

1. **Sauvegarder les fichiers dans Drive** :
   ```python
   import shutil
   shutil.copy('/content/ml_model.py', '/content/drive/MyDrive/')
   shutil.copy('/content/data_loader.py', '/content/drive/MyDrive/')
   shutil.copy('/content/train_model.py', '/content/drive/MyDrive/')
   ```

2. **Garder l'onglet actif** : Colab se déconnecte après ~90 min d'inactivité

3. **Sauvegarder les checkpoints dans Drive** :
   - Modifiez `--output_dir` pour sauvegarder dans Drive
   - Ou copiez régulièrement les checkpoints

## 💡 Astuce : Sauvegarder automatiquement

Ajoutez ceci dans votre notebook pour sauvegarder automatiquement :

```python
# Sauvegarder les fichiers Python dans Drive
import shutil
import os

os.makedirs('/content/drive/MyDrive/ml_training_files', exist_ok=True)

for file in ['ml_model.py', 'data_loader.py', 'train_model.py']:
    if os.path.exists(f'/content/{file}'):
        shutil.copy(f'/content/{file}', f'/content/drive/MyDrive/ml_training_files/{file}')
        print(f"✓ {file} sauvegardé dans Drive")

print("\n✅ Tous les fichiers sauvegardés!")
```
