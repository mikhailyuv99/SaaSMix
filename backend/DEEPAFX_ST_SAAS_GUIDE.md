# DeepAFx-ST : tester puis brancher sur le SaaS

Objectif : **tester** DeepAFx-ST (avec les modèles pré-entraînés), puis si la qualité te va, **avoir un modèle prêt pour le SaaS** (API qui appelle l’inférence).

---

## Étape 1 – Tester (sans entraîner)

Tu peux tester **tout de suite** avec les **checkpoints fournis** (speech ou music). Pas besoin d’entraîner.

### 1.1 Setup local (ou Colab)

```bash
# Clone
git clone https://github.com/adobe-research/DeepAFx-ST.git
cd DeepAFx-ST

# Env (Python 3.8 recommandé)
python -m venv env
# Windows: env\Scripts\activate
# Linux/Mac: source env/bin/activate

pip install --upgrade pip
pip install --pre -e .

# Checkpoints + exemples (petit téléchargement)
wget https://github.com/adobe-research/DeepAFx-ST/releases/download/v0.1.0/checkpoints_and_examples.tar.gz -O - | tar -xz
```

Sous Windows, si `wget` n’existe pas : télécharge à la main  
[https://github.com/adobe-research/DeepAFx-ST/releases/tag/v0.1.0](https://github.com/adobe-research/DeepAFx-ST/releases/tag/v0.1.0)  
→ `checkpoints_and_examples.tar.gz` → extraire à la racine du repo.

### 1.2 Inférence (vocal + ref → WAV)

Une fois les checkpoints en place :

```bash
# Speech (vocal) – modèle "autodiff" pré-entraîné sur LibriTTS
python scripts/process.py -i ton_vocal_raw.wav -r ta_ref_mixee.wav -c checkpoints/style/libritts/autodiff/lightning_logs/version_1/checkpoints/epoch=367-step=1226911-val-libritts-autodiff.ckpt

# La sortie est écrite à côté (ou selon le script, vérifier la doc du script)
```

Tu mets :
- **-i** : ton vocal brut (WAV).
- **-r** : ta ref “style” (un vocal déjà mixé, ou un de tes 222 mixed).
- **-c** : un checkpoint (speech = libritts, music = jamendo).

Tu écoutes le résultat. Si c’est bon pour toi, on passe à l’intégration SaaS.

---

## Étape 2 – “Modèle prêt pour le SaaS” = quoi ?

Ça veut dire :

1. **Inférence fiable** : une commande ou un script Python qui prend (vocal, ref) et renvoie un WAV (déjà fait par `process.py`).
2. **Appelable depuis ton backend** : un endpoint (ex. FastAPI) qui reçoit les fichiers (ou chemins), appelle DeepAFx-ST, renvoie le WAV ou un lien de téléchargement.
3. **Qualité OK pour toi** : si le pré-entraîné (speech/music) ne suffit pas, il faudra soit fine-tuner soit entraîner (voir plus bas).

Donc **après le test** :
- Si le rendu te convient → on enveloppe `process.py` (ou son équivalent en Python) dans une route API → tu as un “modèle prêt à l’utilisation” pour le SaaS.
- Si le rendu ne convient pas → soit on essaie un autre checkpoint (spsa, tcn1, etc.), soit on regarde l’entraînement (étape 3).

---

## Étape 3 – Intégration API (exemple minimal)

Une fois que `process.py` donne un résultat qui te va, tu peux exposer ça en API. Exemple (à adapter dans ton backend) :

```python
# backend/deepafx_service.py (exemple)
import subprocess
import os
import tempfile
import shutil

DEEPAFX_DIR = "/chemin/vers/DeepAFx-ST"  # ou variable d'env
CHECKPOINT_SPEECH = "checkpoints/style/libritts/autodiff/lightning_logs/version_1/checkpoints/epoch=367-step=1226911-val-libritts-autodiff.ckpt"

def process_vocal_deepafx(vocal_path: str, ref_path: str, output_path: str, checkpoint: str = None) -> str:
    checkpoint = checkpoint or os.path.join(DEEPAFX_DIR, CHECKPOINT_SPEECH)
    cmd = [
        "python", "scripts/process.py",
        "-i", os.path.abspath(vocal_path),
        "-r", os.path.abspath(ref_path),
        "-c", os.path.abspath(checkpoint),
    ]
    result = subprocess.run(cmd, cwd=DEEPAFX_DIR, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"DeepAFx-ST failed: {result.stderr}")
    # Le script écrit souvent dans un dossier fixe ou -o ; adapter selon process.py
    return output_path
```

Ensuite dans ton FastAPI (ou équivalent) : route qui reçoit `vocal` + `ref` (fichiers ou URLs), les enregistre en temporaire, appelle `process_vocal_deepafx`, renvoie le WAV. Comme ça, **oui, tu as un modèle prêt à l’utilisation pour le SaaS** (sous réserve que la qualité du pré-entraîné te convienne).

---

## Étape 4 – Et si tu veux entraîner (optionnel)

- Le **training officiel** utilise LibriTTS / Jamendo en **self-supervised** (pas de paires raw/mixed). Grosse config (datasets ~1TB, plusieurs GPU).
- Pour **utiliser tes 222 vocaux** : DeepAFx-ST est **self-supervised** : un seul dossier de WAV suffit (raw, mixed, ou les deux). Le modèle génère des paires synthétiques en appliquant des effets aléatoires. Pas besoin de paires (raw, mixed) alignées.

**Guide dédié :** voir **DEEPAFX_ST_TRAINING_GUIDE.md** pour :
- préparation des données (un dossier `vocals_24k` en WAV 24 kHz mono),
- cellules Colab (clone, patch setup, install, extraction, entraînement autodiff 1 GPU),
- sauvegarde du checkpoint sur Drive,
- inférence avec le checkpoint entraîné (et correctifs process.py),
- lien vers l’API SaaS.

En pratique : **commence par tester les pré-entraînés**. Si c’est bon → intégration API. Si ce n’est pas bon → essaie d’autres checkpoints (spsa, tcn1, tcn2) ou **entraîne sur tes vocaux** (DEEPAFX_ST_TRAINING_GUIDE.md).

---

## Récap

| Question | Réponse |
|----------|--------|
| Tester DeepAFx-ST ? | Clone, `pip install -e .`, télécharge checkpoints, lance `process.py -i vocal.wav -r ref.wav -c <ckpt>`. |
| Modèle prêt pour le SaaS après ça ? | **Oui** si le rendu te convient : tu exposes l’inférence en API (comme ci-dessus) et tu l’utilises comme “moteur” mix à la place (ou en plus) de Diff-MST / DSP. |
| Faut-il entraîner ? | Pas obligatoire pour tester. Entraînement = si tu veux un modèle plus adapté à ton style (là il faudra adapter le pipeline ou les données). |

Si tu veux, prochaine étape : on peut détailler la commande exacte `process.py` pour ton OS (Windows) et où le script écrit le fichier de sortie, pour que tu aies le flux “vocal + ref → un seul WAV” clair avant de le brancher en API.
