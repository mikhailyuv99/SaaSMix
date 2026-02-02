"""
Match LEAD 2 processing by comparing raw vocal -> LEAD 1 -> LEAD 2
"""

import numpy as np
import librosa
import os

def analyze_transformation(input_path: str, output_path: str, stage_name: str):
    """Analyze what processing transforms input to output"""
    print(f"\n{'='*60}")
    print(f"ANALYZING: {stage_name}")
    print(f"{'='*60}")
    
    input_audio, sr = librosa.load(input_path, sr=44100, mono=True)
    output_audio, sr2 = librosa.load(output_path, sr=44100, mono=True)
    
    # Ensure same length
    min_len = min(len(input_audio), len(output_audio))
    input_audio = input_audio[:min_len]
    output_audio = output_audio[:min_len]
    
    # Level analysis
    input_rms = np.sqrt(np.mean(input_audio ** 2))
    output_rms = np.sqrt(np.mean(output_audio ** 2))
    input_peak = np.max(np.abs(input_audio))
    output_peak = np.max(np.abs(output_audio))
    
    print(f"RMS: {20*np.log10(input_rms+1e-10):.2f} dB -> {20*np.log10(output_rms+1e-10):.2f} dB (gain: {20*np.log10(output_rms/input_rms+1e-10):+.2f} dB)")
    print(f"Peak: {20*np.log10(input_peak+1e-10):.2f} dB -> {20*np.log10(output_peak+1e-10):.2f} dB")
    
    # Frequency analysis
    input_fft = np.fft.rfft(input_audio)
    output_fft = np.fft.rfft(output_audio)
    freqs = np.fft.rfftfreq(min_len, 1/sr)
    
    input_mag = np.abs(input_fft)
    output_mag = np.abs(output_fft)
    
    # EQ curve
    eq_curve = 20 * np.log10(output_mag / (input_mag + 1e-10))
    
    # Analyze bands
    bands = {
        "Low (20-200 Hz)": (20, 200),
        "Low-Mid (200-800 Hz)": (200, 800),
        "Mid (800-3000 Hz)": (800, 3000),
        "High-Mid (3000-8000 Hz)": (3000, 8000),
        "High (8000-20000 Hz)": (8000, 20000)
    }
    
    print(f"\nEQ Applied:")
    for band_name, (low, high) in bands.items():
        mask = (freqs >= low) & (freqs <= high)
        if np.any(mask):
            band_gain = np.mean(eq_curve[mask])
            print(f"   {band_name}: {band_gain:+.2f} dB")
    
    # Brightness
    input_centroid = np.mean(librosa.feature.spectral_centroid(y=input_audio, sr=sr))
    output_centroid = np.mean(librosa.feature.spectral_centroid(y=output_audio, sr=sr))
    print(f"\nBrightness: {input_centroid:.1f} Hz -> {output_centroid:.1f} Hz (change: {output_centroid - input_centroid:+.1f} Hz)")
    
    # Compression
    input_dynamic = np.max(input_audio) - np.min(input_audio)
    output_dynamic = np.max(output_audio) - np.min(output_audio)
    compression_ratio = input_dynamic / (output_dynamic + 1e-10)
    print(f"Compression: {compression_ratio:.2f}:1")
    
    return {
        "eq_curve": eq_curve,
        "freqs": freqs,
        "gain_db": 20*np.log10(output_rms/input_rms+1e-10),
        "brightness_change": output_centroid - input_centroid,
        "compression_ratio": compression_ratio
    }

if __name__ == "__main__":
    raw_path = r"C:\Users\mikha\Desktop\mixexamples\raw_vocal.wav"
    lead1_path = r"C:\Users\mikha\Desktop\SPLITMIXERTRACKS\mixedvocalsforsursor_LEAD 1.wav"
    lead2_path = r"C:\Users\mikha\Desktop\SPLITMIXERTRACKS\mixedvocalsforsursor_LEAD 2.wav"
    pcomp_path = r"C:\Users\mikha\Desktop\SPLITMIXERTRACKS\mixedvocalsforsursor_PCOMP.wav"
    
    # Analyze transformations
    raw_to_lead1 = analyze_transformation(raw_path, lead1_path, "RAW -> LEAD 1 (Autotune)")
    lead1_to_lead2 = analyze_transformation(lead1_path, lead2_path, "LEAD 1 -> LEAD 2 (Main Processing)")
    lead2_to_pcomp = analyze_transformation(lead2_path, pcomp_path, "LEAD 2 -> PCOMP (Parallel Compression)")
    
    print("\n" + "="*60)
    print("KEY INSIGHTS FOR MATCHING:")
    print("="*60)
    print(f"\nLEAD 1 -> LEAD 2:")
    print(f"  - RMS gain: {lead1_to_lead2['gain_db']:+.2f} dB (should be close to 0 or negative)")
    print(f"  - Brightness boost: {lead1_to_lead2['brightness_change']:+.1f} Hz")
    print(f"  - Compression: {lead1_to_lead2['compression_ratio']:.2f}:1")
    
    print(f"\nLEAD 2 -> PCOMP:")
    print(f"  - RMS gain: {lead2_to_pcomp['gain_db']:+.2f} dB (should be very negative - quiet parallel)")
    print(f"  - Compression: {lead2_to_pcomp['compression_ratio']:.2f}:1 (MASSIVE compression)")
