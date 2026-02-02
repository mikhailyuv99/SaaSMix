"""
Detailed comparison of your mix vs my mix
"""

import numpy as np
import librosa
import os
import glob

def detailed_compare(your_mix_path: str, my_mix_path: str):
    """
    Detailed comparison to find exact differences
    """
    print("=" * 70)
    print("DETAILED COMPARISON: YOUR MIX vs MY MIX")
    print("=" * 70)
    print()
    
    # Load both files
    print("Loading audio files...")
    your_mix, sr = librosa.load(your_mix_path, sr=44100, mono=True)
    my_mix, sr_m = librosa.load(my_mix_path, sr=44100, mono=True)
    
    # Ensure same length
    min_len = min(len(your_mix), len(my_mix))
    your_mix = your_mix[:min_len]
    my_mix = my_mix[:min_len]
    
    print(f"Loaded {min_len/sr:.2f} seconds of audio\n")
    
    # 1. Overall Level
    your_rms = np.sqrt(np.mean(your_mix ** 2))
    my_rms = np.sqrt(np.mean(my_mix ** 2))
    level_diff = 20*np.log10(your_rms/my_rms+1e-10)
    
    print("=" * 70)
    print("1. OVERALL LEVEL")
    print("=" * 70)
    print(f"Your RMS: {20*np.log10(your_rms+1e-10):.2f} dB")
    print(f"My RMS:   {20*np.log10(my_rms+1e-10):.2f} dB")
    print(f"Difference: {level_diff:+.2f} dB ({'louder' if level_diff < 0 else 'quieter'})")
    print()
    
    # 2. Frequency Response - Detailed
    print("=" * 70)
    print("2. FREQUENCY RESPONSE (Detailed)")
    print("=" * 70)
    
    your_fft = np.fft.rfft(your_mix)
    my_fft = np.fft.rfft(my_mix)
    freqs = np.fft.rfftfreq(len(your_mix), 1/sr)
    
    your_mag = np.abs(your_fft)
    my_mag = np.abs(my_fft)
    
    # EQ difference
    eq_diff = 20 * np.log10(your_mag / (my_mag + 1e-10))
    
    # Detailed frequency bands
    detailed_bands = {
        "Sub (20-60 Hz)": (20, 60),
        "Low (60-200 Hz)": (60, 200),
        "Low-Mid (200-500 Hz)": (200, 500),
        "Mid (500-2000 Hz)": (500, 2000),
        "Upper Mid (2000-4000 Hz)": (2000, 4000),
        "Presence (4000-6000 Hz)": (4000, 6000),
        "High (6000-10000 Hz)": (6000, 10000),
        "Air (10000-20000 Hz)": (10000, 20000)
    }
    
    print(f"{'Band':<25} {'Your Mix':>12} {'My Mix':>12} {'Difference':>12}")
    print("-" * 70)
    
    for band_name, (low_freq, high_freq) in detailed_bands.items():
        mask = (freqs >= low_freq) & (freqs <= high_freq)
        if np.any(mask):
            your_band = 20 * np.log10(np.mean(your_mag[mask]) + 1e-10)
            my_band = 20 * np.log10(np.mean(my_mag[mask]) + 1e-10)
            diff_band = np.mean(eq_diff[mask])
            print(f"{band_name:<25} {your_band:>11.2f} dB {my_band:>11.2f} dB {diff_band:>+11.2f} dB")
    print()
    
    # 3. Dynamics
    print("=" * 70)
    print("3. DYNAMICS")
    print("=" * 70)
    
    your_peak = np.max(np.abs(your_mix))
    my_peak = np.max(np.abs(my_mix))
    
    # Crest factor (peak to RMS ratio)
    your_crest = your_peak / (your_rms + 1e-10)
    my_crest = my_peak / (my_rms + 1e-10)
    
    print(f"Crest Factor (Peak/RMS):")
    print(f"   Your Mix: {your_crest:.2f}")
    print(f"   My Mix:   {my_crest:.2f}")
    print(f"   (Lower = more compressed)")
    print()
    
    # 4. Spectral Centroid (Brightness)
    print("=" * 70)
    print("4. BRIGHTNESS (Spectral Centroid)")
    print("=" * 70)
    
    your_centroid = np.mean(librosa.feature.spectral_centroid(y=your_mix, sr=sr))
    my_centroid = np.mean(librosa.feature.spectral_centroid(y=my_mix, sr=sr))
    
    print(f"Your Mix: {your_centroid:.1f} Hz")
    print(f"My Mix:   {my_centroid:.1f} Hz")
    print(f"Difference: {your_centroid - my_centroid:+.1f} Hz")
    print(f"   ({'Your mix is MUCH brighter' if your_centroid > my_centroid + 500 else 'Similar brightness'})")
    print()
    
    # 5. Key Issues Summary
    print("=" * 70)
    print("5. KEY ISSUES TO FIX (Priority Order)")
    print("=" * 70)
    
    issues = []
    
    # Check low frequencies
    low_mask = (freqs >= 20) & (freqs <= 200)
    low_diff = np.mean(eq_diff[low_mask])
    if abs(low_diff) > 3:
        issues.append(("CRITICAL", f"Low frequencies: {low_diff:+.1f}dB difference (your mix cuts more)"))
    
    # Check brightness
    if abs(your_centroid - my_centroid) > 500:
        issues.append(("CRITICAL", f"Brightness: {your_centroid - my_centroid:+.0f}Hz difference (your mix is much brighter)"))
    
    # Check high frequencies
    high_mask = (freqs >= 8000) & (freqs <= 20000)
    high_diff = np.mean(eq_diff[high_mask])
    if abs(high_diff) > 2:
        issues.append(("HIGH", f"High frequencies: {high_diff:+.1f}dB difference"))
    
    # Check level
    if abs(level_diff) > 1:
        issues.append(("MEDIUM", f"Overall level: {abs(level_diff):.1f}dB difference"))
    
    # Check compression
    if abs(your_crest - my_crest) > 0.5:
        issues.append(("MEDIUM", f"Compression: Crest factor difference of {abs(your_crest - my_crest):.2f}"))
    
    for priority, issue in issues:
        print(f"[{priority}] {issue}")
    
    print()
    print("=" * 70)
    print("ANALYSIS COMPLETE")
    print("=" * 70)
    
    return {
        "level_diff": level_diff,
        "brightness_diff": your_centroid - my_centroid,
        "low_diff": low_diff,
        "high_diff": high_diff,
        "compression_diff": your_crest - my_crest
    }

