"""
Liste tous les WaveShell .vst3, affiche les plugins par fichier, puis imprime
les lignes VST_PATHS a coller dans vst_config.py pour chaque plugin Waves.
Lance: python discover_waves_shells.py

Note: Le message WMIC peut apparaitre (JUCE) ; tu peux l'ignorer ou lancer avec:
  $env:JUCE_DISABLE_CPU_FEATURE_DETECTION="1"; python discover_waves_shells.py
Les anciennes versions WaveShell (14.x) peuvent echouer au scan ; seuls les shells
scannables sont utilises pour la suggestion VST_PATHS.
"""
import os
# Des que possible pour eviter WMIC (JUCE)
os.environ.setdefault("JUCE_DISABLE_CPU_FEATURE_DETECTION", "1")

import re
import sys
from pathlib import Path

vst3_dir = Path(r"C:\Program Files\Common Files\VST3")
if not vst3_dir.exists():
    print("Dossier introuvable:", vst3_dir)
    sys.exit(1)

try:
    from pedalboard import load_plugin
except ImportError:
    print("pip install pedalboard")
    sys.exit(1)

# Clés et noms qu'on utilise dans la chaîne (même ordre que vst_config)
try:
    from vst_config import WAVES_PLUGIN_NAMES, VST3
except ImportError:
    VST3 = r"C:\Program Files\Common Files\VST3"
    WAVES_PLUGIN_NAMES = {
        "dereverb_pro_mono": "Clarity Vx - DeReverb Pro Mono",
        "nls_channel_mono": "NLS Channel Mono",
        "r_deesser_mono": "R Deesser Mono",
        "f6_rta_mono": "F6 RTA Mono",
        "cla_76_mono": "CLA-76 Mono",
        "rvox_mono": "R-Vox Mono",
        "r_compressor_mono": "R Compressor Mono",
        "r_vox_mono_pcomp": "R-Vox Mono",
        "doubler2_stereo": "Doubler2 Stereo",
        "sa_imager_stereo": "S1 Imager Stereo",
        "nls_channel_stereo": "NLS Channel Stereo",
    }

# Tous les .vst3 dont le nom contient WaveShell
vst3_files = [p for p in vst3_dir.rglob("*.vst3") if "WaveShell" in p.name]
print("Fichiers WaveShell .vst3 trouves:", len(vst3_files))

# path -> liste des noms de plugins
shell_plugins = {}

for path in sorted(vst3_files):
    path_str = str(path)
    print("Scan:", path.name, "...", flush=True)
    try:
        load_plugin(path_str)
        # Charge comme plugin unique (inattendu pour un WaveShell)
        print("  -> charge comme plugin unique (pas de liste)", flush=True)
    except ValueError as e:
        msg = str(e)
        if "contains" in msg and "plugins" in msg and ("following values:" in msg or "following values" in msg):
            block = msg.split("following values")[-1].split(":")[-1].strip()
            names = [line.strip().strip('"') for line in block.split("\n") if line.strip()]
            if not names and '"' in msg:
                names = re.findall(r'"([^"]+)"', msg)
            shell_plugins[path_str] = names
            print("\n" + "=" * 60)
            print("FICHIER:", path_str)
            print("=" * 60)
            for n in names:
                print(" ", n)
        else:
            print(path.name, "-> ValueError:", msg[:200])
    except Exception as e:
        err = str(e)
        if "scan failure" in err or "unsupported plugin format" in err:
            print("  -> skip (format non supporte)")
        else:
            print("  -> erreur:", e)

print("\nShells scannes (avec liste de plugins):", len(shell_plugins))

# plugin_name (exact) -> premier path qui contient ce plugin
name_to_path = {}
for path_str, names in shell_plugins.items():
    for n in names:
        if n not in name_to_path:
            name_to_path[n] = path_str

# Suggestion VST_PATHS pour vst_config.py
print("\n" + "=" * 60)
print("SUGGESTED VST_PATHS (copy into vst_config.py)")
print("=" * 60)
for key, plugin_name in WAVES_PLUGIN_NAMES.items():
    path = name_to_path.get(plugin_name)
    if path:
        # Afficher en Python pour copier-coller
        esc = path.replace("\\", "\\\\")
        print(f'    "{key}": r"{path}",')
    else:
        print(f'    # "{key}": NOT FOUND (plugin "{plugin_name}")')

print("\nFin. Colle les lignes ci-dessus dans VST_PATHS dans vst_config.py.")
