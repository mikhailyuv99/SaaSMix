# Quick Start: Neural Audio Model

Get started training your professional vocal mixing model in 5 minutes!

## Step 1: Organize Your Data

Create this structure:
```
dataset/
├── raw/          (your raw vocal files)
└── mixed/        (your mixed vocal files - same names!)
```

**Important:** Files must have matching names (e.g., `vocal1.wav` in both folders)

## Step 2: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Step 3: Start Training

**If you have a GPU:**
```bash
python train_model.py \
    --raw_dir ../dataset/raw \
    --mixed_dir ../dataset/mixed \
    --output_dir ./models \
    --batch_size 8 \
    --num_epochs 100
```

**If you DON'T have a GPU (use Google Colab):**
1. Go to https://colab.research.google.com
2. Upload your dataset to Google Drive
3. Upload `train_model.py`, `ml_model.py`, `data_loader.py`
4. Run training in Colab (free GPU!)

## Step 4: Monitor Training

In another terminal:
```bash
tensorboard --logdir ./models/logs
```

Open http://localhost:6006 to see training progress

## Step 5: Use Your Trained Model

Once training completes, use the model:

```python
from audio_processor import AudioProcessor

# Load with ML model
processor = AudioProcessor(
    use_ml_model=True,
    model_path='./models/best_model.pt'
)

# Process a vocal
audio, sr = processor.load_audio('test.wav')
processed = processor.process_vocal(audio, {})
processor.save_audio(processed, 'output.wav')
```

## Tips

- **Minimum data**: 50 pairs (for testing)
- **Good quality**: 500+ pairs
- **Production**: 1000+ pairs
- **Training time**: 2-24 hours depending on data size and GPU

## Need Help?

See `TRAINING_GUIDE.md` for detailed instructions.
