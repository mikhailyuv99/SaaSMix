# MP3 vs WAV pour l'Entraînement Diff-MST

## 🎯 Question : MP3 Acceptable ?

**Réponse courte :** **OUI, mais avec quelques précautions !**

---

## 📊 MP3 vs WAV : Différences

### WAV (Waveform Audio File Format)
- ✅ **Non compressé** (qualité maximale)
- ✅ **Pas de perte** de données
- ✅ **Standard** pour l'entraînement ML
- ⚠️ **Fichiers plus gros** (10x plus que MP3)

### MP3 (MPEG Audio Layer 3)
- ✅ **Compressé** (fichiers plus petits)
- ⚠️ **Perte de données** (compression)
- ⚠️ **Qualité réduite** (selon bitrate)
- ✅ **Plus facile à télécharger**

---

## ✅ MP3 Acceptable pour l'Entraînement ?

### OUI, si :

1. **Bitrate élevé** (≥ 192 kbps, idéalement 320 kbps)
2. **Qualité source bonne** (pas de MP3 re-compressés)
3. **On convertit en WAV** avant l'entraînement (recommandé)

### ⚠️ Attention si :

1. **Bitrate faible** (< 128 kbps) → Qualité insuffisante
2. **MP3 re-compressés** → Perte de qualité cumulative
3. **Utilisation directe** sans conversion → Peut causer des problèmes

---

## 🎯 Recommandation

### Option 1 : Convertir en WAV (Recommandé) ⭐

**Pourquoi :**
- ✅ Format standard pour ML
- ✅ Pas de problèmes de compatibilité
- ✅ Qualité préservée (si bitrate MP3 élevé)
- ✅ Cohérence (tous les fichiers en WAV)

**Comment :**
- Utiliser FFmpeg ou Audacity
- Convertir tous les MP3 en WAV 44.1kHz
- Organiser dans `dataset/raw/`

---

### Option 2 : Utiliser MP3 Directement

**Possible si :**
- ✅ Bitrate ≥ 192 kbps
- ✅ Librosa/PyTorch supporte MP3
- ⚠️ Mais moins optimal

**Inconvénients :**
- ⚠️ Qualité légèrement réduite
- ⚠️ Peut causer des problèmes de compatibilité
- ⚠️ Moins standard

---

## 🔧 Comment Convertir MP3 → WAV

### Méthode 1 : FFmpeg (Recommandé)

**Installation :**
```bash
# Windows (avec Chocolatey)
choco install ffmpeg

# Ou télécharger depuis https://ffmpeg.org/
```

**Conversion :**
```bash
# Convertir un fichier
ffmpeg -i input.mp3 -ar 44100 -ac 1 output.wav

# Convertir tous les MP3 d'un dossier
for file in *.mp3; do
    ffmpeg -i "$file" -ar 44100 -ac 1 "${file%.mp3}.wav"
done
```

**Paramètres :**
- `-ar 44100` : Sample rate 44.1kHz
- `-ac 1` : Mono (ou `-ac 2` pour stereo)
- `output.wav` : Format WAV

---

### Méthode 2 : Python (pydub)

**Installation :**
```bash
pip install pydub
# Sur Windows, aussi installer ffmpeg
```

**Code :**
```python
from pydub import AudioSegment
import os

def convert_mp3_to_wav(input_dir, output_dir):
    """Convertit tous les MP3 en WAV"""
    os.makedirs(output_dir, exist_ok=True)
    
    for filename in os.listdir(input_dir):
        if filename.endswith('.mp3'):
            # Charger MP3
            audio = AudioSegment.from_mp3(
                os.path.join(input_dir, filename)
            )
            
            # Convertir en WAV 44.1kHz mono
            audio = audio.set_frame_rate(44100)
            audio = audio.set_channels(1)  # Mono
            
            # Sauvegarder
            output_path = os.path.join(
                output_dir,
                filename.replace('.mp3', '.wav')
            )
            audio.export(output_path, format='wav')
            print(f"Converted: {filename}")

# Utilisation
convert_mp3_to_wav('downloads/mp3', 'dataset/raw')
```

---

### Méthode 3 : Audacity (Interface Graphique)

**Pour les moins techniques :**

1. Ouvrir Audacity
2. Fichier → Ouvrir → Sélectionner MP3
3. Fichier → Exporter → Exporter en WAV
4. Options :
   - Format : WAV (Microsoft)
   - Sample rate : 44100 Hz
   - Channels : Mono (ou Stereo)
5. Répéter pour tous les fichiers

**Avantage :** Interface graphique, facile
**Inconvénient :** Plus lent (fichier par fichier)

---

## 📋 Script de Conversion Automatique

### Script Python Complet

