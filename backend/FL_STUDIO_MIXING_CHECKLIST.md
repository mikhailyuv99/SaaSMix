# Checklist : Mixage dans FL Studio pour Diff-MST

## 🎯 Objectif

Mixer 200-300 vocals raw avec la **même chaine** dans FL Studio, puis exporter pour l'entraînement Diff-MST.

---

## ✅ Checklist : Avant de Commencer

### Organisation FL Studio
- [ ] Créer un **template/projet** avec ta chaine de mixage
- [ ] Sauvegarder ce template pour réutiliser
- [ ] Vérifier que tous les plugins sont chargés

### Structure des Fichiers
- [ ] Créer `dataset/raw/` sur ton PC
- [ ] Créer `dataset/mixed/` sur ton PC
- [ ] Copier tous les vocals raw dans `dataset/raw/`

---

## 🎛️ Chaine de Mixage (Rappel)

### Ce qu'on APPLIQUE ✅

1. **High-Pass Filter** : 110Hz
2. **EQ** :
   - Low shelf : -4dB @ 200Hz
   - Cut @ 280Hz : -2.5dB
   - Cut @ 450Hz : -1.5dB
   - High shelf : +1dB @ 8000Hz (contrôlé)
3. **Compressor** :
   - Ratio : 2:1
   - Threshold : -12dB
   - Attack : 5ms
   - Release : 100ms
   - Makeup gain : +1dB
4. **Saturation** (tape saturation subtile) :
   - Drive : 0.14 (ou équivalent)
5. **Limiter** :
   - Threshold : -0.3dB
   - Release : 50ms
6. **Normalisation** : -0.3dB peak

### Ce qu'on N'APPLIQUE PAS ❌

- ❌ **PAS de Reverb**
- ❌ **PAS de Delay**
- ❌ **PAS de Doubler**
- ❌ **PAS d'autres effets contextuels**

**Pourquoi ?** Le modèle doit apprendre le "core mixing", pas les effets.

---

## 📋 Processus dans FL Studio

### Étape 1 : Créer le Template

1. **Ouvrir FL Studio**
2. **Charger un vocal raw** (exemple)
3. **Ajouter ta chaine** :
   - High-Pass Filter
   - EQ
   - Compressor
   - Saturation
   - Limiter
4. **Régler les paramètres** (une fois pour toutes)
5. **Sauvegarder comme template** : `Vocal_Mixing_Template.flp`

### Étape 2 : Mixer Chaque Vocal

**Pour chaque vocal :**

1. **Ouvrir le template** (ou utiliser le projet)
2. **Remplacer le vocal** :
   - Supprimer l'ancien vocal
   - Importer le nouveau vocal raw
3. **Vérifier les paramètres** :
   - ✅ Même chaine
   - ✅ Mêmes paramètres
   - ✅ Pas de reverb/delay
4. **Ajuster si nécessaire** :
   - ⚠️ Parfois besoin d'ajuster le gain d'entrée
   - ⚠️ Mais garder les mêmes paramètres d'effets
5. **Exporter** :
   - Format : WAV
   - Sample rate : 44100 Hz
   - Bit depth : 24-bit (ou 16-bit)
   - Nom : **Même nom que le raw** (important !)

### Étape 3 : Organisation

**Après export :**

1. **Vérifier le nom** : Même nom que le raw
2. **Déplacer dans `dataset/mixed/`**
3. **Vérifier** : `raw/vocal1.wav` ↔ `mixed/vocal1.wav`

---

## ⚠️ Points d'Attention

### Noms des Fichiers

**IMPORTANT :** Les noms doivent être **identiques** !

**Exemple :**
- Raw : `dataset/raw/song_01_vocal.wav`
- Mixed : `dataset/mixed/song_01_vocal.wav` ✅

**Pas :**
- Raw : `dataset/raw/song_01_vocal.wav`
- Mixed : `dataset/mixed/song_01_vocal_MIXED.wav` ❌

**Solution :** 
- Exporter avec le même nom
- Ou renommer après export

### Sample Rate

