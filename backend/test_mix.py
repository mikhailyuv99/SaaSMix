"""
Simple test script for audio processing
Just run this and it will process your files automatically!
"""

import os
import sys
from mixing_service import MixingService

def main():
    print("🎵 SaaS Mix - Simple Test Script\n")
    
    # Get file paths from user
    print("Enter the paths to your audio files:")
    vocal_path = input("Vocal file path (WAV): ").strip().strip('"')
    instrumental_path = input("Instrumental file path (WAV, optional - press Enter to skip): ").strip().strip('"')
    
    # Check if vocal file exists
    if not os.path.exists(vocal_path):
        print(f"❌ Error: Vocal file not found: {vocal_path}")
        return
    
    # Check if instrumental file exists (if provided)
    if instrumental_path and not os.path.exists(instrumental_path):
        print(f"❌ Error: Instrumental file not found: {instrumental_path}")
        return
    
    # Set to None if empty
    if not instrumental_path:
        instrumental_path = None
    
    # Select preset
    print("\nAvailable presets:")
    print("1. Trap Aggressive")
    print("2. Smooth R&B")
    print("3. Modern Clean")
    preset_choice = input("Select preset (1-3, default: 3): ").strip()
    
    preset_map = {"1": "trap_aggressive", "2": "smooth_rnb", "3": "modern_clean"}
    preset_id = preset_map.get(preset_choice, "modern_clean")
    
    # Get parameters
    print("\nAdjust parameters (press Enter for defaults):")
    reverb_input = input("Reverb intensity (0.0-1.0, default: 0.3): ").strip()
    reverb_intensity = float(reverb_input) if reverb_input else 0.3
    
    delay_input = input("Delay intensity (0.0-1.0, default: 0.25): ").strip()
    delay_intensity = float(delay_input) if delay_input else 0.25
    
    bpm_input = input("BPM (press Enter for auto-detect): ").strip()
    manual_bpm = float(bpm_input) if bpm_input else None
    
    # Process!
    print("\n🔄 Processing... This may take 30-60 seconds...")
    
    try:
        service = MixingService()
        processed_vocal_path, full_mix_path = service.process_mix(
            vocal_path=vocal_path,
            instrumental_path=instrumental_path,
            preset_id=preset_id,
            reverb_intensity=reverb_intensity,
            delay_intensity=delay_intensity,
            manual_bpm=manual_bpm
        )
        
        print("\n✅ Processing complete!")
        print(f"\n📁 Processed vocal saved to:")
        print(f"   {processed_vocal_path}")
        
        if full_mix_path:
            print(f"\n📁 Full mix saved to:")
            print(f"   {full_mix_path}")
        
        # Try to open the files
        try:
            os.startfile(processed_vocal_path)
            print("\n🎵 Opening processed vocal in your default audio player...")
        except:
            pass
        
        if full_mix_path:
            try:
                os.startfile(full_mix_path)
                print("🎵 Opening full mix in your default audio player...")
            except:
                pass
        
        print("\n✨ Done! Check your audio player to listen to the results.")
        
    except Exception as e:
        print(f"\n❌ Error during processing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
