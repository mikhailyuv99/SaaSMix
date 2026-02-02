"""
CLI: drop a vocal path → get mixed vocal WAV.
Usage:
  python mix_vocal.py "C:\path\to\vocal.wav"
  python mix_vocal.py vocal.wav --output mixed.wav --preset modern_clean
"""
import argparse
import os
import sys
import shutil

# Run from backend folder
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)
os.chdir(SCRIPT_DIR)

from mixing_service import MixingService


def main():
    p = argparse.ArgumentParser(description="Mix a vocal (DSP or ML). Output: same folder, <name>_mixed.wav by default.")
    p.add_argument("vocal", help="Path to raw vocal WAV (or drag-and-drop file)")
    p.add_argument("-o", "--output", default=None, help="Output WAV path (default: next to vocal, <name>_mixed.wav)")
    p.add_argument("--preset", default="modern_clean", choices=["trap_aggressive", "smooth_rnb", "modern_clean"],
                   help="Preset (default: modern_clean)")
    p.add_argument("--instrumental", default=None, help="Optional instrumental WAV for full mix")
    p.add_argument("--reverb", type=float, default=0.3, help="Reverb 0–1 (default: 0.3)")
    p.add_argument("--delay", type=float, default=0.25, help="Delay intensity 0–1 (default: 0.25)")
    p.add_argument("--bpm", type=float, default=None, help="BPM (default: auto-detect)")
    p.add_argument("--use-ml", action="store_true", help="Use ML model if models/best_model.pt exists")
    args = p.parse_args()

    vocal_path = os.path.abspath(args.vocal.strip().strip('"'))
    if not os.path.isfile(vocal_path):
        print(f"ERROR: File not found: {vocal_path}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        out_path = os.path.abspath(args.output.strip().strip('"'))
    else:
        base = os.path.splitext(os.path.basename(vocal_path))[0]
        out_dir = os.path.dirname(vocal_path)
        out_path = os.path.join(out_dir, f"{base}_mixed.wav")

    model_path = os.path.join(SCRIPT_DIR, "models", "best_model.pt")
    service = MixingService(use_ml_model=args.use_ml, model_path=model_path)
    processed_path, full_mix_path = service.process_mix(
        vocal_path=vocal_path,
        instrumental_path=args.instrumental,
        preset_id=args.preset,
        reverb_intensity=args.reverb,
        delay_intensity=args.delay,
        manual_bpm=args.bpm,
    )
    shutil.copy2(processed_path, out_path)
    print(out_path)
    if full_mix_path and args.instrumental:
        full_out = os.path.join(os.path.dirname(out_path), os.path.splitext(os.path.basename(out_path))[0] + "_full_mix.wav")
        shutil.copy2(full_mix_path, full_out)
        print(full_out, file=sys.stderr)


if __name__ == "__main__":
    main()
