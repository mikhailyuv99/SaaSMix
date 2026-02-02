"""
Run this entire script in a Colab cell to create configs/user/ and the four YAML files.
Copy-paste the code below into a Colab code cell and run it.
"""

# ============ COPY FROM HERE INTO COLAB ============
import os

BASE = "/content/Diff-MST"
USER_CONFIG = os.path.join(BASE, "configs", "user")
os.makedirs(USER_CONFIG, exist_ok=True)

# 1) trainer.yaml
trainer_yaml = """seed_everything: 42
trainer:
  accelerator: gpu
  devices: 1
  max_epochs: 300
  precision: "32"
  gradient_clip_val: 10.0
  check_val_every_n_epoch: 1
  log_every_n_steps: 50
  enable_checkpointing: true
  enable_model_summary: true
  num_sanity_val_steps: 2
  default_root_dir: /content/Diff-MST/lightning_logs
  logger:
    class_path: pytorch_lightning.loggers.TensorBoardLogger
    init_args:
      save_dir: /content/Diff-MST/lightning_logs
      name: vocal_mix
  callbacks:
    - class_path: pytorch_lightning.callbacks.ModelCheckpoint
      init_args:
        save_top_k: 1
        monitor: val/loss
        mode: min
        dirpath: /content/Diff-MST/checkpoints
        filename: "best_epoch{epoch}"
    - class_path: pytorch_lightning.callbacks.ModelSummary
      init_args:
        max_depth: 2
"""

with open(os.path.join(USER_CONFIG, "trainer.yaml"), "w") as f:
    f.write(trainer_yaml)

# 2) optimizer.yaml
optimizer_yaml = """optimizer:
  class_path: torch.optim.Adam
  init_args:
    lr: 0.000002
"""

with open(os.path.join(USER_CONFIG, "optimizer.yaml"), "w") as f:
    f.write(optimizer_yaml)

# 3) data.yaml - uses repo default MultitrackDataModule; paths point to your dataset.
#    If you use VocalPairDataModule, change class_path and init_args accordingly.
data_yaml = """data:
  class_path: mst.dataloader.MultitrackDataModule
  init_args:
    track_root_dirs:
      - /content/dataset/raw
    metadata_files:
      - /content/Diff-MST/data/vocal_metadata.yaml
    length: 262144
    min_tracks: 1
    max_tracks: 1
    batch_size: 4
    num_workers: 2
    num_train_passes: 20
    num_val_passes: 1
    train_buffer_size_gb: 2.0
    val_buffer_size_gb: 0.5
    target_track_lufs_db: -48.0
"""

# Create minimal metadata if missing (MultitrackDataModule may require it)
DATA_DIR = os.path.join(BASE, "data")
os.makedirs(DATA_DIR, exist_ok=True)
vocal_metadata = """# Minimal metadata for single-track vocal dataset
# Format depends on mst.dataloader; adjust if your loader expects different keys.
train: []
val: []
"""
with open(os.path.join(BASE, "data", "vocal_metadata.yaml"), "w") as f:
    f.write(vocal_metadata)

with open(os.path.join(USER_CONFIG, "data.yaml"), "w") as f:
    f.write(data_yaml)

# 4) model.yaml - from repo naive+feat
model_yaml = """model:
  class_path: mst.system.System
  init_args:
    generate_mix: true
    active_eq_epoch: 0
    active_compressor_epoch: 0
    active_fx_bus_epoch: 1000
    active_master_bus_epoch: 0
    use_track_loss: false
    use_mix_loss: true
    use_param_loss: false
    mix_fn: mst.mixing.naive_random_mix
    mix_console:
      class_path: mst.modules.AdvancedMixConsole
      init_args:
        sample_rate: 44100
        input_min_gain_db: -48.0
        input_max_gain_db: 48.0
        output_min_gain_db: -48.0
        output_max_gain_db: 48.0
        eq_min_gain_db: -12.0
        eq_max_gain_db: 12.0
        min_pan: 0.0
        max_pan: 1.0
    model:
      class_path: mst.modules.MixStyleTransferModel
      init_args:
        track_encoder:
          class_path: mst.modules.SpectrogramEncoder
          init_args:
            embed_dim: 512
            n_fft: 2048
            hop_length: 512
            input_batchnorm: false
        mix_encoder:
          class_path: mst.modules.SpectrogramEncoder
          init_args:
            embed_dim: 512
            n_fft: 2048
            hop_length: 512
            input_batchnorm: false
        controller:
          class_path: mst.modules.TransformerController
          init_args:
            embed_dim: 512
            num_track_control_params: 27
            num_fx_bus_control_params: 25
            num_master_bus_control_params: 26
            num_layers: 12
            nhead: 8
    loss:
      class_path: mst.loss.AudioFeatureLoss
      init_args:
        sample_rate: 44100
        stem_separation: false
        use_clap: false
        weights:
          - 0.1
          - 0.001
          - 1.0
          - 1.0
          - 0.1
          - 1.0
"""

with open(os.path.join(USER_CONFIG, "model.yaml"), "w") as f:
    f.write(model_yaml)

print("Created:", USER_CONFIG)
for name in ["trainer.yaml", "optimizer.yaml", "data.yaml", "model.yaml"]:
    p = os.path.join(USER_CONFIG, name)
    print("  ", p, "(", os.path.getsize(p), "bytes)")
# ============ END COLAB BLOCK ============
