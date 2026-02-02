# Why Checkpoints Stopped After Epoch 91

## Cause

Your `ModelCheckpoint` is configured with:

- **`save_top_k: 3`** – keep only the 3 best checkpoints (by monitored metric)
- **`monitor: val/loss`** and **`mode: min`** – “best” = lowest validation loss

So Lightning **only writes a checkpoint when the current epoch’s `val/loss` is in the top 3 (lowest)**.  
After epoch 91, your validation loss never improved enough to enter that top 3, so **no new checkpoint was saved** for 92, 93, … and **`last.ckpt` was not updated** either (it is only updated when *some* checkpoint is saved).

So:

- Nothing “broke” at epoch 92.
- There is no special difference between epoch 91 and 92 in the code.
- The behavior is exactly what this config does: **save only when val/loss is in top 3**.

Drive space is irrelevant here; the callback simply didn’t decide to save after 91.

---

## Fix: Save Every Epoch (e.g. on Drive)

You have two main options.

### Option A: One callback that saves every epoch

Save every epoch to Drive and still keep a “best” notion by using a second, “best-only” callback if you want.

**In Colab, set your `trainer.yaml` callbacks to something like:**

```yaml
callbacks:
  - class_path: pytorch_lightning.callbacks.ModelCheckpoint
    init_args:
      dirpath: /content/drive/MyDrive/diffmst_checkpoints
      filename: "vocal_epoch{epoch}-step{step}"
      save_top_k: -1          # -1 = save every epoch (all)
      save_last: True
      every_n_epochs: 1
      save_on_train_epoch_end: True
```

`save_top_k: -1` means “save every time the callback runs” (here, every epoch), so you get a file for 92, 93, etc. and `last.ckpt` will stay up to date.  
Downside: many files (one per epoch). If that fills Drive, use Option B.

### Option B: Two callbacks (recommended)

1. **“Best” checkpoints** (top 3 by `val/loss`) – same as now, for best models.
2. **“Last” every epoch** – one callback that only cares about saving the latest state every epoch (e.g. overwrite one file or use a single `last.ckpt`).

Example:

```yaml
callbacks:
  # Best 3 by val/loss (current behavior)
  - class_path: pytorch_lightning.callbacks.ModelCheckpoint
    init_args:
      dirpath: /content/drive/MyDrive/diffmst_checkpoints
      filename: "best_epoch{epoch}-step{step}"
      monitor: val/loss
      mode: min
      save_top_k: 3
      save_last: False
      every_n_epochs: 1
      save_on_train_epoch_end: True

  # Every-epoch “last” so you never lose progress
  - class_path: pytorch_lightning.callbacks.ModelCheckpoint
    init_args:
      dirpath: /content/drive/MyDrive/diffmst_checkpoints
      filename: "last_epoch{epoch}-step{step}"
      save_top_k: 1           # keep only 1 = overwrite with latest
      every_n_epochs: 1
      save_on_train_epoch_end: True
```

Or use a fixed name like `last.ckpt` by setting `filename: "last"` and `save_top_k: 1` so the same file is overwritten each epoch.

---

## Summary

| What you saw | Why |
|--------------|-----|
| Nothing saved after epoch 91 | `val/loss` for epochs 92+ was never in the top 3, so the callback never saved. |
| `last.ckpt` not updated | `last.ckpt` is only updated when *a* checkpoint is saved; with top‑k only, that didn’t happen. |
| No bug at 91 vs 92 | Same callback logic every epoch; 92 just didn’t qualify. |

To always have a recent checkpoint (e.g. for crashes or Colab disconnects), add an every-epoch save: either `save_top_k: -1` (Option A) or a second callback that saves “last” every epoch (Option B).
