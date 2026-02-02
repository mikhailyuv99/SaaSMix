"""
Test rapide : passer un WAV vocal dans le plugin HISE (Project1) via le backend.
Usage:
  python run_hise_render.py <input.wav> [output.wav]
  Si output.wav omis -> output_test.wav dans le même dossier que input.
"""
import sys
from pathlib import Path

# Ajoute le backend au path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from vst_preset_chain import process_file

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_hise_render.py <input.wav> [output.wav]")
        print("  Ex: python run_hise_render.py C:\\path\\to\\vocal.wav")
        sys.exit(1)
    inp = Path(sys.argv[1])
    if not inp.is_file():
        print("Fichier introuvable:", inp)
        sys.exit(1)
    out = sys.argv[2] if len(sys.argv) > 2 else str(inp.parent / "output_test.wav")
    process_file(str(inp), out, bpm=120)
    print("OK ->", out)

if __name__ == "__main__":
    main()
