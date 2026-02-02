# Guide de préparation du dataset pour l'entraînement ML

## ❌ NE PAS ajouter Reverb/Delay dans les fichiers "mixed"

### Pourquoi ?

**1. Le modèle doit apprendre le "core sound"**
- ✅ EQ (équilibrage fréquentiel)
- ✅ Compression (contrôle dynamique)
- ✅ Saturation (couleur/chaleur)
- ❌ PAS les effets contextuels (reverb/delay)

**2. Les effets sont mieux gérés par DSP après**
- Reverb/delay dépendent du BPM, du style, du contexte
- Le modèle ne peut pas généraliser ces effets
- Mieux vaut les ajouter via DSP après le traitement ML

**3. Architecture actuelle**
- Le modèle ML apprend : `raw vocal → core mixed vocal`
- Les effets (reverb/delay) sont ajoutés après via `mixing_service.py`
- C'est plus flexible et généralisable

---

## ✅ Ce que tu DOIS faire

### Structure du dataset

```
dataset/
├── raw/
│   ├── vocal1.wav      ← Vocal brut, non traité
│   ├── vocal2.wav
│   └── ...
└── mixed/
    ├── vocal1.wav      ← Vocal mixé (SANS reverb/delay)
    ├── vocal2.wav
    └── ...
```

### Processus de mixage pour les fichiers "mixed"

**Applique SEULEMENT :**
1. ✅ **EQ** - Équilibrage fréquentiel
2. ✅ **Compression** - Contrôle dynamique
3. ✅ **Saturation** - Couleur/chaleur
4. ✅ **Limiter** - Prévention du clipping
5. ✅ **Normalisation** - Niveau final

**N'APPLIQUE PAS :**
- ❌ Reverb
- ❌ Delay
- ❌ Doubler
- ❌ Autres effets contextuels

---

## 🎯 Exemple de chaine de traitement

### Dans ton DAW (Logic, Ableton, etc.)

**Chaine pour créer les fichiers "mixed" :**

```
Raw Vocal
  ↓
High-Pass Filter (110Hz)
  ↓
EQ (low shelf -4dB @ 200Hz, cuts @ 280Hz/450Hz)
  ↓
Compressor (ratio 2:1, threshold -12dB)
  ↓
Saturation (subtle tape saturation)
  ↓
Limiter (-0.3dB)
  ↓
Normalize (-0.3dB peak)
  ↓
Export → mixed/vocal1.wav
```

**PAS de :**
- ❌ Reverb bus
- ❌ Delay bus
- ❌ Doubler
- ❌ Autres effets

---

## 📊 Comparaison

### ✅ BON (sans reverb/delay)
```
Raw: vocal1.wav (dry, non traité)
Mixed: vocal1.wav (EQ + compression + saturation, DRY)
```
→ Le modèle apprend le "core mixing"
→ Les effets sont ajoutés après via DSP (flexible)

### ❌ MAUVAIS (avec reverb/delay)
```
Raw: vocal1.wav (dry)
Mixed: vocal1.wav (EQ + compression + reverb + delay)
```
→ Le modèle apprend des patterns de reverb/delay spécifiques
→ Ne généralise pas bien sur d'autres morceaux
→ Moins flexible

---

## 🔄 Workflow complet

### 1. Préparation des données
1. Télécharge les vocals raw
2. Mixe-les avec ta chaine (SANS reverb/delay)
3. Exporte les paires raw/mixed
4. Organise dans `dataset/raw/` et `dataset/mixed/`

### 2. Entraînement
```python
# Le modèle apprend : raw → core mixed (sans effets)
!python train_model.py \
    --raw_dir /content/dataset/raw \
    --mixed_dir /content/dataset/mixed \
    --num_epochs 1000
```

### 3. Utilisation
```python
# Le modèle traite le vocal (core mixing)
processed = ml_model(raw_vocal)

# Les effets sont ajoutés après (DSP)
final = add_reverb(processed, intensity=0.3)
final = add_delay(final, bpm=120)
```

---

## 💡 Pourquoi cette approche est meilleure

**Avantages :**
- ✅ Le modèle apprend le "vrai mixing" (EQ, compression, saturation)
- ✅ Les effets restent flexibles (ajustables selon le contexte)
- ✅ Meilleure généralisation (fonctionne sur tous les styles)
- ✅ Plus de contrôle pour l'utilisateur final

**Inconvénients :**
- ⚠️ Les effets ne sont pas "appris" (mais c'est mieux ainsi)

---

## ✅ Checklist avant l'entraînement

- [ ] Dataset organisé : `raw/` et `mixed/` avec les mêmes noms
- [ ] Fichiers "mixed" : SEULEMENT EQ + compression + saturation
- [ ] PAS de reverb dans les fichiers "mixed"
- [ ] PAS de delay dans les fichiers "mixed"
- [ ] Normalisation cohérente (-0.3dB peak)
- [ ] Même sample rate (44100 Hz)
- [ ] Même longueur (ou segments de 4 secondes)

---

## 🎵 Résumé

**Règle d'or :** 
> Le modèle ML apprend le "core vocal sound" (EQ, compression, saturation).
> Les effets contextuels (reverb/delay) sont ajoutés après via DSP.

**C'est exactement comme dans le code actuel :**
- `_process_vocal_ml()` → Core mixing
- `mixing_service.py` → Ajoute les effets après

**Donc :** Mixe tes vocals SANS reverb/delay pour l'entraînement ! 🎯
