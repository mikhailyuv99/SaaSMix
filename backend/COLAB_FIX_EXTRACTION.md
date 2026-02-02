# Fix Extraction - Solution Automatique

## Le Problème

Votre `dataset.zip` contient probablement:
- `dataset/raw/` et `dataset/mixed/` (dans le zip)
- Quand extrait → `/content/dataset/dataset/raw/` (imbriqué!)

## Solution Automatique

**Copiez-collez ceci dans Colab (corrige tout automatiquement):**

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
print("\nVérification de la structure...")
contents = os.listdir(extract_path)
print(f"Contenu extrait: {contents}")

# Gérer le cas imbriqué
if 'dataset' in contents:
    # Cas imbriqué: extract_path/dataset/raw et extract_path/dataset/mixed
    print("Structure imbriquée détectée, correction...")
    nested_dataset = f'{extract_path}/dataset'
    if os.path.exists(f'{nested_dataset}/raw') and os.path.exists(f'{nested_dataset}/mixed'):
        # Déplacer dataset/dataset vers dataset
        shutil.move(nested_dataset, final_path)
        print("✓ Structure corrigée!")
    else:
        print("❌ Structure inattendue dans le dossier imbriqué")
        print(f"   Contenu: {os.listdir(nested_dataset)}")
elif 'raw' in contents and 'mixed' in contents:
    # Cas direct: extract_path/raw et extract_path/mixed
    print("Structure directe détectée")
    os.makedirs(final_path)
    shutil.move(f'{extract_path}/raw', f'{final_path}/raw')
    shutil.move(f'{extract_path}/mixed', f'{final_path}/mixed')
    print("✓ Fichiers déplacés!")
else:
    print(f"❌ Structure inattendue: {contents}")
    print("   Vérifiez manuellement le contenu du zip")

# Nettoyer
if os.path.exists(extract_path):
    shutil.rmtree(extract_path)

# Vérifier le résultat final
if os.path.exists(f'{final_path}/raw') and os.path.exists(f'{final_path}/mixed'):
    raw_count = len(os.listdir(f'{final_path}/raw'))
    mixed_count = len(os.listdir(f'{final_path}/mixed'))
    print(f"\n✓ Dataset prêt!")
    print(f"✓ Fichiers raw: {raw_count}")
    print(f"✓ Fichiers mixed: {mixed_count}")
    print(f"✓ Chemin: {final_path}/raw et {final_path}/mixed")
else:
    print(f"\n❌ Erreur: raw ou mixed introuvable dans {final_path}")
    print(f"   Contenu de {final_path}: {os.listdir(final_path) if os.path.exists(final_path) else 'n\'existe pas'}")
```

**Cette cellule:**
1. ✅ Extrait le zip
2. ✅ Détecte si c'est imbriqué ou non
3. ✅ Corrige automatiquement
4. ✅ Vérifie que tout est bon

**Utilisez cette cellule au lieu de Cell 3!** 🚀
