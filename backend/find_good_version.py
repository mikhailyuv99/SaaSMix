"""
Compare the good version (processed_vocal_2760.wav) with current output
to understand what made it better
"""

import numpy as np
import librosa
import os
import glob

def compare_versions(good_path: str, current_path: str):
    """Compare the good version with current to find differences"""
    print("="*60)
    print("COMPARING: Good Version vs Current Version")
    print("="*60)
    
    good, sr = librosa.load(good_path, sr=44100, mono=True)
    current, sr2 = librosa.load(current_path, sr=44100, mono=True)
    
    # Ensure same length
    min_len = min(len(good), len(current))
    good = good[:min_len]
    current = current[:min_len]
    
    print(f"Length: {min_len/sr:.2f} seconds\n")
    
    # Level comparison
    good_rms = np.sqrt(np.mean(good ** 2))
    current_rms = np.sqrt(np.mean(current ** 2))
    good_peak = np.max(np.abs(good))
    current_peak = np.max(np.abs(current))
    
    print("LEVEL COMPARISON:")
    print(f"   Good RMS:    {20*np.log10(good_rms+1e-10):.2f} dB")
    print(f"   Current RMS: {20*np.log10(current_rms+1e-10):.2f} dB")
    print(f"   Difference:  {20*np.log10(good_rms/current_rms+1e-10):+.2f} dB")
    print(f"   Good Peak:    {20*np.log10(good_peak+1e-10):.2f} dB")
    print(f"   Current Peak: {20*np.log10(current_peak+1e-10):.2f} dB\n")
    
    # Frequency analysis
    good_fft = np.fft.rfft(good)
    current_fft = np.fft.rfft(current)
    freqs = np.fft.rfftfreq(min_len, 1/sr)
    
    good_mag = np.abs(good_fft)
    current_mag = np.abs(current_fft)
    
    # EQ difference
    eq_diff = 20 * np.log10(good_mag / (current_mag + 1e-10))
    
    bands = {
        "Low (20-200 Hz)": (20, 200),
        "Low-Mid (200-800 Hz)": (200, 800),
        "Mid (800-3000 Hz)": (800, 3000),
        "High-Mid (3000-8000 Hz)": (3000, 8000),
        "High (8000-20000 Hz)": (8000, 20000)
    }
    
    print("FREQUENCY DIFFERENCES (Good - Current):")
    for band_name, (low, high) in bands.items():
        mask = (freqs >= low) & (freqs <= high)
        if np.any(mask):
            band_diff = np.mean(eq_diff[mask])
            print(f"   {band_name}: {band_diff:+.2f} dB")
    
    # Brightness
    good_centroid = np.mean(librosa.feature.spectral_centroid(y=good, sr=sr))
    current_centroid = np.mean(librosa.feature.spectral_centroid(y=current, sr=sr))
    print(f"\nBrightness:")
    print(f"   Good:    {good_centroid:.1f} Hz")
    print(f"   Current: {current_centroid:.1f} Hz")
    print(f"   Difference: {good_centroid - current_centroid:+.1f} Hz")
    
    # Compression
    good_dynamic = np.max(good) - np.min(good)
    current_dynamic = np.max(current) - np.min(current)
    print(f"\nDynamic Range:")
    print(f"   Good:    {good_dynamic:.4f}")
    print(f"   Current: {current_dynamic:.4f}")
    print(f"   Ratio:   {current_dynamic/good_dynamic:.2f}x")
    
    print("\n" + "="*60)
    print("KEY FINDINGS:")
    print("="*60)
    
    # Identify major differences
    low_diff = np.mean(eq_diff[(freqs >= 20) & (freqs <= 200)])
    mid_diff = np.mean(eq_diff[(freqs >= 800) & (freqs <= 3000)])
    high_diff = np.mean(eq_diff[(freqs >= 8000) & (freqs <= 20000)])
    
    if abs(low_diff) > 2:
        print(f"1. Low frequencies: Good version has {abs(low_diff):.1f}dB {'more' if low_diff > 0 else 'less'}")
    if abs(mid_diff) > 2:
        print(f"2. Mid frequencies: Good version has {abs(mid_diff):.1f}dB {'more' if mid_diff > 0 else 'less'}")
    if abs(high_diff) > 2:
        print(f"3. High frequencies: Good version has {abs(high_diff):.1f}dB {'more' if high_diff > 0 else 'less'}")
    if abs(good_centroid - current_centroid) > 200:
        print(f"4. Brightness: Good version is {abs(good_centroid - current_centroid):.0f}Hz {'brighter' if good_centroid > current_centroid else 'darker'}")
    if abs(20*np.log10(good_rms/current_rms+1e-10)) > 1:
        print(f"5. Overall level: Good version is {abs(20*np.log10(good_rms/current_rms+1e-10)):.1f}dB {'louder' if good_rms > current_rms else 'quieter'}")

if __name__ == "__main__":
    good_path = r"C:\Users\mikha\Desktop\mixexamples\processed_vocal_2760.wav"
    
    # Find latest processed file
    mixexamples_dir = r"C:\Users\mikha\Desktop\mixexamples"
    temp_dir = r"C:\Users\mikha\AppData\Local\Temp"
    
    # Check mixexamples first
    mixexamples_files = glob.glob(os.path.join(mixexamples_dir, "processed_vocal_*.wav"))
    temp_files = glob.glob(os.path.join(temp_dir, "processed_vocal_*.wav"))
    
    all_files = mixexamples_files + temp_files
    if not all_files:
        print("Could not find current processed vocal file!")
        print("Please run quick_test.py first to generate a current version.")
        exit(1)
    
    # Get most recent
    current_path = max(all_files, key=os.path.getmtime)
    
    print(f"Good version: {os.path.basename(good_path)}")
    print(f"Current version: {os.path.basename(current_path)}\n")
    
    compare_versions(good_path, current_path)
