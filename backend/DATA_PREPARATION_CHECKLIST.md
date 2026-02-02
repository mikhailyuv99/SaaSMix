# Data Preparation Checklist

Quick checklist to organize your raw/mixed vocal pairs for training.

## ✅ What You Need

- [ ] **Raw acapella vocals** (unprocessed, no effects)
- [ ] **Mixed acapella vocals** (your professional mixes, same songs)
- [ ] **Matching filenames** (same name in both folders)

## 📁 Folder Structure

Create this structure:

```
dataset/
├── raw/          (put all RAW vocals here)
│   ├── song1.wav
│   ├── song2.wav
│   └── ...
└── mixed/        (put all MIXED vocals here - same names!)
    ├── song1.wav
    ├── song2.wav
    └── ...
```

## ✅ Checklist

### Step 1: Collect All Pairs
- [ ] Find all raw vocals you have
- [ ] Find matching mixed vocals
- [ ] Make sure they're from the same recording
- [ ] Verify they're acapella (no instrumentals)

### Step 2: Organize Files
- [ ] Create `dataset/raw/` folder
- [ ] Create `dataset/mixed/` folder
- [ ] Copy raw vocals to `raw/` folder
- [ ] Copy mixed vocals to `mixed/` folder
- [ ] **IMPORTANT:** Make sure filenames match exactly!

### Step 3: Verify
- [ ] Count files in `raw/` folder
- [ ] Count files in `mixed/` folder
- [ ] Check that numbers match
- [ ] Check that filenames match (e.g., `song1.wav` in both)

### Step 4: Quality Check
- [ ] Both files are same length (or close)
- [ ] Both are same sample rate (44100 Hz recommended)
- [ ] Both are WAV format (or MP3/FLAC - both work)
- [ ] No corrupted files

## 💡 Tips

1. **Filename matching is critical!**
   - `raw/song1.wav` must match `mixed/song1.wav`
   - Case-sensitive on some systems (use lowercase)

2. **More is better, but start with what you have:**
   - 50 pairs = Good start
   - 100 pairs = Better
   - 200+ pairs = Great!

3. **Quality over quantity:**
   - Better to have 50 good pairs than 100 bad ones
   - Make sure raw/mixed actually match

4. **Don't worry about:**
   - Different file sizes (code handles it)
   - Some silence in songs (code skips it automatically)
   - Slight length differences (code aligns them)

## 🚀 When You're Ready

Once you have your pairs organized:

1. **Zip the dataset folder:**
   ```
   Right-click dataset folder → Compress → dataset.zip
   ```

2. **Upload to Google Drive** (for Colab training)

3. **Start training!** (Follow `BEGINNER_GUIDE.md`)

## 📊 Quick Count Script

Want to verify your pairs? Run this in PowerShell (in your dataset folder):

```powershell
cd dataset
$raw = (Get-ChildItem raw -Filter *.wav).Count
$mixed = (Get-ChildItem mixed -Filter *.wav).Count
Write-Host "Raw files: $raw"
Write-Host "Mixed files: $mixed"
Write-Host "Matching pairs: $([Math]::Min($raw, $mixed))"
```

Good luck collecting your pairs! 🎵
