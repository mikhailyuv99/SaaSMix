# Complete Beginner's Guide to Training Your Vocal Mixing AI

**No coding or ML experience needed!** This guide will walk you through everything step by step.

---

## Part 1: Understanding What We're Doing (Simple Explanation)

### What is a Neural Network?
Think of it like this:
- You show a computer **thousands of examples** of raw vocals → mixed vocals
- The computer **learns the pattern** (like how you mix)
- After learning, it can **automatically mix new vocals** the same way

**Real-world example:** 
- You show it 500 pairs: "This raw vocal → This mixed vocal"
- It learns: "Oh, I see! You always cut the low end, add compression, add saturation..."
- Then when you give it a NEW raw vocal, it applies what it learned

### Why This Works Better Than DSP
- **DSP (what we had)**: We manually coded rules like "cut 110Hz, compress at -12dB..."
- **ML (what we're doing)**: The computer learns YOUR exact style from your examples
- **Result**: It can match professional quality because it learned from professional mixes!

---

## Part 2: What You Need

### 1. Your Dataset (Most Important!)
You need:
- **Raw vocals** (unprocessed)
- **Mixed vocals** (your professional mixes)
- **Matching pairs** (same song, one raw, one mixed)

**How many?**
- Minimum: 50 pairs (to test if it works)
- Good: 200-500 pairs (decent quality)
- Great: 1000+ pairs (professional quality)

### 2. A Computer
- **Windows, Mac, or Linux** - all work
- **GPU is helpful but not required** (we'll use Google Colab for free GPU)

### 3. Internet Connection
- To download Python packages
- To use Google Colab (if you don't have a GPU)

---

## Part 3: Step-by-Step Setup

### Step 1: Install Python (If You Don't Have It)

**Check if you have Python:**
1. Open PowerShell (Windows) or Terminal (Mac/Linux)
2. Type: `python --version`
3. If you see a version number (like "Python 3.10.4"), you're good!
4. If you see an error, install Python from https://www.python.org/downloads/

**During installation:**
- ✅ Check "Add Python to PATH" (important!)

### Step 2: Organize Your Data

**Create folders:**
```
On your Desktop, create:
dataset/
├── raw/     (put all your RAW vocals here)
└── mixed/   (put all your MIXED vocals here)
```

**Important rules:**
1. **Same filenames!** 
   - If raw file is `song1.wav`, mixed file must also be `song1.wav`
   - They can be in different folders, but names must match

2. **Example:**
   ```
   dataset/raw/song1.wav
   dataset/raw/song2.wav
   dataset/mixed/song1.wav  ← same name!
   dataset/mixed/song2.wav  ← same name!
   ```

3. **File formats:** WAV, MP3, or FLAC all work

**How to organize:**
1. Create folder: `C:\Users\YourName\Desktop\dataset`
2. Inside, create two folders: `raw` and `mixed`
3. Copy all raw vocals to `raw` folder
4. Copy all mixed vocals to `mixed` folder
5. Make sure filenames match!

---

## Part 4: Install Required Software

### Step 1: Open PowerShell/Terminal

**Windows:**
- Press `Windows Key + X`
- Click "Windows PowerShell" or "Terminal"

**Mac:**
- Press `Cmd + Space`
- Type "Terminal" and press Enter

### Step 2: Navigate to Your Project

```powershell
# Go to your project folder
cd "C:\Users\mikha\Desktop\SaaS Mix\backend"
```

(Replace with your actual path if different)

### Step 3: Install Python Packages

```powershell
# Install everything needed
pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

**This will take 5-10 minutes** (downloading ~2GB of files)

**If you get errors:**
- Make sure Python is installed
- Try: `python -m pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm`

---

## Part 5: Training Your Model (The Easy Way - Google Colab)

**Why Google Colab?**
- Free GPU (makes training 10x faster)
- No setup needed
- Works in your browser

### Step 1: Prepare Your Data

1. **Zip your dataset:**
   - Right-click your `dataset` folder
   - Select "Compress" or "Send to > Compressed folder"
   - You'll get `dataset.zip`

2. **Upload to Google Drive:**
   - Go to https://drive.google.com
   - Upload `dataset.zip` to your Drive
   - Also upload these files from your `backend` folder:
     - `ml_model.py`
     - `data_loader.py`
     - `train_model.py`

### Step 2: Open Google Colab

1. Go to https://colab.research.google.com
2. Click "New Notebook"

### Step 3: Set Up Colab Notebook

**Copy and paste this code into Colab cells:**

**Cell 1: Install packages**
```python
!pip install torch torchaudio librosa soundfile scipy numpy tensorboard tqdm
```

**Cell 2: Mount Google Drive**
```python
from google.colab import drive
drive.mount('/content/drive')
```

**Cell 3: Extract dataset**
```python
import zipfile
import os

# Extract your dataset (replace 'YourFolderName' with your actual folder name)
zip_path = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/dataset'

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)

print("Dataset extracted!")
```

**Cell 4: Copy training files**
```python
import shutil

# Copy files from Drive to Colab (replace 'YourFolderName' with your actual folder)
drive_path = '/content/drive/MyDrive/YourFolderName'
colab_path = '/content'

shutil.copy(f'{drive_path}/ml_model.py', colab_path)
shutil.copy(f'{drive_path}/data_loader.py', colab_path)
shutil.copy(f'{drive_path}/train_model.py', colab_path)

print("Files copied!")
```

**Cell 5: Start Training**
```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 8 \
    --num_epochs 100 \
    --learning_rate 0.0001
```

### Step 4: Monitor Training

**In Colab, you'll see:**
- Progress bars showing training progress
- Loss numbers (should decrease over time)
- Time remaining

**What to watch:**
- Loss should go DOWN (e.g., 0.5 → 0.3 → 0.2)
- If loss stops decreasing, training is done
- Training takes 2-24 hours depending on data size

### Step 5: Download Your Trained Model

**When training finishes:**
1. Look for: `Best model saved to: /content/models/best_model.pt`
2. In Colab, click folder icon (left sidebar)
3. Navigate to `models` folder
4. Right-click `best_model.pt` → Download

**Save it to:** `C:\Users\mikha\Desktop\SaaS Mix\backend\models\best_model.pt`

---

## Part 6: Training Your Model (Local - If You Have GPU)

**Only do this if you have an NVIDIA GPU!**

### Step 1: Check If You Have GPU

```powershell
python -c "import torch; print('CUDA available:', torch.cuda.is_available())"
```

**If it says `True`:** You have GPU! Continue below.
**If it says `False`:** Use Google Colab method above instead.

### Step 2: Start Training

```powershell
# Make sure you're in the backend folder
cd "C:\Users\mikha\Desktop\SaaS Mix\backend"

# Start training (replace paths with YOUR actual dataset path)
python train_model.py `
    --raw_dir "C:\Users\mikha\Desktop\dataset\raw" `
    --mixed_dir "C:\Users\mikha\Desktop\dataset\mixed" `
    --output_dir ".\models" `
    --batch_size 8 `
    --num_epochs 100
```

**What you'll see:**
- Progress bars
- Loss numbers decreasing
- Time estimates

**Training time:**
- 50 pairs: ~2-4 hours
- 500 pairs: ~12-24 hours
- 1000+ pairs: 1-3 days

### Step 3: Monitor Training (Optional)

**In a NEW PowerShell window:**
```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix\backend"
tensorboard --logdir .\models\logs
```

**Then open:** http://localhost:6006 in your browser
- You'll see graphs showing training progress

---

## Part 7: Using Your Trained Model

### Step 1: Test the Model

**Create a test script:** `test_ml_model.py`

```python
from audio_processor import AudioProcessor

# Load your trained model
processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)

# Load a test vocal
audio, sr = processor.load_audio('C:/Users/mikha/Desktop/test_vocal.wav')

# Process it
processed = processor.process_vocal(audio, {})

# Save result
processor.save_audio(processed, 'C:/Users/mikha/Desktop/output.wav')

print("Done! Check output.wav")
```

**Run it:**
```powershell
python test_ml_model.py
```

### Step 2: Use in Your App

**In your `mixing_service.py` or `main.py`:**

```python
from audio_processor import AudioProcessor

# Instead of this:
# processor = AudioProcessor()

# Use this:
processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)
```

**That's it!** Your app will now use the ML model instead of DSP.

---

## Part 8: Troubleshooting

### Problem: "No module named 'torch'"
**Solution:** Run `pip install torch torchaudio` again

### Problem: "CUDA out of memory"
**Solution:** Reduce batch size:
```powershell
--batch_size 4  # instead of 8
```

### Problem: "No matching pairs found"
**Solution:** 
- Check filenames match exactly
- Check both folders exist
- Check files are .wav, .mp3, or .flac

### Problem: Training is too slow
**Solution:** 
- Use Google Colab (free GPU)
- Or reduce batch_size to 2-4
- Or reduce segment_length (in train_model.py, change `44100 * 4` to `44100 * 2`)

### Problem: Model sounds bad
**Solutions:**
- Need more training data (get 200+ pairs)
- Train for more epochs (try 200 instead of 100)
- Check your raw/mixed pairs actually match
- Make sure data quality is good

### Problem: "File not found" errors
**Solution:** 
- Use full paths: `C:/Users/YourName/Desktop/dataset/raw`
- Or use relative paths from where you run the command

---

## Part 9: Understanding Training Output

**What you'll see during training:**

```
Epoch 1/100
  Train Loss: 0.523456
  Val Loss: 0.512345
  LR: 1.00e-04
```

**What this means:**
- **Epoch**: One complete pass through all your data
- **Train Loss**: How wrong the model is (lower = better)
- **Val Loss**: How well it works on new data (lower = better)
- **LR**: Learning rate (how fast it learns)

**Good signs:**
- ✅ Loss decreases: `0.5 → 0.4 → 0.3 → 0.2`
- ✅ Train and Val loss are similar
- ✅ Loss stabilizes (stops decreasing much)

**Bad signs:**
- ❌ Loss increases
- ❌ Loss doesn't change
- ❌ Val loss much higher than train loss

---

## Part 10: Quick Reference

### Training Command (Google Colab)
```python
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --output_dir /content/models \
    --batch_size 8 \
    --num_epochs 100
```

### Training Command (Local GPU)
```powershell
python train_model.py `
    --raw_dir "C:\path\to\dataset\raw" `
    --mixed_dir "C:\path\to\dataset\mixed" `
    --output_dir ".\models" `
    --batch_size 8 `
    --num_epochs 100
```

### Test Model
```python
from audio_processor import AudioProcessor

processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)

audio, sr = processor.load_audio('test.wav')
processed = processor.process_vocal(audio, {})
processor.save_audio(processed, 'output.wav')
```

---

## Summary: The Complete Process

1. **Organize data** → Put raw/mixed pairs in folders
2. **Install packages** → `pip install torch torchaudio ...`
3. **Train model** → Run `train_model.py` (Colab or local)
4. **Wait** → 2-24 hours depending on data
5. **Download model** → Get `best_model.pt`
6. **Use model** → Load in `AudioProcessor`
7. **Test** → Process a vocal and listen!

---

## Need Help?

**Common questions:**
- **"How do I know if it's working?"** → Loss should decrease, check output audio
- **"How long does it take?"** → 2-24 hours depending on data size
- **"Do I need a GPU?"** → No, but it's 10x faster. Use Colab for free GPU.
- **"How much data do I need?"** → Minimum 50 pairs, recommended 500+

**If stuck:**
- Check error messages carefully
- Make sure all paths are correct
- Verify your data is organized correctly
- Try with a small dataset first (10-20 pairs) to test

Good luck! 🚀
