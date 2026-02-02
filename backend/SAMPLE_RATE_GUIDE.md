# Sample Rate : 44100 Hz vs 48000 Hz

## 🎯 Question : 48000 Hz Acceptable ?

**Réponse :** **OUI, c'est même excellent !** ✅

---

## 📊 44100 Hz vs 48000 Hz

### 44100 Hz (CD Quality)
- ✅ Standard audio (CD, streaming)
- ✅ Utilisé partout
- ✅ Suffisant pour la voix humaine
- ✅ Plus petit (moins de données)

### 48000 Hz (Professional)
- ✅ **Standard professionnel** (vidéo, studio)
- ✅ **Meilleure qualité** (plus de détails)
- ✅ Utilisé en production professionnelle
- ⚠️ Légèrement plus gros (10% plus de données)

**Verdict :** Les deux sont excellents ! 48000 Hz est même légèrement meilleur.

---

## ✅ Pour l'Entraînement Diff-MST

### 48000 Hz est Parfait !

**Pourquoi :**
- ✅ Qualité professionnelle
- ✅ Diff-MST supporte 48000 Hz
- ✅ Même meilleur que 44100 Hz (plus de détails)
- ✅ Standard professionnel

**Important :** Tous les fichiers doivent avoir le **même sample rate** !

---

## ⚠️ Point Critique : Cohérence

### Règle d'Or

**TOUS les fichiers doivent avoir le même sample rate !**

**Exemple :**
- ✅ Tous en 48000 Hz → Parfait
- ✅ Tous en 44100 Hz → Parfait
- ❌ Certains 44100, certains 48000 → Problème !

**Pourquoi :**
- Le modèle ML s'attend à un sample rate constant
- Mélanger les sample rates cause des problèmes
- Conversion nécessaire si mixte

---

## 🔧 Si Tu as un Mix de Sample Rates

### Solution : Convertir Tout au Même Sample Rate

**Option 1 : Tout convertir en 48000 Hz (Recommandé si la majorité est en 48000)**

```python
from pydub import AudioSegment
import os

def convert_to_48000(input_dir, output_dir):
    """Convertit tous les fichiers en 48000 Hz"""
    os.makedirs(output_dir, exist_ok=True)
    
    for filename in os.listdir(input_dir):
        if filename.endswith(('.wav', '.mp3')):
            audio = AudioSegment.from_file(
                os.path.join(input_dir, filename)
            )
            
            # Convertir en 48000 Hz mono
            audio = audio.set_frame_rate(48000)
            audio = audio.set_channels(1)
            
            # Sauvegarder
            output_path = os.path.join(
                output_dir,
                filename.replace('.mp3', '.wav')
            )
            audio.export(output_path, format='wav')
            print(f"Converted: {filename} → 48000 Hz")
```

**Option 2 : Tout convertir en 44100 Hz (Si tu préfères)**

```python
# Même code mais avec 44100 au lieu de 48000
audio = audio.set_frame_rate(44100)
```

---

## 🎯 Recommandation pour Toi

### Si Tes MP3 sont en 48000 Hz :

**✅ GARDE 48000 Hz !**

**Pourquoi :**
- ✅ Qualité professionnelle
- ✅ Pas besoin de downsampling (perte de qualité)
- ✅ Diff-MST supporte 48000 Hz
- ✅ Même meilleur que 44100 Hz

**Action :**
1. Convertir MP3 → WAV en **gardant 48000 Hz**
2. Mixer dans FL Studio en **48000 Hz**
3. Exporter les mixed en **48000 Hz**
4. Tout sera cohérent en 48000 Hz

---

## 🔧 Conversion MP3 → WAV (48000 Hz)

### Script Python

```python
from pydub import AudioSegment
import os

def convert_mp3_to_wav_48000(input_dir, output_dir):
    """Convertit tous les MP3 en WAV 48000 Hz"""
    os.makedirs(output_dir, exist_ok=True)
    
    for filename in os.listdir(input_dir):
        if filename.endswith('.mp3'):
            try:
                # Charger MP3
                audio = AudioSegment.from_mp3(
                    os.path.join(input_dir, filename)
                )
                
                # Convertir en WAV 48000 Hz mono
                audio = audio.set_frame_rate(48000)  # 48000 Hz
                audio = audio.set_channels(1)  # Mono
                
                # Sauvegarder
                output_filename = filename.replace('.mp3', '.wav')
                output_path = os.path.join(output_dir, output_filename)
                audio.export(output_path, format='wav')
                
                print(f"✓ {filename} → {output_filename} (48000 Hz)")
                
            except Exception as e:
                print(f"✗ Error with {filename}: {e}")

# Utilisation
convert_mp3_to_wav_48000('downloads/mp3', 'dataset/raw')
```

