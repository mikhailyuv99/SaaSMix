# Tester ton plugin HISE avec le backend

Étapes pour exporter ton projet HISE en VST3 et le faire tourner avec `vst_preset_chain.py`.

---

## 1. Exporter en VST3 depuis HISE

1. Dans HISE, ouvre ton projet (Project1 ou le nom que tu lui as donné).
2. Menu **File** → **Export** → **Export as VST3** (ou **Compile** → **Export** selon la version).
3. Choisis un dossier de build (ex. `C:\Users\mikha\Desktop\HISE\Project1\Builds\...`) et lance la compilation.
4. Une fois la compilation terminée, le `.vst3` se trouve en général dans un sous-dossier du type :
   - **Visual Studio** : `Project1\Builds\VisualStudio2022\x64\Release\VST3\` → dossier ou fichier `Project1.vst3`
   - Ou **CMake** : `Project1\Builds\CMakeBuild\build\VST3\Release\`
5. **Copie le chemin complet** vers le `.vst3` (ou vers le dossier qui porte le nom du plugin, selon comment HISE exporte).

---

## 2. Mettre le chemin dans la config

1. Ouvre **`backend/vst_config.py`**.
2. Trouve la ligne :
   ```python
   "hise_vocal_chain": "",  # ex: r"C:\..."
   ```
3. Remplace `""` par le chemin vers **ton** `.vst3`, en raw string (préfixe `r`), par exemple :
   ```python
   "hise_vocal_chain": r"C:\Users\mikha\Desktop\HISE\Project1\Builds\VisualStudio2022\x64\Release\VST3\Project1.vst3",
   ```
   Si HISE exporte un **dossier** (ex. `Project1.vst3` qui est un dossier sur Windows), mets le chemin du dossier :
   ```python
   "hise_vocal_chain": r"C:\Users\mikha\Desktop\HISE\Project1\Builds\...\VST3\Project1.vst3",
   ```
4. Sauvegarde le fichier.

---

## 3. Lancer un test

Dans un terminal, depuis le dossier **backend** :

```powershell
cd C:\Users\mikha\Desktop\SaaS Mix\backend
python vst_preset_chain.py "C:\Users\mikha\Desktop\dataset\raw\song1.wav" "C:\Users\mikha\Desktop\mon_vocal_hise.wav" 120
```

- **Entrée** : chemin vers ton WAV vocal (ex. song1.wav).
- **Sortie** : chemin du WAV traité (ex. mon_vocal_hise.wav).
- **120** : BPM (optionnel, utilisé seulement si la chaîne utilise des effets tempo-sync ; avec un seul plugin HISE tu peux mettre n’importe quoi).

Si `hise_vocal_chain` est bien rempli et que le plugin existe, la chaîne utilise **uniquement ton plugin HISE** (pas les Waves/FabFilter). Le script charge le VST3, passe l’audio dedans et écrit le résultat dans le fichier de sortie.

---

## 4. En cas de problème

- **"Plugin file ... not found"** : vérifie le chemin dans `vst_config.py` (antislash, raw string `r"..."`).
- **"Failed to load plugin"** : le build HISE a peut-être échoué ou le VST3 n’est pas au bon endroit ; recompile dans HISE et vérifie le dossier de sortie.
- **Erreur WMIC** : tu peux l’ignorer, ou lancer avec :
  ```powershell
  $env:JUCE_DISABLE_CPU_FEATURE_DETECTION="1"; python vst_preset_chain.py "input.wav" "output.wav" 120
  ```
- **Pas de son / son bizarre** : écoute le fichier de sortie ; si le plugin a des paramètres par défaut, le son peut changer. Tu peux ensuite ajouter dans le code le réglage des paramètres du plugin (comme pour les autres VST) si tu veux figer un preset.

Une fois que ça tourne, tu as le pipeline complet : **HISE → VST3 → Python → fichier WAV**.
