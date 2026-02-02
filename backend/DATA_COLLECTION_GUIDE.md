# Guide : Collecter 100 Paires pour Diff-MST

## 🎯 Objectif

Collecter **100 paires** de données (raw/mixed) pour fine-tuner Diff-MST et avoir un modèle qui mixe bien la voix.

---

## 📊 Combien de Paires Exactement ?

### Avec Transfer Learning (Diff-MST pré-entraîné) :

**Minimum : 100 paires**
- ✅ Qualité acceptable
- ✅ Temps fine-tuning : 4-6 heures
- ✅ Bon pour commencer

**Recommandé : 150-200 paires** ⭐
- ✅ Qualité professionnelle
- ✅ Temps fine-tuning : 6-8 heures
- ✅ **C'est le sweet spot**

**Premium : 200-300 paires**
- ✅ Qualité exceptionnelle
- ✅ Temps fine-tuning : 8-12 heures
- ✅ Meilleure qualité possible

**Ma recommandation : Vise 150-200 paires** (meilleur compromis)

---

## 📁 Structure des Données

### Organisation

```
dataset/
├── raw/
│   ├── vocal1.wav
│   ├── vocal2.wav
│   ├── vocal3.wav
│   └── ... (100-200 fichiers)
└── mixed/
    ├── vocal1.wav      ← Même nom que raw !
    ├── vocal2.wav
    ├── vocal3.wav
    └── ... (même nombre, mêmes noms)
```

**IMPORTANT :**
- ✅ Les noms doivent **correspondre exactement**
- ✅ `raw/vocal1.wav` ↔ `mixed/vocal1.wav`
- ✅ Même nombre de fichiers dans les deux dossiers

---

## 🎵 Comment Collecter les Données

### Option 1 : Télécharger des Vocals Raw Gratuits

**Tu as dit avoir trouvé une library avec plein de vocals raw :**

1. **Télécharge les vocals raw** (100-200 fichiers)
2. **Mixe-les** avec ta chaine de mixage (sans reverb/delay)
3. **Exporte les mixed** avec les mêmes noms
4. **Organise** dans `raw/` et `mixed/`

**Temps estimé :**
- Téléchargement : 1-2 jours
- Mixage : 2-4 semaines (selon vitesse)
- Organisation : 1 jour

---

### Option 2 : Utiliser Tes Propres Mixes

**Si tu as déjà mixé des vocals :**

1. **Trouve les raw originaux** (si tu les as)
2. **Trouve les mixed finaux**
3. **Organise** dans `raw/` et `mixed/`

**Temps estimé :** 1-2 jours (si tu as déjà tout)

---

### Option 3 : Mixer Progressivement

**Approche progressive :**

1. **Semaine 1** : Mixer 25 paires → Tester
2. **Semaine 2** : Mixer 25 paires de plus → Tester
3. **Semaine 3-4** : Mixer 50-100 paires de plus
4. **Total** : 100-200 paires en 3-4 semaines

**Avantage :** Tu peux tester le modèle au fur et à mesure

---

## 🎛️ Comment Mixer les Vocals (IMPORTANT)

### Chaine de Mixage pour les Fichiers "mixed"

**Rappel : PAS de reverb/delay dans les mixed !**

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

**Ce qu'on APPLIQUE :**
- ✅ EQ (équilibrage fréquentiel)
- ✅ Compression (contrôle dynamique)
- ✅ Saturation (couleur/chaleur)
- ✅ Limiter (prévention clipping)
- ✅ Normalisation (niveau final)

**Ce qu'on N'APPLIQUE PAS :**
- ❌ Reverb
- ❌ Delay
- ❌ Doubler
- ❌ Autres effets contextuels

**Pourquoi ?** Le modèle doit apprendre le "core mixing", pas les effets.

---

## 📋 Checklist : Préparation des Données

### Qualité des Fichiers

- [ ] **Format** : WAV (44.1kHz recommandé)
- [ ] **Sample rate** : 44100 Hz (ou convertir)
- [ ] **Mono/Stereo** : Cohérent (tous mono ou tous stereo)
- [ ] **Longueur** : 30 secondes minimum (2-3 minutes idéal)
- [ ] **Qualité** : Pas de clipping, pas de corruption

### Organisation

- [ ] **Noms identiques** : `raw/vocal1.wav` ↔ `mixed/vocal1.wav`
- [ ] **Même nombre** : Même nombre de fichiers dans `raw/` et `mixed/`
- [ ] **Pas d'espaces** : Utiliser `_` ou `-` dans les noms
- [ ] **Pas de caractères spéciaux** : Éviter `é`, `à`, etc.

### Mixage

