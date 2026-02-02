"""
Inférence Diff-MST pour song1 : utilise le CLI (validate) pour charger le modèle
puis un callback qui sauve la sortie du premier batch.
À exécuter dans l'env diffmst depuis /content/Diff-MST.
"""
import os
import sys
import shutil
import torch
import soundfile as sf
import numpy as np

sys.path.insert(0, "/content/Diff-MST")
os.chdir("/content/Diff-MST")

OUT_PATH = "/content/drive/MyDrive/song1_mixed_output.wav"
SR_OUT = 48000

# 1) Créer un dataset avec uniquement song1
dataset_song1 = "/content/dataset_song1"
for sub in ["raw", "mixed"]:
    d = os.path.join(dataset_song1, sub)
    os.makedirs(d, exist_ok=True)
    src = os.path.join("/content/dataset", sub, "song1.wav")
    dst = os.path.join(d, "song1.wav")
    if os.path.exists(src):
        shutil.copy2(src, dst)
    else:
        # trouver un fichier qui commence par song1
        parent = os.path.join("/content/dataset", sub)
        for f in os.listdir(parent):
            if f.lower().startswith("song1"):
                shutil.copy2(os.path.join(parent, f), os.path.join(d, f))
                break

# 2) Config data qui ne contient que song1 (val_split=0 pour tout en val)
data_song1_yaml = """
data:
  class_path: mst.vocal_dataloader.VocalPairDataModule
  init_args:
    raw_dir: /content/dataset_song1/raw
    mixed_dir: /content/dataset_song1/mixed
    sample_rate: 44100
    segment_length: 131072
    batch_size: 1
    num_workers: 0
    val_split: 1.0
    seed: 42
"""
with open("/content/Diff-MST/configs/user/data_song1.yaml", "w") as f:
    f.write(data_song1_yaml.strip())

# 3) Callback qui sauve le premier batch de validation
from pytorch_lightning.callbacks import Callback

class SaveFirstValOutput(Callback):
    def __init__(self, out_path=OUT_PATH, sr_out=SR_OUT):
        self.out_path = out_path
        self.sr_out = sr_out
        self.saved = False

    def on_validation_batch_end(self, trainer, pl_module, outputs, batch, batch_idx):
        if self.saved or outputs is None:
            return
        # outputs = data_dict from validation_step
        pred = outputs.get("pred_mix_b_norm")
        if pred is None:
            return
        pred = pred.squeeze(0).cpu().numpy()
        if pred.ndim == 1:
            pred = np.stack([pred, pred])
        import librosa
        pred_48 = librosa.resample(pred, orig_sr=44100, target_sr=self.sr_out)
        sf.write(self.out_path, pred_48.T, self.sr_out)
        self.saved = True
        print("OK Sortie sauvegardée:", self.out_path)

# 4) Lancer validate avec le CLI (build model from config + load ckpt)
if __name__ == "__main__":
    import sys as _sys
    _sys.argv = [
        "main.py", "validate",
        "-c", "/content/Diff-MST/configs/user/trainer.yaml",
        "-c", "/content/Diff-MST/configs/user/optimizer.yaml",
        "-c", "/content/Diff-MST/configs/models/naive_feat.yaml",
        "-c", "/content/Diff-MST/configs/user/data_song1.yaml",
        "--ckpt_path", "/content/drive/MyDrive/diffmst_checkpoints/last.ckpt",
        "--trainer.limit_val_batches", "1",
    ]

    from pytorch_lightning.cli import LightningCLI
    from mst.system import System

    cli = LightningCLI(System, run=False)
    cli.trainer.callbacks.append(SaveFirstValOutput())
    cli.trainer.validate(cli.model, datamodule=cli.datamodule, ckpt_path="/content/drive/MyDrive/diffmst_checkpoints/last.ckpt")
