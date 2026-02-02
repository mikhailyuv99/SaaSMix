"""
Compare three vocal mixes:
1. Raw vocal
2. Your professional mix (FL Studio with your preset)
3. My processed version

This will help identify what's missing in my implementation.
"""

import numpy as np
import librosa
import soundfile as sf
import os
from scipy import signal
from scipy.signal import butter, lfilter

def compare_three_mixes(raw_path: str, your_mix_path: str, my_mix_path: str):
    """
    Compare all three versions to find differences
    """
    print("=" * 60)
    print("COMPARING THREE MIXES")
    print("=" * 60)
    print(f"Raw: {raw_path}")
    print(f"Your Mix: {your_mix_path}")
    print(f"My Mix: {my_mix_path}")
    print()
    
    # Load all three files
    print("Loading audio files...")
    raw, sr = librosa.load(raw_path, sr=44100, mono=True)
    your_mix, sr_y = librosa.load(your_mix_path, sr=44100, mono=True)
    my_mix, sr_m = librosa.load(my_mix_path, sr=44100, mono=True)
    
    # Ensure same length
    min_len = min(len(raw), len(your_mix), len(my_mix))
    raw = raw[:min_len]
    your_mix = your_mix[:min_len]
    my_mix = my_mix[:min_len]
    
    print(f"Loaded {min_len/sr:.2f} seconds of audio\n")
    
    # 1. Level Comparison
    print("=" * 60)
    print("LEVEL COMPARISON")
    print("=" * 60)
    raw_rms = np.sqrt(np.mean(raw ** 2))
    your_rms = np.sqrt(np.mean(your_mix ** 2))
    my_rms = np.sqrt(np.mean(my_mix ** 2))
    
    raw_peak = np.max(np.abs(raw))
    your_peak = np.max(np.abs(your_mix))
    my_peak = np.max(np.abs(my_mix))
    
    print(f"RMS Levels:")
    print(f"   Raw:        {20*np.log10(raw_rms+1e-10):6.2f} dB")
    print(f"   Your Mix:   {20*np.log10(your_rms+1e-10):6.2f} dB  (gain: {20*np.log10(your_rms/raw_rms+1e-10):+6.2f} dB)")
    print(f"   My Mix:     {20*np.log10(my_rms+1e-10):6.2f} dB  (gain: {20*np.log10(my_rms/raw_rms+1e-10):+6.2f} dB)")
    print(f"   Difference: {20*np.log10(your_rms/my_rms+1e-10):+6.2f} dB")
    print()
    
    print(f"Peak Levels:")
    print(f"   Raw:        {20*np.log10(raw_peak+1e-10):6.2f} dB")
    print(f"   Your Mix:   {20*np.log10(your_peak+1e-10):6.2f} dB")
    print(f"   My Mix:     {20*np.log10(my_peak+1e-10):6.2f} dB")
    print()
    
    # 2. Frequency Analysis - Compare EQ curves
    print("=" * 60)
    print("FREQUENCY ANALYSIS (EQ COMPARISON)")
    print("=" * 60)
    raw_fft = np.fft.rfft(raw)
    your_fft = np.fft.rfft(your_mix)
    my_fft = np.fft.rfft(my_mix)
    
    freqs = np.fft.rfftfreq(len(raw), 1/sr)
    
    raw_mag = np.abs(raw_fft)
    your_mag = np.abs(your_fft)
    my_mag = np.abs(my_fft)
    
    # EQ curves relative to raw
    your_eq = 20 * np.log10(your_mag / (raw_mag + 1e-10))
    my_eq = 20 * np.log10(my_mag / (raw_mag + 1e-10))
    diff_eq = your_eq - my_eq  # Difference between your mix and mine
    
    # Analyze key frequency bands
    bands = {
        "Low (20-200 Hz)": (20, 200),
        "Low-Mid (200-800 Hz)": (200, 800),
        "Mid (800-3000 Hz)": (800, 3000),
        "High-Mid (3000-8000 Hz)": (3000, 8000),
        "High (8000-20000 Hz)": (8000, 20000)
    }
    
    print("EQ Applied (relative to raw):")
    print(f"{'Band':<25} {'Your Mix':>12} {'My Mix':>12} {'Difference':>12}")
    print("-" * 60)
    for band_name, (low_freq, high_freq) in bands.items():
        mask = (freqs >= low_freq) & (freqs <= high_freq)
        if np.any(mask):
            your_band = np.mean(your_eq[mask])
            my_band = np.mean(my_eq[mask])
            diff_band = your_band - my_band
            print(f"{band_name:<25} {your_band:>+11.2f} dB {my_band:>+11.2f} dB {diff_band:>+11.2f} dB")
    print()
    
    # 3. Dynamics Comparison
    print("=" * 60)
    print("DYNAMICS COMPARISON (COMPRESSION)")
    print("=" * 60)
    raw_dynamic = np.max(raw) - np.min(raw)
    your_dynamic = np.max(your_mix) - np.min(your_mix)
    my_dynamic = np.max(my_mix) - np.min(my_mix)
    
    your_compression = raw_dynamic / (your_dynamic + 1e-10)
    my_compression = raw_dynamic / (my_dynamic + 1e-10)
    
    print(f"Dynamic Range:")
    print(f"   Raw:        {raw_dynamic:.4f}")
    print(f"   Your Mix:   {your_dynamic:.4f}  (compression: {your_compression:.2f}:1)")
    print(f"   My Mix:     {my_dynamic:.4f}  (compression: {my_compression:.2f}:1)")
    print(f"   Difference: {your_compression/my_compression:.2f}x {'more' if your_compression > my_compression else 'less'} compressed")
    print()
    
    # 4. Reverb Analysis
    print("=" * 60)
    print("REVERB ANALYSIS")
    print("=" * 60)
    raw_energy = np.abs(raw)
    your_energy = np.abs(your_mix)
    my_energy = np.abs(my_mix)
    
    # Find where main signal ends
    threshold = np.max(raw_energy) * 0.01
    raw_end = np.where(raw_energy > threshold)[0]
    if len(raw_end) > 0:
        raw_end_idx = raw_end[-1]
        
        # Reverb tail analysis
        your_tail = np.sum(your_energy[raw_end_idx:])
        my_tail = np.sum(my_energy[raw_end_idx:])
        your_main = np.sum(your_energy[:raw_end_idx])
        my_main = np.sum(my_energy[:raw_end_idx])
        
        your_reverb_ratio = your_tail / (your_main + your_tail + 1e-10)
        my_reverb_ratio = my_tail / (my_main + my_tail + 1e-10)
        
        print(f"Reverb Tail Energy:")
        print(f"   Your Mix:   {your_reverb_ratio*100:.1f}% of total energy")
        print(f"   My Mix:     {my_reverb_ratio*100:.1f}% of total energy")
        print(f"   Difference: {(your_reverb_ratio - my_reverb_ratio)*100:+.1f}%")
        print()
        
        # Reverb decay time
        your_decay_samples = len(your_mix) - raw_end_idx
        my_decay_samples = len(my_mix) - raw_end_idx
        print(f"Reverb Tail Length:")
        print(f"   Your Mix:   {your_decay_samples/sr:.2f} seconds")
        print(f"   My Mix:     {my_decay_samples/sr:.2f} seconds")
        print()
    
    # 5. Brightness Comparison
    print("=" * 60)
    print("BRIGHTNESS COMPARISON")
    print("=" * 60)
    raw_centroid = np.mean(librosa.feature.spectral_centroid(y=raw, sr=sr))
    your_centroid = np.mean(librosa.feature.spectral_centroid(y=your_mix, sr=sr))
    my_centroid = np.mean(librosa.feature.spectral_centroid(y=my_mix, sr=sr))
    
    print(f"Spectral Centroid (brightness):")
    print(f"   Raw:        {raw_centroid:.1f} Hz")
    print(f"   Your Mix:   {your_centroid:.1f} Hz  (change: {your_centroid - raw_centroid:+.1f} Hz)")
    print(f"   My Mix:     {my_centroid:.1f} Hz  (change: {my_centroid - raw_centroid:+.1f} Hz)")
    print(f"   Difference: {your_centroid - my_centroid:+.1f} Hz")
    print()
    
    # 6. Key Differences Summary
    print("=" * 60)
    print("KEY DIFFERENCES TO FIX")
    print("=" * 60)
    
    issues = []
    
    # Check level difference
    level_diff = 20*np.log10(your_rms/my_rms+1e-10)
    if abs(level_diff) > 1.0:
        issues.append(f"Level: My mix is {abs(level_diff):.1f}dB {'louder' if level_diff < 0 else 'quieter'} than yours")
    
    # Check compression
    if your_compression > my_compression * 1.2:
        issues.append(f"Compression: Your mix is {your_compression/my_compression:.1f}x more compressed")
    elif my_compression > your_compression * 1.2:
        issues.append(f"Compression: My mix is {my_compression/your_compression:.1f}x more compressed")
    
    # Check frequency bands
    for band_name, (low_freq, high_freq) in bands.items():
        mask = (freqs >= low_freq) & (freqs <= high_freq)
        if np.any(mask):
            diff_band = np.mean(diff_eq[mask])
            if abs(diff_band) > 2.0:
                issues.append(f"EQ {band_name}: {diff_band:+.1f}dB difference")
    
    # Check reverb
    if len(raw_end) > 0:
        reverb_diff = (your_reverb_ratio - my_reverb_ratio) * 100
        if abs(reverb_diff) > 5:
            issues.append(f"Reverb: Your mix has {abs(reverb_diff):.1f}% {'more' if reverb_diff > 0 else 'less'} reverb")
    
    # Check brightness
    brightness_diff = your_centroid - my_centroid
    if abs(brightness_diff) > 200:
        issues.append(f"Brightness: Your mix is {abs(brightness_diff):.0f}Hz {'brighter' if brightness_diff > 0 else 'darker'}")
    
    if issues:
        for i, issue in enumerate(issues, 1):
            print(f"{i}. {issue}")
    else:
        print("No major differences detected!")
    
    print()
    print("=" * 60)
    print("Analysis complete!")
    print("=" * 60)
    
    return {
        "level_diff_db": level_diff,
        "compression_diff": your_compression / my_compression,
        "reverb_diff": your_reverb_ratio - my_reverb_ratio,
        "brightness_diff": brightness_diff,
        "eq_diff": diff_eq,
        "frequencies": freqs
    }

if __name__ == "__main__":
    import sys
    
    raw_path = r"C:\Users\mikha\Desktop\mixexamples\raw_vocal.wav"
    your_mix_path = r"C:\Users\mikha\Desktop\mixexamples\mixedvocal.wav"
    # Get the most recent processed file
    import glob
    temp_dir = r"C:\Users\mikha\AppData\Local\Temp"
    processed_files = glob.glob(os.path.join(temp_dir, "processed_vocal_*.wav"))
    if processed_files:
        # Sort by modification time, get most recent
        my_mix_path = max(processed_files, key=os.path.getmtime)
    else:
        my_mix_path = r"C:\Users\mikha\AppData\Local\Temp\processed_vocal_24704.wav"
    
    try:
        results = compare_three_mixes(raw_path, your_mix_path, my_mix_path)
        print("\nUse these insights to adjust the processing parameters!")
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