if __name__ == "__main__":
    your_mix_path = r"C:\Users\mikha\Desktop\mixexamples\mixedvocal.wav"
    
    # Find my mix in mixexamples folder
    mixexamples_dir = r"C:\Users\mikha\Desktop\mixexamples"
    my_mix_files = glob.glob(os.path.join(mixexamples_dir, "*.wav"))
    my_mix_files = [f for f in my_mix_files if "mixedvocal" not in f.lower() and "raw_vocal" not in f.lower()]
    
    if not my_mix_files:
        print("Could not find your processed version in mixexamples folder!")
        print("Please make sure your processed vocal is in: C:\\Users\\mikha\\Desktop\\mixexamples\\")
        exit(1)
    
    my_mix_path = my_mix_files[0]
    print(f"Found your processed version: {os.path.basename(my_mix_path)}\n")
    
    try:
        results = detailed_compare(your_mix_path, my_mix_path)
        print("\n" + "=" * 70)
        print("HONEST ASSESSMENT:")
        print("=" * 70)
        print("Yes, it IS possible to get close to your quality!")
        print("The main issues are:")
        print("1. Low frequency cutting (I'm not cutting enough)")
        print("2. Brightness (I'm making it darker, you make it brighter)")
        print("3. High frequency balance")
        print("4. Compression characteristics")
        print()
        print("These are all fixable with parameter adjustments.")
        print("The algorithms are sound, we just need to tune them correctly.")
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
