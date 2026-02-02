# Architecture SaaS Complet : Vocal Mixing IA

## 🎯 Vision de Ton SaaS

Un endroit où un artiste peut avoir un son **professionnel** avec juste des enregistrements bruts grâce à l'IA :
- ✅ Mixer juste la voix raw
- ✅ Mixer voix + instrumental
- ✅ Ajouter des pistes d'adlibs, renforts, etc.
- ✅ Contrôle textuel ("augmente les aigus", "baisse les sibilances", etc.)

---

## 🤔 Questions Répondues

### 1. Diff-MST peut-il être "prompté" avec du texte ?

**Réponse courte : Non directement, MAIS on peut l'ajouter !**

**Diff-MST actuel :**
- ❌ Pas de prompting textuel natif
- ✅ Prédit des paramètres (EQ, compression, etc.)
- ✅ Ces paramètres sont **interprétables et modifiables**

**Solution : Ajouter une couche de contrôle textuel**
- Utiliser un **LLM** (GPT-4, Claude, etc.) pour traduire le texte en paramètres
- Exemple : "augmente les aigus" → `high_shelf_gain: +3dB`
- Puis appliquer ces paramètres à Diff-MST

**Architecture proposée :**
```
Texte utilisateur → LLM → Paramètres → Diff-MST → Mix final
```

---

### 2. C'est quoi "Transformer + Console de Mixing Différentiable" ?

**Transformer (Controller) :**
- Architecture de réseau de neurones (comme GPT)
- **Analyse** les pistes audio (raw vocal, instrumental, etc.)
- **Prédit** les paramètres de mixing (EQ, compression, etc.)
- Apprend les patterns de mixing depuis les données

