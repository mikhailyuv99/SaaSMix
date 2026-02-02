# Fix: Dataset Extraction Error

## The Problem

You got:
```
FileNotFoundError: [Errno 2] No such file or directory: '/content/dataset/raw'
```

## The Cause

Your `dataset.zip` probably has a nested structure:
- `dataset.zip` contains `dataset/raw/` and `dataset/mixed/`
- When extracted, it becomes `/content/dataset/dataset/raw/` (nested!)

## Quick Fix

**Run this cell to check what's actually there:**

```python
import os

# Check what's in /content/dataset
print("Contents of /content/dataset:")
for item in os.listdir('/content/dataset'):
    print(f"  - {item}")

# Check if there's a nested dataset folder
if 'dataset' in os.listdir('/content/dataset'):
    print("\n⚠️  Found nested 'dataset' folder!")
    print("   Actual path: /content/dataset/dataset/raw")
    print("   Fix: Use nested path or re-extract")
```

## Solution 1: Use Nested Path

**If you have nested structure, use this:**

```python
import zipfile
import os

zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content'

# Extract to /content (not /content/dataset)
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

# Check structure
print("Checking structure...")
if os.path.exists('/content/dataset/raw'):
    raw_path = '/content/dataset/raw'
    mixed_path = '/content/dataset/mixed'
elif os.path.exists('/content/dataset/dataset/raw'):
    raw_path = '/content/dataset/dataset/raw'
    mixed_path = '/content/dataset/dataset/mixed'
    print("⚠️  Using nested path")
else:
    print("❌ Can't find raw/mixed folders!")
    print("Contents:", os.listdir('/content'))

print(f"\n✓ Raw files: {len(os.listdir(raw_path))}")
print(f"✓ Mixed files: {len(os.listdir(mixed_path))}")
```

## Solution 2: Fix Extraction (Recommended)

**Extract and handle nested structure automatically:**

```python
import zipfile
import os
import shutil

zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/temp_extract'
final_path = '/content/dataset'

# Extract to temp location
print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

# Check if nested
if os.path.exists(f'{extract_path}/dataset'):
    # Has nested dataset folder
    print("Found nested structure, fixing...")
    if os.path.exists(final_path):
        shutil.rmtree(final_path)
    shutil.move(f'{extract_path}/dataset', final_path)
else:
    # No nesting, move everything
    if os.path.exists(final_path):
        shutil.rmtree(final_path)
    os.makedirs(final_path)
    for item in os.listdir(extract_path):
        shutil.move(f'{extract_path}/{item}', f'{final_path}/{item}')

# Clean up
shutil.rmtree(extract_path)

# Verify
print("✓ Dataset extracted!")
print(f"✓ Raw files: {len(os.listdir(final_path + '/raw'))}")
print(f"✓ Mixed files: {len(os.listdir(final_path + '/mixed'))}")
```

## Solution 3: Re-zip Correctly (If You Can)

**If you can re-zip, do this:**

1. **Don't zip the `dataset` folder itself**
2. **Select the contents** (raw and mixed folders)
3. **Right-click → Compress**

This way the zip contains `raw/` and `mixed/` directly, not `dataset/raw/` and `dataset/mixed/`.

---

## Quick Test Cell

**Run this to see what you have:**

```python
import os

# Check structure
base = '/content/dataset'
print("Checking /content/dataset...")
if os.path.exists(base):
    print("Contents:", os.listdir(base))
    
    # Check for nested
    if 'dataset' in os.listdir(base):
        nested = f'{base}/dataset'
        print(f"\nFound nested folder: {nested}")
        print("Contents:", os.listdir(nested))
        
        if os.path.exists(f'{nested}/raw'):
            print("\n✓ Use path: /content/dataset/dataset/raw")
        else:
            print("\n❌ Still can't find raw folder")
    elif os.path.exists(f'{base}/raw'):
        print("\n✓ Use path: /content/dataset/raw")
    else:
        print("\n❌ Can't find raw folder")
else:
    print("❌ /content/dataset doesn't exist!")
```

---

## Recommended: Use Solution 2

**Copy-paste this (handles everything automatically):**

```python
import zipfile
import os
import shutil

zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/temp_extract'
final_path = '/content/dataset'

# Extract
print("Extracting dataset...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

# Handle nested structure
if os.path.exists(f'{extract_path}/dataset'):
    # Nested: move dataset/dataset to dataset
    if os.path.exists(final_path):
        shutil.rmtree(final_path)
    shutil.move(f'{extract_path}/dataset', final_path)
else:
    # Not nested: move raw/mixed to dataset
    if os.path.exists(final_path):
        shutil.rmtree(final_path)
    os.makedirs(final_path)
    for item in os.listdir(extract_path):
        if item in ['raw', 'mixed']:
            shutil.move(f'{extract_path}/{item}', f'{final_path}/{item}')

# Clean up
shutil.rmtree(extract_path)

# Verify
raw_count = len(os.listdir(f'{final_path}/raw'))
mixed_count = len(os.listdir(f'{final_path}/mixed'))
print(f"✓ Dataset extracted!")
print(f"✓ Raw files: {raw_count}")
print(f"✓ Mixed files: {mixed_count}")
```

This will work regardless of how you zipped it! 🚀
