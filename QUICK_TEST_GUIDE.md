# Quick Test Guide - Super Simple! 🚀

## Method 1: Drag & Drop (Easiest!)

1. **Find your WAV files**
   - **Vocal file** (required)
   - **Instrumental file** (optional - only if you want full mix)
2. **Drag 1 or 2 files** onto `quick_test.py`
   - 1 file = processed vocal only
   - 2 files = processed vocal + full mix
3. **Wait 30-60 seconds**
4. **Done!** Files will open automatically in your audio player

### How to use:
- Right-click `quick_test.py` → "Open with" → Python
- Or drag files onto it in File Explorer

## Method 2: Command Line (Still Easy!)

1. Open PowerShell in the `backend` folder
2. Activate virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Run (vocal only):
   ```powershell
   python quick_test.py "C:\path\to\vocal.wav"
   ```
   Or (vocal + instrumental):
   ```powershell
   python quick_test.py "C:\path\to\vocal.wav" "C:\path\to\instrumental.wav"
   ```

## Method 3: Interactive Script

1. Open PowerShell in the `backend` folder
2. Activate virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Run:
   ```powershell
   python test_mix.py
   ```
4. Follow the prompts - it will ask you for everything!

## Output Files

Both scripts will **always** create:
- **Processed vocal** - Your vocal with all effects applied

If you provide an instrumental, you'll also get:
- **Full mix** - Processed vocal mixed with instrumental

Files are saved in your temp folder and will open automatically!

## Tips

- **File format**: Must be WAV files
- **Processing time**: Usually 30-60 seconds
- **Preset**: Defaults to "Modern Clean" (can change in interactive mode)
- **Auto-open**: Files will try to open in your default audio player

## Troubleshooting

**"File not found" error:**
- Make sure file paths are correct
- Use quotes around paths with spaces: `"C:\My Files\vocal.wav"`

**"Module not found" error:**
- Make sure you activated the virtual environment first!

**Files don't open automatically:**
- Just navigate to the temp folder and open them manually
- Path is shown in the output
