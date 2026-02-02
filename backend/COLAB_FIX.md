# Quick Fix: Colab Syntax Error

## The Problem

You got this error:
```
SyntaxError: invalid syntax
```

## The Fix

**❌ WRONG:**
```python
python !pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

**✅ CORRECT:**
```python
!pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

## Explanation

In Google Colab (and Jupyter notebooks):
- `!` = Run as shell command
- `!pip install` = Install Python packages
- **Don't add `python` before `!`** - it's not needed!

## All Correct Commands for Colab

### Cell 1: Install Packages
```python
!pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

### Cell 2: Mount Drive
```python
from google.colab import drive
drive.mount('/content/drive')
```

### Cell 3: Extract Dataset
```python
import zipfile
import os

zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/dataset'

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

print("✓ Dataset extracted!")
```

### Cell 4: Copy Files (if needed)
```python
import shutil

# If you uploaded to a folder, replace 'YourFolderName'
drive_folder = '/content/drive/MyDrive/YourFolderName'

shutil.copy(f'{drive_folder}/ml_model.py', '/content/')
shutil.copy(f'{drive_folder}/data_loader.py', '/content/')
shutil.copy(f'{drive_folder}/train_model.py', '/content/')

print("✓ Files copied!")
```

**OR** just upload files via Colab UI (folder icon → Upload)

### Cell 5: Verify Dataset
```python
import os

raw_dir = '/content/dataset/raw'
mixed_dir = '/content/dataset/mixed'

raw_files = set(os.listdir(raw_dir))
mixed_files = set(os.listdir(mixed_dir))
matches = raw_files & mixed_files

print(f"✓ Found {len(matches)} matching pairs!")
```

### Cell 6: Start Training
```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 2 \
    --num_epochs 300 \
    --learning_rate 0.00003 \
    --segment_length 176400
```

**Note:** For `!python train_model.py`, the `python` is OK because you're running a Python script. But for `!pip install`, don't add `python` before it!

## Quick Rule

- **`!pip install`** = No `python` needed
- **`!python script.py`** = `python` is needed (running a script)

## Try Again!

1. Delete the cell with the error
2. Create a new cell
3. Copy-paste the correct command (without `python`):
   ```python
   !pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
   ```
4. Run it!

Good luck! 🚀
