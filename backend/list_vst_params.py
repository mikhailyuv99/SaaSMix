"""
Affiche les noms des paramètres d'un VST (pour recopier dans vst_preset_chain.py).
Usage: python list_vst_params.py "C:\Chemin\Vers\Plugin.vst3"
       ou après avoir créé vst_config.py : python list_vst_params.py pro_q4
"""
import sys
from pathlib import Path

try:
    from pedalboard import load_plugin
except ImportError:
    print("pip install pedalboard")
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python list_vst_params.py <path.vst3> | <cle_vst_config>")
        sys.exit(1)
    arg = sys.argv[1]
    if arg.endswith(".vst3") or arg.endswith(".vst"):
        path = Path(arg)
    else:
        try:
            from vst_config import VST_PATHS
            path = VST_PATHS.get(arg)
            if not path:
                print("Clé inconnue. Clés:", list(VST_PATHS.keys()))
                sys.exit(1)
            path = Path(path)
        except ImportError:
            print("Crée vst_config.py (copie de vst_config.example.py) ou donne le chemin .vst3")
            sys.exit(1)
    if not path.exists():
        print("Fichier introuvable:", path)
        sys.exit(1)
    p = load_plugin(str(path))
    print("Paramètres pour", path.name)
    print("-" * 40)
    for k in sorted(p.parameters.keys()):
        param = p.parameters[k]
        v = getattr(param, "raw_value", None)
        print(f"  {k!r}")
    print("-" * 40)
    print("Dans ton code: plugin.<nom> = valeur")


if __name__ == "__main__":
    main()