```python
"""
Script pour convertir tous les MP3 en WAV
"""
import os
from pydub import AudioSegment

def convert_all_mp3_to_wav(input_dir, output_dir):
    """
    Convertit tous les MP3 d'un dossier en WAV
    
    Args:
        input_dir: Dossier avec les MP3
        output_dir: Dossier de sortie pour les WAV
    """
    os.makedirs(output_dir, exist_ok=True)
    
    mp3_files = [f for f in os.listdir(input_dir) if f.endswith('.mp3')]
    total = len(mp3_files)
    
    print(f"Found {total} MP3 files")
    print("Converting to WAV (44.1kHz, mono)...")
    
    for i, filename in enumerate(mp3_files, 1):
        try:
            # Charger MP3
            input_path = os.path.join(input_dir, filename)
            audio = AudioSegment.from_mp3(input_path)
            
            # Convertir en WAV 44.1kHz mono
            audio = audio.set_frame_rate(44100)
            audio = audio.set_channels(1)  # Mono
            
            # Sauvegarder
            output_filename = filename.replace('.mp3', '.wav')
            output_path = os.path.join(output_dir, output_filename)
            audio.export(output_path, format='wav')
            
            print(f"[{i}/{total}] ✓ {filename} → {output_filename}")
            
        except Exception as e:
            print(f"[{i}/{total}] ✗ Error with {filename}: {e}")
    
    print(f"\n✅ Conversion complete! {total} files converted.")

# Utilisation
if __name__ == "__main__":
    input_dir = "downloads/mp3"  # Dossier avec tes MP3
    output_dir = "dataset/raw"    # Dossier de sortie
    
    convert_all_mp3_to_wav(input_dir, output_dir)
```

**Sauvegarde comme :** `convert_mp3_to_wav.py`

**Utilisation :**
```bash
python convert_mp3_to_wav.py
```

---

## ⚠️ Points d'Attention

### 1. Bitrate du MP3

**Vérifier le bitrate :**
```python
from pydub import AudioSegment

audio = AudioSegment.from_mp3("file.mp3")
print(f"Bitrate: {audio.frame_rate} Hz")
print(f"Channels: {audio.channels}")
```

**Recommandation :**
- ✅ ≥ 192 kbps : Acceptable
- ✅ ≥ 320 kbps : Idéal
- ⚠️ < 128 kbps : Qualité insuffisante

---

### 2. Sample Rate

**Important :** Tous les fichiers doivent avoir le même sample rate.

**Recommandation :** 44100 Hz (standard)

**Dans la conversion :**
```python
audio = audio.set_frame_rate(44100)  # Force 44.1kHz
```

---

### 3. Mono vs Stereo

**Pour l'entraînement :**
- ✅ **Mono recommandé** (plus simple, moins de données)
- ⚠️ Stereo possible mais plus complexe

**Dans la conversion :**
```python
audio = audio.set_channels(1)  # Force mono
```

---

### 4. Qualité Source

**Attention :** Si les MP3 sont déjà de mauvaise qualité, convertir en WAV ne les améliorera pas.

**Solution :** Vérifier la qualité avant de télécharger/télécharger seulement les meilleurs.

---

## 📊 Impact sur la Qualité du Modèle

### MP3 320 kbps → WAV
- ✅ **Impact minimal** (qualité très proche)
- ✅ Acceptable pour l'entraînement
- ✅ Le modèle apprendra bien

### MP3 192 kbps → WAV
- ⚠️ **Impact modéré** (légère perte de qualité)
- ⚠️ Acceptable mais pas optimal
- ⚠️ Le modèle peut apprendre mais qualité moindre

### MP3 < 128 kbps → WAV
- ❌ **Impact important** (perte de qualité significative)
- ❌ Pas recommandé
- ❌ Le modèle apprendra moins bien

**Verdict :** Si bitrate ≥ 192 kbps, c'est acceptable !

---

## ✅ Plan d'Action

### Étape 1 : Télécharger les MP3
- ✅ Télécharger depuis le site
- ✅ Vérifier le bitrate (si possible)
- ✅ Organiser dans un dossier `downloads/mp3/`

### Étape 2 : Convertir en WAV
- ✅ Utiliser le script Python (ou FFmpeg)
- ✅ Convertir tous les MP3 en WAV 44.1kHz mono
- ✅ Sauvegarder dans `dataset/raw/`

### Étape 3 : Vérifier
- ✅ Vérifier que tous les fichiers sont en WAV
- ✅ Vérifier le sample rate (44100 Hz)
- ✅ Vérifier qu'ils s'ouvrent correctement

### Étape 4 : Mixer
- ✅ Mixer les WAV dans FL Studio
- ✅ Exporter les mixed en WAV
- ✅ Organiser dans `dataset/mixed/`

---

## 🚀 Script Rapide (Prêt à Utiliser)

Je peux te créer un script Python qui :
1. Convertit tous les MP3 en WAV
2. Vérifie la qualité
3. Organise dans les bons dossiers

**Tu veux que je te le crée maintenant ?**

---

## 📋 Résumé

**Question :** MP3 acceptable pour l'entraînement ?

**Réponse :** **OUI, mais convertir en WAV d'abord !**

**Pourquoi :**
- ✅ Format standard pour ML
- ✅ Pas de problèmes de compatibilité
- ✅ Qualité préservée (si bitrate élevé)

**Comment :**
- ✅ Utiliser FFmpeg ou Python (pydub)
- ✅ Convertir en WAV 44.1kHz mono
- ✅ Organiser dans `dataset/raw/`

**C'est totalement faisable !** 🚀
