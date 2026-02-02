# Neural Audio Model Training Guide

This guide will help you train a professional-quality neural audio model to compete with services like Cryo Mix.

## Prerequisites

1. **GPU** (recommended) - Training on CPU is possible but very slow
   - NVIDIA GPU with CUDA support (8GB+ VRAM recommended)
   - Or use Google Colab (free GPU access)

2. **Dataset** - Raw and mixed vocal pairs
   - Minimum: 50-100 pairs for initial testing
   - Recommended: 500+ pairs for production quality
   - More data = better results

3. **Python packages** - Already in requirements.txt:
   - torch, torchaudio
   - tensorboard (for monitoring)
   - tqdm (progress bars)

## Dataset Preparation

### Directory Structure

Organize your dataset like this:

```
dataset/
├── raw/
│   ├── vocal1.wav
│   ├── vocal2.wav
│   └── ...
└── mixed/
    ├── vocal1.wav
    ├── vocal2.wav
    └── ...
```

**Important:**
- Raw and mixed files must have **matching filenames**
- Both should be WAV format (MP3/FLAC also supported)
- Same sample rate (44100 Hz recommended)
- Same length (will be handled automatically)

### Data Quality Tips

1. **Normalize levels** - Ensure both raw and mixed are at similar levels
2. **Match lengths** - Raw and mixed should be from the same recording
3. **Variety** - Include different vocal styles, genres, and recording qualities
4. **Clean data** - Remove any corrupted or misaligned files

## Training Steps

### Step 1: Prepare Your Data

```bash
# Example structure
mkdir -p dataset/raw
mkdir -p dataset/mixed

# Copy your raw vocals to dataset/raw/
# Copy your mixed vocals to dataset/mixed/
# Make sure filenames match!
```

### Step 2: Start Training

**Local GPU:**
```bash
cd backend
python train_model.py \
    --raw_dir ../dataset/raw \
    --mixed_dir ../dataset/mixed \
    --output_dir ./models \
    --batch_size 8 \
    --num_epochs 100 \
    --learning_rate 1e-4 \
    --model_type time_domain
```

**Google Colab (Free GPU):**
1. Upload your dataset to Google Drive
2. Open Colab notebook
3. Mount Drive and run training script
4. Download trained model when done

### Step 3: Monitor Training

Training creates TensorBoard logs. View them:

```bash
tensorboard --logdir ./models/logs
```

Open browser to `http://localhost:6006`

**What to watch:**
- **Train Loss** - Should decrease steadily
- **Validation Loss** - Should track train loss (if it diverges, you're overfitting)
- **Learning Rate** - Automatically adjusts

### Step 4: Evaluate Model

After training, test the model:

```python
from audio_processor import AudioProcessor

# Load trained model
processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)

# Process a vocal
audio, sr = processor.load_audio('test_vocal.wav')
processed = processor.process_vocal(audio, {})
processor.save_audio(processed, 'output.wav')
```

## Training Parameters

### Batch Size
- **GPU with 8GB VRAM**: batch_size=8
- **GPU with 16GB+ VRAM**: batch_size=16-32
- **CPU**: batch_size=2-4 (very slow)

### Learning Rate
- Default: `1e-4` (0.0001)
- If loss doesn't decrease: try `5e-5` (0.00005)
- If loss is unstable: try `1e-5` (0.00001)

### Number of Epochs
- Start with 50-100 epochs
- Monitor validation loss
- Stop when validation loss stops improving

### Model Type
- **time_domain**: Faster, works well for most cases (recommended)
- **spectral**: More complex, potentially better quality but slower

## Expected Training Time

- **50 pairs**: ~2-4 hours on GPU
- **500 pairs**: ~12-24 hours on GPU
- **5000+ pairs**: 1-3 days on GPU

**CPU training**: 10-20x slower (not recommended)

## Troubleshooting

### Out of Memory Error
- Reduce `batch_size` (try 4 or 2)
- Reduce `segment_length` (default is 4 seconds, try 2 seconds)

### Loss Not Decreasing
- Check data quality (are raw/mixed pairs actually matching?)
- Lower learning rate
- Check if data is normalized properly

### Model Sounds Bad
- Need more training data
- Train for more epochs
- Check data alignment (raw and mixed should match)

### Training Too Slow
- Use GPU (Google Colab free tier)
- Reduce batch_size
- Reduce segment_length

## Using Trained Model

Once you have a trained model (`best_model.pt`), integrate it:

```python
# In your mixing_service.py or main.py
from audio_processor import AudioProcessor

processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)
```

The model will automatically be used instead of DSP processing.

## Next Steps

1. **Train initial model** with your dataset
2. **Evaluate quality** - compare with your manual mixes
3. **Iterate** - add more data, adjust parameters, retrain
4. **Deploy** - integrate into production API

## Tips for Best Results

1. **More data = better model** - Collect as many pairs as possible
2. **Consistent mixing style** - If you have multiple mixing styles, train separate models
3. **High-quality source** - Better raw recordings = better results
4. **Regular evaluation** - Test model during training to catch issues early
5. **Save checkpoints** - Training saves checkpoints every epoch, resume if needed

## Example: Full Training Session

```bash
# 1. Prepare data
mkdir -p dataset/{raw,mixed}
# ... copy your files ...

# 2. Start training
python train_model.py \
    --raw_dir dataset/raw \
    --mixed_dir dataset/mixed \
    --output_dir models \
    --batch_size 8 \
    --num_epochs 100

# 3. Monitor (in another terminal)
tensorboard --logdir models/logs

# 4. After training, test
python -c "
from audio_processor import AudioProcessor
proc = AudioProcessor(use_ml_model=True, model_path='models/best_model.pt')
audio, sr = proc.load_audio('test.wav')
out = proc.process_vocal(audio, {})
proc.save_audio(out, 'output.wav')
"
```

Good luck! 🚀
