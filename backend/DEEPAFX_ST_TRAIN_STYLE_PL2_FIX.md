# Correctif train_style.py pour PyTorch Lightning 2.x

PyTorch Lightning 2.0+ a supprimé `Trainer.add_argparse_args` et `Trainer.from_argparse_args`. Le script officiel DeepAFx-ST plante avec :

```text
AttributeError: type object 'Trainer' has no attribute 'add_argparse_args'
```

## Solution : cellule à exécuter dans Colab **avant** la cellule d’entraînement

Colle et exécute cette cellule **une seule fois** (après le clone et l’install, avant de lancer l’entraînement).

```python
# Patch train_style.py pour PyTorch Lightning 2.x (add_argparse_args / from_argparse_args supprimés)
import os
path = "/content/DeepAFx-ST/scripts/train_style.py"
with open(path, "r") as f:
    content = f.read()

# 1) Supprimer la ligne qui appelle add_argparse_args
content = content.replace(
    " parser = pl.Trainer.add_argparse_args(parser)\n",
    ""
)
content = content.replace(
    " parser = pl.Trainer.add_argparse_args(parser)",
    ""
)

# 2) Ajouter les arguments Trainer à la main (même indentation 1 espace que le script)
old = """ parser = ArgumentParser()

 # add all the available trainer and system options to argparse"""
new = """ parser = ArgumentParser()
 parser.add_argument("--max_epochs", type=int, default=100)
 parser.add_argument("--accelerator", type=str, default="gpu")
 parser.add_argument("--devices", type=int, default=1)
 parser.add_argument("--gpus", type=int, default=None, help="legacy")
 parser.add_argument("--default_root_dir", type=str, default=None)
 parser.add_argument("--gradient_clip_val", type=float, default=None)
 parser = System.add_model_specific_args(parser)"""
# On remplace le bloc puis on remplace la ligne dupliquée "parser = System.add_model_specific_args"
content = content.replace(old, new)
content = content.replace(
    " parser = System.add_model_specific_args(parser)\n parser = System.add_model_specific_args(parser)",
    " parser = System.add_model_specific_args(parser)"
)

# 3) Remplacer Trainer.from_argparse_args(...) par Trainer(...) (indentation 1 espace)
old_trainer = """ # create PyTorch Lightning trainer
 trainer = pl.Trainer.from_argparse_args(
 args,
 callbacks=callbacks,
 plugins=DDPPlugin(find_unused_parameters=False),
 )"""
new_trainer = """ # create PyTorch Lightning trainer
 _devices = args.devices if getattr(args, 'gpus', None) is None else args.gpus
 trainer = pl.Trainer(
  max_epochs=args.max_epochs,
  accelerator=args.accelerator,
  devices=_devices,
  default_root_dir=args.default_root_dir,
  gradient_clip_val=args.gradient_clip_val,
  callbacks=callbacks,
  plugins=[DDPPlugin(find_unused_parameters=False)],
 )"""
content = content.replace(old_trainer, new_trainer)

with open(path, "w") as f:
    f.write(content)
print("train_style.py patché pour Lightning 2.x")
```

Ensuite, relance la cellule d’entraînement (celle qui exécute `train_style.py`).

## Si tu as une erreur sur `DDPPlugin`

Sous Lightning 2.x, `DDPPlugin` peut avoir été déplacé. Si tu vois une erreur du type `cannot import DDPPlugin` ou `Strategy`, remplace dans la même cellule de patch la partie qui crée le `Trainer` pour ne plus utiliser `plugins` et utiliser `strategy="ddp"` à la place :

- Dans le patch ci‑dessus, remplace la ligne  
  `plugins=[DDPPlugin(find_unused_parameters=False)],`  
  par  
  `strategy="ddp",`  
  et supprime l’import `from pytorch_lightning.plugins import DDPPlugin` en ajoutant dans le patch une ligne qui enlève cette ligne du fichier (ou édite le fichier à la main pour enlever l’import et mettre `strategy="ddp"` dans le `Trainer`).

Si tu veux, on peut détailler une version du patch qui fait tout ça automatiquement (sans `DDPPlugin`).
