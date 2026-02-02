"""
Ultra-simple quick test - just drag and drop your files!
Usage: python quick_test.py "path/to/vocal.wav" "path/to/instrumental.wav"
"""

import os
import sys
from mixing_service import MixingService

def main():
    if len(sys.argv) < 2:
        print("Usage: python quick_test.py <vocal.wav> [instrumental.wav]")
        print("\nExamples:")
        print('  python quick_test.py "C:\\Users\\You\\vocal.wav"')
        print('  python quick_test.py "C:\\Users\\You\\vocal.wav" "C:\\Users\\You\\beat.wav"')
        print("\nOr just drag and drop your files onto this script!")
        print("(Drag 1 file for vocal only, or 2 files for vocal + instrumental)")
        return
    
    vocal_path = sys.argv[1].strip('"')
    instrumental_path = sys.argv[2].strip('"') if len(sys.argv) > 2 else None
    
    # Check vocal file
    if not os.path.exists(vocal_path):
        print(f"❌ Vocal file not found: {vocal_path}")
        return
    
    # Check instrumental file if provided
    if instrumental_path and not os.path.exists(instrumental_path):
        print(f"❌ Instrumental file not found: {instrumental_path}")
        return
    
    print("Processing your mix...")
    print(f"   Vocal: {os.path.basename(vocal_path)}")
    if instrumental_path:
        print(f"   Instrumental: {os.path.basename(instrumental_path)}")
    else:
        print("   Instrumental: None (vocal only)")
    print("   Preset: Professional Mix (based on your chain)")
    print("   This will take 30-60 seconds...\n")
    
    try:
        # Use ML model if available
        model_path = "./models/best_model.pt"
        use_ml = os.path.exists(model_path)
        
        if use_ml:
            print(f"✓ Using ML model: {model_path}\n")
        else:
            print(f"⚠️  ML model not found at {model_path}, using DSP instead\n")
        
        service = MixingService(use_ml_model=use_ml, model_path=model_path)
        processed_vocal_path, full_mix_path = service.process_mix(
            vocal_path=vocal_path,
            instrumental_path=instrumental_path,
            preset_id="nav_polished",  # Using one of the presets
            reverb_intensity=0.3,
            delay_intensity=0.25
        )
        
        print("Done!")
        print(f"\nProcessed vocal: {processed_vocal_path}")
        if full_mix_path:
            print(f"Full mix: {full_mix_path}")
        
        # Open files automatically
        try:
            os.startfile(processed_vocal_path)
            if full_mix_path:
                os.startfile(full_mix_path)
            print("\nFiles opened in your audio player!")
        except:
            print("\nOpen the files above in your audio player to listen.")
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
