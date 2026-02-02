# Google Colab Training Notebook

Copy this entire notebook into Google Colab for easy training!

## How to Use

1. Go to https://colab.research.google.com
2. Click "New Notebook"
3. Copy each section below into a separate cell
4. Run cells in order
5. Upload your dataset to Google Drive first!

---

## Cell 1: Install Packages

```python
!pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

---

## Cell 2: Mount Google Drive

```python
from google.colab import drive
drive.mount('/content/drive')
print("Drive mounted! Now upload your dataset.zip to Drive.")
```

**After running:** Click the link, authorize, copy the code, paste it.

---

## Cell 3: Upload Training Files

**Option A: Upload via Colab UI**
1. Click folder icon (left sidebar)
2. Click "Upload" button
3. Upload: `ml_model.py`, `data_loader.py`, `train_model.py`

**Option B: Copy from Drive**
```python
import shutil

# Replace 'YourFolderName' with where you uploaded the files
drive_folder = '/content/drive/MyDrive/YourFolderName'

shutil.copy(f'{drive_folder}/ml_model.py', '/content/')
shutil.copy(f'{drive_folder}/data_loader.py', '/content/')
shutil.copy(f'{drive_folder}/train_model.py', '/content/')

print("Files copied!")
```

---

## Cell 4: Extract Dataset

```python
import zipfile
import os

# Replace 'dataset.zip' with your actual zip file name
zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/dataset'

print("Extracting dataset...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

print("Done! Dataset extracted to /content/dataset")
print(f"Found {len(os.listdir(extract_path + '/raw'))} raw files")
print(f"Found {len(os.listdir(extract_path + '/mixed'))} mixed files")
```

---

## Cell 5: Verify Dataset

```python
import os

raw_dir = '/content/dataset/raw'
mixed_dir = '/content/dataset/mixed'

raw_files = set(os.listdir(raw_dir))
mixed_files = set(os.listdir(mixed_dir))

# Find matching pairs
matches = raw_files & mixed_files
print(f"Found {len(matches)} matching pairs!")

if len(matches) == 0:
    print("ERROR: No matching files found!")
    print("Make sure filenames match exactly in both folders.")
else:
    print("✓ Dataset looks good!")
    print(f"Sample files: {list(matches)[:5]}")
```

---

## Cell 6: Start Training

```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 8 \
    --num_epochs 100 \
    --learning_rate 0.0001 \
    --sample_rate 44100
```

**This will take 2-24 hours!** You can close the browser, it will keep running.

---

## Cell 7: Check Training Progress (Run Anytime)

```python
import os

log_dir = '/content/models/logs'
if os.path.exists(log_dir):
    print("Training logs found!")
    print("Run: tensorboard --logdir /content/models/logs")
    print("Then click the tensorboard link above")
else:
    print("Training hasn't started yet or no logs created.")
```

---

## Cell 8: Download Model (After Training Completes)

```python
from google.colab import files

model_path = '/content/models/best_model.pt'

if os.path.exists(model_path):
    print("Downloading best_model.pt...")
    files.download(model_path)
    print("✓ Downloaded! Save it to: backend/models/best_model.pt")
else:
    print("Model not found. Training may still be running.")
    print("Check Cell 6 output for status.")
```

---

## Cell 9: Test Model (Optional - After Download)

```python
# This is just to verify the model works
# You'll do real testing on your local machine

import torch
from ml_model import load_model

device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = load_model('/content/models/best_model.pt', 'time_domain', device)

print("✓ Model loaded successfully!")
print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
```

---

## Tips for Colab

1. **Don't close browser immediately** - Wait 5 minutes to make sure training started
2. **Colab disconnects after 90 min inactivity** - Training will stop. Check back regularly.
3. **Free GPU limit** - You get ~12 hours/day free. Plan training accordingly.
4. **Save checkpoints** - Model saves every epoch, so you can resume if disconnected
5. **Monitor progress** - Check Cell 6 output regularly

---

## Resume Training (If Disconnected)

```python
# Find the latest checkpoint
import os
checkpoints = [f for f in os.listdir('/content/models') if f.startswith('checkpoint_epoch_')]
if checkpoints:
    latest = sorted(checkpoints)[-1]
    print(f"Resuming from: {latest}")
    
    !python train_model.py \
        --raw_dir /content/dataset/raw \
        --mixed_dir /content/dataset/mixed \
        --output_dir /content/models \
        --batch_size 8 \
        --num_epochs 100 \
        --resume_from /content/models/{latest}
```

---

## Complete Notebook (All Cells Together)

Just copy-paste this entire section into Colab:

```python
# ===== CELL 1: Install =====
!pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm

# ===== CELL 2: Mount Drive =====
from google.colab import drive
drive.mount('/content/drive')

# ===== CELL 3: Copy Files =====
import shutil
drive_folder = '/content/drive/MyDrive/YourFolderName'  # CHANGE THIS!
shutil.copy(f'{drive_folder}/ml_model.py', '/content/')
shutil.copy(f'{drive_folder}/data_loader.py', '/content/')
shutil.copy(f'{drive_folder}/train_model.py', '/content/')

# ===== CELL 4: Extract Dataset =====
import zipfile
zip_path = '/content/drive/MyDrive/dataset.zip'  # CHANGE THIS!
extract_path = '/content/dataset'
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

# ===== CELL 5: Verify =====
import os
raw_files = set(os.listdir('/content/dataset/raw'))
mixed_files = set(os.listdir('/content/dataset/mixed'))
matches = raw_files & mixed_files
print(f"Found {len(matches)} matching pairs!")

# ===== CELL 6: Train =====
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 8 \
    --num_epochs 100

# ===== CELL 7: Download =====
from google.colab import files
files.download('/content/models/best_model.pt')
```

**Remember to:**
1. Change `YourFolderName` to your actual folder
2. Change `dataset.zip` to your actual zip file name
3. Upload files to Drive first!

Good luck! 🚀