**IMPORTANT :** Tous les fichiers doivent avoir le **même sample rate**.

**Recommandé :** 44100 Hz

**Dans FL Studio :**
- Vérifier le sample rate du projet
- Exporter en 44100 Hz

### Normalisation

**IMPORTANT :** Tous les mixed doivent être normalisés à **-0.3dB peak**.

**Dans FL Studio :**
- Utiliser le limiter à -0.3dB
- Ou normaliser après export

### Style Cohérent

**IMPORTANT :** Tous les vocals doivent être mixés avec les **mêmes paramètres**.

**Solution :**
- Utiliser le même template pour tous
- Ne pas changer les paramètres entre les vocals
- Si besoin d'ajuster, ajuster seulement le gain d'entrée

---

## 🚀 Astuces FL Studio

### Template Réutilisable

**Créer un template :**
1. Setup ta chaine une fois
2. Sauvegarder comme template
3. Ouvrir ce template pour chaque vocal
4. Remplacer juste le vocal
5. Exporter

**Gain de temps :** Énorme !

### Batch Export (Optionnel)

**Si FL Studio le supporte :**
- Exporter plusieurs pistes en une fois
- Vérifier que les noms sont corrects

**Sinon :** Exporter 1 par 1 (plus sûr pour les noms)

### Vérification Rapide

**Après chaque export :**
- Vérifier le nom du fichier
- Vérifier qu'il est dans `dataset/mixed/`
- Vérifier qu'il correspond au raw

---

## 📊 Progression

### Objectif : 200-300 paires

**Plan suggéré :**
- **Semaine 1** : 50-75 vocals
- **Semaine 2** : 50-75 vocals
- **Semaine 3** : 50-75 vocals
- **Semaine 4** : 50-75 vocals (si besoin)

**Total :** 200-300 paires en 3-4 semaines

---

## ✅ Checklist Finale (Avant de me Recontacter)

Quand tu auras fini, vérifie :

### Organisation
- [ ] 200-300 fichiers dans `dataset/raw/`
- [ ] 200-300 fichiers dans `dataset/mixed/`
- [ ] Même nombre de fichiers dans les deux dossiers
- [ ] Tous les noms correspondent (raw/vocal1.wav ↔ mixed/vocal1.wav)

### Qualité
- [ ] Tous les fichiers sont en WAV
- [ ] Tous en 44100 Hz (ou même sample rate)
- [ ] Pas de corruption (tous les fichiers s'ouvrent)
- [ ] Tous normalisés à -0.3dB peak

### Mixage
- [ ] Même chaine pour tous
- [ ] Mêmes paramètres pour tous
- [ ] Pas de reverb/delay dans les mixed
- [ ] Style cohérent

### Prêt pour Entraînement
- [ ] Tout est organisé
- [ ] Tout est vérifié
- [ ] Tu es prêt à fine-tuner Diff-MST !

---

## 🎯 Résumé

**Ce que tu fais :**

1. ✅ Créer template FL Studio avec ta chaine
2. ✅ Mixer 200-300 vocals (même paramètres)
3. ✅ Exporter avec les mêmes noms que les raw
4. ✅ Organiser dans `dataset/raw/` et `dataset/mixed/`
5. ✅ Vérifier que tout est OK

**Ce qu'on fera après :**

1. ✅ Fine-tuner Diff-MST avec tes données
2. ✅ Tester le modèle
3. ✅ Ajuster si besoin
4. ✅ Intégrer dans le SaaS

---

## 🚀 On se Retrouve Quand ?

**Quand tu auras :**
- ✅ 200-300 paires prêtes
- ✅ Tout organisé et vérifié
- ✅ Prêt pour l'entraînement

**On fera alors :**
- ✅ Installation Diff-MST
- ✅ Adaptation pour vocal mixing
- ✅ Fine-tuning avec tes données
- ✅ Tests du modèle

**Bon courage pour le mixage ! 💪**

**Reviens vers moi quand c'est prêt, et on fine-tune Diff-MST ensemble !** 🚀
