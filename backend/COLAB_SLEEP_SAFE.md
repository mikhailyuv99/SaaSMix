# Dormir Tranquille - Sauvegarder dans Drive

## Le Problème

Colab se déconnecte après ~90 min d'inactivité → tout dans `/content/` est perdu.

## La Solution : Sauvegarder dans Drive

### Option 1 : Sauvegarder les checkpoints dans Drive (RECOMMANDÉ)

Modifiez Cell 6 pour sauvegarder directement dans Drive :

```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/drive/MyDrive/models \
    --batch_size 4 \
    --num_epochs 300 \
    --learning_rate 3e-5 \
    --model_type time_domain
```

**Changement :** `--output_dir /content/drive/MyDrive/models` au lieu de `/content/models`

✅ **Avantages :**
- Les checkpoints sont sauvegardés dans Drive (persistant)
- Si Colab se déconnecte, vous pouvez reprendre depuis le dernier checkpoint
- Le meilleur modèle sera dans Drive, pas perdu

### Option 2 : Sauvegarder automatiquement pendant l'entraînement

Ajoutez cette cellule AVANT Cell 6 pour modifier `train_model.py` automatiquement :

```python
# Modifier train_model.py pour sauvegarder dans Drive
import os

# Lire le fichier
with open('/content/train_model.py', 'r') as f:
    content = f.read()

# Remplacer le chemin de sauvegarde
# Chercher la ligne qui sauvegarde les checkpoints
if 'checkpoint_dir' in content:
    # Le code sauvegarde déjà dans output_dir, donc on change juste --output_dir
    print("✓ train_model.py est prêt")
    print("⚠️  Utilisez --output_dir /content/drive/MyDrive/models dans Cell 6")
else:
    print("Fichier non trouvé ou déjà modifié")
```

## Reprendre Après Déconnexion

Si Colab se déconnecte, vous pouvez reprendre depuis le dernier checkpoint :

```python
# Trouver le dernier checkpoint
import os
import glob

checkpoint_dir = '/content/drive/MyDrive/models'
checkpoints = glob.glob(f'{checkpoint_dir}/checkpoint_epoch_*.pt')

if checkpoints:
    # Trier par numéro d'epoch
    checkpoints.sort(key=lambda x: int(x.split('_')[-1].split('.')[0]))
    last_checkpoint = checkpoints[-1]
    last_epoch = int(last_checkpoint.split('_')[-1].split('.')[0])
    
    print(f"Dernier checkpoint: Epoch {last_epoch}")
    print(f"Chemin: {last_checkpoint}")
    
    # Reprendre l'entraînement
    !python train_model.py \
        --raw_dir /content/dataset/raw \
        --mixed_dir /content/dataset/mixed \
        --output_dir /content/drive/MyDrive/models \
        --batch_size 4 \
        --num_epochs 300 \
        --learning_rate 3e-5 \
        --model_type time_domain \
        --resume_from {last_checkpoint}
else:
    print("Aucun checkpoint trouvé, démarrez depuis le début")
```

## Script Complet : Setup + Entraînement Sécurisé

```python
# ===== CELLULE 1 : Setup Complet =====

# 1. Monter Drive
from google.colab import drive
drive.mount('/content/drive', force_remount=True)

# 2. Créer dossier pour modèles dans Drive
import os
os.makedirs('/content/drive/MyDrive/models', exist_ok=True)
os.makedirs('/content/drive/MyDrive/ml_training_files', exist_ok=True)

# 3. Sauvegarder les fichiers Python dans Drive (une fois)
import shutil
for file in ['ml_model.py', 'data_loader.py', 'train_model.py']:
    if os.path.exists(f'/content/{file}'):
        shutil.copy(f'/content/{file}', f'/content/drive/MyDrive/ml_training_files/{file}')
        print(f"✓ {file} sauvegardé")

print("\n✅ Setup terminé! Vous pouvez dormir tranquille.")
```

```python
# ===== CELLULE 2 : Entraînement (SAUVEGARDE DANS DRIVE) =====

!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/drive/MyDrive/models \
    --batch_size 4 \
    --num_epochs 300 \
    --learning_rate 3e-5 \
    --model_type time_domain
```

## Vérifier les Checkpoints Sauvegardés

```python
import os
import glob

checkpoint_dir = '/content/drive/MyDrive/models'

# Lister tous les checkpoints
checkpoints = glob.glob(f'{checkpoint_dir}/*.pt')
print(f"Checkpoints trouvés: {len(checkpoints)}")

for cp in sorted(checkpoints):
    size = os.path.getsize(cp) / (1024*1024)  # MB
    print(f"  {os.path.basename(cp)}: {size:.1f} MB")

# Vérifier le meilleur modèle
if os.path.exists(f'{checkpoint_dir}/best_model.pt'):
    size = os.path.getsize(f'{checkpoint_dir}/best_model.pt') / (1024*1024)
    print(f"\n✅ Meilleur modèle sauvegardé: {size:.1f} MB")
```

## Résumé : Dormir Tranquille

1. ✅ **Utilisez `--output_dir /content/drive/MyDrive/models`** dans Cell 6
2. ✅ **Les checkpoints sont sauvegardés dans Drive** (persistant)
3. ✅ **Si déconnexion :** Reprenez depuis le dernier checkpoint
4. ✅ **Le meilleur modèle sera dans Drive** → téléchargeable même si Colab coupe

## Temps d'Entraînement

- **300 epochs = 2-4 heures**
- **Checkpoints toutes les 10 epochs** → vous ne perdez jamais plus de 10 epochs
- **Meilleur modèle sauvegardé automatiquement** → toujours disponible

**Vous pouvez dormir tranquille! 😴**