- [ ] **Style cohérent** : Même style de mixage pour tous
- [ ] **Pas de reverb/delay** : Seulement core mixing
- [ ] **Normalisation** : Tous à -0.3dB peak
- [ ] **Qualité** : Mixage professionnel

---

## 🚀 Plan d'Action : Collecter 100-200 Paires

### Semaine 1 : Setup & Premiers Mixes

**Jour 1-2 :**
- [ ] Télécharger les vocals raw (100-200 fichiers)
- [ ] Organiser dans `dataset/raw/`
- [ ] Vérifier la qualité (pas de corruption)

**Jour 3-7 :**
- [ ] Mixer les 25-50 premiers vocals
- [ ] Exporter dans `dataset/mixed/`
- [ ] Vérifier que les noms correspondent

**Résultat :** 25-50 paires prêtes

---

### Semaine 2 : Continuer le Mixage

**Jour 1-7 :**
- [ ] Mixer 50-75 vocals de plus
- [ ] Exporter dans `dataset/mixed/`
- [ ] Vérifier la cohérence du style

**Résultat :** 75-125 paires prêtes

---

### Semaine 3 : Finaliser

**Jour 1-7 :**
- [ ] Mixer les derniers vocals (25-75)
- [ ] Vérifier toutes les paires
- [ ] Organiser et nettoyer

**Résultat :** 100-200 paires prêtes ✅

---

## 🔍 Vérification Avant Entraînement

### Script de Vérification

Une fois que tu as toutes tes paires, on créera un script pour vérifier :

```python
# Vérifier que tout est OK
- Nombre de fichiers dans raw/ = nombre dans mixed/
- Tous les noms correspondent
- Tous les fichiers sont valides (pas de corruption)
- Sample rate cohérent
- Longueurs similaires
```

**Je te donnerai ce script quand tu auras fini !**

---

## 📊 Progression Recommandée

### Approche Progressive (Recommandée)

**100 paires → Tester → 150 paires → Tester → 200 paires**

**Pourquoi :**
- ✅ Tu peux tester le modèle avec 100 paires
- ✅ Si ça marche bien, tu continues
- ✅ Si ça marche pas, tu ajustes avant de mixer plus

**Plan :**
1. **Mixer 100 paires** (2-3 semaines)
2. **Fine-tune Diff-MST** (6-8 heures)
3. **Tester** le modèle
4. **Si bon** → Mixer 50-100 de plus
5. **Si pas bon** → Ajuster et réentraîner

---

## 💡 Conseils pour le Mixage

### Style Cohérent

**Important :** Tous les vocals doivent être mixés avec le **même style**.

**Pourquoi :** Le modèle apprend ton style spécifique. Si tu changes de style, il va être confus.

**Solution :**
- ✅ Utilise la **même chaine** pour tous
- ✅ Même preset/paramètres
- ✅ Même approche

### Variété dans les Données

**Mais aussi :** Il faut de la **variété** dans les vocals raw.

**Variété souhaitée :**
- ✅ Différents styles vocaux (rap, R&B, pop, etc.)
- ✅ Différentes qualités d'enregistrement
- ✅ Différentes voix (masculin, féminin, etc.)
- ✅ Différentes longueurs

**Pourquoi :** Le modèle doit généraliser, pas juste mémoriser.

---

## ⏱️ Estimation Temps Total

### Mixage Manuel

**Temps par vocal :**
- Setup chaine : 2-3 minutes
- Mixage : 5-10 minutes
- Export : 1 minute
- **Total : 8-14 minutes par vocal**

**Pour 100 vocals :**
- **Temps total : 13-23 heures**
- **Sur 2-3 semaines : 1-2h/jour**

**Pour 200 vocals :**
- **Temps total : 27-47 heures**
- **Sur 3-4 semaines : 1-2h/jour**

---

## ✅ Résumé

**Objectif :** 100-200 paires raw/mixed

**Structure :**
```
dataset/
├── raw/    (100-200 fichiers)
└── mixed/  (même nombre, mêmes noms)
```

**Mixage :**
- ✅ EQ + Compression + Saturation + Limiter
- ❌ PAS de reverb/delay

**Temps :** 2-4 semaines (selon nombre)

**Prochaine étape :** Une fois les données prêtes, on fine-tune Diff-MST ensemble !

---

## 🚀 On Commence ?

**Actions immédiates :**

1. **Télécharger les vocals raw** (100-200 fichiers)
2. **Créer les dossiers** `dataset/raw/` et `dataset/mixed/`
3. **Commencer à mixer** (25-50 par semaine)
4. **Me tenir au courant** de ta progression

**Quand tu auras 100 paires, on fine-tune Diff-MST ensemble !** 🎯
