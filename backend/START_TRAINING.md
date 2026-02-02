# Start Training with Your 29 Pairs! 🚀

You're ready to train! Follow these steps.

---

## Step 1: Verify Your Dataset

**Run this to check everything is correct:**

```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix\backend"
python verify_dataset.py "C:\Users\mikha\Desktop\dataset\raw" "C:\Users\mikha\Desktop\dataset\mixed"
```

**Or if your dataset is in a different location:**

```powershell
python verify_dataset.py "<path_to_raw_folder>" "<path_to_mixed_folder>"
```

**What to look for:**
- ✓ Should show "29 matching pairs"
- ✓ No errors
- ✓ Ready to train message

---

## Step 2: Prepare for Google Colab

### A. Zip Your Dataset

1. Right-click your `dataset` folder
2. Select "Compress" or "Send to > Compressed folder"
3. You'll get `dataset.zip`

### B. Upload to Google Drive

1. Go to https://drive.google.com
2. Upload `dataset.zip` to your Drive
3. Also upload these files from `backend` folder:
   - `ml_model.py`
   - `data_loader.py`
   - `train_model.py`

---

## Step 3: Open Google Colab

1. Go to https://colab.research.google.com
2. Click "New Notebook"

---

## Step 4: Copy-Paste Training Code

**Copy each cell below into Colab and run them:**

### Cell 1: Install Packages
```python
!pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

**⚠️ IMPORTANT:** In Colab, just use `!pip install` - don't add `python` before it!

### Cell 2: Mount Google Drive
```python
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
```
*(Click the link, authorize, copy the code, paste it)*

**⚠️ If you get "mount failed" error:**
1. Click **Runtime** → **Restart runtime**
2. Try again, or use **Alternative Method** below (direct upload - easier!)

### Cell 3: Extract Dataset
```python
import zipfile
import os

# Replace 'dataset.zip' with your actual zip file name
zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/dataset'

print("Extracting dataset...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

print("✓ Dataset extracted!")
print(f"Found {len(os.listdir(extract_path + '/raw'))} raw files")
print(f"Found {len(os.listdir(extract_path + '/mixed'))} mixed files")
```

### Cell 4: Copy Training Files
```python
import shutil

# Option A: If you uploaded files to a folder, replace 'YourFolderName'
drive_folder = '/content/drive/MyDrive/YourFolderName'

# Option B: Or upload via Colab UI (folder icon → Upload)
# Then skip this cell

shutil.copy(f'{drive_folder}/ml_model.py', '/content/')
shutil.copy(f'{drive_folder}/data_loader.py', '/content/')
shutil.copy(f'{drive_folder}/train_model.py', '/content/')

print("✓ Files copied!")
```

**OR upload files via Colab UI (EASIER - Recommended!):**
1. Click folder icon (left sidebar)
2. Click "Upload" button
3. Upload: `ml_model.py`, `data_loader.py`, `train_model.py`
4. **Also upload `dataset.zip` here!** (Skip Drive mounting if you do this)

**Alternative: Skip Drive, Upload Everything Directly**
- Upload `dataset.zip` to Colab
- Upload the 3 Python files to Colab
- Skip Cell 2 (Drive mount) and Cell 4 (copy files)
- Go straight to Cell 3 (extract dataset) - but change path to `/content/dataset.zip`

### Cell 5: Verify Dataset
```python
import os

raw_dir = '/content/dataset/raw'
mixed_dir = '/content/dataset/mixed'

raw_files = set(os.listdir(raw_dir))
mixed_files = set(os.listdir(mixed_dir))
matches = raw_files & mixed_files

print(f"✓ Found {len(matches)} matching pairs!")
if len(matches) == 29:
    print("✓ Perfect! All 29 pairs found!")
else:
    print(f"⚠️  Expected 29, found {len(matches)}")
```

### Cell 6: START TRAINING! 🚀
```python
# Ultra-optimized for 29 pairs
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 2 \
    --num_epochs 300 \
    --learning_rate 0.00003 \
    --segment_length 176400
```

**This will take 6-12 hours!** You can close the browser, it will keep running.

---

## Step 5: Monitor Training

**What you'll see:**
- Progress bars
- Loss numbers (should decrease: 0.5 → 0.4 → 0.3 → 0.2)
- Time estimates
- Epoch progress (1/300, 2/300, etc.)

**Good signs:**
- ✅ Loss decreasing steadily
- ✅ Training loss and validation loss similar
- ✅ Progress bars moving

**Bad signs:**
- ❌ Loss not changing
- ❌ Validation loss much higher than training loss
- ❌ Errors in output

---

## Step 6: Download Your Model

**When training finishes (look for "Training complete!"):**

```python
from google.colab import files

model_path = '/content/models/best_model.pt'
files.download(model_path)
print("✓ Downloaded! Save to: backend/models/best_model.pt")
```

**Or:**
1. Click folder icon (left sidebar)
2. Navigate to `models` folder
3. Right-click `best_model.pt` → Download

**Save it to:** `C:\Users\mikha\Desktop\SaaS Mix\backend\models\best_model.pt`

---

## Step 7: Test Your Model

**Create `test_model.py`:**

```python
from audio_processor import AudioProcessor

# Load your trained model
processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)

# Test on a vocal
audio, sr = processor.load_audio('C:/Users/mikha/Desktop/test_vocal.wav')
processed = processor.process_vocal(audio, {})
processor.save_audio(processed, 'C:/Users/mikha/Desktop/output.wav')

print("✓ Done! Check output.wav")
```

**Run it:**
```powershell
python test_model.py
```

---

## Troubleshooting

### "No matching pairs found"
- Check filenames match exactly
- Check both folders exist
- Run `verify_dataset.py` to see what's wrong

### Training too slow
- This is normal for 29 pairs (6-12 hours)
- Be patient, it's learning!

### Out of memory
- Reduce batch_size to 1
- Reduce segment_length to 88200 (2 seconds)

### Loss not decreasing
- Check your raw/mixed pairs actually match
- Make sure data quality is good
- Try different learning rate (0.00005 or 0.00001)

---

## Quick Reference

**Training command (29 pairs):**
```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 2 \
    --num_epochs 300 \
    --learning_rate 0.00003
```

**Expected time:** 6-12 hours

**What to watch:** Loss decreasing steadily

---

## You're Ready! 🎉

1. ✅ Verify dataset (`verify_dataset.py`)
2. ✅ Zip and upload to Drive
3. ✅ Open Colab
4. ✅ Copy-paste cells
5. ✅ Start training!
6. ✅ Wait 6-12 hours
7. ✅ Download model
8. ✅ Test it!

**Good luck! Your model will learn your mixing style from those 29 pairs!** 🚀
