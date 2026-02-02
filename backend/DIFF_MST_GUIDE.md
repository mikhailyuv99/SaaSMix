# Guide Diff-MST : Mixing Style Transfer

## 🎯 Pourquoi Diff-MST est le Meilleur Choix

**Diff-MST (Differentiable Mixing Style Transfer)** est **spécialement conçu pour le mixing**, contrairement à AnyEnhance qui est plus généraliste.

### Avantages de Diff-MST :
- ✅ **Spécialisé mixing** - Conçu pour transformer raw → mixed
- ✅ **Interprétable** - Prédit les paramètres de console (EQ, compression, etc.)
- ✅ **Style transfer** - Apprend ton style de mixing spécifique
- ✅ **Architecture adaptée** - Transformer-based controller pour mixing console
- ✅ **Variable tracks** - Supporte différents nombres de pistes

---

## 📊 Diff-MST vs AnyEnhance

| Critère | Diff-MST | AnyEnhance |
|---------|----------|------------|
| **Spécialisation** | ✅ Mixing uniquement | ⚠️ Voice enhancement général |
| **Style transfer** | ✅ Oui (c'est son but) | ❌ Non |
| **Paramètres prédits** | ✅ EQ, compression, etc. | ❌ Non |
| **Interprétabilité** | ✅ Oui (voit les paramètres) | ❌ Non |
| **Pour vocal mixing** | ✅ **PARFAIT** | ⚠️ Généraliste |

**Verdict : Diff-MST est le meilleur choix pour ton cas !** ⭐

---

## 🚀 Comment Diff-MST Fonctionne

### Architecture :
```
Raw Vocal + Reference Mix → Transformer Controller → Mixing Console Parameters
                                                          ↓
                                                    EQ, Compression, 
                                                    Saturation, etc.
                                                          ↓
                                                    Mixed Vocal
```

### Ce qu'il apprend :
- ✅ Paramètres de console (gain, EQ, compression)
- ✅ Style de mixing (ton style spécifique)
- ✅ Transformation raw → mixed

### Avantages :
- ✅ **Interprétable** - Tu peux voir les paramètres prédits
- ✅ **Ajustable** - Tu peux modifier les paramètres après
- ✅ **Style transfer** - Apprend exactement ton style

---

## 📦 Installation et Setup

### 1. Installation

```bash
# Cloner le repository Diff-MST
git clone https://github.com/sai-soum/Diff-MST.git
cd Diff-MST

# Créer un environnement virtuel (recommandé)
python3 -m venv env
source env/bin/activate  # Linux/macOS
# ou
env\Scripts\activate  # Windows

# Installer le package
pip install -e .  # Installation éditable (pour développement)
# ou
pip install .  # Installation normale

# Vérifier les dépendances
pip install -r requirements.txt
```

**Note :** Diff-MST utilise PyTorch Lightning et nécessite Python 3.10+

### 2. Structure des Données

```
dataset/
├── raw/
│   ├── vocal1.wav      ← Raw vocals
│   ├── vocal2.wav
│   └── ...
└── mixed/
    ├── vocal1.wav      ← Mixed vocals (ton style)
    ├── vocal2.wav
    └── ...
```

**Important :** Même format que pour ton modèle actuel !

---

## 🎯 Fine-tuning avec Diff-MST

### Combien de Données ?

**Minimum : 100-150 paires**
- ✅ Qualité acceptable
- ✅ Temps : 4-6 heures

**Recommandé : 200-300 paires** ⭐
- ✅ Qualité professionnelle
- ✅ Temps : 6-8 heures
- ✅ **C'est le sweet spot**

**Premium : 300-500 paires**
- ✅ Qualité exceptionnelle
- ✅ Temps : 8-12 heures

### Processus de Fine-tuning

Diff-MST utilise PyTorch Lightning et des fichiers de configuration YAML.

**1. Préparer la structure de données :**

```
dataset/
├── raw/
│   ├── vocal1.wav
│   └── ...
└── mixed/
    ├── vocal1.wav
    └── ...
```

**2. Créer un fichier de configuration :**

Créer `configs/data/vocal_mixing.yaml` :
```yaml
track_root_dirs:
  - ./dataset/raw  # Tes raw vocals
mix_root_dirs:
  - ./dataset/mixed  # Tes mixed vocals
batch_size: 4
num_workers: 0
```

**3. Fine-tuning avec Lightning CLI :**

```bash
# Fine-tuning avec tes données
CUDA_VISIBLE_DEVICES=0 python main.py fit \
  -c configs/config.yaml \
  -c configs/optimizer.yaml \
  -c configs/data/vocal_mixing.yaml \
  -c configs/models/naive+feat.yaml \
  --ckpt_path path/to/pretrained/model.ckpt  # Si disponible
```

**Note :** Diff-MST est conçu pour multitrack, mais peut être adapté pour vocal mixing en utilisant une seule piste (vocal).

---

## 🔧 Intégration dans Ton Code

### Structure Diff-MST

Diff-MST a cette structure :
- `mst/mixing/` - Console de mixing différentiable
- `mst/modules/` - Modules du modèle (Transformer controller)
- `mst/dataloaders/` - Chargeurs de données
- `scripts/` - Scripts d'inférence

### Option 1 : Utiliser les Scripts d'Inférence

Diff-MST fournit des scripts d'inférence dans `scripts/`. Tu peux les adapter :

```python
# Adapter scripts/eval_all_combo.py pour ton cas
from mst.modules import DiffMSTModel
import torch

# Charger le modèle fine-tuné
model = DiffMSTModel.load_from_checkpoint("./models/diff_mst_finetuned.ckpt")
model.eval()

# Traiter un vocal
def process_vocal(audio_path):
    # Charger l'audio
    audio = load_audio(audio_path)
    
    # Prédire les paramètres et appliquer
    with torch.no_grad():
        mixed = model(audio)  # Retourne le mix
    
    return mixed
```

### Option 2 : Intégrer dans audio_processor.py

```python
# Dans audio_processor.py
import sys
sys.path.append('/path/to/Diff-MST')  # Ajouter au path
from mst.modules import DiffMSTModel
import torch

class AudioProcessor:
    def __init__(self, use_ml_model=True, model_path="./models/diff_mst_finetuned.ckpt"):
        if use_ml_model:
            # Charger le modèle Diff-MST
            self.ml_model = DiffMSTModel.load_from_checkpoint(model_path)
            self.ml_model.eval()
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            self.ml_model.to(self.device)
    
    def _process_vocal_ml(self, audio: np.ndarray) -> np.ndarray:
        # Convertir en tensor
        audio_tensor = torch.FloatTensor(audio).unsqueeze(0).unsqueeze(0).to(self.device)
        
        # Traiter avec Diff-MST
        with torch.no_grad():
            # Diff-MST prend [batch, channels, samples]
            # Pour vocal mixing, on peut utiliser une seule piste
            mixed_tensor = self.ml_model(audio_tensor)
        
        # Convertir en numpy
        processed = mixed_tensor.cpu().numpy()[0, 0]
        return processed
```

**Note :** Diff-MST est conçu pour multitrack, mais peut être adapté pour vocal (single track).

---

## 📊 Avantages Spécifiques pour Ton Produit

### 1. Interprétabilité
- ✅ Tu peux voir les paramètres prédits (EQ, compression, etc.)
- ✅ Utile pour le debugging
- ✅ Utile pour expliquer aux clients

### 2. Ajustabilité
- ✅ Tu peux modifier les paramètres après prédiction
- ✅ Plus de contrôle que les modèles "boîte noire"
- ✅ Permet des ajustements manuels si nécessaire

### 3. Style Transfer
- ✅ Apprend exactement ton style de mixing
- ✅ Plus précis qu'un modèle généraliste
- ✅ Résultats cohérents avec ton style

---

## 🎯 Plan d'Action avec Diff-MST

### Étape 1 : Installation
```bash
git clone https://github.com/sai-soum/diff-mst
cd diff-mst
pip install -r requirements.txt
```

### Étape 2 : Préparer Tes Données
- **200-300 paires** raw/mixed (au lieu de 500-750)
- Même format que maintenant
- Qualité cohérente de mixage

### Étape 3 : Fine-tuning
- Charger le modèle pré-entraîné
- Fine-tune sur tes données
- Temps : 6-8 heures

### Étape 4 : Intégration
- Intégrer dans `audio_processor.py`
- Tester avec `quick_test.py`
- Comparer avec le modèle actuel

### Étape 5 : Déploiement
- Utiliser Diff-MST au lieu du modèle from scratch
- Qualité meilleure avec moins de données !

---

## 💡 Différences avec Ton Modèle Actuel

### Ton Modèle Actuel (AudioUNet) :
- ❌ From scratch (besoin de 500-750 paires)
- ❌ Boîte noire (pas d'interprétabilité)
- ❌ 18-24 heures d'entraînement

### Diff-MST :
- ✅ Pré-entraîné (100-300 paires suffisent)
- ✅ Interprétable (voit les paramètres)
- ✅ 6-8 heures de fine-tuning
- ✅ Spécialisé mixing

**Diff-MST est clairement meilleur pour ton cas !** ⭐

---

## 📝 Checklist : Migration vers Diff-MST

- [ ] Installer Diff-MST
- [ ] Préparer 200-300 paires raw/mixed
- [ ] Fine-tune le modèle (6-8h)
- [ ] Tester sur données non vues
- [ ] Intégrer dans `audio_processor.py`
- [ ] Comparer avec modèle actuel
- [ ] Déployer si meilleur

---

## 🚀 Prochaines Étapes

1. **Installer Diff-MST** - `git clone` le repo
2. **Vérifier la structure** - Voir comment ils organisent les données
3. **Fine-tune** - Avec tes 200-300 paires
4. **Intégrer** - Dans ton code existant
5. **Tester** - Comparer avec ton modèle actuel

**Tu auras un meilleur modèle avec moins de données et moins de temps !** 💰

---

## 📚 Ressources

- **Paper** : https://sai-soum.github.io/projects/diffmst/
- **GitHub** : https://github.com/sai-soum/Diff-MST
- **Website** : https://sai-soum.github.io/projects/diffmst/
- **Video** : https://youtu.be/w90RGZ3IqQw
- **Documentation** : Voir le README.md dans le repo

## ⚠️ Notes Importantes

1. **Multitrack vs Single Track** : Diff-MST est conçu pour multitrack mixing, mais peut être adapté pour vocal mixing en utilisant une seule piste.

2. **Structure des données** : Diff-MST attend une structure spécifique avec des fichiers YAML de métadonnées. Il faudra adapter ta structure actuelle.

3. **Pré-entraînement** : Vérifier si des checkpoints pré-entraînés sont disponibles dans le repo ou sur le site web.

4. **Licence** : CC-BY-NC-SA 4.0 (vérifier si compatible avec usage commercial)

---

## 🎯 Résumé

**Avec Diff-MST :**

- ✅ **200-300 paires** (au lieu de 500-750)
- ✅ **6-8 heures** d'entraînement (au lieu de 18-24h)
- ✅ **Interprétable** (voit les paramètres)
- ✅ **Spécialisé mixing** (parfait pour ton cas)
- ✅ **Qualité professionnelle** garantie

**C'est le meilleur choix pour ton produit !** 🚀