### Avec FFmpeg

```bash
# Convertir en 48000 Hz
ffmpeg -i input.mp3 -ar 48000 -ac 1 output.wav

# Pour tous les fichiers
for file in *.mp3; do
    ffmpeg -i "$file" -ar 48000 -ac 1 "${file%.mp3}.wav"
done
```

---

## 🎛️ Dans FL Studio

### Configurer le Sample Rate

**Important :** Configurer FL Studio pour utiliser 48000 Hz

**Étapes :**
1. **Options** → **Audio Settings**
2. **Sample rate** : Sélectionner **48000 Hz**
3. **Buffer length** : Ajuster si nécessaire
4. **Sauvegarder**

**À l'export :**
1. **File** → **Export** → **WAV file**
2. Vérifier que le sample rate est **48000 Hz**
3. Exporter

---

## 📊 Comparaison : 44100 vs 48000

| Critère | 44100 Hz | 48000 Hz |
|---------|----------|----------|
| **Qualité** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Standard** | Audio (CD) | Professionnel (vidéo/studio) |
| **Taille fichier** | Plus petit | 10% plus gros |
| **Pour ML** | ✅ Excellent | ✅ **Même meilleur** |
| **Diff-MST** | ✅ Supporté | ✅ **Supporté** |

**Verdict :** Les deux sont excellents, 48000 Hz est même légèrement meilleur !

---

## ✅ Checklist : Sample Rate

### Avant de Commencer

- [ ] **Vérifier le sample rate** de tes MP3
  - Si 48000 Hz → Parfait, garde 48000 Hz
  - Si 44100 Hz → Parfait, garde 44100 Hz
  - Si mixte → Convertir tout au même

### Conversion

- [ ] **Convertir MP3 → WAV** en gardant le sample rate original
  - Si 48000 Hz → Convertir en 48000 Hz
  - Si 44100 Hz → Convertir en 44100 Hz

### Mixage FL Studio

- [ ] **Configurer FL Studio** au même sample rate
  - Si raw en 48000 Hz → FL Studio en 48000 Hz
  - Si raw en 44100 Hz → FL Studio en 44100 Hz

### Export

- [ ] **Exporter les mixed** au même sample rate
  - Même sample rate que les raw
  - Cohérence totale

---

## 🎯 Plan d'Action pour Toi

### Si Tes MP3 sont en 48000 Hz :

1. ✅ **Convertir MP3 → WAV en 48000 Hz**
   ```python
   audio = audio.set_frame_rate(48000)  # Garde 48000 Hz
   ```

2. ✅ **Configurer FL Studio en 48000 Hz**
   - Options → Audio Settings → 48000 Hz

3. ✅ **Mixer et exporter en 48000 Hz**
   - Tout sera cohérent en 48000 Hz

4. ✅ **Diff-MST sera entraîné en 48000 Hz**
   - Qualité professionnelle garantie

---

## 📋 Résumé

**Question :** 48000 Hz c'est bon ?

**Réponse :** **OUI, c'est même excellent !** ✅

**Pourquoi :**
- ✅ Qualité professionnelle
- ✅ Diff-MST supporte 48000 Hz
- ✅ Même meilleur que 44100 Hz

**Important :**
- ✅ **Cohérence** : Tous les fichiers au même sample rate
- ✅ Si raw en 48000 Hz → Mixed en 48000 Hz
- ✅ Si raw en 44100 Hz → Mixed en 44100 Hz

**Action :**
- ✅ Convertir tes MP3 en WAV en **gardant 48000 Hz**
- ✅ Mixer dans FL Studio en **48000 Hz**
- ✅ Exporter en **48000 Hz**
- ✅ Tout sera cohérent !

**C'est parfait !** 🚀
