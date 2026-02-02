"""
Analyze FL Studio split mixer tracks to understand processing at each stage
"""

import numpy as np
import librosa
import os

def analyze_bus(bus_path: str, bus_name: str):
    """Analyze a single bus to understand its processing"""
    print(f"\n{'='*60}")
    print(f"ANALYZING: {bus_name}")
    print(f"{'='*60}")
    
    if not os.path.exists(bus_path):
        print(f"File not found: {bus_path}")
        return None
    
    audio, sr = librosa.load(bus_path, sr=44100, mono=True)
    
    # Basic stats
    rms = np.sqrt(np.mean(audio ** 2))
    peak = np.max(np.abs(audio))
    dynamic_range = np.max(audio) - np.min(audio)
    
    print(f"Length: {len(audio)/sr:.2f} seconds")
    print(f"RMS: {20*np.log10(rms+1e-10):.2f} dB")
    print(f"Peak: {20*np.log10(peak+1e-10):.2f} dB")
    print(f"Dynamic Range: {dynamic_range:.4f}")
    
    # Frequency analysis
    fft = np.fft.rfft(audio)
    freqs = np.fft.rfftfreq(len(audio), 1/sr)
    magnitude = np.abs(fft)
    
    # Analyze frequency bands
    bands = {
        "Low (20-200 Hz)": (20, 200),
        "Low-Mid (200-800 Hz)": (200, 800),
        "Mid (800-3000 Hz)": (800, 3000),
        "High-Mid (3000-8000 Hz)": (3000, 8000),
        "High (8000-20000 Hz)": (8000, 20000)
    }
    
    print(f"\nFrequency Energy:")
    for band_name, (low, high) in bands.items():
        mask = (freqs >= low) & (freqs <= high)
        if np.any(mask):
            band_energy = np.mean(magnitude[mask])
            band_db = 20 * np.log10(band_energy + 1e-10)
            print(f"   {band_name}: {band_db:.2f} dB")
    
    # Brightness
    centroid = np.mean(librosa.feature.spectral_centroid(y=audio, sr=sr))
    print(f"\nSpectral Centroid (brightness): {centroid:.1f} Hz")
    
    return {
        "audio": audio,
        "sr": sr,
        "rms_db": 20*np.log10(rms+1e-10),
        "peak_db": 20*np.log10(peak+1e-10),
        "dynamic_range": dynamic_range,
        "centroid": centroid,
        "magnitude": magnitude,
        "freqs": freqs
    }

def compare_stages(raw_path: str, lead1_path: str, lead2_path: str, pcomp_path: str):
    """Compare processing stages to understand what each does"""
    print("="*60)
    print("STAGE-BY-STAGE ANALYSIS")
    print("="*60)
    
    # Load raw
    raw, sr = librosa.load(raw_path, sr=44100, mono=True)
    raw_rms = np.sqrt(np.mean(raw ** 2))
    
    # Analyze each stage
    lead1 = analyze_bus(lead1_path, "LEAD 1 (Autotune)")
    lead2 = analyze_bus(lead2_path, "LEAD 2 (Main Processing)")
    pcomp = analyze_bus(pcomp_path, "PCOMP (Parallel Compression)")
    
    if lead1 and lead2:
        print(f"\n{'='*60}")
        print("LEAD 1 → LEAD 2 TRANSFORMATION")
        print(f"{'='*60}")
        gain = 20*np.log10(lead2["rms_db"]/lead1["rms_db"]+1e-10)
        print(f"RMS Gain: {gain:+.2f} dB")
        print(f"Brightness Change: {lead2['centroid'] - lead1['centroid']:+.1f} Hz")
    
    if lead2 and pcomp:
        print(f"\n{'='*60}")
        print("LEAD 2 → PCOMP TRANSFORMATION")
        print(f"{'='*60}")
        gain = 20*np.log10(pcomp["rms_db"]/lead2["rms_db"]+1e-10)
        print(f"RMS Gain: {gain:+.2f} dB")
        print(f"Brightness Change: {pcomp['centroid'] - lead2['centroid']:+.1f} Hz")
        print(f"Compression: PCOMP has {lead2['dynamic_range']/pcomp['dynamic_range']:.2f}x less dynamic range")
    
    return {
        "raw": raw,
        "lead1": lead1,
        "lead2": lead2,
        "pcomp": pcomp
    }

if __name__ == "__main__":
    base_path = r"C:\Users\mikha\Desktop\SPLITMIXERTRACKS"
    
    raw_path = r"C:\Users\mikha\Desktop\mixexamples\raw_vocal.wav"
    lead1_path = os.path.join(base_path, "mixedvocalsforsursor_LEAD 1.wav")
    lead2_path = os.path.join(base_path, "mixedvocalsforsursor_LEAD 2.wav")
    pcomp_path = os.path.join(base_path, "mixedvocalsforsursor_PCOMP.wav")
    short_verb_path = os.path.join(base_path, "mixedvocalsforsursor_SHORT VERB.wav")
    long_verb_path = os.path.join(base_path, "mixedvocalsforsursor_LONG VERB.wav")
    master_path = os.path.join(base_path, "mixedvocalsforsursor_Master.wav")
    
    # Analyze all buses
    print("Analyzing all mixer buses...")
    
    lead1 = analyze_bus(lead1_path, "LEAD 1")
    lead2 = analyze_bus(lead2_path, "LEAD 2")
    pcomp = analyze_bus(pcomp_path, "PCOMP")
    short_verb = analyze_bus(short_verb_path, "SHORT VERB")
    long_verb = analyze_bus(long_verb_path, "LONG VERB")
    master = analyze_bus(master_path, "MASTER")
    
    # Compare stages
    print("\n" + "="*60)
    print("STAGE COMPARISONS")
    print("="*60)
    
    raw, sr = librosa.load(raw_path, sr=44100, mono=True)
    raw_rms = np.sqrt(np.mean(raw ** 2))
    raw_rms_db = 20*np.log10(raw_rms+1e-10)
    
    if lead1:
        print(f"\nRAW -> LEAD 1:")
        print(f"   RMS Gain: {lead1['rms_db'] - raw_rms_db:+.2f} dB")
    
    if lead1 and lead2:
        print(f"\nLEAD 1 -> LEAD 2:")
        print(f"   RMS Gain: {lead2['rms_db'] - lead1['rms_db']:+.2f} dB")
        print(f"   Brightness: {lead2['centroid'] - lead1['centroid']:+.1f} Hz")
    
    if lead2 and pcomp:
        print(f"\nLEAD 2 -> PCOMP:")
        print(f"   RMS Gain: {pcomp['rms_db'] - lead2['rms_db']:+.2f} dB")
        print(f"   Compression Ratio: {lead2['dynamic_range']/pcomp['dynamic_range']:.2f}:1")
    
    print("\n" + "="*60)
    print("Analysis complete!")
    print("="*60)
