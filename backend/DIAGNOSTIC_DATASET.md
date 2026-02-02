# Diagnostic Dataset - Colab

## Cell de Diagnostic (à lancer AVANT Cell 6)

Copiez cette cellule dans Colab et lancez-la pour voir ce qui ne va pas :

```python
import os

raw_dir = '/content/dataset/raw'
mixed_dir = '/content/dataset/mixed'

print("=== DIAGNOSTIC DATASET ===\n")

# Vérifier si les dossiers existent
print(f"1. Dossier raw existe: {os.path.exists(raw_dir)}")
print(f"2. Dossier mixed existe: {os.path.exists(mixed_dir)}\n")

if os.path.exists(raw_dir):
    raw_files = [f for f in os.listdir(raw_dir) if f.endswith(('.wav', '.mp3', '.flac'))]
    print(f"3. Fichiers dans raw/: {len(raw_files)} fichiers")
    if raw_files:
        print(f"   Exemples: {raw_files[:5]}")
else:
    print("3. Dossier raw/ n'existe pas!")
    raw_files = []

print()

if os.path.exists(mixed_dir):
    mixed_files = [f for f in os.listdir(mixed_dir) if f.endswith(('.wav', '.mp3', '.flac'))]
    print(f"4. Fichiers dans mixed/: {len(mixed_files)} fichiers")
    if mixed_files:
        print(f"   Exemples: {mixed_files[:5]}")
else:
    print("4. Dossier mixed/ n'existe pas!")
    mixed_files = []

print()

# Trouver les paires correspondantes
if raw_files and mixed_files:
    raw_set = set(raw_files)
    mixed_set = set(mixed_files)
    matches = raw_set & mixed_set  # Intersection
    
    print(f"5. Paires correspondantes: {len(matches)}")
    if matches:
        print(f"   Exemples: {list(matches)[:5]}")
    else:
        print("\n   ❌ PROBLÈME: Aucune paire correspondante!")
        print("\n   Fichiers dans raw mais pas dans mixed:")
        only_raw = raw_set - mixed_set
        print(f"   {list(only_raw)[:10]}")
        print("\n   Fichiers dans mixed mais pas dans raw:")
        only_mixed = mixed_set - raw_set
        print(f"   {list(only_mixed)[:10]}")

print("\n=== FIN DIAGNOSTIC ===")
```

## Solutions Possibles

### Problème 1: Dossiers n'existent pas
**Solution:** Relancez Cell 3 (extraction du dataset)

### Problème 2: Noms de fichiers ne correspondent pas
**Solution:** Les noms doivent être EXACTEMENT identiques (majuscules/minuscules comptent!)

Exemple:
- ✅ `raw/song1.wav` + `mixed/song1.wav` = OK
- ❌ `raw/song1.wav` + `mixed/Song1.wav` = PAS OK
- ❌ `raw/song1.wav` + `mixed/song1_mixed.wav` = PAS OK

### Problème 3: Fichiers dans mauvais format
**Solution:** Vérifiez que les fichiers sont `.wav`, `.mp3`, ou `.flac`

### Problème 4: Structure de dossiers incorrecte
**Solution:** Vérifiez la structure:
```
/content/dataset/
├── raw/
│   ├── vocal1.wav
│   └── vocal2.wav
└── mixed/
    ├── vocal1.wav
    └── vocal2.wav
```

## Script de Renommage (si nécessaire)

Si les noms ne correspondent pas, utilisez ce script pour les renommer:

```python
import os
import shutil

raw_dir = '/content/dataset/raw'
mixed_dir = '/content/dataset/mixed'

# Lister tous les fichiers
raw_files = sorted([f for f in os.listdir(raw_dir) if f.endswith(('.wav', '.mp3', '.flac'))])
mixed_files = sorted([f for f in os.listdir(mixed_dir) if f.endswith(('.wav', '.mp3', '.flac'))])

print(f"Raw files: {len(raw_files)}")
print(f"Mixed files: {len(mixed_files)}")

# Renommer pour correspondre (si même nombre)
if len(raw_files) == len(mixed_files):
    for i, (raw_file, mixed_file) in enumerate(zip(raw_files, mixed_files)):
        # Utiliser le nom du raw pour les deux
        base_name = os.path.splitext(raw_file)[0]
        ext = os.path.splitext(raw_file)[1]
        
        new_raw_name = f"{base_name}{ext}"
        new_mixed_name = f"{base_name}{ext}"
        
        # Renommer
        if raw_file != new_raw_name:
            os.rename(os.path.join(raw_dir, raw_file), os.path.join(raw_dir, new_raw_name))
        if mixed_file != new_mixed_name:
            os.rename(os.path.join(mixed_dir, mixed_file), os.path.join(mixed_dir, new_mixed_name))
        
        print(f"Renamed: {raw_file} + {mixed_file} -> {base_name}{ext}")
    
    print("\n✅ Renommage terminé! Relancez le diagnostic.")
else:
    print(f"\n❌ Nombre de fichiers différent! ({len(raw_files)} vs {len(mixed_files)})")
    print("Vous devez avoir le même nombre de fichiers dans raw/ et mixed/")
```