**Console de Mixing Différentiable :**
- **Console virtuelle** qui applique les effets audio
- **Différentiable** = peut calculer les gradients (nécessaire pour l'entraînement)
- Applique les paramètres prédits par le Transformer :
  - EQ (gain, fréquence, Q)
  - Compression (threshold, ratio, attack, release)
  - Saturation
  - Panning
  - Gain

**Comment ça marche ensemble :**
```
Audio Input → Transformer (analyse) → Paramètres prédits → Console (applique) → Audio Output
```

**Avantages :**
- ✅ Interprétable (on voit les paramètres)
- ✅ Ajustable (on peut modifier les paramètres)
- ✅ Apprend le style de mixing
- ✅ Évite les artefacts (utilise de vrais effets audio)

---

## 🏗️ Architecture Proposée pour Ton SaaS

### Architecture Complète

```
┌─────────────────────────────────────────────────────────────┐
│                    Interface Utilisateur                     │
│  - Upload vocal raw                                          │
│  - Upload instrumental (optionnel)                            │
│  - Upload adlibs/renforts (optionnel)                        │
│  - Contrôles textuels ("augmente les aigus")                 │
│  - Contrôles manuels (sliders EQ, compression, etc.)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Système de Contrôle Textuel (LLM)              │
│  - Traduit texte → paramètres                                │
│  - Ex: "augmente les aigus" → high_shelf_gain: +3dB         │
│  - Ex: "baisse les sibilances" → deesser_threshold: -40dB   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Diff-MST (Mixing Style Transfer)                │
│  - Analyse toutes les pistes (vocal, instrumental, adlibs)  │
│  - Prédit les paramètres de mixing                            │
│  - Applique via console différentiable                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Post-Processing & Effets                       │
│  - Ajustements manuels (si utilisateur modifie)              │
│  - Reverb, Delay (ajoutés après)                             │
│  - Final mix                                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Mix Final Professionnel
```

---

## 🎛️ Fonctionnalités Détaillées

### 1. Upload Multi-Pistes

**Pistes supportées :**
- ✅ **Vocal principal** (obligatoire)
- ✅ **Instrumental** (optionnel)
- ✅ **Adlibs** (optionnel, multiple pistes)
- ✅ **Renforts/Backing vocals** (optionnel, multiple pistes)
- ✅ **Doublures** (optionnel)

**Format :**
```python
{
    "vocal": "vocal.wav",  # Obligatoire
    "instrumental": "beat.wav",  # Optionnel
    "adlibs": ["adlib1.wav", "adlib2.wav"],  # Optionnel
    "backing_vocals": ["backing1.wav", "backing2.wav"],  # Optionnel
    "doubles": ["double1.wav"]  # Optionnel
}
```

### 2. Contrôle Textuel

**Exemples de prompts supportés :**
- "augmente les aigus" → `high_shelf_gain: +3dB`
- "baisse les sibilances" → `deesser_threshold: -40dB, deesser_reduction: -12dB`
- "enlève le delay" → `delay_intensity: 0.0`
- "augmente la largeur de ma reverb" → `reverb_room_size: 0.8`
- "rends la voix plus présente" → `compression_makeup_gain: +2dB, mid_freq_gain: +2dB`
- "ajoute plus de chaleur" → `saturation_drive: 0.2`
- "rends la voix plus fine" → `high_pass_freq: 120Hz, low_mid_cut: -3dB`

**Implémentation :**
```python
class TextToParameters:
    """Traduit le texte utilisateur en paramètres audio"""
    
    def __init__(self):
        self.llm = load_llm()  # GPT-4, Claude, ou modèle local
    
    def parse(self, text: str) -> dict:
        """
        Traduit le texte en paramètres
        
        Exemple:
        "augmente les aigus" → {"high_shelf_gain": 3.0}
        """
        prompt = f"""
        Traduis cette instruction de mixing en paramètres audio:
        "{text}"
        
        Retourne un JSON avec les paramètres modifiés.
        """
        
        response = self.llm.generate(prompt)
        return json.loads(response)
```

### 3. Mixing Multi-Pistes avec Diff-MST

**Diff-MST supporte le multitrack nativement !** C'est son point fort.

**Comment ça marche :**
```python
# Diff-MST prend plusieurs pistes en entrée
tracks = {
    "vocal": vocal_audio,
    "instrumental": instrumental_audio,
    "adlibs": [adlib1, adlib2],
    "backing": [backing1, backing2]
}

# Diff-MST analyse toutes les pistes
# Prédit les paramètres pour chaque piste
# Applique les paramètres via console différentiable
# Retourne le mix final

mixed = diff_mst_model.process_multitrack(tracks)
```

---

## 💻 Implémentation Technique

### Structure des Fichiers

```
backend/
├── mixing_service.py          # Service principal (existant)
├── audio_processor.py         # Processeur audio (existant)
├── diff_mst_integration.py    # NOUVEAU : Intégration Diff-MST
├── text_control.py            # NOUVEAU : Contrôle textuel (LLM)
├── multitrack_mixer.py        # NOUVEAU : Mixing multi-pistes
└── ml_model.py                # Modèle actuel (peut être remplacé)
```

### 1. Intégration Diff-MST

```python
# diff_mst_integration.py
import sys
sys.path.append('/path/to/Diff-MST')
from mst.modules import DiffMSTModel
import torch

class DiffMSTMixer:
    """Wrapper pour Diff-MST avec support multi-pistes"""
    
    def __init__(self, model_path: str):
        self.model = DiffMSTModel.load_from_checkpoint(model_path)
        self.model.eval()
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model.to(self.device)
    
    def process_multitrack(
        self,
        vocal: np.ndarray,
        instrumental: Optional[np.ndarray] = None,
        adlibs: List[np.ndarray] = [],
        backing_vocals: List[np.ndarray] = []
    ) -> Tuple[np.ndarray, dict]:
        """
        Traite plusieurs pistes avec Diff-MST
        
        Returns:
            - Mixed audio
            - Paramètres prédits (pour affichage/modification)
        """
        # Préparer les pistes pour Diff-MST
        tracks = self._prepare_tracks(vocal, instrumental, adlibs, backing_vocals)
        
        # Traiter avec Diff-MST
        with torch.no_grad():
            mixed, parameters = self.model.process_multitrack(tracks)
        
        return mixed, parameters
    
    def _prepare_tracks(self, vocal, instrumental, adlibs, backing_vocals):
        """Prépare les pistes au format Diff-MST"""
        tracks = []
        
        # Vocal principal (obligatoire)
        tracks.append({
            "audio": vocal,
            "type": "vocal",
            "name": "main_vocal"
        })
        
        # Instrumental (optionnel)
        if instrumental is not None:
            tracks.append({
                "audio": instrumental,
                "type": "instrumental",
                "name": "instrumental"
            })
        
        # Adlibs
        for i, adlib in enumerate(adlibs):
            tracks.append({
                "audio": adlib,
                "type": "adlib",
                "name": f"adlib_{i}"
            })
        
        # Backing vocals
        for i, backing in enumerate(backing_vocals):
            tracks.append({
                "audio": backing,
                "type": "backing_vocal",
                "name": f"backing_{i}"
            })
        
        return tracks
```

### 2. Contrôle Textuel

```python
# text_control.py
from openai import OpenAI  # Ou autre LLM
import json

class TextToParameters:
    """Traduit les instructions textuelles en paramètres audio"""
    
    def __init__(self, api_key: str = None):
        # Option 1 : API OpenAI/Anthropic
        if api_key:
            self.client = OpenAI(api_key=api_key)
        # Option 2 : Modèle local (plus économique)
        else:
            self.model = load_local_llm()  # Ollama, etc.
    
    def parse(self, text: str, current_params: dict = None) -> dict:
        """
        Traduit le texte en paramètres audio
        
        Args:
            text: Instruction textuelle ("augmente les aigus")
            current_params: Paramètres actuels (optionnel)
        
        Returns:
            Dict avec les paramètres modifiés
        """
        prompt = f"""
Tu es un ingénieur du son expert. Traduis cette instruction de mixing en paramètres audio techniques.

Instruction: "{text}"

Paramètres actuels: {json.dumps(current_params or {}, indent=2)}

Retourne UNIQUEMENT un JSON avec les paramètres à modifier.
Format:
{{
    "high_shelf_gain": 3.0,  // si augmentation des aigus
    "deesser_threshold": -40.0,  // si baisse des sibilances
    "delay_intensity": 0.0,  // si enlever le delay
    // etc.
}}
"""
        
        if hasattr(self, 'client'):
            # API OpenAI/Anthropic
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}]
            )
            result = json.loads(response.choices[0].message.content)
        else:
            # Modèle local
            result = self.model.generate(prompt)
            result = json.loads(result)
        
        return result
    
    # Mapping direct pour instructions communes (plus rapide)
    DIRECT_MAPPINGS = {
        "augmente les aigus": {"high_shelf_gain": 3.0},
        "baisse les sibilances": {"deesser_threshold": -40.0, "deesser_reduction": -12.0},
        "enlève le delay": {"delay_intensity": 0.0},
        "augmente la largeur de ma reverb": {"reverb_room_size": 0.8},
        "rends la voix plus présente": {"compression_makeup_gain": 2.0, "mid_freq_gain": 2.0},
        "ajoute plus de chaleur": {"saturation_drive": 0.2},
        "rends la voix plus fine": {"high_pass_freq": 120, "low_mid_cut": -3.0},
    }
    
    def parse_fast(self, text: str) -> dict:
        """Version rapide avec mapping direct"""
        text_lower = text.lower()
        for key, params in self.DIRECT_MAPPINGS.items():
            if key in text_lower:
                return params
        # Si pas trouvé, utiliser LLM
        return self.parse(text)
```

### 3. Service Mixing Multi-Pistes

```python
# mixing_service.py (extension)
class MixingService:
    def __init__(self, use_diff_mst: bool = True, diff_mst_path: str = None):
        if use_diff_mst:
            self.diff_mst = DiffMSTMixer(diff_mst_path)
        self.text_control = TextToParameters()
    
    def process_multitrack_mix(
        self,
        vocal_path: str,
        instrumental_path: Optional[str] = None,
        adlibs_paths: List[str] = [],
        backing_vocals_paths: List[str] = [],
        text_instructions: Optional[str] = None,
        manual_params: Optional[dict] = None
    ) -> Tuple[str, dict]:
        """
        Traite un mix multi-pistes avec contrôle textuel
        
        Returns:
            - Chemin du mix final
            - Paramètres appliqués (pour affichage)
        """
        # Charger toutes les pistes
        vocal = self.processor.load_audio(vocal_path)[0]
        instrumental = None
        if instrumental_path:
            instrumental = self.processor.load_audio(instrumental_path)[0]
        
        adlibs = [self.processor.load_audio(path)[0] for path in adlibs_paths]
        backing_vocals = [self.processor.load_audio(path)[0] for path in backing_vocals_paths]
        
        # Traiter avec Diff-MST
        mixed, predicted_params = self.diff_mst.process_multitrack(
            vocal, instrumental, adlibs, backing_vocals
        )
        
        # Appliquer les instructions textuelles si fournies
        if text_instructions:
            text_params = self.text_control.parse_fast(text_instructions)
            # Fusionner avec les paramètres prédits
            predicted_params.update(text_params)
        
        # Appliquer les paramètres manuels si fournis
        if manual_params:
            predicted_params.update(manual_params)
        
        # Réappliquer les paramètres modifiés
        final_mix = self._apply_parameters(mixed, predicted_params)
        
        # Sauvegarder
        output_path = self._save_mix(final_mix)
        
        return output_path, predicted_params
```

---

## 🎨 Interface Utilisateur (Exemple)

### Upload
```
┌─────────────────────────────────────┐
│  Upload vos pistes                  │
├─────────────────────────────────────┤
│  Vocal principal *                  │
│  [📁 Choisir fichier]                │
│                                      │
│  Instrumental (optionnel)            │
│  [📁 Choisir fichier]                │
│                                      │
│  Adlibs (optionnel)                  │
│  [📁 + Ajouter piste]                │
│                                      │
│  Renforts/Backing (optionnel)       │
│  [📁 + Ajouter piste]                │
└─────────────────────────────────────┘
```

### Contrôle Textuel
```
┌─────────────────────────────────────┐
│  Instructions textuelles            │
├─────────────────────────────────────┤
│  [Texte] augmente les aigus         │
│  [Texte] baisse les sibilances      │
│  [Texte] enlève le delay            │
│                                      │
│  [🔍 Analyser] [🎵 Mixer]           │
└─────────────────────────────────────┘
```

### Paramètres Prédits (Affichage)
```
┌─────────────────────────────────────┐
│  Paramètres appliqués               │
├─────────────────────────────────────┤
│  EQ High Shelf: +3.0 dB            │
│  De-esser: -40 dB threshold        │
│  Compression: 2:1 ratio              │
│  Saturation: 0.15 drive             │
│                                      │
│  [✏️ Modifier manuellement]         │
└─────────────────────────────────────┘
```

---

## 📊 Comparaison : Diff-MST vs Modèle Actuel

| Fonctionnalité | Modèle Actuel | Diff-MST |
|----------------|---------------|----------|
| **Multi-pistes** | ❌ Vocal seul | ✅ **Oui** |
| **Instrumental** | ⚠️ Mix séparé | ✅ **Intégré** |
| **Adlibs/Renforts** | ❌ Non | ✅ **Oui** |
| **Contrôle textuel** | ❌ Non | ⚠️ **À ajouter** |
| **Interprétabilité** | ❌ Boîte noire | ✅ **Paramètres visibles** |
| **Style transfer** | ✅ Oui | ✅ **Oui (mieux)** |

**Verdict : Diff-MST est clairement meilleur pour ton SaaS !**

---

## 🚀 Plan d'Action

### Phase 1 : Intégration Diff-MST (2-3 semaines)
1. Installer Diff-MST
2. Adapter pour vocal mixing (single track + multitrack)
3. Fine-tune avec 200-300 paires
4. Intégrer dans `mixing_service.py`

### Phase 2 : Contrôle Textuel (1-2 semaines)
1. Implémenter `TextToParameters`
2. Mapping direct pour instructions communes
3. Option LLM pour instructions complexes
4. Interface utilisateur

### Phase 3 : Multi-Pistes (1 semaine)
1. Extension `process_multitrack_mix`
2. Support adlibs, renforts
3. Interface upload multiple

### Phase 4 : Tests & Déploiement (1 semaine)
1. Tests avec vrais cas d'usage
2. Optimisation performance
3. Déploiement

**Total : 5-7 semaines pour un SaaS complet**

---

## 💰 Coûts Estimés

### Infrastructure
- **LLM API** (OpenAI/Anthropic) : ~$0.01-0.10 par requête
- **GPU** (pour Diff-MST) : AWS/GCP ~$0.50-2.00/heure
- **Stockage** : S3 ~$0.023/GB/mois

### Alternative Économique
- **LLM local** (Ollama) : Gratuit (serveur dédié)
- **GPU local** : Si tu as déjà
- **Stockage** : S3 toujours nécessaire

---

## ✅ Résumé

**Avec Diff-MST + Contrôle Textuel :**

✅ **Multi-pistes** : Vocal + Instrumental + Adlibs + Renforts
✅ **Contrôle textuel** : "augmente les aigus" → paramètres
✅ **Interprétable** : Vois et modifie les paramètres
✅ **Style transfer** : Apprend ton style de mixing
✅ **Qualité pro** : Résultats professionnels

**C'est exactement ce qu'il te faut pour ton SaaS !** 🚀
